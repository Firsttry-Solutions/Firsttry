# BACKBONE LAYER 0: INVOCATION PROOF HARNESS

**Purpose:** Deterministically prove (or disprove) that the Jira gadget UI successfully invokes production backend resolvers and that requests correlate via `ui_req_id`.

**Document Version:** 1.0  
**Last Updated:** 2026-01-18

---

## Overview

This document describes the invocation proof harness—a bash script that captures real evidence from production logs to answer:

1. **Does the gadget UI invoke the backend?** (Yes/No)
2. **Can we correlate UI requests to backend resolvers?** (Via `ui_req_id`)
3. **Is build metadata correctly injected?** (Valid `backend_build_sha`)

The harness is **non-invasive**, captures **real production logs**, and uses **standard grep/sed/awk** (no jq, no complex parsing).

---

## Quick Start

```bash
cd atlassian/forge-app
bash tools/l0_invocation_proof.sh
```

**When prompted:**
1. Open the Jira dashboard with the Firsttry gadget
2. Hard refresh the page
3. Click "Refresh now" button
4. Click "Run Probe" button
5. Wait 5-10 seconds
6. Copy the `ui_req_id` from the gadget footer (format: `ui_XXXXXXX...`)
7. Paste it into the script prompt

**Output:**
- Evidence directory: `/tmp/ft_l0_invocation_<TIMESTAMP>/`
- Report: `docs/BACKBONE_L0_INVOCATION_PROOF_RESULT.md`
- Exit code: `0` (PASS) or `1` (FAIL)

---

## Script Flow

### Phase 1: Context Capture (Automated)

**Files created:**
- `01_head.txt` — Current git commit SHA
- `02_whoami.txt` — Forge authentication context
- `03_install_prod.txt` — Production gadget installations

**Purpose:** Establish reproducible context for evidence audit trail.

### Phase 2: Pre-Action Logs (Automated)

**Files created:**
- `10_logs_pre_raw.txt` — Raw logs from last 10 minutes
- `11_logs_pre_grouped.txt` — Grouped logs for readability

**Purpose:** Baseline: capture any background activity before user action.

### Phase 3: Human Interaction (Manual)

**User must:**
1. Navigate to dashboard
2. Hard refresh (clear cache)
3. Click "Refresh now"
4. Click "Run Probe"
5. Wait 5-10 seconds for gadget to load
6. Copy `ui_req_id` from footer
7. Paste into script

**Why:** The UI footer contains the exact `ui_req_id` that was sent to the backend. We use this to correlate logs.

### Phase 4: Post-Action Logs (Automated)

**Files created:**
- `20_logs_post_raw.txt` — Raw logs from last 10 minutes (after user action)
- `21_logs_post_grouped.txt` — Grouped logs after user action

**Purpose:** Capture all backend activity during and after user interaction.

### Phase 5: Evidence Extraction (Automated, grep-based)

**Files created:**

| File | Content |
|------|---------|
| `30_uireq_hits.txt` | All log lines containing the UI_REQ_ID |
| `31_marker_hits.txt` | All lines with `RESOLVER_ENTER`, `RESOLVER_OK`, `RESOLVER_ERR`, etc. |
| `32_uireq_with_markers.txt` | Lines where UI_REQ_ID AND resolver markers co-occur |
| `33_sha_values.txt` | Extracted `backend_build_sha` values from logs |
| `34_unique_shas.txt` | Unique SHA values (should all be the same) |
| `40_counts.txt` | Occurrence counts of each marker type |

**Example counts:**
```
UIREQ_COUNT=8
RESOLVER_ENTER_COUNT=3
RESOLVER_OK_COUNT=2
RESOLVER_ERR_COUNT=1
PING_COUNT=4
PROBE_COUNT=2
BUILD_SHA_COUNT=12
```

---

## PASS/FAIL Criteria

### ✅ PASS (All three gates must pass)

