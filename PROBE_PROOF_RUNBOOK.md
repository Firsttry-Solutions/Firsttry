# FORENSIC_PROBE: Hard Proof Runbook

**Objective:** Prove that the probe works end-to-end by showing:
1. The exact nonce in the UI response (fact, not claim)
2. The **same nonce** in production logs (deterministic verification)

**Status:** Ready for execution

---

## Prerequisites

- Access to Jira dashboard with Firsttry gadget
- Terminal with `forge` CLI authenticated
- `bash` shell

---

## STEP 1: Build & Deploy

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Build gadget UI (should complete in < 1 minute)
cd src/gadget-ui
npm run build
# Expected: ✓ 79 modules transformed, built in ~450ms

# Go back and deploy
cd ../..

# Deploy to production
forge deploy --environment production
# Watch logs for: "✓ App deployed successfully"

# Upgrade installation
forge install --upgrade --environment production
# Watch logs for: "✓ Installation upgraded"
```

**Status after Step 1:**
- ✅ Gadget UI built
- ✅ Backend probe resolver deployed
- ✅ Verification script in place
- ✅ Ready for proof execution

---

## STEP 2: Manual Proof (UI Click)

### 2A: Reload Gadget in Browser

1. Open Jira: https://firsttry.atlassian.net
2. Go to dashboard with Firsttry gadget
3. Remove gadget (click gear → Remove)
4. Re-add gadget (Add Gadget → Find Firsttry → Add)
5. Hard refresh: `Ctrl+F5` (or `Cmd+Shift+R` on Mac)
6. Wait for gadget to load

**Check:** Gadget loaded successfully, "🔬 Forensic Probe" section visible

### 2B: Click "Run Probe" Button

1. Scroll to "🔬 Forensic Probe (Production Correlation Proof)" section
2. Click blue "Run Probe" button
3. Wait ~2 seconds for response

**Expected UI Output:**
```
✅ PROBE SUCCESS

PROOF LINES (Copy-Paste into Terminal):
PROBE_GREP_NONCE=probe_1768662844441_af14b920
PROBE_GREP_UI_REQ_ID=ui_1768660190864_d8f211a2
BACKEND_BUILD_SHA_FROM_RESPONSE=cdfa04fba064

Full Response JSON:
{
  "ok": true,
  "meta": {
    "ui_req_id": "ui_1768660190864_d8f211a2",
    "probe_nonce": "probe_1768662844441_af14b920",
    "backend_build_sha": "cdfa04fba064",
    ...
  },
  ...
}
```

### 2C: Copy the Nonce

From the "PROOF LINES" section, note:
- **PROBE_GREP_NONCE** = `probe_1768662844441_af14b920` (CRITICAL: This is your proof!)

**Status after Step 2:**
- ✅ UI displays nonce
- ✅ Nonce is visible proof that backend executed
- ✅ Ready for log verification

---

## STEP 3: Automated Proof (Verification Script)

### 3A: Run Verification Script (Immediate)

In terminal, run immediately (within 5 minutes):

```bash
cd /workspaces/Firsttry

# Run verification with nonce from Step 2C
bash tools/probe_prod.sh --nonce probe_1768662844441_af14b920

# Optional: also include ui_req_id (adds extra verification)
bash tools/probe_prod.sh --nonce probe_1768662844441_af14b920 --ui ui_1768660190864_d8f211a2

# Optional: specify lookback window in minutes (default: 20)
bash tools/probe_prod.sh --nonce probe_1768662844441_af14b920 --minutes 30
```

### 3B: Expected Output (PASS)

```
╔════════════════════════════════════════════════════════════════╗
║ FORENSIC_PROBE: Production Log Capture & Verification          ║
╚════════════════════════════════════════════════════════════════╝

PROBE_NONCE:  probe_1768662844441_af14b920
UI_REQ_ID:    ui_1768660190864_d8f211a2
LOOKBACK:     20 minutes
OUTPUT_DIR:   /tmp/ft_probe_20250117_143522

Step 1: Capturing environment...
Step 2: Capturing production logs (20min lookback, timeout 120s)...
  Grouped logs: 45823 bytes
  Raw logs:     42156 bytes

Step 3: Searching for any PROBE markers...
  Grouped logs: 2 PROBE markers
  Raw logs:     2 PROBE markers

Step 4: Searching for exact nonce: probe_1768662844441_af14b920
  Grouped logs: 1 matches
  Raw logs:     1 matches

Step 5: Searching for ui_req_id: ui_1768660190864_d8f211a2
  Grouped logs: 1 matches
  Raw logs:     1 matches

════════════════════════════════════════════════════════════════
VERDICT
════════════════════════════════════════════════════════════════

✅ PASS: Nonce found in production logs

First matching line (from raw logs):
{"marker":"PROBE","ui_req_id":"ui_1768660190864_d8f211a2","probe_nonce":"probe_1768662844441_af14b920","backend_build_sha":"cdfa04fba064",...}

This PROVES:
  ✓ UI invoked the probe resolver successfully
  ✓ Backend generated and returned the nonce
  ✓ Backend logged the nonce to production logs
  ✓ Forge logs system captured and returned the production stream

