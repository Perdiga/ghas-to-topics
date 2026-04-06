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

**Concurrency & Rate Limits:**
- Process repos in batches of 10 (concurrency limit) to avoid overwhelming the API
- Use `Promise.allSettled()` to handle partial failures without stopping entire batch

**Error Handling:**
- 404 on alert endpoints: feature not enabled, return 0
- 403 on alert endpoints: no permission, log warning, return 0
- Label operations: if get fails with 404, create; otherwise update
