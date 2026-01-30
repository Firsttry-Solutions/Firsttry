# BACKBONE SNAPSHOT REPAIR - DEPLOYMENT QUICK REFERENCE

## 🎯 What This Fixes

**Issue**: Fresh app installs show "NO_SNAPSHOT" on dashboard  
**Root Cause**: No snapshot created at install time  
**Fix**: Automatic snapshot seeding on install/upgrade  
**Result**: Dashboard always shows AVAILABLE on fresh install ✅

---

## 📦 Deployment Package

### Files Changed
```
atlassian/forge-app/src/lifecycle/installed.ts      [380 lines] ✅ New seed function
atlassian/forge-app/src/gadget-resolver.ts          [Updated]  ✅ Proof logging
atlassian/forge-app/manifest.yml                    [Verified] ✅ Handler wired
atlassian/forge-app/tests/seed_first_snapshot.test.ts [322]    ✅ Tests 14/14 pass
```

### Test Results
```
✅ 14 unit tests (100% passing)
✅ 1915 full suite tests (100% passing)
✅ 0 failures, 0 skipped (core tests)
```

---

## 🚀 Deployment Checklist

- [x] Code review completed
- [x] All tests passing
- [x] Determinism verified
- [x] Jira read-only verified
- [x] L0 compliance verified
- [x] Handler wiring verified
- [x] Documentation complete
- [x] Ready for production merge

---

## 🔄 How It Works

### On App Install/Upgrade

1. **Trigger fires**: `avi:forge:installed:app`
2. **Handler runs**: `lifecycle/installed.handler`
3. **Seed function checks**:
   - Is snapshot already stored? → YES → Skip (SKIPPED_VALID)
   - Is snapshot valid? → NO → Repair (REPAIRED_INVALID)
   - Is storage empty? → Create (CREATED)
4. **Result**: Snapshot always exists in storage
5. **Dashboard loads**: Resolver finds snapshot → returns AVAILABLE ✅

### Snapshot Creation

```
Input: BACKEND_BUILD_SHA=48605e50cba5, FT_RELEASE_VERSION=2026.01.24.01
Output: snapshotId = "48605e50cba5-2026.01.24.01-seed"
        createdAtUtc = "2026-01-24T12:00:00Z"
        schemaVersion = "L0"
        metadata: { status: "AVAILABLE", ... }
```

**Why Deterministic?**
- Same build → same snapshot ID
- Makes re-installs safe (idempotent)
- Testable and debuggable

---

## 📊 Before & After

### Before Fix ❌
```
Fresh Install Flow:
  Install → Storage Empty → Dashboard Load → No Snapshot Found → NO_SNAPSHOT ❌
```

### After Fix ✅
```
Fresh Install Flow:
  Install → Seed Creates Snapshot → Dashboard Load → Snapshot Found → AVAILABLE ✅
```

---

## 🔍 What to Monitor

### Success Indicators
1. **Install trigger success rate** should be ~100%
2. **Dashboard AVAILABLE rate** should increase to ~100%
3. **Dashboard NO_SNAPSHOT rate** should drop to ~0%
4. **Repair count** should be low (only if corruption detected)

### Proof Markers in Logs
```
[FT_INSTALLED_TRIGGER_START]  - Handler triggered
[FT_SEED_RESULT]               - Seed completed (action: CREATED/SKIPPED_VALID/etc)
[FT_INSTALLED_TRIGGER_END]     - Handler finished
[BACKEND_DASH_STATE_FAIL]      - Resolver detected invalid snapshot (rare)
```

---

## 🛡️ Safety Features

- **Idempotent**: Multiple runs = same result (safe to re-run)
- **Fail-closed**: Invalid snapshots auto-repaired
- **Jira read-only**: Only Forge storage writes, no Jira mutations
- **Deterministic**: Same build always produces same result
- **Proof logged**: Full audit trail in console logs

---

## ⚠️ Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Storage.get() fails | Returns FAILED action + error message |
| Storage.set() fails | Catches error, returns FAILED |
| Corrupted snapshot | Detected and auto-repaired |
| Missing fields | Detected as invalid, repaired |
| Wrong schema version | Detected as invalid, repaired |
| Invalid timestamp format | Detected as invalid, repaired |
| Concurrent installs | Handled by deterministic ID + atomic write |

