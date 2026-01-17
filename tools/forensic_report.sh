#!/bin/bash
# FORENSIC_CHECK_REPORT: Generate deterministic forensic diagnostic report
# 
# Purpose: Capture evidence and generate REAL report with zero placeholders
# Usage:   bash tools/forensic_report.sh --nonce <nonce> [--minutes <N>] [--ui <id>] [--env <env>]
#
# Output:
#   - /workspaces/Firsttry/FORENSIC_CHECK_REPORT.md (final report, no placeholders)
#   - /tmp/ft_forensic_<timestamp>/ (evidence bundle with all raw captures)

set -euo pipefail

# ============================================================================
# PARSE ARGUMENTS
# ============================================================================

PROBE_NONCE=""
UI_REQ_ID=""
MINUTES=60
FORGE_ENV="production"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --nonce)
      PROBE_NONCE="${2:-}"
      if [ -z "$PROBE_NONCE" ]; then
        echo "ERROR: --nonce requires a value" >&2
        exit 1
      fi
      shift 2
      ;;
    --minutes)
      MINUTES="${2:-60}"
      if ! [[ "$MINUTES" =~ ^[0-9]+$ ]]; then
        echo "ERROR: --minutes must be a number" >&2
        exit 1
      fi
      shift 2
      ;;
    --ui)
      UI_REQ_ID="${2:-}"
      shift 2
      ;;
    --env)
      FORGE_ENV="${2:-production}"
      shift 2
      ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$PROBE_NONCE" ]; then
  echo "ERROR: --nonce is required" >&2
  exit 1
fi

# ============================================================================
# SETUP
# ============================================================================

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUTDIR="/tmp/ft_forensic_${TIMESTAMP}"
mkdir -p "$OUTDIR"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_FILE="$REPO_ROOT/FORENSIC_CHECK_REPORT.md"

echo "Forensic Report Generation"
echo "Timestamp: $TIMESTAMP"
echo "Nonce: $PROBE_NONCE"
echo "Environment: $FORGE_ENV"
echo "Lookback: ${MINUTES}m"
echo "Output dir: $OUTDIR"
echo ""

# ============================================================================
# HELPER FUNCTION: LOG VALIDITY CHECK
# ============================================================================

# Check if a log file contains real application logs (not just CLI errors)
# Returns: 0 (valid) or 1 (invalid)
is_log_valid() {
  local logfile="$1"
  
  if [ ! -f "$logfile" ] || [ ! -s "$logfile" ]; then
    return 1
  fi
  
  # Check for "No logs found" message (explicit negative)
  if grep -qi "no logs found\|not found\|empty" "$logfile"; then
    return 1
  fi
  
  # Count lines and error indicator lines
  local total_lines=$(wc -l < "$logfile" 2>/dev/null || echo 0)
  
  # Check if MOST lines are CLI errors (these are bad signs)
  local error_indicator_lines=$(grep -iE "^Error:|^WARN|failed|not authorized|rate limit|Forbidden|Unauthorized|manifest.*error|To run this command" "$logfile" 2>/dev/null | wc -l)
  
  # If most lines are error messages, it's not a valid app log
  if [ "$total_lines" -gt 0 ]; then
    local error_ratio=$((error_indicator_lines * 100 / total_lines))
    if [ "$error_ratio" -gt 50 ]; then
      # More than 50% error lines = probably CLI noise, not app logs
      return 1
    fi
  fi
  
  # Check for at least one line that looks like a real app log entry
  # App logs should have: timestamp + log level, JSON, or known app markers
  if grep -qE "(^\[|\"timestamp\"|\"@timestamp\"|INFO|WARN|ERROR|DEBUG|\{.*\}|nonce=|marker|trace|PROBE)" "$logfile"; then
    return 0
  fi
  
  # Final check: if file has substantial content and isn't pure errors, it might be valid
  # But only if it has lines longer than typical CLI output
  local filesize=$(stat -c%s "$logfile" 2>/dev/null || wc -c < "$logfile" || echo 0)
  if [ "$filesize" -gt 500 ]; then
    # Check for lines that look like app logs (long lines with JSON-like or timestamp-like structure)
    local app_like_lines=$(awk 'length > 50 && (/\{/ || /\[/ || /:/)' "$logfile" | wc -l)
    if [ "$app_like_lines" -gt 0 ]; then
      return 0
    fi
  fi
  
  # Default: not valid
  return 1
}

