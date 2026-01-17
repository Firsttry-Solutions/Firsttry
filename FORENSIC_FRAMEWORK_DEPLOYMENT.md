# FORENSIC FRAMEWORK: Deployment & Verification Guide

## Overview

This document provides the **exact commands and steps** required to:
1. Deploy the updated FORENSIC_PROBE system to production
2. Execute the probe in Jira
3. Generate forensic evidence reports
4. Interpret diagnostic results

All steps are **deterministic** - no guessing, no assumptions. Every claim points to specific files and command outputs.

---

## PART 1: LOCAL VERIFICATION (Before Deployment)

### Step 1A: Verify Build Succeeds

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Run all tests (1464 tests)
npm test

# Expected: ✓ Test Files 118 passed (118) | Tests 1464 passed (1464)
```

### Step 1B: Build Gadget UI

```bash
cd /workspaces/Firsttry/atlassian/forge-app/src/gadget-ui
npm run build

# Expected output:
# ✓ 79 modules transformed
# ✓ built in ~450ms
# (No errors about PROBE_ENTRY, PROBE_OK, PROBE_ERR)
```

### Step 1C: Verify Scripts Are Executable

```bash
# Check forensic_report.sh
bash -n /workspaces/Firsttry/tools/forensic_report.sh
echo $?  # Expected: 0

# Check probe_prod.sh
bash -n /workspaces/Firsttry/tools/probe_prod.sh
echo $?  # Expected: 0
```

**File Locations (Verify These Exist):**
- ✓ `/workspaces/Firsttry/tools/forensic_report.sh` (369 lines)
- ✓ `/workspaces/Firsttry/tools/probe_prod.sh` (257 lines)
- ✓ `/workspaces/Firsttry/atlassian/forge-app/src/resolvers/probe.ts` (265 lines, updated with PROBE_ENTRY/PROBE_OK/PROBE_ERR markers)
- ✓ `/workspaces/Firsttry/atlassian/forge-app/src/gadget-ui/src/main.ts` (runProbe function at ~1450)
- ✓ `/workspaces/Firsttry/atlassian/forge-app/src/gadget-ui/index.html` (probe widget at ~95)

---

## PART 2: PRODUCTION DEPLOYMENT

### Step 2A: Authenticate to Forge Production

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Check current authentication
forge whoami

# Expected output includes:
#   Email: <your-email>@<domain>.com
#   Tenant: <tenant-name>
#   (other fields)

# If NOT authenticated, login:
forge login
```

### Step 2B: Verify Forge Installation Status

```bash
# Check that app is installed in production
forge install list --environment production

# Expected output includes a line like:
#   App ID: <app-id>
#   Version: 2.14.0
#   Environment: production
#   Status: installed
```

**⚠️ CRITICAL:** If app is NOT installed, install it first:

```bash
forge install --environment production
```

### Step 2C: Deploy Code to Production

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Build everything
npm run build

# Expected:
# ✓ Gadget UI builds successfully (79 modules, 456ms)
# ✓ Build succeeded
# ✓ Backend build: not configured (intentional)

# Deploy to production
forge deploy --environment production

# Expected:
# Deploying...
# ✓ App deployed successfully
# Version: 2.14.0 (new deployment timestamp)
```

### Step 2D: Upgrade Installation (Activate Deployment)

```bash
# Upgrade the installed app to the latest deployed version
forge install --upgrade --environment production

# Expected:
# ✓ Installation upgraded
# Version: 2.14.0 (now matches deployment)
```

**Verification:** Confirm deployment by checking app version:

```bash
forge install list --environment production
# Version should now match deployment timestamp
```

---

## PART 3: MANUAL PROBE EXECUTION (In Jira)

### Step 3A: Reload the Gadget

1. Go to your Jira dashboard (https://<your-site>.atlassian.net)
2. Find the Firsttry gadget
3. Remove it (click "..." → Remove)
4. Re-add the gadget (Dashboard → Gadgets → Firsttry)
5. Hard refresh the page: `Ctrl+F5` (or `Cmd+Shift+R` on Mac)

### Step 3B: Locate the Probe Button

In the gadget, scroll to the **"FORENSIC_PROBE"** section.

You should see:
- A blue **"Run Probe"** button
- Below it: a status field (initially says "Ready")
- Below that: a large panel for response display

### Step 3C: Click "Run Probe"

1. Click the **"Run Probe"** button
2. Wait for response (should be < 2 seconds)
3. Look for **✅ PROBE SUCCESS** (green)

**Expected Success Response:**

```
✅ PROBE SUCCESS