Output directory (for inspection): /tmp/ft_probe_20250117_143522

Exit code: 0
```

**Script Behavior:**
- ✅ **PASS** (exit 0): Nonce found in EITHER grouped OR raw logs
- ❌ **FAIL** (exit 2): Nonce NOT found, diagnostics provided

---

## Proof Acceptance Criteria

### ✅ Proof is VALID if:

1. **UI Response Contains Nonce** ✓
   - PROOF_LINES shows `PROBE_GREP_NONCE=probe_...`
   - JSON response contains `meta.probe_nonce`
   - Nonce is non-empty and unique

2. **Verification Script Finds Nonce** ✓
   - Script runs with `--nonce <nonce>`
   - Output shows `✅ PASS: Nonce found in production logs`
   - Exit code is 0
   - First matching line is printed

3. **Nonce Matches in Both** ✓
   - UI nonce == Log nonce (binary match)
   - Backend build SHA matches (metadata verification)
   - Timestamps correlate (within 5 seconds)

### ❌ Proof is INVALID if:

1. UI doesn't show nonce (button doesn't work)
2. Button shows error instead of nonce
3. Script returns FAIL with exit code 2
4. Nonce values don't match between UI and logs
5. Script says "Nonce NOT found" (means backend didn't log it)

---

## Troubleshooting

### Problem: "Run Probe" Button Not Visible

**Cause:** Old UI still cached
**Fix:**
```bash
# Hard refresh browser
Ctrl+F5 (Windows/Linux)
Cmd+Shift+R (Mac)

# Or remove & re-add gadget entirely
```

### Problem: Button Shows "INVOKE_THROW" Error

**Cause:** Backend probe resolver not deployed
**Fix:**
```bash
cd atlassian/forge-app
forge deploy --environment production
forge install --upgrade --environment production

# Check logs for errors
forge logs --environment production | grep -i probe
```

### Problem: Script Returns FAIL (Exit 2)

**Cause:** Nonce not found in logs (one of 4 reasons)
**Diagnostics:**
```bash
# Check if any PROBE markers logged at all
forge logs --environment production --limit 1000 | grep -i PROBE

# Check if logs are returning data
forge logs --environment production --limit 10 | head -20

# Check authentication
forge whoami
forge install list --environment production
```

**Common Fixes:**
1. Re-run UI probe (generate fresh nonce)
2. Run script immediately (within 5 minutes)
3. Increase lookback: `--minutes 30` or `--minutes 60`
4. Check backend version: `forge install list --environment production`

---

## What This Proves

### Technical Proof:
✓ UI successfully invoked the probe resolver
✓ HTTP request reached the backend
✓ Backend probe function executed
✓ Nonce was generated (cryptographically random)
✓ Backend returned response to UI
✓ Backend logged nonce to production logs
✓ Forge logs captured the production stream
✓ Nonce is grepable from logs

### Operational Proof:
✓ Both UI and backend are deployed (same version)
✓ Full stack integration is functional
✓ No gaps in the UI → Backend → Logs chain
✓ Application is operational end-to-end

### Compliance Proof:
✓ Deterministic (not probabilistic)
✓ Permanent (in logs, auditable)
✓ Reproducible (same nonce + grep works)
✓ Non-repudiable (proof in production logs)

---

## Quick Reference

### Commands

```bash
# Build & deploy
cd /workspaces/Firsttry/atlassian/forge-app/src/gadget-ui && npm run build && cd ../.. && forge deploy --environment production

# Run verification
bash /workspaces/Firsttry/tools/probe_prod.sh --nonce <NONCE>

# Check backend logs for probe
forge logs --environment production | grep -i probe_nonce

# Check any PROBE markers
forge logs --environment production | grep '"marker":"PROBE'
```

### Files

| File | Purpose |
|------|---------|
| `src/gadget-ui/src/main.ts` | UI runProbe() function |
| `src/resolvers/probe.ts` | Backend probe resolver |
| `tools/probe_prod.sh` | Verification script |
| `/tmp/ft_probe_*` | Script output (diagnostics) |

---

## Success Scenario

```
1. Click "Run Probe" button
   ↓
2. UI displays: "✅ PROBE SUCCESS"
   ↓
3. Copy nonce: probe_1768662844441_af14b920
   ↓
4. Run script: bash tools/probe_prod.sh --nonce <nonce>
   ↓
5. Script output: "✅ PASS: Nonce found in production logs"
   ↓
6. First matching line shown with exact nonce
   ↓
7. Exit code: 0
   ↓
   PROOF COMPLETE ✅
```

**Time: ~5 minutes total**

---

## Next Steps (If Proof Succeeds)

1. Document the PASS verdict with nonce + output
2. Celebrate: End-to-end correlation proved! 🎉
3. Archive logs: `/tmp/ft_probe_*` directory (for audit)
4. Repeat: Can run proof anytime to verify health

---

**Last Updated:** 2025-01-17
**Status:** Ready to Execute
**Exit Condition:** PASS or FAIL (binary, deterministic)
