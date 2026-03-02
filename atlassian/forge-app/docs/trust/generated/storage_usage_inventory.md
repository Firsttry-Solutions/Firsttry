# Storage Usage Inventory

**Auto-generated from:** Product facts extraction
**Generated at:** 2026-03-02T09:35:22Z
**Git SHA:** 4ad0495173829a83dace7a7db60a7c1c245483a4

<!-- BEGIN: GENERATED -->

This file documents Forge storage API usage detected in the codebase.

## Storage API Calls

**Detected storage API calls in `src/**`:** 100

The app uses Forge's built-in storage API (`storage.set()`, `storage.get()`) for:

- App configuration persistence
- Audit trail / activity log
- User preferences (if applicable)

**Isolation:** Forge storage is app-scoped and isolated per installation.
**Encryption:** Managed by Atlassian Forge platform (encryption at rest).
**Retention:** See [data-retention-deletion.md](../data-retention-deletion.md)

<!-- END: GENERATED -->
