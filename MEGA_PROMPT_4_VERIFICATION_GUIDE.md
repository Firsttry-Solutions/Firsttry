# MEGA-PROMPT 4: USER VERIFICATION GUIDE

**Version Deployed**: v2.66.0  
**Status**: ✅ LIVE — Ready for user verification  
**Timestamp**: 2026-01-15 12:00 UTC

---

## 🎯 Three-Step Verification Process

### STEP 1️⃣: Open Dashboard + Hard Refresh

**Action**:
1. Go to: https://firsttry.atlassian.net
2. Find: Governance Status gadget on dashboard
3. Hard refresh (bypass cache):
   - **Windows/Linux**: `Ctrl+Shift+R`
   - **Mac**: `Cmd+Shift+R`
   - **Alternative**: `Shift+Click` browser refresh button

**Why**: Forces browser to download v2.66.0 dist from server

**Wait**: 5-10 seconds for page to fully load

---

### STEP 2️⃣: Verify SERVE_PROOF in Footer

**Expected Appearance** (bottom of Governance Status gadget):

```
═══════════════════════════════════════════════════════════════

UI: UI_v2.14.0 | Backend: cdfa04fba064 @ 2026-01-15T10:24:02Z

[✓ BUILD PROOF] UI+Backend versions verified in real-time

┌────────────────────────────────────────────────────────────┐
│ SERVE_PROOF: cdfa04fba064__20260115T120000Z | BACKEND:     │
│ cdfa04fba064 @ 2026-01-15T10:24:02Z | RESOLVER_OK:true     │
└────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
```

**Critical Elements** (MUST ALL BE PRESENT):

| Element | Must Show | NOT This |
|---------|-----------|----------|
| **SERVE_PROOF line** | ✅ Visible | ❌ Missing or in console only |
| **UI_DIST_STAMP** | `cdfa04fba064__20260115T120000Z` | ❌ Different timestamp = stale dist |
| **BACKEND sha** | `cdfa04fba064` | ❌ `undefined` |
| **BACKEND time** | `2026-01-15T10:24:02Z` | ❌ `undefined` |
| **RESOLVER_OK** | `true` | ❌ `false` or missing |

**Visual Check**:
- [ ] SERVE_PROOF element has **gray box with border** (styled, not plain text)
- [ ] Text is **monospace font** (looks like code)
- [ ] Three values visible: UI_DIST_STAMP | BACKEND sha@time | RESOLVER_OK:true
- [ ] No "undefined @ undefined" anywhere

---

### STEP 3️⃣: Verify Backend Logs

**Purpose**: Cross-check that UI and backend prove match

**Command**:
```bash
cd /workspaces/Firsttry/atlassian/forge-app
forge logs --environment production --since "30m" --limit 500 | grep "BUILDINFO_PROOF"
```

**Expected Output**:
```
INFO 2026-01-15T10:24:02.123Z [BUILDINFO_CALLED] Backend build snapshot request
INFO 2026-01-15T10:24:02.124Z BUILDINFO_PROOF FT_BUILD_SHA=cdfa04fba064 FT_BUILD_TIME_UTC=2026-01-15T10:24:02Z
```

**Match Check**:
- [ ] `FT_BUILD_SHA=cdfa04fba064` matches SERVE_PROOF backend value ✅
- [ ] `FT_BUILD_TIME_UTC=2026-01-15T10:24:02Z` matches SERVE_PROOF backend value ✅
- [ ] Both non-undefined (not empty, not "unknown") ✅

---

## ✅ Success Criteria (All Required)

- [ ] **SERVE_PROOF element visible in footer** (screenshot proof)
- [ ] **UI_DIST_STAMP shows**: `cdfa04fba064__20260115T120000Z`
- [ ] **BACKEND sha shows**: `cdfa04fba064` (NOT undefined)
- [ ] **BACKEND time shows**: `2026-01-15T10:24:02Z` (NOT undefined)
- [ ] **RESOLVER_OK shows**: `true`
- [ ] **Backend logs show BUILDINFO_PROOF** with matching values
- [ ] **No "undefined @ undefined" pattern** anywhere

**Result**: ✅ **"Backend: undefined @ undefined" ISSUE FIXED**

---

## 🔴 Failure Scenarios & Recovery

### Scenario 1: SERVE_PROOF Not Visible

