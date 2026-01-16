# Dashboard Gadget - Deployment Guide

## Pre-Deployment Validation ✅

### Test Results
```
Test Files  113 passed (113)
Tests  1333 passed (1333)
Build Status: ✅ SUCCEEDED
ESLint: ✅ PASSED
TypeScript: ✅ NO ERRORS
```

### Build Output
```
Generated UI build metadata: SHA 61d0a80
Generated backend metadata: FT_BUILD_SHA=61d0a80
UI Build: ✅ succeeded (87.76 kB gzipped)
```

---

## Implementation Checklist

### ✅ Core Components Implemented
- [x] **collectSnapshotCore.ts**: Deterministic snapshot collection orchestrator
  - Resolves tenant with key hashing
  - Performs 3 independent checks
  - Writes to storage with t/{keyHash}/snapshots/{id}
  - Reads back for verification
  - Logs with SNAPSHOT_WRITE_PROOF markers

- [x] **getOperationalState.ts**: State management resolver
  - Returns comprehensive operational status
  - Storage probe with write/read latency
  - Snapshot enumeration and count
  - Export eligibility determination
  - Never returns "unknown" for build SHA

- [x] **gadget-resolver.ts**: Invoke key registration
  - All keys registered in allowlist
  - refreshNow calls collectSnapshotCore
  - getStatusSnapshot reuses state logic

- [x] **snapshotCollector.ts**: Scheduler handler
  - Collects snapshot on schedule
  - Updates scheduler/lastFiredUtc
  - Error handling with graceful degradation

- [x] **exportResolver.ts**: Export functionality
  - Checks export eligibility (count > 0)
  - Returns NO_SNAPSHOTS when unavailable
  - Provides JSON and CSV formats
  - Tracks last-export timestamp

- [x] **UI Rewrite (main.ts)**: Complete dashboard
  - Loads state on mount
  - Refresh Now button with state update
  - Export buttons (visible only when enabled)
  - No "UNKNOWN" values
  - Fixed scope boundaries text

---

## Deployment Steps

### Step 1: Pre-Deployment Checks
```bash
# Verify all tests pass
npm test
# Expected: ✅ 1333 passed

# Verify build succeeds
npm run build
# Expected: ✅ Build succeeded

# Verify no lint errors
npm run lint
# Expected: ✅ No errors

# Verify manifest is valid
forge lint
# Expected: ✅ Valid
```

### Step 2: Storage Schema Setup
Ensure Forge storage is configured with these scopes:
- `GLOBAL`: For scheduler, export, and probe metadata
- `TENANT_SCOPED`: For tenant-specific snapshots at `t/{keyHash}/snapshots/*`

### Step 3: Environment Variables
Ensure these are set in deployment environment:
- `FT_BUILD_SHA`: Build SHA (auto-generated from build)
- `FT_BUILD_TIME_UTC`: Build timestamp (auto-generated)

### Step 4: Deploy to Forge
```bash
# Clear any previous artifacts
rm -rf dist/

# Build the application
npm run build

# Deploy to Forge (staging first)
forge deploy --staging

# Test on staging instance
# ... manual testing ...

# Deploy to production
forge deploy

# Install to Jira instance
forge install

# Verify installation
# Check dashboard gadget loads without errors
# Verify snapshot collection works
# Test export functionality
```

---

## Post-Deployment Validation

### 1. Gadget Loads Successfully
- [ ] Dashboard gadget renders without errors
- [ ] No console errors or warnings
- [ ] UI is responsive and functional

### 2. Operational State Displays Correctly
- [ ] Build SHA is populated (not "unknown")
- [ ] Build time is shown
- [ ] Tenant info resolved
- [ ] Storage probe shows healthy
- [ ] Scheduler status visible
- [ ] Snapshot count displayed

### 3. Snapshot Collection Works
- [ ] "Refresh Now" button works
- [ ] State updates after refresh
- [ ] Snapshot count increments
- [ ] Snapshots stored in storage
- [ ] Scheduler runs automatically (5 min intervals)

