# FirstTry Governance - Atlassian Forge App

PHASE 0 Scaffold: Minimal static UI modules for Jira Cloud.

## Structure

```
atlassian/forge-app/
├── manifest.yml          # Jira Cloud app manifest (permissions + modules)
├── src/
│   └── index.ts         # Entry point (admin page + issue panel handlers)
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
└── README.md            # This file
```

## Modules

### Admin Page (`firstry-admin-page`)
- Global settings/status page
- PHASE 0: Static "FirstTry Governance: Installed" message
- Future: Configuration, run history, alerts configuration

### Issue Panel (`firstry-issue-panel`)
- Panel on Jira issues
- PHASE 0: Static "FirstTry Governance Panel" message
- Future: Display governance status, linked runs, issue properties

## Permissions (Minimal, Sufficient for Future Phases)

| Permission | Scope | Purpose |
|-----------|-------|---------|
| `storage` | read, write | Config, event cache, run ledgers |
| `jira:read` | read:jira-work, read:issue-details:jira | Read project metadata, issues |
| `jira:write` | write:jira-work, write:issues:jira | Create alert issues (Phase 1+) |
| `jira:read-write` | read/write:issue-property:jira | Issue metadata |

## Installation (Dev)

```bash
# Login to Atlassian (requires API token)
forge login

# Install to dev site
forge install -e development --site <YOUR_DEV_SITE>

# View logs
forge logs --follow
```

## Deployment

See `docs/ATLASSIAN_DUAL_LAYER_SPEC.md` for full deployment model.

## PHASE 0 Notes

- **No ingestion implemented**: Modules are static only.
- **No storage writes**: Storage permissions defined but not used.
- **No scheduling**: Scheduler triggers defined in spec but not implemented.
- **No agent integration**: Agent changes deferred to Phase 1+.

Next: See evidence pack `audit_artifacts/atlassian_dual_layer/phase_0_evidence.md`.