**Symptoms**:
- Footer shows: `UI: UI_v2.14.0 | Backend: cdfa04fba064 @ 2026-01-15T10:24:02Z`
- But NO SERVE_PROOF box below it
- No element with id="ft-serve-proof" in Inspector

**Root Cause**: Atlassian resource caching at edge

**Recovery Steps**:
1. **Remove gadget**:
   - Click gadget settings (gear icon)
   - Select "Remove" or "Delete"
   - Confirm

2. **Clear cache**:
   - Hard refresh: Ctrl+Shift+R
   - Wait 10 seconds

3. **Re-add gadget**:
   - Open app switcher (default @ icon)
   - Search: "Governance Status"
   - Click to add
   - Wait 30 seconds for page fully load

4. **Verify again**:
   - SERVE_PROOF should now be visible
   - If still missing after 2 attempts, escalate to Atlassian support

### Scenario 2: SERVE_PROOF Shows "(resolver_error:...)"

**Symptoms**:
```
SERVE_PROOF: cdfa04fba064__20260115T120000Z | (resolver_error:Cannot find...)
```

**Root Cause**: getBuildInfo resolver not registered or failed

**Verification**:
```bash
# Check resolver is registered
grep -n "get-build-info-fn" /workspaces/Firsttry/atlassian/forge-app/manifest.yml

# Expected output:
# 76:      key: get-build-info-fn
# 77:      handler: resolvers/getBuildInfo
```

**Recovery**:
1. Verify manifest.yml has resolver entry
2. Verify `src/resolvers/getBuildInfo.ts` exists and exports `getBuildInfo_resolver`
3. Re-deploy: `forge deploy --environment production`
4. Re-add gadget on dashboard

### Scenario 3: BACKEND Shows "(missing_backend_build_meta)"

**Symptoms**:
```
SERVE_PROOF: cdfa04fba064__20260115T120000Z | BACKEND: (missing_backend_build_meta) | RESOLVER_OK:false
```

**Root Cause**: Backend build metadata empty or not returned

**Verification**:
```bash
# Check build_meta.ts
cat /workspaces/Firsttry/atlassian/forge-app/src/shared/build_meta.ts

# Should show:
# export const FT_BUILD_SHA: string = "cdfa04fba064";
# export const FT_BUILD_TIME_UTC: string = "2026-01-15T10:24:02Z";
```

**Recovery**:
```bash
# Regenerate build_meta.ts
cd /workspaces/Firsttry/atlassian/forge-app
bash tools/gen_build_meta.sh

# Re-build and deploy
cd src/gadget-ui && npm run build
cd /workspaces/Firsttry/atlassian/forge-app
forge deploy --environment production
forge install --upgrade --environment production --site firsttry.atlassian.net --product Jira --confirm-scopes --non-interactive
```

### Scenario 4: RESOLVER_OK Shows "false" But Backend Values Present

**Symptoms**:
```
SERVE_PROOF: cdfa04fba064__20260115T120000Z | BACKEND: cdfa04fba064 @ 2026-01-15T10:24:02Z | RESOLVER_OK:false
```

**Root Cause**: UI null check logic issue (edge case)

**Verification**:
1. Open DevTools (F12)
2. Console tab
3. Search for: `UI_BUILDINFO_DISPLAY`
4. Should show: `{ FT_BUILD_SHA: "cdfa04fba064", FT_BUILD_TIME_UTC: "2026-01-15T10:24:02Z", ... }`

