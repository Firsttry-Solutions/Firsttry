# Data Classification & Inventory

This document describes what FirstTry stores and what it does not store.

## Stored (Forge tenant-scoped storage)
FirstTry may store:
- Jira accountId references (identifiers, not passwords)
- Access metadata (roles/permissions context as retrieved via read APIs)
- Drift events (Phase 2/monitoring metadata)
- Review workflow metadata (approvals/decisions/exceptions metadata)
- Owner registry entries (informational ownership mapping, not enforcement)
- Deterministic export metadata fields (build identifiers, schema versions, etc.)

## Not stored (explicit exclusions)
FirstTry does NOT store:
- Jira issue bodies
- Comments
- Attachments
- Issue descriptions
- File contents
- Credentials

No Jira issue body, comment, or attachment content is persisted.

## Field-Level Inventory
- snapshotId
- accountId references
- drift events
- review decisions
- owner registry entries
- timestamps (visible for audit trails, but excluded from deterministic hash inputs where required)
- metadata fields (schemaVersion, buildShaShort, etc.)

## Storage inventory reference
A detailed key-level inventory is maintained here:
- [docs/storage-inventory.md](storage-inventory.md)

References:
- Data flow: [data-flow.md](data-flow.md)
- Whitepaper: [security-whitepaper.md](security-whitepaper.md)
