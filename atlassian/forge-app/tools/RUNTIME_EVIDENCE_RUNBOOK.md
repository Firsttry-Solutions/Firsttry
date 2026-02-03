# Runtime Evidence Capture Runbook

## Overview

This runbook guides you through capturing real runtime evidence from Forge staging environment after the dashboard UI is deployed.

The verification is **fail-closed**: any gate failure immediately marks the entire verification as FAIL with explicit reasons. There are no subjective checks or assumptions.

## Prerequisites

- Dashboard deployed to Forge STAGING
- Browser with DevTools (F12)
- Terminal with Forge CLI authenticated
- Access to `/tmp` for temporary files

## Step 1: Capture Correlation ID from Browser Console

**Goal**: Get the correlation ID that links UI logs to backend resolver logs.

### Instructions

1. Open the staging dashboard in your browser:
   ```
   https://staging.eu-west-1.atlassian.net/cloud/firsttry/governance-status
   ```
   (Or your staging URL)

2. Wait for page to fully load (dashboard renders)

3. Open DevTools: Press `F12`

4. Go to **Console** tab

5. Look for a line containing `[UI_CORRELATION_ID_SET]` or `[UI_CORRELATION_ID]`

6. Copy the correlation ID value, it will look like:
   ```
   correlation_1704067200000_abc123def456
   ```

7. Save this value in a text file or note it down. You'll need it in Step 2.

**Example**: If you see:
```
[UI_CORRELATION_ID_SET] {correlationId: "correlation_1704067200000_abc123"}
```

Then your CORRELATION_ID is: `correlation_1704067200000_abc123`

---

## Step 2: Capture Forge Logs with Correlation Cross-Check

**Goal**: Verify that the resolver was invoked with the same correlation ID and responded successfully.

### Instructions

1. Open a terminal in the repo root:
   ```bash
   cd /workspaces/Firsttry/atlassian/forge-app
   ```

2. Run the capture script with your CORRELATION_ID from Step 1:
   ```bash
   CORRELATION_ID=correlation_1704067200000_abc123 ENVIRONMENT=staging bash tools/capture_runtime_evidence.sh
   ```

   Replace `correlation_1704067200000_abc123` with your actual correlation ID from Step 1.

3. The script will:
   - Fetch the last 2000 lines of Forge logs from staging
   - Extract resolver entry/OK/error markers
   - Check 4 gates:
     - G1: Correlation ID present in logs (>= 1 mention)
     - G2: Resolver entry marker logged (>= 1)
     - G3: Resolver success logged, no errors (>= 1 OK, 0 ERR)
     - G4: SnapshotId present in logs (>= 1)

4. Expected output if all gates PASS:
   ```
   ==== GATE SUMMARY ====
   G1 (Correlation ID Present):   PASS
   G2 (Resolver Entry Logged):    PASS
   G3 (Resolver Success Logged):  PASS
   G4 (SnapshotId Present):       PASS

   ✅ PASS: All runtime evidence gates verified
   ```

5. **If any gate fails**, the script will output:
   ```
   ❌ FAIL: Runtime evidence gates verification failed
   [reason for each failed gate]
   ```

6. Output is saved to `/tmp/ft_runtime_evidence_<timestamp>/`

   Key files:
   - `10_forge_logs_raw.txt` - Raw Forge logs (entire capture)
   - `11_resolver_lines.txt` - Extracted resolver markers
   - `12_correlation_hits.txt` - Lines mentioning correlation ID
   - `20_gate_results.txt` - Gate definitions
   - `FAIL_REASON.txt` - If any gate failed (detailed reason)

---

## Step 3: Capture Browser Console Evidence

**Goal**: Verify that the UI markers (build SHA, build time, identity source) are rendered correctly.

### Instructions

1. Still in DevTools Console from Step 1, paste the entire contents of:
   ```
   tools/devtools_gate.js
   ```

2. Press `Enter` to execute the script

3. You will see output like:
   ```
   🔍 === FT RUNTIME EVIDENCE GATE - BROWSER CONSOLE ===

   📊 GATE A: Build SHA Marker
     Element found: YES
     Content: cfa369c607d47280c2aec9147a731f7e51e77534
     Matches 40-hex pattern: true
     Status: ✅ PASS

   📊 GATE B: Build Time Marker
     Element found: YES
     Content: 2025-02-01T06:30:00Z
     Matches RFC3339 pattern: true
     Status: ✅ PASS

   📊 GATE C: Identity Source Marker
     Marker element found: YES
     Status: ✅ PASS

   📊 GATE D: Correlation ID Set
     window.__FT_CORRELATION_ID: correlation_1704067200000_abc123
     Type: string
     Non-empty: YES
     Status: ✅ PASS

   ═══════════════════════════════════════
   VERDICT: ✅ PASS - ALL GATES GREEN
   ═══════════════════════════════════════
   ```