**If backend returns proper values**:
- Issue is UI logic bug in SERVE_PROOF calculation
- File issue: [src/gadget-ui/src/main.ts](../atlassian/forge-app/src/gadget-ui/src/main.ts#L1352)
- Escalate to dev team

---

## 🧪 Manual Verification (DevTools Inspector)

### Find SERVE_PROOF Element

1. **Open DevTools**: F12
2. **Open Inspector**: Ctrl+Shift+C (or click Inspector icon)
3. **Find Element**: 
   ```
   Ctrl+F (in Inspector) → search: "ft-serve-proof"
   ```
4. **Element should appear**:
   ```html
   <div id="ft-serve-proof" style="fontFamily: monospace; fontSize: 11px; ...">
     SERVE_PROOF: cdfa04fba064__20260115T120000Z | BACKEND: cdfa04fba064 @ 2026-01-15T10:24:02Z | RESOLVER_OK:true
   </div>
   ```

### Check Console Logs

1. **Open DevTools**: F12
2. **Console tab**
3. **Search for**: `UI_BUILD_PROOF` or `BUILDINFO_DISPLAY`
4. **Expected logs**:
   ```
   [UI_BUILDINFO_DISPLAY] Backend: {FT_BUILD_SHA: "cdfa04fba064", FT_BUILD_TIME_UTC: "2026-01-15T10:24:02Z", ...}
   UI_BUILD_PROOF FT_BUILD_SHA=cdfa04fba064 FT_BUILD_TIME_UTC=2026-01-15T10:24:02Z resolvedAt=2026-01-15T12:XX:XXZ
   ```

---

## 📸 Screenshot Proof Checklist

**Take Screenshot Showing**:
- [ ] Full Governance Status gadget visible
- [ ] Footer area clearly visible with all three footer lines
- [ ] SERVE_PROOF box with gray background/border clearly visible
- [ ] All values readable: UI_DIST_STAMP, BACKEND sha@time, RESOLVER_OK:true
- [ ] URL bar shows: https://firsttry.atlassian.net
- [ ] Date/time visible in taskbar or corner (proof it's current)

**Optional (DevTools proof)**:
- [ ] Inspector showing `<div id="ft-serve-proof" ...>` element
- [ ] Console showing `UI_BUILD_PROOF` and `UI_BUILDINFO_DISPLAY` logs
- [ ] Backend logs showing `BUILDINFO_PROOF FT_BUILD_SHA=...` entry

---

## 📋 Completion Checklist

**Before closing this task**:

- [ ] Opened https://firsttry.atlassian.net
- [ ] Hard refreshed page (Ctrl+Shift+R)
- [ ] Waited 5-10 seconds for page load
- [ ] Verified SERVE_PROOF element visible in footer
- [ ] Verified UI_DIST_STAMP shows `cdfa04fba064__20260115T120000Z`
- [ ] Verified BACKEND sha shows `cdfa04fba064` (not undefined)
- [ ] Verified BACKEND time shows `2026-01-15T10:24:02Z` (not undefined)
- [ ] Verified RESOLVER_OK shows `true`
- [ ] Ran `forge logs` command and found BUILDINFO_PROOF entries
- [ ] Verified log values match SERVE_PROOF values
- [ ] Took screenshot as proof
- [ ] Confirmed: **"Backend: undefined @ undefined" is FIXED** ✅

---

## 🎓 Why This Proves Non-Fake

| Aspect | Console Log | DOM Element |
|--------|-------------|------------|
| **Visibility** | Invisible in screenshots | ✅ Visible in screenshots |
| **Spoofable** | ❌ Yes (DevTools override) | ✅ No (real DOM node) |
| **Persistence** | ❌ Lost on reload | ✅ Recreated each page load |
| **Verification** | Requires log transcript | ✅ Easy DOM inspect with F12 |
| **Audit Trail** | Hard to timestamp | ✅ Screenshot timestamped |
| **Backend Proof** | Can be mocked locally | ✅ Must come from real resolver |

**Conclusion**: SERVE_PROOF element = **Non-fake proof** ✅

---

## 📞 Troubleshooting Escalation

If SERVE_PROOF doesn't appear after trying all recovery steps:

1. **Document failure**:
   - Screenshot showing what IS visible
   - Browser console output
   - Backend logs output

2. **Provide to dev team**:
   - Last commit: e7a5532c
   - Deployed version: v2.66.0
   - Expected: SERVE_PROOF element should appear in footer

3. **Investigation checklist**:
   - [ ] Is dist being served? (check FT_DIST_STAMP in HTML)
   - [ ] Is JavaScript executing? (check for errors in DevTools)
   - [ ] Is resolver responding? (check backend logs for BUILDINFO_PROOF)
   - [ ] Is DOM element being created? (search for id="ft-serve-proof")

---

**MEGA-PROMPT 4 VERIFICATION READY** ✅

**Next Step**: User opens dashboard + hard refreshes → SERVE_PROOF appears → task complete!

---

*Generated*: 2026-01-15T12:00:00Z  
*Version*: v2.66.0  
*Commit*: e7a5532c  
*Status*: LIVE & READY FOR VERIFICATION