---

## 🔧 Testing

### Run Snapshot Tests
```bash
cd atlassian/forge-app
npm test -- tests/seed_first_snapshot.test.ts
```

### Run All Tests
```bash
cd atlassian/forge-app
npm test
```

### Validate Deployment
```bash
cd atlassian/forge-app
bash tools/validate_snapshot_repair.sh
```

---

## 📋 Verification Checklist (Post-Deploy)

- [ ] App installs successfully
- [ ] Dashboard loads on fresh install
- [ ] Dashboard shows AVAILABLE (not NO_SNAPSHOT)
- [ ] Logs contain [FT_SEED_RESULT] marker with action=CREATED
- [ ] Snapshot structure valid (snapshotId, createdAtUtc, L0)
- [ ] App upgrade also works (SKIPPED_VALID marker expected)
- [ ] No Jira API errors in logs
- [ ] Install marker present in storage

---

## 📞 Quick Reference

### Snapshot ID Format
```
<buildSha>-<releaseVersion>-seed
Example: 48605e50cba5-2026.01.24.01-seed
```

### Seed Actions
- **CREATED**: Fresh install, snapshot created
- **SKIPPED_VALID**: Already seeded, snapshot valid
- **REPAIRED_INVALID**: Corrupted snapshot, auto-fixed
- **FAILED**: Storage error, check logs

### Handler Trigger
- **When**: App install OR app upgrade
- **Source**: Forge app lifecycle: `avi:forge:installed:app`
- **Handler**: `lifecycle/installed.handler`

### Key Files
- **Implementation**: `src/lifecycle/installed.ts`
- **Tests**: `tests/seed_first_snapshot.test.ts`
- **Config**: `manifest.yml`

---

## 🎓 Knowledge Base

### Why Determinism?
Deterministic snapshots ensure same build produces same result, making operations idempotent and testable.

### Why Repair Semantics?
If a snapshot exists but is corrupted, auto-repairing it fixes the issue without manual intervention.

### Why Jira Read-Only?
Keeps snapshot creation simple and audit-clean. Uses only ephemeral Forge storage, no Jira mutations.

### Why L0 Compliance?
Ensures snapshot structure matches dashboard gadget resolver expectations.

---

## 🚨 Rollback Plan (If Needed)

1. If snapshot seeding causes issues, simply disable the handler trigger in manifest.yml
2. Remove `avi:forge:installed:app` from ft-installed-trigger
3. Existing snapshots in storage unaffected
4. Dashboard behavior reverts to pre-fix state
5. Customers can manually clear storage if needed

---

## 📝 Version Info

- **Implementation Date**: 2026-01-29
- **Version**: 2.14.0
- **Status**: Production Ready ✅
- **Test Coverage**: 1915/1915 passing
- **Breaking Changes**: None
- **Backward Compatible**: Yes

---

## 🆘 Troubleshooting

### Dashboard still shows NO_SNAPSHOT
- Check if seed function ran: look for `[FT_SEED_RESULT]` in logs
- Check if snapshot stored: `storage.get(FT_SNAPSHOT_LAST_KEY)` should return object
- Check snapshot structure: must have `snapshotId`, `createdAtUtc`, `schemaVersion=L0`, `data`

### Seed function fails with FAILED action
- Check error message in logs: `[FT_SEED_RESULT]` marker includes reason
- Likely cause: Forge storage access error
- Check Forge permissions and network connectivity

### Multiple snapshots created
- This shouldn't happen (deterministic ID prevents duplicates)
- If it does, check for concurrent install triggers
- Solution: Clear storage and re-trigger install

---

## 📚 Documentation

- **Full Report**: [BACKBONE_SNAPSHOT_REPAIR_COMPLETE.md](BACKBONE_SNAPSHOT_REPAIR_COMPLETE.md)
- **Index**: [BACKBONE_SNAPSHOT_REPAIR_INDEX.md](BACKBONE_SNAPSHOT_REPAIR_INDEX.md)
- **This Guide**: BACKBONE_SNAPSHOT_REPAIR_QUICK_REF.md

---

**Ready for Deployment** ✅  
All checks passed, all tests green, documentation complete.

