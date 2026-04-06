# GHAS Alert Labels

A GitHub Action that automatically labels repositories with their GitHub Advanced Security (GHAS) alert counts.

## What it does

This action scans all repositories in a GitHub organization or enterprise and applies labels indicating the count of open security alerts:

- `S-<n>` — Secret scanning alerts
- `C-<n>` — Code scanning alerts  
- `D-<n>` — Dependabot alerts

Labels are updated automatically, so if alert counts change, the labels will reflect the new counts on the next run.

## Required Token Scopes

The GitHub token must have:
- `security_events:read` — to read GHAS alert counts
- `read:org` — to list organization repositories
- `repo` or `public_repo` — to create/update labels on repositories

For enterprise usage, the token must also have enterprise-level permissions.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `token` | Yes | — | GitHub token with appropriate scopes |
| `organization` | No | — | GitHub organization name (mutually exclusive with `enterprise`) |
| `enterprise` | No | — | GitHub Enterprise slug (mutually exclusive with `organization`) |
| `dry-run` | No | `false` | If `true`, logs what would happen without applying labels |
| `label-color-security` | No | `d73a4a` | Hex color for secret scanning labels (S-*) |
| `label-color-code` | No | `e4e669` | Hex color for code scanning labels (C-*) |
| `label-color-dependabot` | No | `0075ca` | Hex color for Dependabot labels (D-*) |

## Outputs

| Output | Description |
|--------|-------------|
| `repositories-processed` | Number of repositories processed |
| `labels-applied` | Number of labels applied or updated |

## Usage

### For an organization

```yaml
name: GHAS Alert Labels
on:
  workflow_dispatch:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6am UTC

jobs:
  label:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: read
      issues: write
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: your-org/ghas-to-labels@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
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
    token: ${{ secrets.GITHUB_TOKEN }}
    organization: your-org-name
    dry-run: 'true'
```

## Label Format

Labels follow the pattern `{PREFIX}-{COUNT}`:

- `S-5` — 5 open secret scanning alerts
- `C-12` — 12 open code scanning alerts
- `D-3` — 3 open Dependabot alerts

If a repository has 0 alerts for a given type, no label is applied. If the count decreases to 0, the existing label is removed.

## Behavior

- **Archived repositories are skipped** — they will not be labeled
- **Labels are idempotent** — running multiple times with the same counts won't create duplicates
- **Old labels are replaced** — if a repo had `S-5` and now has 3 alerts, `S-5` is deleted and `S-3` is created
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