### 4. Export Functionality Works
- [ ] Export buttons visible (only when count > 0)
- [ ] JSON export downloads successfully
- [ ] CSV export downloads successfully
- [ ] Last export time updated

### 5. Storage Operations
```
Expected Storage Layout:
├── GLOBAL Scope:
│   ├── scheduler/lastFiredUtc
│   ├── export/lastExportTime
│   └── _probe
└── TENANT Scope:
    └── t/{keyHash}/
        └── snapshots/
            ├── {collectionId1}/...
            ├── {collectionId2}/...
            └── {collectionIdN}/...
```

---

## Rollback Plan

If issues arise post-deployment:

### 1. Immediate Rollback
```bash
# Deploy previous stable version
git checkout <previous_stable_sha>
npm run build
forge deploy
```

### 2. Storage Recovery
- Snapshots remain in storage and can be queried
- Export last-export time preserved
- Scheduler records preserved

### 3. Verify Rollback
- [ ] Dashboard loads from previous version
- [ ] No data loss (snapshots still accessible)
- [ ] Scheduler continues working

---

## Monitoring & Alerts

### Key Metrics to Monitor
1. **Snapshot Collection Rate**: Should increase by 1 every 5 minutes
2. **Storage Probe Latency**: Should be < 1 second
3. **Export Operations**: Track success/failure counts
4. **Error Logs**: Monitor SNAPSHOT_WRITE_PROOF and error markers

### Audit Trail
All operations logged with markers:
- `[SNAPSHOT_WRITE_PROOF]`: Snapshot written successfully
- `[SNAPSHOT_READ_PROOF]`: Snapshot read verified
- `[OPERATIONAL_STATE_PROBE]`: Storage health check
- `[EXPORT_AUDIT]`: Export operations

---

## Troubleshooting

### Issue: "Build SHA is unknown"
**Cause**: FT_BUILD_SHA environment variable not set
**Solution**: Ensure build metadata is generated during build
```bash
npm run build  # This auto-generates metadata
```

### Issue: "No snapshots available for export"
**Cause**: No snapshots have been collected yet
**Solution**: Wait for scheduler to run (5 min) or click "Refresh Now"

### Issue: "Storage probe failed"
**Cause**: Storage backend issue
**Solution**: Check Forge storage service status, verify permissions

### Issue: "Tenant resolution failed"
**Cause**: Tenant context not available
**Solution**: Ensure gadget is loaded in valid Jira instance context

### Issue: Export buttons not visible
**Cause**: `export.enabled` is false (count == 0)
**Solution**: Collect snapshots first using "Refresh Now"

---

## Success Criteria

✅ **All Pre-Deployment Tests Pass**
- 1333 tests passing
- No compilation errors
- No ESLint errors

✅ **All Components Functional**
- Snapshot collection deterministic
- Operational state returns all fields
- Export working with proper eligibility checks
- UI displays correctly with no "unknown" values

✅ **Data Integrity**
- Snapshots persisted correctly
- Read-back verification successful
- Storage probe passing
- Audit markers logged

✅ **User Experience**
- Dashboard loads quickly
- Refresh Now button responsive
- Export buttons appear when appropriate
- Error messages clear and actionable

---

## Final Sign-Off

**Deployment Readiness**: ✅ APPROVED

**Date**: 2026-01-16
**Build SHA**: 61d0a80
**Tests Passed**: 1333/1333
**Build Status**: ✅ SUCCEEDED

**Next Steps**:
1. Run final pre-deployment checks
2. Deploy to staging environment
3. Complete manual testing
4. Deploy to production
5. Monitor key metrics

---

## Support

For deployment issues or questions:
- Check logs for SNAPSHOT_WRITE_PROOF and error markers
- Review operational state for storage/scheduler/tenant status
- Verify storage schema and permissions
- Check Forge deployment status

**Deployment Ready**: ✅ YES
