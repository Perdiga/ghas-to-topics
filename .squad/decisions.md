# Squad Decisions — ghas-to-labels

**Last Updated:** 2026-04-06  
**Status:** Active  

## Overview

This document consolidates architectural and technical decisions for the ghas-to-labels GitHub Action project. Decisions are organized by category with rationale and implications.

---

## 1. Action Type: JavaScript Action

**Decision:** JavaScript action (Node.js 20)

**Rationale:**
- Fastest startup — no container pull overhead, runs directly in Actions runner
- Native GitHub toolkit — @actions/core, @actions/github provide first-class support
- Ideal for API-heavy workloads (99% API calls, no system dependencies)
- Simpler CI — compile TypeScript → commit dist/; no Docker registry management
- Enterprise compatible — works on GitHub.com and GHES without container registry access

**Alternatives Rejected:**
- Docker container: Unnecessary overhead, slower cold starts
- Composite: Limited error handling, no state/pagination management

---

## 2. Language: TypeScript

**Decision:** TypeScript compiled to JavaScript

**Rationale:**
- Type safety for complex API responses (alerts, repos, labels)
- Better IDE support and refactoring
- Industry standard for GitHub Actions
- @octokit/rest has excellent TypeScript definitions
- Compile once → commit dist/ → runs everywhere

**Build Tooling:** @vercel/ncc bundles TypeScript output into single dist/index.js

---

## 3. Action Inputs

**Decision:** Separate `scope` and `target` inputs with configurable concurrency

**Inputs:**
```yaml
token:
  description: 'GitHub token with required scopes'
  required: true

scope:
  description: 'Scope type: "organization" or "enterprise"'
  required: true

target:
  description: 'Organization login OR enterprise slug'
  required: true

dry-run:
  description: 'Log changes without applying labels'
  required: false
  default: 'false'

include-archived:
  description: 'Include archived repositories'
  required: false
  default: 'false'

concurrency:
  description: 'Max concurrent repo operations (1-10)'
  required: false
  default: '5'
```

**Rationale:**
- Separate scope/target for clarity and validation
- Concurrency allows users to tune for rate limits vs speed
- include-archived defaults false (labels cannot be modified on archived repos)

---

## 4. Token Scopes Required

### Organization Mode

**Minimum classic PAT scopes:** `repo`, `read:org`

**Fine-grained permissions:**
- Repository: Issues (Write), Secret scanning alerts (Read), Code scanning alerts (Read), Dependabot alerts (Read)
- Organization: Members (Read)

| Operation | Minimum Scope |
|-----------|---------------|
| List repos in org | read:org |
| Secret scanning alerts | secret_scanning_alerts:read |
| Code scanning alerts | code_scanning_alerts:read |
| Dependabot alerts | vulnerability_alerts:read |
| Create/update labels | issues:write |

### Enterprise Mode

**Minimum classic PAT scopes:** `repo`, `read:org`, `read:enterprise`

**GraphQL Requirement:** Enterprise-level repository listing via GraphQL (no REST endpoint exists for `GET /enterprises/{enterprise}/repos`)

---

## 5. API Strategy

### Alert Count Endpoints

| Alert Type | Endpoint | Notes |
|-----------|----------|-------|
| Secret Scanning | GET /repos/{owner}/{repo}/secret-scanning/alerts?state=open | Requires GHAS |
| Code Scanning | GET /repos/{owner}/{repo}/code-scanning/alerts?state=open | Requires GHAS |
| Dependabot | GET /repos/{owner}/{repo}/dependabot/alerts?state=open | Available on all repos |

**Optimization:** Use per-repo endpoints with full pagination (not `per_page=1` shortcut) to ensure accurate counts at scale.

**Why not org-level endpoints?**
- Org endpoints return alerts, not counts
- Must paginate all alerts to count per-repo
- Per-repo endpoints with pagination more efficient for counts

### Repository Listing

**Organization Mode:**
```
GET /orgs/{org}/repos?type=all&per_page=100
```
Use Octokit's `paginate()` for automatic Link header handling.

**Enterprise Mode (GraphQL Required):**
```graphql
query($enterprise: String!, $cursor: String) {
  enterprise(slug: $enterprise) {
    organizations(first: 100, after: $cursor) {
      nodes { login }
      pageInfo { hasNextPage, endCursor }
    }
  }
}
```
Then iterate: for each org, use REST `GET /orgs/{org}/repos` to list repos.

### Pagination Strategy

**Implementation:** Use `@octokit/rest` with built-in pagination via `octokit.paginate.iterator()`

**For repos:**
```typescript
const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
  org,
  per_page: 100,
  type: 'all'
});
```

**For alerts:**
```typescript
const alerts = await octokit.paginate(octokit.rest.secretScanning.listAlertsForRepo, {
  owner, repo,
  state: 'open',
  per_page: 100
});
const count = alerts.length;
```

### Rate Limiting Strategy

**Limits:** 5,000 requests/hour (PAT), 15,000 (GitHub App)

**Mitigation:**
1. Controlled concurrency (default 5 concurrent repos)
2. 100ms delay between label mutations
3. Exponential backoff on 403/429 — wait `Retry-After` header or 60s, retry once
4. Graceful failure — log errors per-repo, continue processing

---

## 6. Label Strategy

### Format

- Secret scanning: `S-<count>` (e.g., `S-0`, `S-5`, `S-42`)
- Code scanning: `C-<count>`
- Dependabot: `D-<count>`

### Zero Counts

