# Martin — History

## Project Context

**Project:** ghas-to-labels
**Stack:** GitHub Actions (YAML), TypeScript/JavaScript, GitHub REST & GraphQL APIs
**Requested by:** Mateus Perfigao Domiciano
**Purpose:** A GitHub Action that scans all repositories in an organization or enterprise, collects the count of open GHAS alerts (secret scanning/security, code scanning, Dependabot), and applies labels to each repo in the format S-<n>, C-<n>, D-<n>.

## Learnings

### 2026-04-06: Architecture Design Complete

**Key decisions made:**

1. **Action type:** JavaScript action (Node.js 20) — fastest startup, native toolkit support, no Docker overhead
2. **Language:** TypeScript with `@vercel/ncc` bundling to single `dist/index.js`
3. **Inputs:** `token`, `scope` (org/enterprise), `target`, `dry-run`, `include-archived`, `concurrency`
4. **Token scopes:** Org mode needs `repo` + `read:org`; Enterprise adds `read:enterprise`
5. **API strategy:** Per-repo alert endpoints with Octokit pagination; count alerts, not list
6. **Label strategy:** `S-<n>`, `C-<n>`, `D-<n>` format; include zero counts; delete+create for updates
7. **Enterprise mode:** Requires GraphQL to list orgs (no REST endpoint for enterprise repos)
8. **Rate limiting:** Controlled concurrency (default 5), 100ms delay between writes, exponential backoff on 403/429
9. **Error handling:** Skip repos gracefully (GHAS not enabled, archived, no permission), log warnings, continue

**Critical discovery:** Enterprise repo listing has no REST API — must use GraphQL to enumerate orgs, then REST per org. This adds complexity; recommend enterprise as Phase 2.

**Color scheme for labels:**
- 0 alerts: Green (#0E8A16)
- 1-5: Yellow (#FBCA04)
- 6-20: Orange (#D93F0B)
- 21+: Red (#B60205)

---

### 2026-04-06: Architecture Finalized & Committed

**Session:** Full team orchestration with Whistler, Mother, Coordinator

**Work Completed:**
- Architecture design documented and merged into squad decisions
- Whistler completed all project scaffolding (TypeScript, action.yml, src/, tests)
- Mother wrote 77 comprehensive test cases
- Coordinator fixed zero-count label behavior (delete, not create)

**Key Decisions Confirmed:**
1. ✅ JavaScript action type selected (no Docker overhead)
2. ✅ TypeScript implementation with @vercel/ncc bundling
3. ✅ Label idempotency: delete+create strategy
4. ✅ **Critical Fix:** Zero counts now delete labels, not create S-0/C-0/D-0
5. ✅ Enterprise requires GraphQL for org listing
6. ✅ Concurrency batching (10 repos concurrent)

**Deliverables:**
- Complete TypeScript codebase
- 77 test cases with 80%+ branch coverage
- Comprehensive README with scope documentation
- All architectural decisions merged into decisions.md
- Orchestration logs created for each agent phase
- Session log documenting full team work

**Ready for:** CI/testing, deployment, user documentation review