# ============================================================================
# CAPTURE ENVIRONMENT PROOF
# ============================================================================

echo "Step 1: Capturing environment proof..."

WHOAMI_FILE="$OUTDIR/forge_whoami.txt"
INSTALL_LIST_FILE="$OUTDIR/forge_install_list.txt"

forge whoami > "$WHOAMI_FILE" 2>&1 || {
  echo "WARNING: forge whoami failed" >&2
  echo "Error captured" > "$WHOAMI_FILE"
}

forge install list --environment "$FORGE_ENV" > "$INSTALL_LIST_FILE" 2>&1 || {
  echo "WARNING: forge install list failed" >&2
  echo "Error captured" > "$INSTALL_LIST_FILE"
}

# Extract key values from whoami
FORGE_EMAIL=$(grep -i "email" "$WHOAMI_FILE" | head -1 | cut -d: -f2- | xargs || echo "unknown")
FORGE_TENANT=$(grep -i "tenant" "$WHOAMI_FILE" | head -1 | cut -d: -f2- | xargs || echo "unknown")

echo "  Email: $FORGE_EMAIL"
echo "  Tenant: $FORGE_TENANT"
echo ""

# ============================================================================
# CAPTURE LOGS: FULL + TIME-WINDOWED
# ============================================================================

echo "Step 2: Capturing production logs..."

LOGS_GROUPED_FULL="$OUTDIR/logs_grouped_full.txt"
LOGS_RAW_FULL="$OUTDIR/logs_raw_full.txt"
LOGS_GROUPED_SINCE="$OUTDIR/logs_grouped_since.txt"
LOGS_RAW_SINCE="$OUTDIR/logs_raw_since.txt"

# Full capture (no time window)
timeout 90 forge logs --environment "$FORGE_ENV" --limit 5000 --grouped > "$LOGS_GROUPED_FULL" 2>&1 || true
timeout 90 forge logs --environment "$FORGE_ENV" --limit 5000 > "$LOGS_RAW_FULL" 2>&1 || true

# Time-windowed capture
timeout 90 forge logs --environment "$FORGE_ENV" --limit 5000 --since "${MINUTES}m" --grouped > "$LOGS_GROUPED_SINCE" 2>&1 || true
timeout 90 forge logs --environment "$FORGE_ENV" --limit 5000 --since "${MINUTES}m" > "$LOGS_RAW_SINCE" 2>&1 || true

# Decide which files to use for analysis: prefer *_since if non-empty
SIZE_GROUPED_SINCE=$(stat -c%s "$LOGS_GROUPED_SINCE" 2>/dev/null || wc -c < "$LOGS_GROUPED_SINCE" || echo 0)
SIZE_RAW_SINCE=$(stat -c%s "$LOGS_RAW_SINCE" 2>/dev/null || wc -c < "$LOGS_RAW_SINCE" || echo 0)
SIZE_GROUPED_FULL=$(stat -c%s "$LOGS_GROUPED_FULL" 2>/dev/null || wc -c < "$LOGS_GROUPED_FULL" || echo 0)
SIZE_RAW_FULL=$(stat -c%s "$LOGS_RAW_FULL" 2>/dev/null || wc -c < "$LOGS_RAW_FULL" || echo 0)

# Use *_since if both are non-zero and non-trivial, else fall back to full
if [ "$SIZE_GROUPED_SINCE" -gt 0 ] && [ "$SIZE_RAW_SINCE" -gt 0 ]; then
  USED_GROUPED="$LOGS_GROUPED_SINCE"
  USED_RAW="$LOGS_RAW_SINCE"
  USED_GROUPED_TYPE="grouped (time-windowed)"
  USED_RAW_TYPE="raw (time-windowed)"
  USED_GROUPED_SIZE="$SIZE_GROUPED_SINCE"
  USED_RAW_SIZE="$SIZE_RAW_SINCE"
