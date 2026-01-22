# Dashboard Acceptance Runbook

**Purpose:** Manual step-by-step verification of the dashboard feature in Jira UI.

This runbook is for **optional manual testing** and complements the automated audit (`npm run dashboard:audit`). The automated audit is used for CI/CD gating and doesn't require Jira login.

---

## Setup

### Prerequisites
- Valid Jira Cloud instance with FirstTry app installed
- Forge app deployed to your Jira instance
- Access to dashboard gadget UI
- Browser with debug console access
- Optional: VS Code with dev tools

### Environment
```bash
export JIRA_INSTANCE="https://your-instance.atlassian.net"
export JIRA_USER="your-email@example.com"
export JIRA_API_TOKEN="your-api-token"
```

---

## Test 1: Normal Mode Verification

**Objective:** Verify dashboard loads and displays status without debug mode.

### Steps

1. **Open Dashboard**
   - Navigate to: `$JIRA_INSTANCE/secure/RapidBoard.jspa`
   - Find a gadget labeled "FirstTry: Audit Evidence for Jira"
   - Should NOT show any debug sections (marked with `data-ft-debug="1"`)

2. **Verify Proof Panel Visible**
   - Look for section: "✓ Identity & Deployment Proof"
   - Should display:
     - Envelope Kind: `FT_DASH_ENVELOPE_V1` (or `UNSET` if loading)
     - Schema Version: `v1`
     - Correlation ID: UUID (changes on refresh)
     - UI Build SHA: 40-character hash
     - UI Build Time (UTC): ISO timestamp
     - Backend Build SHA: 40-character hash
     - Backend Build Time (UTC): ISO timestamp

3. **Verify Status Display**
   - Look for section: "Status"
   - Should show health indicator (OK / DEGRADED / ERROR)
   - Should display current operational state

4. **Expected Outcome: PASS**
   - ✅ Proof panel visible
   - ✅ All proof fields populated (not UNSET)
   - ✅ Status displays correctly
   - ✅ No JavaScript errors in console

---

## Test 2: Debug Mode Verification

**Objective:** Verify debug sections appear when `?ft_debug=1` is added to URL.

### Steps

1. **Enable Debug Mode**
   - Current URL: `$JIRA_INSTANCE/secure/RapidBoard.jspa?...`
   - Add query param: `?ft_debug=1`
   - Full URL: `$JIRA_INSTANCE/secure/RapidBoard.jspa?ft_debug=1&...` (adjust based on existing params)
   - Press Enter to reload

2. **Verify Debug Sections Appear**
   - Browser should show additional sections with `data-ft-debug="1"` markers
   - Look for:
     - Debug banner (top of gadget)
     - JS boot indicator
     - CSS canary indicator
   - These should be HIDDEN in normal mode, VISIBLE in debug mode

3. **Verify Console Markers**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for markers:
     - `[UI_BUILD_IDENTITY_EARLY]`
     - `[UI_CSP_PROOF]`
     - `[UI_BRIDGE_RUNTIME_CHECK]`
     - `[UI_INVOKE_WIRING_PROOF]`

4. **Expected Outcome: PASS**
   - ✅ Debug sections visible after page reload
   - ✅ Console shows diagnostic markers
   - ✅ No JavaScript errors

---

## Test 3: Refresh Verification

**Objective:** Verify proof envelope changes on refresh (correlation_id is new).

### Steps

1. **Note Current Proof Values**
   - In normal mode (no `?ft_debug=1`)
   - Record: `Correlation ID`
   - Record: `UI Build SHA`
   - Record: `Backend Build SHA`

2. **Refresh Page**
   - Press Ctrl+R (or Cmd+R on Mac)
   - Wait for dashboard to reload

3. **Verify Correlation ID Changed**
   - New `Correlation ID` should be different from before
   - Proves request tracing is working
   - `UI Build SHA` and `Backend Build SHA` should remain same

4. **Repeat Multiple Times**
   - Refresh 3-5 times
   - Each refresh should get a new correlation ID
   - Build SHAs should remain constant

