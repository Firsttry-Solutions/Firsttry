# FirstTry Governance - Atlassian Forge App

Dashboard gadget providing operational transparency for governance monitoring.

## Structure

```
atlassian/forge-app/
├── manifest.yml          # Jira Cloud app manifest (permissions + modules)
├── src/
│   ├── gadget-ui/       # Dashboard gadget UI (React)
│   ├── ops/             # Heartbeat recording + cadence gate logic
│   └── index.ts         # Entry point
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
└── README.md            # This file
```

## Modules

### Dashboard Gadget (`governance-dashboard-gadget`)
- Displays operational metrics and heartbeat status
- Read-only interface: shows platform trigger interval (5 min) and meaningful check cadence (15 min)
- Data availability disclosure: shows UNKNOWN fields with reason codes (STORAGE_EMPTY, NOT_YET_OBSERVED, NOT_DECLARED)
- Two-layer timing transparency: separates platform trigger pings from meaningful cadence checks

## Scheduling

- **Platform trigger interval**: 5 minutes (Forge `scheduledTrigger` minimum)
- **Meaningful check cadence**: 15 minutes (enforced by storage-based cadence gate)
- **Staleness threshold**: 30 minutes (2 × 15-minute cadence)

No admin actions are required. All metric collection occurs automatically.

## Permissions

| Permission | Scope | Purpose |
|-----------|-------|---------|
| `storage:app` | read, write | Heartbeat metrics storage (Forge Storage) |
| `read:jira-work` | read | Read project/issue metadata |

## Installation (Dev)

```bash
# Login to Atlassian (requires API token)
forge login

# Install to dev site
forge install -e development --site <YOUR_DEV_SITE>

# View logs
forge logs --follow
```

## Documentation

See `docs/` directory for detailed documentation:
- `HEARTBEAT_TRUST_DASHBOARD.md` — Complete reference
- `HEARTBEAT_DELIVERY_SUMMARY.md` — Executive summary
- `HEARTBEAT_QUICK_REF.md` — Quick reference guide