else
  USED_GROUPED="$LOGS_GROUPED_FULL"
  USED_RAW="$LOGS_RAW_FULL"
  USED_GROUPED_TYPE="grouped (full)"
  USED_RAW_TYPE="raw (full)"
  USED_GROUPED_SIZE="$SIZE_GROUPED_FULL"
  USED_RAW_SIZE="$SIZE_RAW_FULL"
fi

echo "  Grouped logs (used): $USED_GROUPED ($USED_GROUPED_SIZE bytes)"
echo "  Raw logs (used): $USED_RAW ($USED_RAW_SIZE bytes)"
echo ""

# ============================================================================
# CHECK LOG VALIDITY AND SAVE HEAD/TAIL
# ============================================================================

echo "Step 2b: Checking log validity..."

# Save head and tail of used log files
head -50 "$USED_GROUPED" > "$OUTDIR/head_grouped.txt" 2>/dev/null || true
tail -50 "$USED_GROUPED" > "$OUTDIR/tail_grouped.txt" 2>/dev/null || true
head -50 "$USED_RAW" > "$OUTDIR/head_raw.txt" 2>/dev/null || true
tail -50 "$USED_RAW" > "$OUTDIR/tail_raw.txt" 2>/dev/null || true

# Check validity using content rules
if is_log_valid "$USED_GROUPED"; then
  GROUPED_VALID="YES"
else
  GROUPED_VALID="NO"
fi

if is_log_valid "$USED_RAW"; then
  RAW_VALID="YES"
else
  RAW_VALID="NO"
fi

# Overall validity: valid if EITHER format is valid
if [ "$GROUPED_VALID" = "YES" ] || [ "$RAW_VALID" = "YES" ]; then
  LOGS_VALID="YES"
else
  LOGS_VALID="NO"
fi

echo "  Grouped logs valid: $GROUPED_VALID"
echo "  Raw logs valid: $RAW_VALID"
echo "  Overall logs valid: $LOGS_VALID"
echo ""

echo "Step 3: Searching for evidence..."

# Define marker literals
ENTRY="PROBE_ENTRY"
OK="PROBE_OK"
ERR="PROBE_ERR"
JSON_MARKER='"marker":"PROBE'

# Count occurrences (literal match with -F)
nonce_grouped_count=$(grep -F -c "$PROBE_NONCE" "$USED_GROUPED" || true)
nonce_raw_count=$(grep -F -c "$PROBE_NONCE" "$USED_RAW" || true)
entry_grouped_count=$(grep -F -c "$ENTRY" "$USED_GROUPED" || true)
entry_raw_count=$(grep -F -c "$ENTRY" "$USED_RAW" || true)
ok_grouped_count=$(grep -F -c "$OK" "$USED_GROUPED" || true)
ok_raw_count=$(grep -F -c "$OK" "$USED_RAW" || true)
err_grouped_count=$(grep -F -c "$ERR" "$USED_GROUPED" || true)
err_raw_count=$(grep -F -c "$ERR" "$USED_RAW" || true)
json_grouped_count=$(grep -F -c "$JSON_MARKER" "$USED_GROUPED" || true)
json_raw_count=$(grep -F -c "$JSON_MARKER" "$USED_RAW" || true)

echo "  Nonce: $nonce_grouped_count (grouped) + $nonce_raw_count (raw)"
echo "  PROBE_ENTRY: $entry_grouped_count (grouped) + $entry_raw_count (raw)"
echo "  PROBE_OK: $ok_grouped_count (grouped) + $ok_raw_count (raw)"
echo "  PROBE_ERR: $err_grouped_count (grouped) + $err_raw_count (raw)"
echo "  JSON marker: $json_grouped_count (grouped) + $json_raw_count (raw)"
echo ""

# ============================================================================
# EXTRACT EXCERPTS
# ============================================================================

