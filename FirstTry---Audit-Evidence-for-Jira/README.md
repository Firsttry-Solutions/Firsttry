# FirstTry Audit Evidence for Jira

**Version**: 2.14.0  
**Platform**: Jira Cloud  
**Runtime**: Atlassian Forge

---

## What This App Does

This app provides a **read-only dashboard gadget** for Jira Cloud that displays a governance snapshot summary. The snapshot contains audit evidence metadata derived from your Jira work data.

### Key Capabilities

- Displays governance dashboard gadget in Jira Dashboards
- Reads Jira work metadata (project info, issue counts, workflow states)
- Stores governance snapshots in Forge platform storage
- Automatically seeds initial snapshot on install and upgrade

### What This App Does NOT Do

- ❌ **No write operations** - Read-only app (no `write:jira-work` scope)
- ❌ **No automation** - No scheduled background jobs
- ❌ **No webhooks** - No HTTP endpoints exposed
- ❌ **No enforcement** - Does not prevent or block any Jira operations
- ❌ **No external network requests** - All processing within Atlassian Forge sandbox

---

## Installation

1. Install from Atlassian Marketplace
2. App automatically seeds initial governance snapshot on first install
3. Add the "FirstTry: Audit Evidence for Jira" gadget to any Jira Dashboard
4. No manual configuration required

**Requirements**:
- Jira Cloud instance
- User must have permission to add dashboard gadgets

---

## Permissions Required

This app requests **minimal scopes**:

### `storage:app`
- **Purpose**: Store governance snapshots within Forge platform storage
- **Data Stored**: 
  - Governance snapshot at key `ft:snapshot:last:v1`
  - Install timestamp marker at key `ft:install:marker:v1`
  - Audit ledger at key `ft:ledger:v1`
- **Location**: Atlassian Forge platform storage (within your Jira Cloud infrastructure)
- **Retention**: Data persists while app is installed; automatically deleted on uninstall

### `read:jira-work`
- **Purpose**: Read Jira work items to generate governance dashboard data
- **Data Accessed**: Project metadata, issue counts, workflow states
- **Mutations**: NONE - This scope provides read-only access
- **Security**: API calls execute with installing user's permissions

---

## Data Handling

### What Data Is Stored
- Governance snapshot metadata (JSON object with schema version "L0")
- Install/upgrade timestamp markers
- Snapshot IDs (deterministic format: `buildSha-releaseVersion-phase`)

### What Data Is NOT Stored
- ❌ No personal identifiable information (PII)
- ❌ No user credentials
- ❌ No Jira issue content (only metadata aggregates)
- ❌ No data in external databases

### Storage Location
All data stored in **Atlassian Forge Platform Storage** (managed by Atlassian). No external databases or third-party storage services are used.

### Data Deletion
- **On uninstall**: All Forge storage automatically deleted by Forge platform
- **Manual deletion**: Not currently supported (Forge platform limitation)

---

## Privacy & Security

- **No analytics or tracking** - No telemetry sent to external services
- **No external egress** - All network requests limited to Jira APIs via Forge SDK
- **Read-only operations** - No write, delete, or admin scopes
- **Sandboxed execution** - Runs on Atlassian Forge platform (isolated environment)
- **No third-party data sharing** - Data processed by Atlassian Forge platform only

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for detailed privacy information.

---

## Lifecycle Behavior

### On First Install
1. App triggers install lifecycle handler
2. Automatically seeds initial governance snapshot
3. Snapshot stored at `ft:snapshot:last:v1`
4. Dashboard gadget becomes immediately available

### On Upgrade
1. App triggers upgrade lifecycle handler
2. Validates existing snapshot
3. Repairs invalid snapshots if needed
4. Ensures backward compatibility

### Deterministic Snapshot IDs
- Generated from git commit SHA + internal release version
- Format: `{buildSha}-{releaseVersion}-{phase}`
- Same code version always generates same snapshot ID
- Enables reproducible debugging

**Note**: Snapshots are NOT immutable. Snapshot data can be updated on upgrade.

---

## Support

**Support Email**: `support@firsttry.run`

**Response Time**: Support requests acknowledged within 2 business days.

See [SUPPORT.md](SUPPORT.md) for details on how to submit support requests.

---

## Documentation

- [PRIVACY_POLICY.md](PRIVACY_POLICY.md) - Data handling, storage, and privacy practices
- [SECURITY.md](SECURITY.md) - Security posture and vulnerability reporting
- [SUPPORT.md](SUPPORT.md) - Support contact and request guidelines
- [SUBPROCESSORS.md](SUBPROCESSORS.md) - Third-party data processors (none)
- [VERSIONING.md](VERSIONING.md) - Version numbering system explanation
- [CHANGELOG.md](CHANGELOG.md) - Release history

---

## Version Information

This app uses multiple version identifiers:

- **Marketplace Version**: 2.14.0 (marketplace-locked; internal deploy version in `package.json` is 2.14.0 — see VERSIONING.md for the distinction)
- **Forge Deploy Version**: Deployment counter (e.g., 4.19.0, increments per deploy)
- **Internal Release Marker**: Date-based marker (e.g., 2026.01.24.01, appears in logs)

See [VERSIONING.md](VERSIONING.md) for detailed explanation of the version numbering system.

---

## Technical Architecture

**Platform**: Atlassian Forge (serverless)  
**Runtime**: Node.js 20.20.0  
**UI Framework**: Forge Custom UI  
**API**: `@forge/api`, `@forge/resolver`, `@forge/bridge`

**Manifest Configuration**:
- Module: `jira:dashboardGadget`
- Lifecycle triggers: `avi:forge:installed:app`, `avi:forge:upgraded:app`
- No scheduled triggers
- No web triggers (no HTTP endpoints)

---

## Known Limitations

- Snapshot export feature not currently available
- Manual snapshot deletion not supported (Forge platform limitation)
- Snapshot data updated on upgrade (not immutable)

---

## License

Proprietary. Licensed to customers via Atlassian Marketplace subscription.

---

**Maintained by**: FirstTry Solutions  
**Last Updated**: 2026-02-10