1. **UI_REQ_ID appears in logs** (`UIREQ_COUNT ≥ 1`)
   - The provided `ui_req_id` is found in production logs at least once
   - Proves: UI successfully sent request to backend OR backend processed it

2. **RESOLVER_ENTER marker exists** (`RESOLVER_ENTER_COUNT ≥ 1`)
   - Backend logs contain `RESOLVER_ENTER` marker (logged at handler entry)
   - Proves: Backend resolver was invoked by UI

3. **Valid backend_build_sha in RESOLVER_ENTER line** (`VALID_SHA_COUNT ≥ 1`)
   - Lines containing both UI_REQ_ID and RESOLVER_ENTER have valid SHA (7-40 hex chars)
   - Proves: Build metadata was correctly injected and included in response

### ❌ FAIL (Any gate failing)

**If UI_REQ_ID not in logs:**
- Interpretation: UI may not have invoked backend, or logs are delayed
- Action: Wait 30 seconds, re-run with same UI_REQ_ID

**If RESOLVER_ENTER missing:**
- Interpretation: Backend resolver was not invoked from UI
- Action: Check gadget code is calling backend, verify network connectivity

**If backend_build_sha invalid:**
- Interpretation: Build script may have failed or resolver not updated
- Action: Run `node tools/build_meta.mjs` and redeploy

---

## Understanding the Logs

### What RESOLVER_ENTER looks like

```json
{
  "marker": "RESOLVER_ENTER",
  "resolver": "getStatusSnapshot",
  "ui_req_id": "ui_abc123def456",
  "backend_build_sha": "535f30e",
  "ts": "2026-01-18T04:35:15Z"
}
```

This is logged in `src/resolvers/gadget-handlers.ts` when the handler receives a request:

```typescript
console.log(
  JSON.stringify({
    marker: "RESOLVER_ENTER",
    resolver: resolverName,
    ui_req_id,
    backend_build_sha: BACKEND_BUILD_SHA,
    ts: new Date().toISOString()
  })
);
```

### What RESOLVER_OK looks like

```json
{
  "marker": "RESOLVER_OK",
  "resolver": "getStatusSnapshot",
  "ui_req_id": "ui_abc123def456",
  "backend_build_sha": "535f30e",
  "durationMs": 124,
  "ts": "2026-01-18T04:35:16Z"
}
```

Success marker logged after resolver returns without error.

### What RESOLVER_ERR looks like

```json
{
  "marker": "RESOLVER_ERR",
  "resolver": "getStatusSnapshot",
  "ui_req_id": "ui_abc123def456",
  "backend_build_sha": "535f30e",
  "error_code": "SNAPSHOT_QUERY_FAILED",
  "trace_id_stable": "trace_def456ghi789",
  "ts": "2026-01-18T04:35:16Z"
}
```

Error marker logged if resolver throws.

---

## Evidence Interpretation

### Scenario 1: Full Happy Path (PASS)

```
Pre-action logs: Background activity only, no relevant markers
User: Opens gadget, clicks buttons, provides ui_req_id "ui_xyz789"
Post-action logs:
  - RESOLVER_ENTER for "ui_xyz789" with backend_build_sha="535f30e"
  - RESOLVER_OK for "ui_xyz789"
  - PING_OK and PROBE_OK markers

Interpretation: ✅ UI successfully invoked backend, correlation verified, build SHA valid
```

### Scenario 2: UI Not Invoking (FAIL)

```
Pre-action logs: Background activity only
User: Opens gadget, tries to click "Refresh now", but button doesn't work or doesn't respond
       Gadget footer shows no ui_req_id
       User provides "ui_UNKNOWN" (not from footer)
Post-action logs: No RESOLVER_ENTER for that ui_req_id

Interpretation: ❌ UI did not invoke backend
Action: Check gadget UI code, verify network calls are being made
```

### Scenario 3: Backend Invoked But Build SHA Missing (FAIL)

