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
# SEARCH FOR MARKERS AND NONCE
# ============================================================================

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
if [ "$nonce_found" = "YES" ]; then
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

elif [ "$USED_GROUPED_SIZE" -gt 200 ] || [ "$USED_RAW_SIZE" -gt 200 ]; then
  # BRANCH B: LOGS CAPTURED BUT NO PROBE MARKERS AT ALL
  DIAGNOSIS_BRANCH="B"
  DIAGNOSIS_TITLE="⚠️ BRANCH B: Logs Captured But Probe Not Invoked"
  DIAGNOSIS_SUMMARY="Production logs were successfully captured ($USED_GROUPED_SIZE bytes grouped, $USED_RAW_SIZE bytes raw), but NO probe markers were found (no PROBE_ENTRY/PROBE_OK/PROBE_ERR, no JSON marker, no nonce). This means the probe resolver was not invoked."
  DIAGNOSIS_ACTION="Action: (1) Verify 'Run Probe' button exists in Jira gadget. (2) Click the button. (3) Within 1-2 minutes, run: bash tools/forensic_report.sh --nonce <nonce_from_ui> --minutes 120"

else
  # BRANCH D: LOG CAPTURE FAILURE
  DIAGNOSIS_BRANCH="D"
  DIAGNOSIS_TITLE="❌ BRANCH D: Log Capture Failed or Too Small"
  DIAGNOSIS_SUMMARY="Log capture returned very few bytes (grouped: $USED_GROUPED_SIZE, raw: $USED_RAW_SIZE). This indicates the Forge logs system is not working, or authentication is incorrect, or the application is not installed."
  DIAGNOSIS_ACTION="Action: (1) Run: forge whoami (verify email and tenant). (2) Run: forge install list --environment production (verify app is listed). (3) If app not installed: forge install --environment production (4) If auth issues: forge logout && forge login (5) Try again in 1-2 minutes."
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
- \`ex_entry.txt\` - PROBE_ENTRY excerpts
- \`ex_ok.txt\` - PROBE_OK excerpts
- \`ex_err.txt\` - PROBE_ERR excerpts
- \`ex_nonce.txt\` - Nonce match excerpts

---

## Verification

**Generated:** $(date -u +'%Y-%m-%d %H:%M:%S UTC')  
**Branch:** $DIAGNOSIS_BRANCH  
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
