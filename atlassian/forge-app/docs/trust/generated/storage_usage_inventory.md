# Storage Usage Inventory

**Auto-generated from:** Product facts extraction
**Generated at:** 2026-03-02T09:27:11Z
**Git SHA:** a3505b4d242a86dc9d63b5cff30c8d58ed59d597

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
