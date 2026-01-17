# Frontend Probe UI Deployment Guide

## Executive Summary

This guide documents the deployment of the **Frontend Probe UI** feature, which provides undeniable proof that:

1. ✅ The UI can invoke the backend probe resolver
2. ✅ The backend returns a unique nonce that can be grepped from production logs
3. ✅ Full end-to-end correlation between UI invocation and backend execution

**Deployment Status:** ✅ Ready for Production

---

## What Changed

### Files Modified

#### 1. **Gadget UI HTML** (`src/gadget-ui/index.html`)

Added the Forensic Probe widget:
- "Run Probe" button (line ~168)
- Response panel for displaying results
- Metrics display grid showing nonce, build SHA, etc.
- Grep command display for manual verification

**Status:** ✅ Already in place - includes all UI elements

#### 2. **Gadget UI TypeScript** (`src/gadget-ui/src/main.ts`)

Added the `runProbe()` function that:
- Calls `invoke('probe', payload)` 
- Displays the nonce and backend metadata
- Shows grep commands for verification

**Status:** ✅ Already implemented - includes:
- Line ~1452: `window.runProbe = async function()`
- Payload construction with multiple correlation fields
- Response display with nonce extraction
- Grep command generation

#### 3. **Backend Probe Resolver** (`src/resolvers/probe.ts`)

Implements the probe endpoint that:
- Generates a unique nonce: `probe_${Date.now()}_${randomHex(8)}`
- Logs JSON marker with nonce for grepping
- Returns meta with all correlation fields
- Never throws, always returns ok:true/false

**Status:** ✅ Already implemented - fully functional

#### 4. **Gadget Handler Dispatcher** (`src/resolvers/gadget-handlers.ts`)

Registers probe in the allowlist (line ~189):

```typescript
const ALLOWED_RESOLVERS: Record<string, (req: any) => Promise<any>> = {
  probe: probe,  // ← FORENSIC_PROBE
  // ...other resolvers
};
```

**Status:** ✅ Already configured - probe is in allowlist

#### 5. **Verification Script** (`tools/probe_prod.sh`)

Standalone script that:
- Accepts `--nonce <value>` parameter
- Captures production logs
- Greps for the nonce (definitive proof)
- Returns PASS/FAIL with diagnostics

**Status:** ✅ Already in place - fully functional

---

## Build & Deploy Steps

### Step 1: Build the Gadget UI

```bash
cd /workspaces/Firsttry/atlassian/forge-app/src/gadget-ui

# Install dependencies (if needed)
npm ci

# Build (should succeed with no errors)
npm run build

# Verify output
ls -lh dist/
# Expected: index.html, assets/index.*.css, assets/index.*.js
```

Expected output:
```
vite v7.3.0 building client environment for production...
✓ 79 modules transformed.
dist/index.html                 37.10 kB │ gzip:  5.17 kB
dist/assets/index.*.css        14.75 kB │ gzip:  3.32 kB
dist/assets/index.*.js         92.24 kB │ gzip: 25.94 kB
✓ built in 454ms
```

### Step 2: Deploy the Forge App

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Deploy to production
forge deploy --environment production

# Watch logs during deployment
forge logs --environment production --follow
```

Expected deployment output:
```
Deploying app to production...
Building functions...
  ✓ phase5-scheduler-fn
  ✓ phase6-weekly-snap-fn
  ✓ token-refresh-job-fn
  ✓ daily-dispatcher-fn
  ✓ status-resolver-fn
  ✓ get-status-snapshot-fn    ← Includes probe resolver
  ✓ refresh-now-fn
  ✓ get-build-info-fn
  ✓ export-snap-fn
  ✓ get-ops-state-fn
Deploying to environment...
  ✓ App deployed successfully
```

### Step 3: Verify Installation

```bash
# Check that the gadget is installed
forge install list --environment production

# Look for: "governance-dashboard-gadget-v2" (status: ENABLED)
```

---

## Testing the Deployment

### Manual Test: UI Invocation

1. **Open Dashboard**
   - Go to Jira → Dashboards → Find dashboard with Firsttry gadget
   - Wait for gadget to load

2. **Locate Probe Widget**
   - Scroll down to find: **"🔬 Forensic Probe (Production Correlation Proof)"**
   - Should see "Run Probe" button

3. **Execute Probe**
   - Click "Run Probe"
   - Wait for response (usually 1-2 seconds)
   - Should see ✅ success message

4. **Verify Response**
   - Note the "Probe Nonce" value shown (e.g., `probe_1768662844441_af14b920`)
   - Copy the grep command shown

### Automated Test: Log Verification

```bash
# From the workspace root
cd /workspaces/Firsttry

# Run the verification script with the nonce from UI
bash tools/probe_prod.sh --nonce probe_1768662844441_af14b920