echo "Step 4: Extracting evidence excerpts..."

# Create excerpt files with max 30 lines each
grep -F "$ENTRY" "$USED_GROUPED" | head -30 > "$OUTDIR/ex_entry.txt" 2>/dev/null || true
grep -F "$OK" "$USED_GROUPED" | head -30 > "$OUTDIR/ex_ok.txt" 2>/dev/null || true
grep -F "$ERR" "$USED_GROUPED" | head -30 > "$OUTDIR/ex_err.txt" 2>/dev/null || true
grep -F "$PROBE_NONCE" "$USED_GROUPED" | head -30 > "$OUTDIR/ex_nonce.txt" 2>/dev/null || true

echo "  Excerpts saved to: ex_entry.txt, ex_ok.txt, ex_err.txt, ex_nonce.txt"
echo ""

# ============================================================================
# COMPUTE FOUND FLAGS
# ============================================================================

nonce_found="NO"
entry_found="NO"
ok_found="NO"
err_found="NO"
json_found="NO"

[ $((nonce_grouped_count + nonce_raw_count)) -gt 0 ] && nonce_found="YES"
[ $((entry_grouped_count + entry_raw_count)) -gt 0 ] && entry_found="YES"
[ $((ok_grouped_count + ok_raw_count)) -gt 0 ] && ok_found="YES"
[ $((err_grouped_count + err_raw_count)) -gt 0 ] && err_found="YES"
[ $((json_grouped_count + json_raw_count)) -gt 0 ] && json_found="YES"

echo "Computed flags:"
echo "  nonce_found: $nonce_found"
echo "  entry_found: $entry_found"
echo "  ok_found: $ok_found"
echo "  err_found: $err_found"
echo "  json_found: $json_found"
echo ""

# ============================================================================
# DETERMINE DIAGNOSIS BRANCH
# ============================================================================

echo "Step 5: Determining diagnosis..."

DIAGNOSIS_BRANCH=""
DIAGNOSIS_TITLE=""
DIAGNOSIS_SUMMARY=""
DIAGNOSIS_ACTION=""

# Branch determination logic (deterministic, using only facts)
# CRITICAL: Check LOGS_VALID FIRST - if logs are not valid, it's always Branch D
if [ "$LOGS_VALID" = "NO" ]; then
  # BRANCH D: LOG CAPTURE FAILURE (content-based check, not byte size)
  DIAGNOSIS_BRANCH="D"
  DIAGNOSIS_TITLE="❌ BRANCH D: Log Capture Failed or Invalid"
  DIAGNOSIS_SUMMARY="Log capture returned data that does not contain real application logs. Grouped logs valid: $GROUPED_VALID, Raw logs valid: $RAW_VALID. The captured output appears to be CLI errors or empty responses, not actual app logs."
  DIAGNOSIS_ACTION="Action: (1) Run: forge whoami (verify email and tenant are correct). (2) Run: forge install list --environment $FORGE_ENV (verify app is listed and installed). (3) If app not installed: forge install --environment $FORGE_ENV (4) If auth issues: forge logout && forge login (5) Check your Forge environment is correct (--env $FORGE_ENV). (6) Try again in 1-2 minutes."

elif [ "$nonce_found" = "YES" ]; then
  # BRANCH A: SUCCESS
  DIAGNOSIS_BRANCH="A"
  DIAGNOSIS_TITLE="✅ BRANCH A: SUCCESS - Nonce Found in Logs"
  DIAGNOSIS_SUMMARY="The nonce generated by the backend was found in the production logs. This proves the end-to-end chain works: UI → Backend → Logs → Verification."
  DIAGNOSIS_ACTION="No action needed. Probe is working correctly."