4. **If any gate shows FAIL**, stop here and note which gates failed:
   - GA FAIL: Build SHA missing or invalid (not 40 hex chars)
   - GB FAIL: Build Time missing or not RFC3339 format
   - GC FAIL: Identity source marker missing from DOM
   - GD FAIL: Correlation ID not set in window global

5. Right-click the console output and select **"Save as HTML"** OR copy the entire console section to a text file named `devtools_console_output.txt`

---

## Step 4: Verify Both Evidence Passes

**Goal**: Confirm that both Forge logs and DevTools evidence gates all passed.

### Summary Check

From Step 2, you should have:
```
✅ PASS: All runtime evidence gates verified
```

From Step 3, you should have:
```
✅ PASS - ALL GATES GREEN
```

If both show PASS:
```
✅ FINAL VERDICT: PASS
   All runtime evidence verified from real Forge logs + real browser console
   This deployment is production-ready
```

If either shows FAIL:
```
❌ FINAL VERDICT: FAIL
   Failed gates: [list each failed gate]
   Action: Investigate and fix before proceeding
```

---

## Troubleshooting

### Step 1: Can't find correlation ID in console
- **Cause**: Page didn't fully load, or correlation ID was set before you opened console
- **Fix**: Refresh page (F5), immediately open DevTools (F12), look for `[UI_CORRELATION_ID_SET]` in the first few console lines

### Step 2: Gate G1 fails (Correlation ID not in logs)
- **Cause**: Dashboard wasn't used after deployment, or logs were rotated
- **Fix**: Go back to Step 1, make sure the dashboard refreshed AFTER you read the correlation ID, then run the script again

### Step 2: Gate G3 fails (Resolver didn't respond successfully)
- **Cause**: Backend resolver crashed or returned error
- **Fix**: Check the `11_resolver_lines.txt` file - look for `[FT_RESOLVER_ERR]` lines and read the error message

### Step 3: Gate GA fails (Build SHA invalid)
- **Cause**: Build SHA marker missing from DOM or contains placeholder value
- **Fix**: Check that `src/gadget-ui/index.html` has `<div data-ft-build-sha="true">...` element with real SHA

### Step 3: Gate GD fails (Correlation ID not set)
- **Cause**: window global not set by UI
- **Fix**: Make sure UI code is fully loaded, check main.ts `ensureCorrelationId()` function is running

---

## Gate Definitions (Reference)

### Forge Logs Gates

| Gate | Check | Expected | FAIL If |
|------|-------|----------|---------|
| G1 | Correlation ID in logs | >= 1 mention | Count = 0 |
| G2 | Resolver entry marker | >= 1 `[FT_RESOLVER_ENTRY]` | Count = 0 |
| G3 | Resolver success | >= 1 `[FT_RESOLVER_OK]` + 0 `[FT_RESOLVER_ERR]` | OK = 0 or ERR > 0 |
| G4 | SnapshotId present | >= 1 mention | Count = 0 |

### Browser Console Gates

| Gate | Check | Expected | FAIL If |
|------|-------|----------|---------|
| GA | Build SHA marker | 40 hex chars, data-ft-build-sha="true" | Missing or invalid |
| GB | Build Time marker | RFC3339 format (YYYY-MM-DDTHH:MM:SSZ), data-ft-build-time="true" | Missing or invalid |
| GC | Identity marker | Element with data-ft-identity-source="true" present | Missing |
| GD | Correlation ID | window.__FT_CORRELATION_ID set to non-empty string | Missing or empty |

---

## Final Output

After both steps pass, create a summary file:

```bash
cat > /tmp/RUNTIME_EVIDENCE_PASS.txt << 'EOF'
✅ FINAL VERDICT: PASS

Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Deployed SHA: cfa369c607d47280c2aec9147a731f7e51e77534
Environment: Forge STAGING (v2.34.0)

All gates verified:
  • Forge Logs Gates (G1-G4): PASS
  • Browser Console Gates (GA-GD): PASS

Evidence sources:
  • Real Forge logs from staging environment
  • Real browser console from deployed dashboard
  • Real correlation ID cross-check

This deployment is production-ready.
EOF
```

---

## Next Steps

1. If PASS: Ready for production deployment
2. If FAIL: Debug the failed gate(s) and re-run the verification

See COMPLETE_WORKFLOW_REPORT.md for full details of all gates and failure reasons.