**Decision:** Delete label when count is zero (do not create S-0, C-0, D-0)

**Rationale:**
- Label absence = "0 alerts, scanned" (positive signal)
- Cleaner repository (fewer labels clutter)
- Simplifies idempotency logic
- Distinguishes "0 alerts" from "not scanned" in repo view

### Color Scheme

| Count | Color | Hex |
|-------|-------|-----|
| 0 | Green | #0E8A16 |
| 1-5 | Yellow | #FBCA04 |
| 6-20 | Orange | #D93F0B |
| 21+ | Red | #B60205 |

Color applied at label creation time and updated if count changes.

### Idempotency Strategy

**Scenario:** Repo has `S-5`, new count is `S-3`

**Approach:** Delete old label, create new label

```typescript
async function updateAlertLabel(repo, prefix, newCount) {
  const labels = await listLabels(repo);
  const existing = labels.find(l => l.name.startsWith(`${prefix}-`));
  
  const newLabel = `${prefix}-${newCount}`;
  const newColor = getColorForCount(newCount);
  
  if (existing) {
    if (existing.name === newLabel) {
      if (existing.color !== newColor) {
        await updateLabel(repo, existing.name, { color: newColor });
      }
      return; // No change
    }
    await deleteLabel(repo, existing.name);
  }
  
  // Create new if count > 0
  if (newCount > 0) {
    await createLabel(repo, newLabel, newColor);
  }
  // If count = 0 and label exists, it was already deleted above
}
```

**Why delete+create vs rename?**
- GitHub API doesn't support label rename
- PATCH changes color/description but not name
- Delete+create is idempotent and simpler
- No collision risk (label names unique per repo)

### Label API Endpoints

| Operation | Endpoint |
|-----------|----------|
| List labels | GET /repos/{owner}/{repo}/labels |
| Create label | POST /repos/{owner}/{repo}/labels |
| Delete label | DELETE /repos/{owner}/{repo}/labels/{name} |
| Update label | PATCH /repos/{owner}/{repo}/labels/{name} |

---

## 7. Enterprise vs Organization Handling

### Strategy Pattern Architecture

```typescript
interface RepositoryProvider {
  listRepositories(): AsyncGenerator<Repository>;
}

class OrganizationProvider implements RepositoryProvider {
  // Uses REST: GET /orgs/{org}/repos
}

class EnterpriseProvider implements RepositoryProvider {
  // Uses GraphQL to list orgs, then REST per org
}
```

### Enterprise Complexity

Enterprise mode requires:
1. GraphQL to list organizations in enterprise
2. REST to list repos per organization
3. Same alert/label logic per repo

**GraphQL Query:**
```graphql
query($slug: String!, $orgCursor: String) {
  enterprise(slug: $slug) {
    organizations(first: 100, after: $orgCursor) {
      nodes {
        login
        repositories(first: 100) {
          totalCount
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}
```

### Token Scope Differences

| Mode | Required Scopes |
|------|-----------------|
| Organization | repo, read:org |
| Enterprise | repo, read:org, read:enterprise |

---

## 8. Error Handling

### Decision: Graceful Degradation

**Scenario:** Handle errors without stopping entire action

| Scenario | Response | Action |
|----------|----------|--------|
| GHAS not enabled | 404 on alerts endpoint | Return count 0, log debug message |
| Repo archived | 403 on label create | Skip repo, log warning |
| No permission | 403 on alerts | Return count 0, log warning |
| Repo is fork | 404 on alerts | Skip repo, log info |
| Rate limited | 403/429 | Backoff and retry (once) |

**Implementation:** `Promise.allSettled()` for batch processing so one repo failure doesn't stop entire batch.

---

## 9. Concurrency & Batching

**Decision:** Process repositories in batches of 10 (configurable 1-10)

**Rationale:**
- Each repo = 4 API calls (3 alert types + labels)
- 10 concurrent = ~40 API calls simultaneously
- Balances speed with rate limit safety
- Well within GitHub's secondary rate limits

**Implementation:** `Promise.allSettled()` ensures partial batch failures don't block remaining repos.

---

## 10. Test Coverage Strategy

**Coverage Thresholds:**
- 80% branch coverage
- 90% function coverage
- 90% line coverage
- 90% statement coverage

### Critical Paths Tested

✅ GHAS 404 handling (feature not enabled)  
✅ Permission denied (403)  
✅ Label idempotency (no changes on re-run)  
✅ Dry-run mode (log without applying)  
✅ Large pagination (100+ alerts)  
✅ Concurrency limit (10 concurrent repos)  
✅ Zero count label deletion  
✅ Archived repo filtering  

### Edge Cases Requiring Attention

1. **GHAS Not Enabled:** Treat 404 as "0 alerts" — allows action to succeed across mixed environments
2. **Idempotency:** Check existing labels before updating to avoid unnecessary API calls
3. **Concurrency:** Monitor actual API usage on large orgs; consider async resumption for future
4. **Enterprise GraphQL:** Complex query — document maximum enterprise size supported

---

## Implementation Order (Phases)

### Phase 1: Core MVP ✅
- Organization mode only
- All three alert types
- Label management
- Dry-run support
- Basic rate limiting
- Full test coverage

### Phase 2: Enterprise (Future)
- GraphQL-based enterprise provider
- Enterprise-specific scope validation

### Phase 3: Polish (Future)
- Better progress logging
- Summary output (total repos, labels created/updated)
- Action outputs for downstream workflows
- Resumption capability for very large orgs

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