5. **Expected Outcome: PASS**
   - ✅ Correlation ID changes on every refresh
   - ✅ Build SHAs remain constant
   - ✅ Proof panel updates without JavaScript errors

---

## Test 4: Snapshot Count & Export Readiness

**Objective:** Verify snapshot collection and export capability.

### Steps

1. **Open Dashboard (Normal Mode)**
   - No `?ft_debug=1`
   - Wait 5-10 seconds for initial load

2. **Locate Snapshots Section**
   - Look for: "Snapshots" or "Events Collected"
   - Should show:
     - Snapshot count (number of events)
     - Last snapshot timestamp
     - Export status (Ready / Not Ready)

3. **Verify Export Button**
   - Look for "Export Snapshot" or similar button
   - Should be:
     - Enabled if snapshots exist
     - Disabled if no snapshots yet (DEGRADED state)

4. **Test Export (Optional)**
   - Click "Export Snapshot"
   - Should download JSON file
   - File should contain:
     - proof envelope (correlation_id, build_sha, etc.)
     - snapshot data (events)
     - metadata

5. **Expected Outcome: PASS**
   - ✅ Snapshot count displays correctly
   - ✅ Export button state matches snapshot availability
   - ✅ Export file contains proof envelope

---

## Test 5: Proof Envelope Verification (Manual)

**Objective:** Verify proof envelope structure in exported data.

### Steps

1. **Export Snapshot**
   - Click "Export Snapshot" button in dashboard
   - Save JSON file

2. **Inspect Proof Fields**
   - Open JSON file in editor
   - Verify presence of:
     ```json
     {
       "envelopeKind": "FT_DASH_ENVELOPE_V1",
       "schemaVersion": "v1",
       "correlation_id": "...",
       "backend_build_sha": "...",
       "backend_build_time_utc": "...",
       "ui_build_sha": "...",
       "ui_build_time_utc": "..."
     }
     ```

3. **Verify Envelope Integrity**
   - All fields should be non-empty (not UNSET or null)
   - Timestamps should be ISO 8601 format
   - SHAs should be 40-character hex strings

4. **Expected Outcome: PASS**
   - ✅ All proof fields present in export
   - ✅ No UNSET values
   - ✅ Correct format for all fields

---

## Test 6: Correlation ID Tracing

**Objective:** Verify correlation_id round-trips from UI → Backend → UI.

### Steps

1. **Enable Debug Mode**
   - Add `?ft_debug=1` to URL

2. **Open DevTools Network Tab**
   - F12 → Network tab
   - Filter for XHR/Fetch requests

3. **Trigger Dashboard Reload**
   - Refresh page (Ctrl+R)

4. **Find Backend Invoke**
   - Look for request to backend resolver
   - Check Request Headers for correlation_id (if included)
   - Check Response body for correlation_id

5. **Compare with UI Display**
   - Look at dashboard Correlation ID field
   - Should match the one from backend response

6. **Expected Outcome: PASS**
   - ✅ Correlation ID present in backend response
   - ✅ UI displays same correlation ID
   - ✅ ID changes on each request

---

## Failure Signatures & Troubleshooting

### Failure: Proof Panel Shows All "UNSET"

**Likely Cause:** Backend not returning proof envelope

**Investigation:**
- DevTools Console: Look for `[BACKBONE_FIX_A_MISSING_UI_REQ_ID]` error
- Check backend resolver: `atlassian/forge-app/src/resolvers/getStatusSnapshot.ts`
- Verify gadget-resolver.ts has all required resolvers registered
- Run: `npm run dashboard:audit` (automated check)

**Layer:** L0 (Backend) or L1 (Backend-UI Contract)

**Resolution:**
1. Check gadget-resolver.ts: Is getStatusSnapshot registered?
2. Check getStatusSnapshot.ts: Does it return all proof fields?
3. Verify build: `npm run build --prefix atlassian/forge-app`
4. Redeploy: `forge deploy`

---

### Failure: Debug Sections Not Appearing

**Likely Cause:** Debug toggle functions missing or CSS rule broken

