# FirstTry Storage Inventory

This document enumerates all Forge storage keys used by the FirstTry application.

## Storage Key Registry

| Storage Key | Purpose | Data Category | Retention Behavior | Deterministic | Source |
|------------|---------|------------|-----------|--------------|--------|
| firsttry:request:metadata | Request state and metadata | Operational | 30 days | Yes | src/storage/requestStore.ts |
| firsttry:decision:status | Decision tracking and status | Operational | 90 days | Yes | src/storage/decisionStore.ts |
| firsttry:owner:registry | Owner association registry | Reference | 7 days | Yes | src/storage/ownerRegistry.ts |
| firsttry:cache:summary | Computed summary cache | Transient | 1 day | Yes | src/storage/cacheStore.ts |

## Verification

All keys listed above are:
- ✅ Enumerated in source code
- ✅ Registered in test enforcement (storageKeyRegistry.spec.ts)
- ✅ Scanned by extract_storage_keys.sh
- ✅ Verified complete by verify_storage_inventory_complete.sh

## Adding New Keys

To add a new storage key:
1. Define in source code with clear naming: `firsttry:domain:purpose`
2. Add row to table above with full detail
3. Implement test in tests/security/storageKeyRegistry.spec.ts
4. Ensure verify_storage_inventory_complete.sh passes in CI

---

**Version**: 4.2.1  
**Last Updated**: 2026-02-16
