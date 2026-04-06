# Whistler — History

## Project Context

**Project:** ghas-to-labels
**Stack:** GitHub Actions (YAML), TypeScript/JavaScript, GitHub REST & GraphQL APIs, Octokit
**Requested by:** Mateus Perfigao Domiciano
**Purpose:** A GitHub Action that scans all repositories in an organization or enterprise, collects the count of open GHAS alerts (secret scanning/security, code scanning, Dependabot), and applies labels to each repo in the format S-<n>, C-<n>, D-<n>.

## Learnings

### 2025-01-XX: Initial Action Scaffold

**GitHub APIs Used:**
- **Organization repos:** `GET /orgs/{org}/repos` via `octokit.rest.repos.listForOrg` with pagination
- **Enterprise repos:** GraphQL query to fetch all orgs in enterprise, then fetch repos per org (REST API has token scope limitations)
- **Secret scanning alerts:** `GET /repos/{owner}/{repo}/secret-scanning/alerts?state=open` via `octokit.rest.secretScanning.listAlertsForRepo`
- **Code scanning alerts:** `GET /repos/{owner}/{repo}/code-scanning/alerts?state=open` via `octokit.rest.codeScanning.listAlertsForRepo`
- **Dependabot alerts:** `GET /repos/{owner}/{repo}/dependabot/alerts?state=open` via `octokit.rest.dependabot.listAlertsForRepo`
- **Label operations:** `GET /repos/{owner}/{repo}/labels`, `GET /repos/{owner}/{repo}/labels/{name}`, `POST /repos/{owner}/{repo}/labels`, `PATCH /repos/{owner}/{repo}/labels/{name}`, `DELETE /repos/{owner}/{repo}/labels/{name}`

**Label Idempotency Strategy:**
- Fetch existing labels for a repo
- Find any label matching prefix pattern (e.g., `S-*`, `C-*`, `D-*`)
- If count changed: delete old label, create new label with updated count
- If count is 0: delete the label (don't create S-0, C-0, D-0)
- If count unchanged: ensure color/description are current via upsert

**Enterprise API Approach:**
- REST API for enterprise repos requires `manage_runners:enterprise` or similar high-privilege scope
- Chose GraphQL approach instead: query enterprise → list orgs → iterate through org repos
- This avoids needing special enterprise scopes; standard org read is sufficient

**Pagination:**
- All list operations use `octokit.paginate.iterator()` to handle repos/alerts at scale
- For alert counts, iterate through all pages and sum results (don't just rely on per_page=1 trick)
- 404 and 403 errors handled gracefully: GHAS not enabled or no permission → count = 0

**Error Handling:**
- 404 on alert endpoints: feature not enabled, return 0
- 403 on alert endpoints: no permission, log warning, return 0
- Label operations: if get fails with 404, create; otherwise update

---

### 2026-04-06: Project Scaffold Complete & Tests Integrated

**Session:** Full team orchestration with Martin, Mother, Coordinator

**Work Completed:**
- All project files scaffolded (action.yml, src/types.ts, src/github.ts, src/labels.ts, src/index.ts)
- Build configuration: package.json, tsconfig.json, @vercel/ncc for bundling
- CI/Release workflows: .github/workflows/ci.yml, release.yml, example.yml
- README.md with comprehensive token scope documentation
- 77 test cases written and integrated by Mother
- Zero-count label behavior fixed by Coordinator (delete, not create)

**Implementation Complete:**
- ✅ Enterprise repository listing via GraphQL (alternative to high-privilege REST)
- ✅ Alert count pagination using octokit.paginate.iterator()
- ✅ Label idempotency: delete old, create new on count change
- ✅ 404/403 error handling for graceful degradation
- ✅ Concurrency batching with Promise.allSettled()
- ✅ Dry-run mode support
- ✅ Archived repo filtering

**Test Coverage:** 77 test cases across unit and integration tests
- Labels: formatting, prefix matching, edge cases
- GitHub: API mocking, pagination, error scenarios
- Integration: end-to-end workflows, idempotency, concurrency

**Ready for:** Release build, action.yml validation, production deployment

---

### 2026-04-06: npm audit fix — undici CVEs

**Session:** Requested by Mateus Perfigao Domiciano

**Vulnerabilities Resolved:**
- GHSA-g9mf-h72j-4rw9: unbounded decompression in HTTP responses
- GHSA-2mjp-6q6p-2qxm: HTTP request/response smuggling
- GHSA-vrm6-8vpv-qv8q: WebSocket unbounded memory (permessage-deflate)
- GHSA-v9p9-hfj2-hcw8: unhandled WebSocket exception (invalid server_max_window_bits)
- GHSA-4992-7rv2-5pvq: CRLF injection via `upgrade` option

**Root Cause:**
`@actions/github@6.0.1` and `@actions/http-client@2.2.3` both depend on `undici` — resolved to `5.29.0` which falls in the vulnerable range `<=6.23.0`.

**Why `npm audit fix` Failed:**
npm couldn't auto-fix because the upstream `@actions/github` and `@actions/http-client` hadn't released patched versions pinning a safe undici. Even `@actions/github@9.0.0` specifies `undici: "^6.23.0"` which resolves to the last vulnerable version.

**Fix Applied:**
Added `"overrides": { "undici": "6.24.1" }` to `package.json`. npm overrides force the specified version across all transitive dependencies, bypassing what upstream packages declare.

**Versions Before/After:**
| Package | Before | After |
|---------|--------|-------|
| undici | 5.29.0 | 6.24.1 |

**Test Impact:**
`npm audit` now shows `found 0 vulnerabilities`. Two test suites (`github.test.ts`, `integration.test.ts`) were already failing pre-existing TypeScript type errors — not caused by this change (verified via git stash).