# Expected output: PASS (nonce found in logs)
```

---

## Verification Checklist

Before considering deployment complete:

- [ ] **UI Builds**
  ```bash
  cd atlassian/forge-app/src/gadget-ui && npm run build
  # Exits with code 0, no errors
  ```

- [ ] **App Deploys**
  ```bash
  cd atlassian/forge-app && forge deploy --environment production
  # Succeeds with all functions deployed
  ```

- [ ] **Probe Widget Visible**
  - Gadget loads in dashboard
  - "🔬 Forensic Probe" section is visible
  - "Run Probe" button is clickable

- [ ] **Probe Executes**
  - Click "Run Probe"
  - Response appears within 3 seconds
  - Shows ✅ success indicator

- [ ] **Nonce Present**
  - Response shows "Probe Nonce" value
  - Value matches format: `probe_<timestamp>_<hex>`
  - Copy-paste grep command is displayed

- [ ] **Verification Works**
  ```bash
  bash tools/probe_prod.sh --nonce <nonce_from_ui>
  # Exits with code 0
  # Output shows: "✓ PROBE nonce found in logs!"
  ```

---

## Rollback (If Needed)

The probe feature is **non-breaking** and can be safely rolled back:

```bash
# Option 1: Disable gadget (keeps old version installed)
forge install update governance-dashboard-gadget-v2 --disable

# Option 2: Redeploy previous version
git checkout <previous-commit>
forge deploy --environment production

# Option 3: Remove gadget entirely (from Jira UI)
# Dashboards > Edit > Remove "Firsttry" gadget widget
```

---

## Post-Deployment Monitoring

### Check Logs for Errors

```bash
# Monitor for probe-related errors
cd atlassian/forge-app
forge logs --environment production --follow | grep -i "probe\|error"

# Expected pattern (success):
# {"marker":"PROBE","ui_req_id":"ui_...","probe_nonce":"probe_..."}

# Warning signs:
# - "INVOKE_KEY_NOT_ALLOWED" (probe not in allowlist)
# - "PROBE_EXCEPTION" (resolver error)
# - "resolver not found" (handler not deployed)
```

### Monitor Performance

The probe endpoint should be very fast (< 100ms):

```bash
# Check probe response times
forge logs --environment production | grep "PROBE" | jq '.response_time_ms'
# Should all be < 100
```

### Check UI Errors

```bash
# Look for UI-side errors
forge logs --environment production | grep "RunProbe"

# Expected: minimal or no output (only if errors occur)
```

---

## Implementation Details

### Probe Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ UI Dashboard                                                │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ 🔬 Forensic Probe                                     │  │
│ │ [Run Probe] ← User clicks                             │  │
│ └─────────────────────────┬───────────────────────────┘  │
│                           │                               │
│                           ▼                               │
│                  invoke('probe', {                       │
│                   ui_req_id: 'ui_123...',               │
│                   uiReqId: 'req_compat_...',            │
│                   requestId: 'rid_...'                  │
│                  })                                     │
└───────────────────────────┬───────────────────────────────┘
                            │
                            │ Forge Bridge
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend Resolver                                            │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ probe() resolver                                      │  │
│ │ 1. Extract ui_req_id (precedence chain)             │  │
│ │ 2. Generate nonce: probe_${ts}_${hex}               │  │
│ │ 3. Log JSON marker with nonce                       │  │
│ │ 4. Return { ok:true, meta:{nonce,...}, ... }       │  │
│ └─────────────────────────┬───────────────────────────┘  │
│                           │                               │
│                           ▼                               │
│                  console.log({                           │
│                   marker: 'PROBE',                       │
│                   probe_nonce: 'probe_456...',          │
│                   ...                                    │
│                  })                                     │
│                           │                              │
└───────────────────────────┼──────────────────────────────┘
                            │
                            ▼
                    Production Logs
                 (grepable by nonce)
```

### Response Structure

```json
{
  "ok": true,
  "meta": {
    "ui_req_id": "ui_1768662844441_af14b920",
    "probe_nonce": "probe_1768662844441_af14b920",
    "backend_build_sha": "cdfa04fba064",
    "now_iso": "2025-01-17T14:35:22.123Z",
    "node": "v20.10.0",
    "function_name": "probe-resolver",
    "forge_env": "production"
  },
  "observed": {
    "payload_keys": ["ui_req_id", "uiReqId", "requestId", "meta"],
    "correlation_fields": {
      "ui_req_id": "ui_1768662844441_af14b920",
      "uiReqId": "req_compat_1768662844441_af14b920",
      "requestId": "rid_1768662844441"
    }
  }
}
```

---

## Documentation References

- [PROBE_RUNBOOK.md](./PROBE_RUNBOOK.md) - User guide for running probes
- [src/gadget-ui/src/main.ts](./src/gadget-ui/src/main.ts#L1452) - UI invocation code
- [src/resolvers/probe.ts](./src/resolvers/probe.ts) - Resolver implementation
- [tools/probe_prod.sh](./tools/probe_prod.sh) - Verification script

---

## Success Criteria

After deployment, verify:

1. ✅ UI loads without errors
2. ✅ Probe widget is visible
3. ✅ "Run Probe" button is clickable
4. ✅ Clicking button returns response with nonce
5. ✅ Nonce can be found in production logs using verification script
6. ✅ Build SHA matches between UI and backend
7. ✅ Grep command provided works correctly

**All criteria met = Deployment successful!** 🎉

---

## Support

If deployment encounters issues:

1. **Check gadget-handlers.ts** - Verify `probe` is in `ALLOWED_RESOLVERS`
2. **Check backend logs** - Look for resolver entry/error markers
3. **Hard refresh browser** - Clear UI cache (Ctrl+Shift+R)
4. **Rebuild gadget UI** - `npm run build` in `src/gadget-ui/`
5. **Redeploy app** - `forge deploy --environment production`

---

**Deployment Date:** 2025-01-17
**Status:** ✅ Ready for Production
**Owner:** Governance Team
**Related Tickets:** N/A (Feature implementation)