elif [ "$entry_found" = "YES" ] || [ "$ok_found" = "YES" ] || [ "$err_found" = "YES" ] || [ "$json_found" = "YES" ]; then
  # BRANCH C: MARKERS FOUND BUT NONCE NOT
  DIAGNOSIS_BRANCH="C"
  DIAGNOSIS_TITLE="⚠️ BRANCH C: Markers Present But Nonce Not Found"
  DIAGNOSIS_SUMMARY="Probe markers (PROBE_ENTRY/PROBE_OK/PROBE_ERR or JSON) were found in logs, but the specific nonce ($PROBE_NONCE) was not found. This suggests the nonce was generated at a different time than captured logs, or the capture window is too short."
  DIAGNOSIS_ACTION="Action: (1) Verify the probe was run AFTER the capture window started. (2) Re-run probe immediately. (3) Run this script again within 1-2 minutes with the new nonce. (4) Increase --minutes if needed: bash tools/forensic_report.sh --nonce <new_nonce> --minutes 120"

else
  # BRANCH B: LOGS ARE VALID BUT NO PROBE MARKERS AT ALL
  DIAGNOSIS_BRANCH="B"
  DIAGNOSIS_TITLE="⚠️ BRANCH B: Logs Captured But Probe Not Invoked"
  DIAGNOSIS_SUMMARY="Production logs were successfully captured and validated as real application logs, but NO probe markers were found (no PROBE_ENTRY/PROBE_OK/PROBE_ERR, no JSON marker, no nonce). This means the probe resolver was not invoked during this period."
  DIAGNOSIS_ACTION="Action: (1) Verify 'Run Probe' button exists in Jira gadget. (2) Click the button. (3) Within 1-2 minutes, run: bash tools/forensic_report.sh --nonce <nonce_from_ui> --minutes 120"
fi

echo "  Branch: $DIAGNOSIS_BRANCH"
echo "  Title: $DIAGNOSIS_TITLE"
echo ""

# ============================================================================
# EXTRACT ENVIRONMENT FOR REPORT
# ============================================================================

WHOAMI_EXCERPT=$(head -40 "$WHOAMI_FILE" || echo "(no whoami data)")
INSTALL_LIST_EXCERPT=$(head -40 "$INSTALL_LIST_FILE" || echo "(no install list data)")
ENTRY_EXCERPT=$(cat "$OUTDIR/ex_entry.txt" 2>/dev/null || echo "(no matches)")
OK_EXCERPT=$(cat "$OUTDIR/ex_ok.txt" 2>/dev/null || echo "(no matches)")
ERR_EXCERPT=$(cat "$OUTDIR/ex_err.txt" 2>/dev/null || echo "(no matches)")
NONCE_EXCERPT=$(cat "$OUTDIR/ex_nonce.txt" 2>/dev/null || echo "(no matches)")

# ============================================================================
# GENERATE REPORT (REAL VALUES, NO PLACEHOLDERS)
# ============================================================================

echo "Step 6: Generating report..."

cat > "$REPORT_FILE" << EOF
# FORENSIC_CHECK_REPORT

**Generated:** $TIMESTAMP  
**Environment:** $FORGE_ENV  
**Nonce Tested:** $PROBE_NONCE  
**Lookback Window:** $MINUTES minutes  
**Report Path:** $REPORT_FILE  
**Evidence Bundle:** $OUTDIR  

---

## Forge Identity

**User Email:** $FORGE_EMAIL  
**Tenant:** $FORGE_TENANT  

---

## Log Capture Metadata

**Grouped Logs Used:** $USED_GROUPED ($USED_GROUPED_TYPE)  
**Raw Logs Used:** $USED_RAW ($USED_RAW_TYPE)  
**Grouped Size:** $USED_GROUPED_SIZE bytes  
**Raw Size:** $USED_RAW_SIZE bytes  

---

## Log Sanity Check

**Validity Assessment (Content-Based):**

| Log Type | Valid? | Reason |
|----------|--------|--------|
| Grouped Logs | $GROUPED_VALID | Checked for real app log markers, not just CLI noise |
| Raw Logs | $RAW_VALID | Checked for real app log markers, not just CLI noise |
| **Overall** | **$LOGS_VALID** | **Valid if either format contains real app logs** |

### Grouped Logs HEAD (first 50 lines)