**Investigation:**
- DevTools Console: Check for JavaScript errors
- Check main.ts for ftIsDebugMode() and ftApplyDebugModeClass()
- Check main.css for `[data-ft-debug="1"]` rules
- Run: `npm run dashboard:audit` (will fail on verify_debug_toggle_contract.mjs)

**Layer:** L2 (Gadget UI)

**Resolution:**
1. Check main.ts for debug functions
2. Verify CSS @supports pattern is present
3. Check for typos in data-ft-debug attribute
4. Rebuild: `npm run build --prefix atlassian/forge-app`

---

### Failure: Correlation ID Doesn't Change on Refresh

**Likely Cause:** Caching or missing request ID generation

**Investigation:**
- DevTools Console: Check for cache-related warnings
- Check forgeInvoke.ts: Does it pass ui_req_id?
- Verify backend: Does it use correlation_id from request?

**Layer:** L1 (Backend-UI Contract)

**Resolution:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+Shift+R)
3. Verify ui_req_id is generated: Check entryProof.ts
4. Check getStatusSnapshot returns new correlation_id

---

### Failure: Export Button Disabled (No Snapshots)

**Likely Cause:** Snapshots not yet collected or storage error

**Investigation:**
- Status shows: "DEGRADED" or "BOOTSTRAP"
- Check DevTools Console for storage errors
- Verify Jira user has proper permissions

**Layer:** L0 (Backend Storage) or L1 (Permissions)

**Resolution:**
1. Wait 30-60 seconds (scheduler may not have run)
2. Check backend logs: Is scheduler running?
3. Verify Jira permissions: Is user admin?
4. Check storage: `npm prove:storage` script

---

### Failure: JavaScript Error in Console

**Common Errors:**

#### Error: "Forge bridge not available"
- Likely: Gadget iframe missing Forge runtime
- Check: Manifest.yml routes correctly to gadget UI
- Resolution: Redeploy forge app

#### Error: "invoke() failed"
- Likely: Resolver crashed or not registered
- Check: gadget-resolver.ts has resolver.define() for all keys
- Resolution: Verify resolver implementation, redeploy

#### Error: "CSP violation"
- Likely: Content Security Policy blocks inline styles
- Check: Manifest.yml CSP settings
- Resolution: Update CSP to allow inline styles

---

## Quick Checklist

- [ ] Dashboard loads without errors
- [ ] Proof panel displays (not all UNSET)
- [ ] Debug mode works with ?ft_debug=1
- [ ] Correlation ID changes on refresh
- [ ] Snapshot count shows non-zero
- [ ] Export button works and contains proof envelope
- [ ] No JavaScript errors in console
- [ ] Build SHA values are 40-char hex
- [ ] Timestamps are ISO 8601 format

---

## Automated Testing

For CI/CD integration, use:

```bash
npm run dashboard:audit
```

This runs all checks without requiring Jira login:
- ✓ Deterministic CI gate
- ✓ Build with all 7/7 gates
- ✓ Resolver registration
- ✓ Status schema fields
- ✓ Gadget DOM elements
- ✓ Debug toggle contract
- ✓ No external network primitives

---

## Related Documentation

- [DASHBOARD_FEATURE_AUDIT.md](DASHBOARD_FEATURE_AUDIT.md) - Automated audit design
- [atlassian/forge-app/src/gadget-resolver.ts](../atlassian/forge-app/src/gadget-resolver.ts) - Resolver registration
- [atlassian/forge-app/src/gadget-ui/index.html](../atlassian/forge-app/src/gadget-ui/index.html) - DOM structure
- [atlassian/forge-app/src/shared/statusSchema.ts](../atlassian/forge-app/src/shared/statusSchema.ts) - Type definitions

---

## Support

- **Questions:** Check console markers (`[UI_*]` and `[BACKBONE_*]`)
- **Issues:** Run `npm run dashboard:audit` and check logs in `/tmp/ft_dashboard_audit_*/`
- **Deployment:** Ensure Forge app is deployed: `forge deploy`