```
Pre-action logs: Baseline
User: Opens gadget, clicks buttons, provides ui_req_id "ui_abc123"
Post-action logs:
  - RESOLVER_ENTER for "ui_abc123" but backend_build_sha is MISSING or "unknown"
  - RESOLVER_OK for "ui_abc123"

Interpretation: ❌ Build metadata not injected correctly
Action: Run "node tools/build_meta.mjs" to inject BACKEND_BUILD_SHA, redeploy
```

### Scenario 4: Logs Too Old (FAIL)

```
Post-action logs: No RESOLVER_ENTER at all
  (Possibly captured logs are from 15 minutes ago, older than 10-minute window)

Interpretation: ❌ Logs may be stale or script timing issue
Action: Re-run script immediately after user interaction (don't wait long)
```

---

## Troubleshooting

### Script fails: "forge whoami" or "forge logs" commands time out

**Cause:** Forge CLI not configured or network issue  
**Fix:**
```bash
# Check forge is installed
which forge
forge whoami

# If needed, re-authenticate
forge login
```

### Script fails: No RESOLVER_ENTER markers at all

**Cause:** Backend code not logging markers, or gadget-handlers.ts not deployed  
**Check:**
```bash
# Verify marker logging is in deployed code
grep -n "RESOLVER_ENTER" src/resolvers/gadget-handlers.ts

# Redeploy if needed
npm run predeploy:prod
forge deploy --environment production
```

### UI_REQ_ID provided but not found in logs

**Cause:** Gadget not actually invoking backend, or logs delayed  
**Fix:**
1. Wait 30 seconds (logs may lag)
2. Re-run script with same UI_REQ_ID
3. If still no match, verify gadget UI code is making backend calls

### backend_build_sha shows "unknown" or is missing

**Cause:** Build script didn't run or failed  
**Fix:**
```bash
# Re-run build injection
node tools/build_meta.mjs

# Check that backend_build.ts was updated with actual SHA
grep "export const BACKEND_BUILD_SHA" src/build/backend_build.ts

# Redeploy
npm run build:gadget
npm run predeploy:prod
forge deploy --environment production
```

---

## Evidence Files Reference

### Context Files
- `00_uireq.txt` — UI_REQ_ID provided by user (for reference)
- `01_head.txt` — Git HEAD SHA (to correlate with code version)
- `02_whoami.txt` — Forge auth context (who deployed, which account)
- `03_install_prod.txt` — Production gadget installations (what version is live)

### Log Files (Raw)
- `10_logs_pre_raw.txt` — 10 minutes of logs BEFORE user action
- `20_logs_post_raw.txt` — 10 minutes of logs AFTER user action

### Log Files (Grouped)
- `11_logs_pre_grouped.txt` — Same logs, grouped for readability
- `21_logs_post_grouped.txt` — Same logs, grouped for readability

### Extracted Evidence (Grep Results)
- `30_uireq_hits.txt` — All lines matching the provided UI_REQ_ID
- `31_marker_hits.txt` — All lines with resolver/probe/ping markers
- `32_uireq_with_markers.txt` — Lines with both UI_REQ_ID AND markers (correlation proof)
- `33_sha_values.txt` — All backend_build_sha values from logs
- `34_unique_shas.txt` — Unique SHA values (for verification)

### Counts File
- `40_counts.txt` — Metrics in key=value format:
  - `UIREQ_COUNT` — How many times UI_REQ_ID appears
  - `RESOLVER_ENTER_COUNT` — Handler entry markers
  - `RESOLVER_OK_COUNT` — Handler success markers
  - `RESOLVER_ERR_COUNT` — Handler error markers
  - `PROBE_COUNT` — Probe invocations
  - `PING_COUNT` — Ping health checks
  - `BUILD_SHA_COUNT` — backend_build_sha mentions

---

## Integration with CI/CD

### Pre-Deployment Checklist

Before deploying to production, run this harness in the **pre-prod environment**:

```bash
# Deploy to pre-prod first
forge deploy --environment preproduction

# Then run proof harness
bash tools/l0_invocation_proof.sh
```

Expected result: **PASS** (all gates green)

### Post-Deployment Verification

After production deployment:

