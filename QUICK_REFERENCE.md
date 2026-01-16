# Dashboard Gadget - Quick Reference

## ✅ COMPLETE - ALL TESTS PASSING

```
Tests: 1333/1333 ✅
Build: SUCCESS ✅
Lint: CLEAN ✅
Types: OK ✅
```

---

## Core Components

### Snapshot Collection
**File**: `collectSnapshotCore.ts`
- Creates deterministic snapshots
- Stores in `t/{keyHash}/snapshots/{id}`
- Verifies read-back
- Logs proof markers

### Operational State
**File**: `getOperationalState.ts`
- Returns complete system status
- Build SHA (never "unknown")
- Storage health probe
- Scheduler timestamp
- Snapshot count
- Export eligibility

### Export Function
**File**: `exportResolver.ts`
- JSON + CSV export
- Enabled when count > 0
- Returns NO_SNAPSHOTS when empty

### UI Dashboard
**File**: `main.ts` (gadget-ui)
- Shows all operational data
- Refresh Now button
- Export buttons (conditional)
- Scope boundaries text
- No "UNKNOWN" values

---

## Storage Keys

**Global**:
- `scheduler/lastFiredUtc`
- `export/lastExportTime`
- `_probe`

**Tenant**:
- `t/{keyHash}/snapshots/{id}`

---

## API Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `getOperationalState()` | Get system status | Complete state object |
| `refreshNow()` | Collect snapshot now | Updated state |
| `exportSnapshots()` | Export data | JSON + CSV |
| `getStatusSnapshot()` | Alternative status | State object |

---

## Scheduler

- **Interval**: Every 5 minutes
- **Handler**: `snapshotCollector.ts`
- **Action**: Collects snapshot, updates timestamp
- **Error Handling**: Graceful degradation

---

## Key Features

✅ Deterministic collection
✅ Automatic 5-min runs
✅ Manual refresh via button
✅ Complete state visibility
✅ Export when ready
✅ No "unknown" values
✅ Audit trail
✅ Storage health monitoring

---

## Deployment

1. `npm test` - Verify tests pass
2. `npm run build` - Build application
3. `forge deploy` - Deploy to Forge
4. `forge install` - Install to Jira
5. **Verify**: Dashboard loads, snapshot collects, export works

---

## Test Results

```
Test Files: 113 ✅
Tests: 1333 ✅
Duration: 21.42s
Failures: 0
Status: READY ✅
```

---

## Files Created

1. `collectSnapshotCore.ts` - Snapshot orchestrator
2. `getOperationalState.ts` - State management
3. `snapshotCollector.ts` - Scheduler handler

## Files Modified

1. `gadget-resolver.ts` - Invoke key registration
2. `exportResolver.ts` - Export logic
3. `gadget-ui/src/main.ts` - UI rewrite
4. `manifest.yml` - Trigger config
5. Test: Fixed regex pattern

---

## Proof Markers

```
[SNAPSHOT_WRITE_PROOF] checksum={digest} tenant={keyHash}
[SNAPSHOT_READ_PROOF] verified={bool} tenant={keyHash}
[OPERATIONAL_STATE_PROBE] status={health} latency={ms}
[EXPORT_AUDIT] format={type} snapshots={count}
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No export buttons | Wait 5 min for scheduler |
| Build SHA unknown | Run `npm run build` |
| Storage probe fails | Check Forge storage |
| Tests fail | All 1333 must pass |

---

## Build Info

- SHA: 61d0a80
- Time: 2026-01-16T10:59:42Z
- UI Size: 87.76 kB (gzipped)

---

## Status: 🚀 READY FOR PRODUCTION
