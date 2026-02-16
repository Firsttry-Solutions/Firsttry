# Dashboard Contract Truth Fix Verification Guide

**Version**: v4.2.2.4-dashboard-contract-fix  
**Date**: 2026-02-16T15:30:44Z  
**Commit**: fb5a3428 (see git log for full details)

## Overview

This guide walks through verification of 3 production correctness fixes applied to the dashboard gadget. All fixes include deterministic proof markers that can be observed in logs.

### Fixes Applied

1. **Backend dashboardContext**: Replaced "MISSING" string placeholders with `null` + `contextReasonCode` field
2. **UI Export Kind Mapping**: Fixed snapshotKind resolution to prioritize backend data (prevent UNKNOWN when data available)
3. **UI Identity Final Marker**: Clarified identity source, renamed `ui_bundle_hash` to `ui_dist_stamp`, added consistency check

---

## Manual Verification Procedure

### Prerequisite Setup

Ensure you have:
- Jira instance with FirstTry gadget (v4.2.2.4+) installed
- Browser developer console open (F12)
- Access to atlassian forge logs (if available)

### Step 1: Verify Backend dashboardContext Contract (FT_DASHBOARD_CONTEXT_CONTRACT_OK)

**Objective**: Confirm backend never returns "MISSING" strings; uses null + contextReasonCode instead.

**Instructions**:

1. Open Jira with FirstTry gadget loaded
2. Open browser Console (F12 → Console tab)
3. Look for marker: `[FT_DASHBOARD_CONTEXT_CONTRACT_OK]`
4. Verify logged JSON contains:
   ```json
   {
     "marker": "[FT_DASHBOARD_CONTEXT_CONTRACT_OK]",
     "dashboardId": null | "12345",  // Either null or valid dashboard ID
     "tenantHashPrefix": null | "abc123...",  // Either null or 12-char hash
     "dashboardPath": null | "/jira/dashboards/12345",  // Either null or path
     "contextReasonCode": "DASHBOARD_CONTEXT_UNAVAILABLE" | undefined,  // Optional reason if null
     "ts": "2026-02-16T15:30:44.123Z"
   }
   ```

**Expected Results**:
- ✅ `dashboardId` is NEVER the string "MISSING"
- ✅ `dashboardPath` is NEVER the string "MISSING"
- ✅ If fields are null, `contextReasonCode` is set (e.g., "DASHBOARD_CONTEXT_UNAVAILABLE")
- ✅ Marker contains all 4 fields (dashboardId, tenantHashPrefix, dashboardPath, contextReasonCode)

**Failure Indicators**:
- ❌ `dashboardId: "MISSING"` or `dashboardPath: "MISSING"` → Fix not applied
- ❌ Missing `contextReasonCode` field → Type definition not updated
- ❌ Missing marker entirely → Resolver not logging proof

---

### Step 2: Verify UI Export Kind Mapping (FT_UI_EXPORT_KIND_CONTRACT_OK)

**Objective**: Confirm UI export state correctly maps snapshotKind from backend (no spurious UNKNOWN).

**Instructions**:

1. In the same console, find marker: `[FT_UI_EXPORT_KIND_CONTRACT_OK]`
2. Check the logged snapshot kind matches backend source:
   ```json
   {
     "marker": "[FT_UI_EXPORT_KIND_CONTRACT_OK]",
     "snapshotId": "snap-12345",
     "snapshotKind": "SEED" | "GOVERNANCE" | "SANDBOX",  // Should match backend
     "exportEligible": true | false,
     "hasCanonicalHash": true | false,
     "exportAllowed": false,  // Depends on kind + eligible
     "reasonCode": "NOT_EXPORT_ELIGIBLE" | "OK"
   }
   ```

**Expected Results**:
- ✅ `snapshotKind` is "SEED", "GOVERNANCE", or "SANDBOX" (NOT "UNKNOWN")
- ✅ If backend snapshotKindNormalized="SEED", then exported snapshotKind="SEED" ✓
- ✅ Only say "UNKNOWN" if backend provides no snapshotKind data
- ✅ Export button disables correctly based on snapshotKind + eligibility

**Failure Indicators**:
- ❌ `snapshotKind: "UNKNOWN"` when backend had valid data → Mapping logic broken
- ❌ Missing marker → UI logging not updated
- ❌ Export button enabled for SEED snapshots → reasonCode logic wrong

**Test Case**: 
- Navigate to a SEED snapshot (if available)
- Verify `snapshotKind: "SEED"` appears in export marker
- Verify export button is disabled with reason "seed snapshots cannot be exported"

---

### Step 3: Verify UI Identity Final Consistency (FT_UI_IDENTITY_FINAL_CONSISTENT)

**Objective**: Confirm UI identity markers are consistent and from single source (ui_build_meta).

**Instructions**:

1. In console, find marker: `[FT_UI_IDENTITY_FINAL_CONSISTENT]`
2. Verify identity fields:
   ```json
   {
     "marker": "UI_BUILD_IDENTITY_FINAL",
     "ui_git_sha": "cdfa04f...",  // 12-char git SHA
     "ui_dist_stamp": "cdfa04f....__20260215T120000Z",  // git SHA + timestamp
     "identity_source": "ui_build_meta_confirmed",
     "backend_build_sha": "abc1234...",  // Separate backend SHA (OK to differ)
     "ts": "2026-02-16T15:30:44.123Z"
   }
   ```