PROOF LINES (Copy-Paste into Terminal):
PROBE_GREP_NONCE=probe_1705515396123_a7f2c1b3
PROBE_GREP_UI_REQ_ID=ui_1705515200456_d8f211a2
BACKEND_BUILD_SHA_FROM_RESPONSE=cdfa04fba064

Full Response JSON:
{
  "ok": true,
  "meta": {
    "ui_req_id": "ui_...",
    "probe_nonce": "probe_...",
    "backend_build_sha": "cdfa04...",
    ...
  },
  ...
}
```

**What This Proves:**
- ✅ UI was able to call the probe resolver
- ✅ Backend received the invocation and generated a unique nonce
- ✅ Nonce was returned to UI in response
- ✅ Response was successfully parsed and displayed

### Step 3D: Copy the Nonce

From the **PROOF LINES** section, copy the value from the first line:

```
PROBE_GREP_NONCE=probe_1705515396123_a7f2c1b3
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                THIS VALUE
```

**Save this value** - you'll use it in the next step.

### Step 3E: Wait for Log Propagation

Forge logs may take 10-30 seconds to appear in the production log stream.

**While waiting:** Open a terminal and prepare the verification command (see Step 4).

---

## PART 4: AUTOMATED PROOF VERIFICATION

### Step 4A: Run Proof Verification Script

Once you have the nonce from Step 3D:

```bash
cd /workspaces/Firsttry

# Run verification (replace <NONCE> with actual nonce from UI)
bash tools/probe_prod.sh --nonce probe_1705515396123_a7f2c1b3

# Expected output (PASS):
# ✅ PASS: Nonce found in production logs
# 
# First matching line (from grouped logs):
# {"marker":"PROBE",...,"probe_nonce":"probe_1705515396123_a7f2c1b3",...}
# 
# This PROVES:
#   ✓ UI invoked the probe resolver successfully
#   ✓ Backend generated and returned the nonce
#   ✓ Backend logged the nonce to production logs
#   ✓ Forge logs system captured and returned the production stream
#
# Output directory (for inspection): /tmp/ft_probe_<timestamp>
```

**Exit Code:** `0` = PASS, `2` = FAIL

### Step 4B: Verify Exit Code

```bash
echo $?
# Expected: 0 (PASS)
```

**If Exit Code = 0:** ✅ **PROOF COMPLETE**

**If Exit Code = 2:** See Troubleshooting section below.

---

## PART 5: FORENSIC DIAGNOSIS (If Proof Fails)

### Step 5A: Generate Comprehensive Forensic Report

If the simple nonce grep fails, generate a detailed diagnostic report:

```bash
cd /workspaces/Firsttry

# Generate report with the nonce that was NOT found
bash tools/forensic_report.sh --nonce probe_1705515396123_a7f2c1b3 --minutes 30

# Output:
# - Report file: /workspaces/Firsttry/FORENSIC_CHECK_REPORT.md
# - Evidence bundle: /tmp/ft_forensic_<timestamp>/
```

### Step 5B: Open the Forensic Report

```bash
# In VS Code or your editor:
open /workspaces/Firsttry/FORENSIC_CHECK_REPORT.md

# The report contains:
# 1. Environment proof (whoami, install list, forge auth)
# 2. Log capture metadata (file sizes, timestamps)
# 3. Binary search results table
#    - Column 1: Evidence type
#    - Column 2: Grouped logs count
#    - Column 3: Raw logs count
#    - Column 4: Found? (✅ YES / ❌ NO)
# 4. Evidence excerpts (max 30 lines each)
# 5. Diagnosis decision tree (4 branches: A/B/C/D)
#    - Branch A: Logs are empty (auth/env problem)
#    - Branch B: Logs captured but no PROBE markers (probe not invoked)
#    - Branch C: Plain-text markers missing (logging method issue)
#    - Branch D: Markers present but nonce not in window (timing issue)
```

### Step 5C: Follow the Diagnosis

The report's "Diagnosis" section tells you EXACTLY which branch applies:

**Example Branch B Diagnosis:**

```
Branch B: Probe invoked but not running (wrong resolver wiring / allowlist / handler dispatch)

Evidence Supporting This Diagnosis:
- Log file has content (1,245 bytes) but no PROBE_ENTRY/PROBE_OK/PROBE_ERR or probe nonce

