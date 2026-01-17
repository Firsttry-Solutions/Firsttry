# FORENSIC PROBE - QUICK START GUIDE

**Version:** 2.95.0 (commit f1c06fbc)  
**Status:** ✅ DEPLOYED TO PRODUCTION  
**Ready for testing:** YES

---

## Three-Step Proof Flow

### Step 1: Reload Gadget
```bash
# In browser:
1. Go to https://firsttry.atlassian.net
2. Remove the gadget and add it again
3. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
4. Wait for page to fully load
```

**Verify:** Footer should show:
- UI_BUILD_MARKER: `ui_20260117_<buildid>`
- Not: `req_20260117_<buildid>` (old format)

---

### Step 2: Run Probe (UI Step - Awaiting Implementation)
```
NOTE: "Run Probe" button not yet added to UI.
      See FORENSIC_PROBE_PROOF_READY.md for complete implementation.
      
When UI is ready:
1. Click "Run Probe" button
2. Diagnostics panel will show:
   - ui_req_id: ui_1234567890_abc123
   - probe_nonce: probe_1234567890_def456
   - backend_build_sha: 3e4f5a6b7c...
   - forge_env: production
   - observed.correlation_fields: {...}
```

---

### Step 3: Get Proof from Logs
```bash
# After Step 2, run this in terminal:
cd /workspaces/Firsttry

# Copy the ui_req_id and probe_nonce from UI, then:
bash tools/probe_prod.sh <UI_REQ_ID> <PROBE_NONCE>

# Example:
bash tools/probe_prod.sh ui_1768660190864_d8f211a2 probe_1768662844441_af14b920
```

**Expected output:**
```
✅ PASS: Nonce found in production logs

First matching PROBE line:
{"marker":"PROBE","ui_req_id":"ui_1768660190864_d8f211a2",...}

This PROVES:
  1. Probe resolver was invoked
  2. Backend logged the correlation data
  3. forge logs is returning the production stream
```

---

## What Gets Verified

### ✅ PASS (Proof Success)
- [x] Probe resolver was invoked on backend
- [x] Backend received ui_req_id from UI
- [x] Backend logged PROBE marker with nonce
- [x] forge logs is returning production stream
- [x] UI_REQ_ID can be extracted from payload
- [x] Nonce is unique and deterministic

### ❌ FAIL (If Unsuccessful)
- Script will output diagnosis:
  - [ ] Probe button not invoked?
  - [ ] Probe code not deployed?
  - [ ] Logs not captured?
  - [ ] forge logs not accessible?

---

## Implementation Status

| Task | Status | Location |
|------|--------|----------|
| Probe resolver | ✅ Done | src/resolvers/probe.ts |
| Probe registration | ✅ Done | src/resolvers/gadget-handlers.ts |
| Probe tests (20) | ✅ Done | tests/forensic_probe.test.ts |
| Production script | ✅ Done | tools/probe_prod.sh |
| Deployed to prod | ✅ Done | v2.95.0 live |
| **UI button** | ⏳ Pending | gadget UI (needs impl) |
| **UI diagnostics panel** | ⏳ Pending | gadget UI (needs impl) |

---

## Troubleshooting

### "Nonce not found in logs"
```bash
# Diagnosis files created in:
/tmp/ft_probe_<TIMESTAMP>/

# Check these files:
cat /tmp/ft_probe_*/00_whoami.txt           # Are you logged in?
cat /tmp/ft_probe_*/02_git_head.txt         # Right repo?
cat /tmp/ft_probe_*/10_logs_grouped.txt    # Any logs at all?
cat /tmp/ft_probe_*/20_probe_any.txt       # Any PROBE markers?
```

### "forge logs returned empty"
```bash
# Verify forge is working:
forge whoami                    # Should show your Atlassian account
forge list --environment production 2>&1  # May not work, but shouldn't error

# Try manual log fetch:
cd /workspaces/Firsttry/atlassian/forge-app
forge logs --environment production --limit 100
```

### Footer still shows old format
```bash
# Hard refresh not working:
1. Close all browser tabs with the gadget
2. Open DevTools → Application → Clear all storage
3. Go to https://firsttry.atlassian.net
4. Ctrl+Shift+R (hard refresh)
5. Wait 5 seconds for gadget to load
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| [src/resolvers/probe.ts](../atlassian/forge-app/src/resolvers/probe.ts) | Probe resolver (extraction, nonce, logging) |
| [src/resolvers/gadget-handlers.ts](../atlassian/forge-app/src/resolvers/gadget-handlers.ts#L195) | ALLOWED_RESOLVERS registration |
| [tests/forensic_probe.test.ts](../atlassian/forge-app/tests/forensic_probe.test.ts) | 20 tests (extraction, registration, hashing) |
| [tools/probe_prod.sh](../tools/probe_prod.sh) | Production forensic script (deterministic verdict) |

---

## Complete Documentation

- [FORENSIC_PROBE_PROOF_READY.md](FORENSIC_PROBE_PROOF_READY.md) - Full technical details
- [DEPLOYMENT_VERIFICATION_v2_95_0.md](DEPLOYMENT_VERIFICATION_v2_95_0.md) - Deployment checklist

---

## Copy-Paste Commands

### After UI shows probe response:
```bash
# Replace with actual values from UI:
UI_REQ_ID="ui_REPLACE_WITH_VALUE_FROM_UI"
PROBE_NONCE="probe_REPLACE_WITH_VALUE_FROM_UI"

cd /workspaces/Firsttry
bash tools/probe_prod.sh "$UI_REQ_ID" "$PROBE_NONCE"
```

### To manually check logs:
```bash
cd /workspaces/Firsttry/atlassian/forge-app
forge logs --environment production --limit 500 --grouped | grep -E "(PROBE|probe)" | head -20
```

### To verify probe code is deployed:
```bash
grep -r "async function probe" src/resolvers/
# Should find: probe.ts definition
```

---

**Status:** Ready for manual user testing. UI button implementation pending.