**Expected Results**:
- ✅ `ui_dist_stamp` starts with `ui_git_sha` (same first 12 chars)
- ✅ `ui_dist_stamp` format: `{gitsha}__YYYYMMDDTHHMMSSZ` (e.g., `cdfa04f....__20260216T153000Z`)
- ✅ `identity_source: "ui_build_meta_confirmed"` (not "resolver_confirmed" or similar)
- ✅ `backend_build_sha` is separate field (OK to be different SHA than UI)

**Failure Indicators**:
- ❌ `ui_dist_stamp` and `ui_git_sha` don't match (different first 12 chars) → Stale data
- ❌ `identity_source: "resolver_confirmed"` → Not updated
- ❌ Field named `ui_bundle_hash` instead of `ui_dist_stamp` → Old version
- ❌ Missing marker → Logging not updated

---

## Test Proof Markers (Unit Tests)

When running `npm test`, expect 3 new proof markers in test output:

```
[FT_DASHBOARD_CONTEXT_TEST_PASS] dashboardContext never emits MISSING strings
[FT_UI_EXPORT_KIND_TEST_PASS] snapshotKindNormalized='SEED' maps to export state correctly  
[FT_UI_IDENTITY_FINAL_TEST_PASS] ui_dist_stamp and ui_git_sha are consistent
```

**Verification**:
```bash
cd /workspaces/Firsttry/atlassian/forge-app
npm test 2>&1 | grep "\[FT_.*_TEST_PASS\]"
```

**Expected Output**:
```
[FT_DASHBOARD_CONTEXT_TEST_PASS] {"test":"dashboardContext_no_missing_strings","status":"PASS",...}
[FT_UI_EXPORT_KIND_TEST_PASS] {"test":"snapshotKind_mapping_contract","status":"PASS",...}
[FT_UI_IDENTITY_FINAL_TEST_PASS] {"test":"identity_final_consistency","status":"PASS",...}
```

---

## Contract Truth Summary

### Before (Broken Contract)
```
Backend dashboardContext:  { dashboardId: "MISSING", tenantHashPrefix: "MISSING", dashboardPath: "MISSING" }
                           ↓
UI Export State:           snapshotKind: "UNKNOWN"  (even though backend sent "SEED")
                           ↓
UI Identity Final:         ui_bundle_hash: "xyz123..." (misleading name, contains timestamp)
```

### After (Fixed Contract)
```
Backend dashboardContext:  { dashboardId: null, tenantHashPrefix: null, dashboardPath: null, contextReasonCode: "DASHBOARD_CONTEXT_UNAVAILABLE" }
                           ↓
UI Export State:           snapshotKind: "SEED"  (from backend snapshotKindNormalized, never UNKNOWN if available)
                           ↓
UI Identity Final:         ui_git_sha: "cdfa04f...", ui_dist_stamp: "cdfa04f....__20260216T...", identity_source: "ui_build_meta_confirmed"
```

---

## Troubleshooting

### Marker Not Appearing

1. **Check gadget is running v4.2.2.4+**:
   ```bash
   # In browser console:
   console.log(document.querySelector('[data-view-id]')?.getAttribute('data-view-id'))
   ```

2. **Reload gadget forcefully**:
   - Ctrl+Shift+Delete (clear cache)
   - Reload page
   - Wait 10 seconds for resolver to initialize

3. **Check Forge logs** (if available):
   ```bash
   forge logs --tail
   ```

### Dashboard Context Shows "ERROR" Instead of Null

**Cause**: Error during resolver execution  
**Fix**: Check upstream dashboardId/cloudId available in request context

### Export Kind Shows "UNKNOWN" for SEED Snapshot

**Cause**: snapshotKindNormalized field missing from backend response  
**Fix**: Verify backend is running v4.2.2.4+; check <resolver logs for `[FT_DASH_ENVELOPE_MARKER_V1]`

### Identity Markers Don't Match

**Cause**: UI served from stale bundle; caching issue  
**Fix**: Full gadget reload, clear CDN cache if available

---

## Success Checklist

- [ ] `[FT_DASHBOARD_CONTEXT_CONTRACT_OK]` marker present in browser console
- [ ] `dashboardId`, `tenantHashPrefix`, `dashboardPath` are all null or valid strings (never "MISSING")
- [ ] `contextReasonCode` field present (even if undefined for valid contexts)
- [ ] `[FT_UI_EXPORT_KIND_CONTRACT_OK]` marker present
- [ ] `snapshotKind` matches backend data (SEED for SEED snapshots, not UNKNOWN)
- [ ] `[FT_UI_IDENTITY_FINAL_CONSISTENT]` marker present
- [ ] `ui_dist_stamp` includes git SHA + timestamp format (e.g., `sha__YYYYMMDDTHHMMSSZ`)
- [ ] `ui_git_sha` matches first 12 chars of `ui_dist_stamp`
- [ ] All 3 unit test markers present in test output

---

## Rollback Instructions

If issues arise, rollback to v4.2.2.3-scopefix-deploy:

```bash
cd /workspaces/Firsttry/atlassian/forge-app
git checkout v4.2.2.3-scopefix-deploy
npm run build:ts
forge deploy --environment production
```

---

## Questions / Support

For questions about these fixes:
1. Check commit message: `git log --format=fuller fb5a3428`
2. Review tag annotation: `git tag -l v4.2.2.4-dashboard-contract-fix -n 20`
3. Check test proofs: `npm test 2>&1 | grep FT_`