Immediate Next Action:
1. Verify handler registration: grep -r 'ALLOWED_RESOLVERS' src/resolvers/
2. Re-deploy with explicit logging: npm test && npm run build:gadget && forge deploy
3. Run button again, re-capture nonce, verify with probe_prod.sh
```

---

## TROUBLESHOOTING

### Symptom: "❌ FAIL: Nonce NOT found in production logs"

**Step 1:** Check log capture is not empty

```bash
# Look at the output directory from probe_prod.sh
ls -lh /tmp/ft_probe_<latest>/10_logs_grouped.txt

# If size is < 100 bytes:
# - Problem: Logs not captured
# - Action: Check forge whoami, forge install list, try with --minutes 60
```

**Step 2:** Check for PROBE markers AT ALL

```bash
# In the output directory:
wc -l /tmp/ft_probe_<latest>/20_entry_grouped.txt
wc -l /tmp/ft_probe_<latest>/21_ok_grouped.txt
wc -l /tmp/ft_probe_<latest>/22_err_grouped.txt

# If all are 0:
# - Problem: Probe resolver not invoked
# - Action: Verify UI button exists, click it again, check for errors in browser devtools
```

**Step 3:** Verify deployment version

```bash
# Check deployment in production
forge install list --environment production

# Verify the probe.ts has PROBE_ENTRY/PROBE_OK/PROBE_ERR logging
grep -n "PROBE_ENTRY\|PROBE_OK\|PROBE_ERR" src/resolvers/probe.ts

# If grep returns nothing:
# - Problem: Code wasn't updated
# - Action: Re-run the changes, npm run build, forge deploy, forge install --upgrade
```

### Symptom: "PROBE_OK marker found but nonce NOT found"

**This means:** Probe ran successfully, but the specific nonce wasn't captured in the log window.

**Action:**
1. Re-run probe (click button again, get new nonce)
2. Immediately run verification:
   ```bash
   bash tools/probe_prod.sh --nonce <NEW_NONCE> --minutes 60
   ```

### Symptom: UI shows "❌ PROBE ERROR"

**This means:** Backend executed but hit an exception.

**What to do:**
1. Look at the error message in the UI response
2. Check the **trace_id_stable** value
3. Use that to search logs:
   ```bash
   bash tools/probe_prod.sh --nonce <NONCE> --minutes 60
   ```
4. In the output directory, grep for the trace_id:
   ```bash
   grep "<trace_id>" /tmp/ft_probe_<latest>/10_logs_grouped.txt
   ```

---

## SUCCESS CRITERIA

### ✅ PROOF ACCEPTED if:

1. **Nonce is visible in UI**
   - Run Probe button shows ✅ PROBE SUCCESS
   - PROOF LINES section displays the nonce clearly
   - Full JSON response is visible in `<pre>` block

2. **Nonce is found in production logs**
   - `bash tools/probe_prod.sh --nonce <nonce>` returns exit code **0**
   - Output says: `✅ PASS: Nonce found in production logs`
   - First matching line is printed (either grouped or raw format)

3. **Nonce is EXACT match**
   - The nonce from UI matches the nonce in logs (binary match)
   - No regex, no fuzzy matching, no "probably"

4. **Markers are present**
   - Logs contain at least ONE of: PROBE_ENTRY, PROBE_OK, or PROBE_ERR
   - OR logs contain JSON marker `"marker":"PROBE"`

### ❌ PROOF REJECTED if:

1. ❌ Nonce NOT found in logs (`exit code 2`)
2. ❌ No PROBE markers found at all
3. ❌ Logs are empty or not captured
4. ❌ Nonce found in logs but doesn't match UI value exactly

---

## EXACT COMMAND SUMMARY (Copy-Paste Ready)

### Deploy to Production (10 minutes)

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Verify
npm test
npm run build

# Deploy
forge deploy --environment production
forge install --upgrade --environment production

# Verify deployment
forge install list --environment production
```

### Execute Proof (5 minutes)

```bash
# 1. Click "Run Probe" button in gadget
#    (Wait for ✅ PROBE SUCCESS)
#    (Copy PROBE_GREP_NONCE=probe_... value)

# 2. In terminal:
cd /workspaces/Firsttry
bash tools/probe_prod.sh --nonce probe_1705515396123_a7f2c1b3

# Expected: ✅ PASS (exit 0)
```