```bash
# Wait 2 minutes for deployment to stabilize
sleep 120

# Verify invocation works
bash tools/l0_invocation_proof.sh
```

Expected result: **PASS** within first test run

---

## Example Report Output

```markdown
# BACKBONE LAYER 0: INVOCATION PROOF RESULT

**Timestamp:** 2026-01-18T04:35:15Z

**Evidence Directory:** `/tmp/ft_l0_invocation_20260118T043515Z`

## Status

✅ **PASS** - Gadget UI is successfully invoking backend resolvers with valid correlation

## Key Findings

| Metric | Value |
|--------|-------|
| UI_REQ_ID Provided | `ui_abc123def456` |
| UI_REQ_ID in Logs | 8 occurrences |
| RESOLVER_ENTER Count | 3 |
| RESOLVER_OK Count | 2 |
| RESOLVER_ERR Count | 1 |
| PING Invocations | 4 |
| PROBE Invocations | 2 |
| Valid backend_build_sha | 12 |

## Pass/Fail Criteria

✅ **PASS Requirements (ALL must be true):**
  1. UI_REQ_ID appears in production logs at least once
  2. At least one RESOLVER_ENTER marker exists in logs
  3. RESOLVER_ENTER line contains valid backend_build_sha matching /^[0-9a-f]{7,40}$/

No issues detected. All pass criteria met.

## Correlation Chain

**Evidence chain:**
1. User copy UI_REQ_ID from footer → `ui_abc123def456`
2. Backend logs show RESOLVER_ENTER with that UI_REQ_ID
3. backend_build_sha in the same log line matches build injection

**This proves:**
- UI successfully invoked backend
- Request was properly correlated across layers
- Build metadata was correctly injected and propagated
```

---

## Technical Details

### Markers Used for Extraction

| Marker | Purpose | Logged From |
|--------|---------|-------------|
| `RESOLVER_ENTER` | Handler invoked | `gadget-handlers.ts` handler entry |
| `RESOLVER_OK` | Handler succeeded | `gadget-handlers.ts` on success |
| `RESOLVER_ERR` | Handler error | `gadget-handlers.ts` in catch block |
| `PING_` | Health check invoked | `ping.ts` |
| `PROBE_` | Probe invoked | `probe.ts` (forensic) |

### SHA Validation

The harness validates `backend_build_sha` using regex: `/^[0-9a-f]{7,40}$/`

- **Valid:** `535f30e` (7 hex chars), `535f30eabcd1234567890` (21 hex chars)
- **Invalid:** `unknown`, `undefined`, `dev`, empty, non-hex chars

### Grep-Only Design

No external dependencies except standard Unix tools:

```bash
# Extracting UI_REQ_ID mentions
grep -F "$UIREQ" "$EVID/20_logs_post_raw.txt"

# Extracting markers
grep -E 'RESOLVER_ENTER|RESOLVER_OK|RESOLVER_ERR' "$EVID/20_logs_post_raw.txt"

# Extracting SHA values
grep -o 'backend_build_sha[^,}]*' "$EVID/33_sha_values.txt"

# Counting occurrences
grep -c 'RESOLVER_ENTER' "$EVID/20_logs_post_raw.txt"

# Validating SHA format
grep -o '"[0-9a-f]\{7,40\}"' "$EVID/33_sha_values.txt"
```

---

## Summary

This harness provides **deterministic, auditable proof** that:

1. ✅ Gadget UI successfully invokes backend resolvers
2. ✅ Requests correlate via `ui_req_id` across layers
3. ✅ Build metadata is correctly injected and propagated

**The evidence is:**
- Real production logs (captured with `forge logs`)
- Grep-searchable (no complex JSON parsing)
- Manually verifiable (user provides UI_REQ_ID from footer)
- Timestamped (for reproducibility)
- Non-invasive (observational, no code changes to business logic)

**Exit codes:**
- `0` = PASS (all gates passed)
- `1` = FAIL (one or more gates failed)

---

**End of Document**
