# Storage Usage Inventory

**Auto-generated from:** Product facts extraction
**Generated at:** 2026-03-02T09:50:28Z
**Git SHA:** 19ac651b7693c1a445731f5bb59e237b428d89b7

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