### Generate Diagnosis (If Needed)

```bash
cd /workspaces/Firsttry
bash tools/forensic_report.sh --nonce probe_1705515396123_a7f2c1b3 --minutes 30

# Read: FORENSIC_CHECK_REPORT.md
open FORENSIC_CHECK_REPORT.md
```

---

## EVIDENCE ARTIFACTS

### What Gets Generated

**On Every Verification Run:**
- `/tmp/ft_probe_<timestamp>/00_whoami.txt` - Forge auth proof
- `/tmp/ft_probe_<timestamp>/01_install_list.txt` - App installation proof
- `/tmp/ft_probe_<timestamp>/02_git_head.txt` - Git commit (code version)
- `/tmp/ft_probe_<timestamp>/10_logs_grouped.txt` - Full grouped logs (searchable)
- `/tmp/ft_probe_<timestamp>/11_logs_raw.txt` - Full raw logs (searchable)
- `/tmp/ft_probe_<timestamp>/20_entry_grouped.txt` - PROBE_ENTRY matches
- `/tmp/ft_probe_<timestamp>/21_ok_grouped.txt` - PROBE_OK matches
- `/tmp/ft_probe_<timestamp>/22_err_grouped.txt` - PROBE_ERR matches
- `/tmp/ft_probe_<timestamp>/23_probe_json_grouped.txt` - JSON marker matches

**On Forensic Report Generation:**
- `/workspaces/Firsttry/FORENSIC_CHECK_REPORT.md` - Comprehensive diagnostic report
- `/tmp/ft_forensic_<timestamp>/` - Evidence bundle (all above files + report)

### How to Inspect Evidence

```bash
# Find latest probe bundle
ls -dt /tmp/ft_probe_* | head -1

# Example: /tmp/ft_probe_20260117_155823

# View full logs
less /tmp/ft_probe_20260117_155823/10_logs_grouped.txt

# Count markers
grep -c "PROBE_OK" /tmp/ft_probe_20260117_155823/10_logs_grouped.txt

# Extract nonce matches
grep "probe_<nonce>" /tmp/ft_probe_20260117_155823/10_logs_grouped.txt
```

---

## WHAT EACH MARKER MEANS

### Plain-Text Markers (Primary Proof)

**PROBE_ENTRY:** Backend received the invoke() call from UI

```
PROBE_ENTRY nonce=probe_1705515396123_a7f2c1b3 ui=ui_1705515200456_d8f211a2 build=cdfa04fba064 ts=2026-01-17T15:56:12Z
```

**PROBE_OK:** Backend successfully generated response

```
PROBE_OK nonce=probe_1705515396123_a7f2c1b3 ui=ui_1705515200456_d8f211a2 build=cdfa04fba064 ts=2026-01-17T15:56:12Z
```

**PROBE_ERR:** Backend hit an exception (rare)

```
PROBE_ERR nonce=probe_1705515396123_a7f2c1b3 ui=ui_1705515200456_d8f211a2 code=PROBE_EXCEPTION trace=abc123 ts=2026-01-17T15:56:12Z
```

### JSON Markers (Secondary Proof)

```json
{"marker":"PROBE","ui_req_id":"ui_...","probe_nonce":"probe_...","backend_build_sha":"cdfa04...","forge_env":"production","function_name":"probe-resolver","observed":{...}}
```

---

## REGULATORY NOTES

This forensic framework provides **non-repudiable evidence** that:

1. **UI invoked backend:** Nonce was generated by backend (not spoofed by UI)
2. **Backend logged invocation:** Plain-text + JSON logs prove execution occurred
3. **Logs were captured:** forge logs successfully captured production stream
4. **Same nonce in both:** Exact binary match between UI response and log grep

This can be repeated **any time** with the **same nonce**, proving the probe is working deterministically, not randomly.

---

## NEXT STEPS AFTER SUCCESS

Once proof is complete (exit code 0):

1. **Document the proof:**
   - Take screenshot of UI with nonce
   - Save output of `bash tools/probe_prod.sh`
   - Archive `/tmp/ft_probe_<timestamp>/` directory

2. **Share evidence:**
   - Include FORENSIC_CHECK_REPORT.md in compliance documentation
   - Reference this deployment guide for repeatability

3. **Maintain auditability:**
   - Keep deployment version pinned: `forge install list --environment production`
   - Re-run proof quarterly to validate continued operation
   - Update this guide if deployment environment changes
