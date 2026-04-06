# GHAS Alert Topics

A GitHub Action that automatically applies repository topics with GitHub Advanced Security (GHAS) alert counts.

## What it does

This action scans all repositories in a GitHub organization or enterprise and sets topics indicating the count of open security alerts:

- `ghas-secret-<n>` — Secret scanning alerts
- `ghas-code-<n>` — Code scanning alerts
- `ghas-dependabot-<n>` — Dependabot alerts

Topics are updated automatically on each run. Non-GHAS topics on a repository are preserved untouched.

## Required Token Scopes

### Classic token (`ghp_*`)

- `security_events` — to read GHAS alert counts
- `read:org` — to list organization repositories
- `public_repo` — to update topics on repositories (use `repo` for private repos)

For enterprise usage, the token must also have enterprise-level permissions.

### Fine-grained personal access token (`github_pat_*`)

Fine-grained tokens are scoped to specific organizations or repositories. Configure these permissions:

| Permission | Access | Why |
|------------|--------|-----|
| **Repository permissions** | | |
| `Administration` | Write | Update repository topics |
| `Code scanning alerts` | Read | Read code scanning alert counts |
| `Secret scanning alerts` | Read | Read secret scanning alert counts |
| `Dependabot alerts` | Read | Read Dependabot alert counts |
| `Metadata` | Read (mandatory) | Required by GitHub for all fine-grained tokens |

> **Note 1:** When creating the token, set the resource owner to your organization and grant access to **All repositories** (or the specific repos you want to update).
>
> **Note 2:** Fine-grained tokens do not support enterprise-level scopes. For enterprise usage, a classic token is required.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `token` | Yes | — | GitHub token with appropriate scopes |
| `organization` | No | — | GitHub organization name (mutually exclusive with `enterprise`) |
| `enterprise` | No | — | GitHub Enterprise slug (mutually exclusive with `organization`) |
| `dry-run` | No | `false` | If `true`, logs what would happen without applying topics |

## Outputs

| Output | Description |
|--------|-------------|
| `repositories-processed` | Number of repositories processed |
| `topics-applied` | Number of repositories whose topics were updated |

## Usage

### For an organization

```yaml
name: GHAS Alert Topics
on:
  workflow_dispatch:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6am UTC

jobs:
  topics:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: your-org/ghas-to-labels@v1
        with:
          token: ${{ secrets.GHAS_TOKEN }}
          organization: your-org-name
```

### For an enterprise

```yaml
- uses: your-org/ghas-to-labels@v1
  with:
    token: ${{ secrets.ENTERPRISE_TOKEN }}
    enterprise: your-enterprise-slug
```

### Dry run mode

```yaml
- uses: your-org/ghas-to-labels@v1
  with:
    token: ${{ secrets.GHAS_TOKEN }}
    organization: your-org-name
    dry-run: 'true'
```

## Topic Format

Topics follow the pattern `ghas-{type}-{count}`:

- `ghas-secret-5` — 5 open secret scanning alerts
- `ghas-code-12` — 12 open code scanning alerts
- `ghas-dependabot-3` — 3 open Dependabot alerts

If a repository has 0 alerts for a given type, no topic is applied. If the count drops to 0, the existing topic is removed.

## Behavior

- **Archived repositories are skipped**
- **Non-GHAS topics are preserved** — only `ghas-*` topics are managed; existing topics like `javascript` or `api` are left alone
- **Idempotent** — running multiple times with the same counts won't update topics unnecessarily
- **Counts change automatically** — if a repo had `ghas-secret-5` and now has 3 alerts, `ghas-secret-3` replaces it
- **Processes repos in batches** — concurrency limit of 10 to respect API rate limits
- **Handles missing permissions gracefully** — if GHAS is not enabled on a repo, it's counted as 0 alerts

## Development

```bash
# Install dependencies
npm install

# Build the action
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

**Important:** The compiled `dist/` folder must be committed to the repository for the action to work.

## License

MIT