\`\`\`
$(cat "$OUTDIR/head_grouped.txt" 2>/dev/null || echo "(no data)")
\`\`\`

### Grouped Logs TAIL (last 50 lines)

\`\`\`
$(cat "$OUTDIR/tail_grouped.txt" 2>/dev/null || echo "(no data)")
\`\`\`

### Raw Logs HEAD (first 50 lines)

\`\`\`
$(cat "$OUTDIR/head_raw.txt" 2>/dev/null || echo "(no data)")
\`\`\`

### Raw Logs TAIL (last 50 lines)

\`\`\`
$(cat "$OUTDIR/tail_raw.txt" 2>/dev/null || echo "(no data)")
\`\`\`

---

## Evidence Search Results

| Evidence | Grouped Count | Raw Count | Found? |
|----------|---------------|-----------|--------|
| **Nonce** ($PROBE_NONCE) | $nonce_grouped_count | $nonce_raw_count | $nonce_found |
| **PROBE_ENTRY** | $entry_grouped_count | $entry_raw_count | $entry_found |
| **PROBE_OK** | $ok_grouped_count | $ok_raw_count | $ok_found |
| **PROBE_ERR** | $err_grouped_count | $err_raw_count | $err_found |
| **JSON marker** (\\"marker\\":\\"PROBE) | $json_grouped_count | $json_raw_count | $json_found |

---

## Diagnosis

### $DIAGNOSIS_TITLE

**Summary:**  
$DIAGNOSIS_SUMMARY

**Immediate Action:**  
$DIAGNOSIS_ACTION

---

## Evidence Excerpts

### Forge Authentication (forge whoami)

\`\`\`
$WHOAMI_EXCERPT
\`\`\`

### Installation Status (forge install list)

\`\`\`
$INSTALL_LIST_EXCERPT
\`\`\`

### Probe Entry Markers (PROBE_ENTRY, max 30 lines)

\`\`\`
$ENTRY_EXCERPT
\`\`\`

### Probe Success Markers (PROBE_OK, max 30 lines)

\`\`\`
$OK_EXCERPT
\`\`\`

### Probe Error Markers (PROBE_ERR, max 30 lines)

\`\`\`
$ERR_EXCERPT
\`\`\`

### Nonce Matches ($PROBE_NONCE, max 30 lines)

\`\`\`
$NONCE_EXCERPT
\`\`\`

---

## How to Use This Report

1. **If Branch A (SUCCESS):** Proof is complete. Nonce found in logs.
2. **If Branch B (Not Invoked):** Click "Run Probe" button in Jira, wait 1-2 min, re-run this script.
3. **If Branch C (Markers but No Nonce):** Re-run probe with new nonce, run this script immediately after.
4. **If Branch D (Capture Failed):** Verify Forge authentication and app installation, then retry.

---

## Evidence Files (in $OUTDIR)

- \`forge_whoami.txt\` - Authentication proof
- \`forge_install_list.txt\` - Installation proof
- \`logs_grouped_full.txt\` - Full grouped logs
- \`logs_raw_full.txt\` - Full raw logs
- \`logs_grouped_since.txt\` - Logs from last $MINUTES minutes (grouped)
- \`logs_raw_since.txt\` - Logs from last $MINUTES minutes (raw)
- \`head_grouped.txt\` - First 50 lines of grouped logs
- \`tail_grouped.txt\` - Last 50 lines of grouped logs
- \`head_raw.txt\` - First 50 lines of raw logs
- \`tail_raw.txt\` - Last 50 lines of raw logs
- \`ex_entry.txt\` - PROBE_ENTRY excerpts
- \`ex_ok.txt\` - PROBE_OK excerpts
- \`ex_err.txt\` - PROBE_ERR excerpts
- \`ex_nonce.txt\` - Nonce match excerpts

---

## Self-Check: Forensic Commands & Validity Flags

This section documents the exact commands executed and computed validity flags for audit purposes.

### Commands Executed

\`\`\`bash
# Forge Identity
forge whoami

# Installation Status
forge install list --environment $FORGE_ENV

# Log Capture (Full)
timeout 90 forge logs --environment $FORGE_ENV --limit 5000 --grouped > logs_grouped_full.txt
timeout 90 forge logs --environment $FORGE_ENV --limit 5000 > logs_raw_full.txt

# Log Capture (Time-Windowed)
timeout 90 forge logs --environment $FORGE_ENV --limit 5000 --since ${MINUTES}m --grouped > logs_grouped_since.txt
timeout 90 forge logs --environment $FORGE_ENV --limit 5000 --since ${MINUTES}m > logs_raw_since.txt
\`\`\`

### Log File Sizes

| File | Path | Size (bytes) |
|------|------|-------------|
| Grouped (Full) | $LOGS_GROUPED_FULL | $SIZE_GROUPED_FULL |
| Raw (Full) | $LOGS_RAW_FULL | $SIZE_RAW_FULL |
| Grouped (Since) | $LOGS_GROUPED_SINCE | $SIZE_GROUPED_SINCE |
| Raw (Since) | $LOGS_RAW_SINCE | $SIZE_RAW_SINCE |
| **Used Grouped** | $USED_GROUPED | $USED_GROUPED_SIZE |
| **Used Raw** | $USED_RAW | $USED_RAW_SIZE |

### Validity Flags (Content-Based Validation)

| Check | Result |
|-------|--------|
| Grouped Logs Valid? | $GROUPED_VALID |
| Raw Logs Valid? | $RAW_VALID |
| Overall Logs Valid? | $LOGS_VALID |
| Nonce Found? | $nonce_found |
| Markers Found? | $([ "$entry_found" = "YES" ] || [ "$ok_found" = "YES" ] || [ "$err_found" = "YES" ] && echo "YES" || echo "NO") |

### Diagnostic Branch Selected

**Branch:** $DIAGNOSIS_BRANCH

This branch was determined by:
1. First checking: Are logs VALID (content-based)? If NO → Branch D
2. Then checking: Is nonce found in logs? If YES → Branch A
3. Then checking: Are markers found but nonce missing? If YES → Branch C
4. Finally: Logs valid but no markers? Then → Branch B

---

## Verification

**Generated:** $(date -u +'%Y-%m-%d %H:%M:%S UTC')  
**Branch:** $DIAGNOSIS_BRANCH  
**Log Validity:** $LOGS_VALID (Grouped: $GROUPED_VALID, Raw: $RAW_VALID)  
**Report Status:** Generated (see Diagnosis for interpretation)
EOF

echo "  Report created: $REPORT_FILE"
echo ""

# ============================================================================
# VALIDATE: NO PLACEHOLDERS ALLOWED
# ============================================================================

echo "Step 7: Validating report (checking for placeholders)..."

if grep -E "PLACEHOLDER|_PLACEHOLDER|NONCE_PLACEHOLDER|TIMESTAMP_PLACEHOLDER|FORENSIC_DIR_PLACEHOLDER|WHOAMI_CONTENT|INSTALL_LIST_HEAD" "$REPORT_FILE" > /dev/null; then
  echo "ERROR: Report contains placeholder tokens!" >&2
  grep -E "PLACEHOLDER|_PLACEHOLDER" "$REPORT_FILE" >&2
  exit 3
fi

echo "  ✓ No placeholders found (validation passed)"
echo ""

# ============================================================================
# FINAL OUTPUT
# ============================================================================

echo "════════════════════════════════════════════════════════════════"
echo "FORENSIC REPORT COMPLETE"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Report: $REPORT_FILE"
echo "Evidence Bundle: $OUTDIR"
echo "Branch: $DIAGNOSIS_BRANCH"
echo ""
echo "Summary:"
echo "  Nonce found: $nonce_found"
echo "  PROBE_ENTRY found: $entry_found"
echo "  PROBE_OK found: $ok_found"
echo "  PROBE_ERR found: $err_found"
echo "  JSON marker found: $json_found"
echo ""
echo "Next: Read $REPORT_FILE and follow diagnosis"
echo ""
echo ""
