#!/usr/bin/env bash
set -euo pipefail

# Rule-C Secret Audit v3
# - Deterministic newest RUN_DIR selection (no glob-order ambiguity)
# - Secrets gate based on rg EXIT CODES (no log parsing false positives)
# - Robust Location extraction (node reads only location keys)
# - Bundle integrity hashes + tool versions
# - Fail-closed STOP markers; never deletes STOP files

die() {
  local msg="$1"
  local out="${2:-/tmp}"
  echo "$msg" | tee "$out/${msg}.txt" >/dev/null
  exit 1
}

utc_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Create a new RUN_DIR always (no rediscovery needed)
RUN_DIR="/tmp/ft_prod_green_ruleC_secret_audit_v3_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN_DIR"
echo "RUN_DIR=$RUN_DIR" | tee "$RUN_DIR/00_run_dir.txt" >/dev/null

# Baseline repo state (read-only)
cd /workspaces/Firsttry || die "STOP_REPO_NOT_FOUND" "$RUN_DIR"
git rev-parse HEAD | tee "$RUN_DIR/01_head.txt" >/dev/null
git status --porcelain=v1 | tee "$RUN_DIR/02_status_before.txt" >/dev/null
git diff --name-only | tee "$RUN_DIR/03_diff_name_only_before.txt" >/dev/null
(node -v && npm -v && rg --version && git --version) 2>&1 | tee "$RUN_DIR/05_tool_versions.txt" >/dev/null

# Bundle discovery: use BUNDLE_OVERRIDE if set, else discover latest deterministically
if [ -n "${BUNDLE_OVERRIDE:-}" ]; then
  # Override mode: use provided bundle path
  BUNDLE="$BUNDLE_OVERRIDE"
  echo "BUNDLE=$BUNDLE (from BUNDLE_OVERRIDE)" | tee "$RUN_DIR/11_bundle_selected.txt" >/dev/null
  test -d "$BUNDLE" || die "STOP_BUNDLE_OVERRIDE_NOT_FOUND" "$RUN_DIR"
else
  # Discovery mode: find latest by mtime
  ls -1dt /tmp/prod_dashboard_green_* 2>/dev/null | head -n 10 | tee "$RUN_DIR/10_latest_bundles.txt" >/dev/null
  BUNDLE="$(head -n 1 "$RUN_DIR/10_latest_bundles.txt" | tr -d '\r')"
  echo "BUNDLE=$BUNDLE" | tee "$RUN_DIR/11_bundle_selected.txt" >/dev/null
  test -n "$BUNDLE" || die "STOP_BUNDLE_NOT_FOUND" "$RUN_DIR"
  test -d "$BUNDLE" || die "STOP_BUNDLE_NOT_FOUND" "$RUN_DIR"
fi

# Required files
REQ=(22_auth_wall_detector_summary.txt 23_ruleC_trigger_request.json 24_ruleC_trigger_response.json 25_ruleC_redirect_chain.txt)
for f in "${REQ[@]}"; do
  test -f "$BUNDLE/$f" || { echo "STOP_MISSING_REQUIRED_FILE $BUNDLE/$f" | tee "$RUN_DIR/STOP_MISSING_REQUIRED_FILE.txt" >/dev/null; exit 1; }
done
echo "REQUIRED_FILES_PRESENT" | tee "$RUN_DIR/12_required_files_present.txt" >/dev/null

# Bundle integrity fingerprints
( cd "$BUNDLE" && sha256sum "${REQ[@]}" ) | tee "$RUN_DIR/13_bundle_sha256.txt" >/dev/null

# Secrets gate: rely on rg exit codes (0=match found, 1=no match, 2=error)
set +e
rg -n '(set-cookie|cookie|authorization|x-auth|bearer|atlassian\.xsrftoken|session|token=|secret)' "$BUNDLE/24_ruleC_trigger_response.json" > "$RUN_DIR/20a_resp_rg.txt"
R1=$?
rg -n '(cookie|authorization|x-auth|bearer|atlassian\.xsrftoken|session|token=|secret)' "$BUNDLE/23_ruleC_trigger_request.json" > "$RUN_DIR/20b_req_rg.txt"
R2=$?
rg -n '(set-cookie|cookie=|Bearer |atlassian\.xsrftoken|token=|session=|secret=)' "$BUNDLE/25_ruleC_redirect_chain.txt" > "$RUN_DIR/20c_chain_rg.txt"
R3=$?
set -e

cat "$RUN_DIR/20a_resp_rg.txt" "$RUN_DIR/20b_req_rg.txt" "$RUN_DIR/20c_chain_rg.txt" | tee "$RUN_DIR/20_secret_scan.txt" >/dev/null

# rg error check
if [ "$R1" -eq 2 ] || [ "$R2" -eq 2 ] || [ "$R3" -eq 2 ]; then
  echo "STOP_RG_ERROR R1=$R1 R2=$R2 R3=$R3" | tee "$RUN_DIR/STOP_RG_ERROR.txt" >/dev/null
  exit 1
fi

# fail-closed if ANY match found
if [ "$R1" -eq 0 ] || [ "$R2" -eq 0 ] || [ "$R3" -eq 0 ]; then
  echo "STOP_SECRETS_FOUND" | tee "$RUN_DIR/STOP_SECRETS_FOUND.txt" >/dev/null
  exit 1
fi
echo "SECRETS_GATE_PASS" | tee "$RUN_DIR/21_secrets_gate_pass.txt" >/dev/null

# Location extraction (only location keys)
FILE="$BUNDLE/24_ruleC_trigger_response.json"
export FILE
node - <<'NODE' | tee "$RUN_DIR/31_location_extracted.txt" >/dev/null
const fs=require('fs');
const j=JSON.parse(fs.readFileSync(process.env.FILE,'utf8'));
function findLoc(o){
  if(!o || typeof o!=='object') return [];
  const out=[];
  for(const [k,v] of Object.entries(o)){
    if(String(k).toLowerCase()==='location') out.push(String(v));
    if(v && typeof v==='object') out.push(...findLoc(v));
  }
  return out;
}
const locs=[...new Set(findLoc(j))];
process.stdout.write(locs.length?locs.join('\n'):'LOCATION_NOT_FOUND');
process.stdout.write('\n');
NODE

# Redirect chain head only (bounded)
head -n 80 "$BUNDLE/25_ruleC_redirect_chain.txt" | tee "$RUN_DIR/32_redirect_chain_head.txt" >/dev/null

# Classification (evidence-only)
LOC="$(tr -d '\r' < "$RUN_DIR/31_location_extracted.txt")"
CHAIN="$(cat "$RUN_DIR/32_redirect_chain_head.txt")"
HAS_LOGIN_JSP=$(( printf "%s\n%s\n" "$LOC" "$CHAIN" | rg -n '/login\.jsp' >/dev/null ) && echo 1 || echo 0 )
HAS_IDP=$(( printf "%s\n%s\n" "$LOC" "$CHAIN" | rg -n 'id\.atlassian\.com/login' >/dev/null ) && echo 1 || echo 0 )
CLASS="UNKNOWN"
if [ "$HAS_IDP" -eq 1 ]; then
  if [ "$HAS_LOGIN_JSP" -eq 1 ]; then
    L1="$(rg -n '/login\.jsp' "$RUN_DIR/32_redirect_chain_head.txt" | head -n1 | cut -d: -f1 || true)"
    L2="$(rg -n 'id\.atlassian\.com/login' "$RUN_DIR/32_redirect_chain_head.txt" | head -n1 | cut -d: -f1 || true)"
    if [ -n "$L1" ] && [ -n "$L2" ] && [ "$L1" -lt "$L2" ]; then
      CLASS="JIRA_LOGIN_JSP_THEN_IDP"
    else
      CLASS="JIRA_LOGIN_JSP_THEN_IDP_UNPROVEN_ORDER"
    fi
  else
    CLASS="DIRECT_IDP"
  fi
fi
echo "CLASS=$CLASS" | tee "$RUN_DIR/42_classification.txt" >/dev/null

# Repo gate: CLEAN or UNCHANGED_FROM_BASELINE (byte + diff proof)
git status --porcelain=v1 | tee "$RUN_DIR/99_status_after.txt" >/dev/null
BASELINE_BYTES="$(wc -c < "$RUN_DIR/02_status_before.txt" | tr -d ' ')"
AFTER_BYTES="$(wc -c < "$RUN_DIR/99_status_after.txt" | tr -d ' ')"
if diff "$RUN_DIR/02_status_before.txt" "$RUN_DIR/99_status_after.txt" >/dev/null; then
  if [ "$BASELINE_BYTES" -eq 0 ] && [ "$AFTER_BYTES" -eq 0 ]; then
    echo "CLEAN_TREE_PASS" | tee "$RUN_DIR/98_repo_gate_result.txt" >/dev/null
  else
    echo "UNCHANGED_FROM_BASELINE_PASS" | tee "$RUN_DIR/98_repo_gate_result.txt" >/dev/null
  fi
else
  echo "STOP_REPO_STATUS_CHANGED" | tee "$RUN_DIR/STOP_REPO_STATUS_CHANGED.txt" >/dev/null
  echo "=== BASELINE ===" | tee -a "$RUN_DIR/STOP_REPO_STATUS_CHANGED.txt" >/dev/null
  cat "$RUN_DIR/02_status_before.txt" | tee -a "$RUN_DIR/STOP_REPO_STATUS_CHANGED.txt" >/dev/null
  echo "=== AFTER ===" | tee -a "$RUN_DIR/STOP_REPO_STATUS_CHANGED.txt" >/dev/null
  cat "$RUN_DIR/99_status_after.txt" | tee -a "$RUN_DIR/STOP_REPO_STATUS_CHANGED.txt" >/dev/null
  exit 1
fi

# Final verdict (bounded, evidence-only)
cat > "$RUN_DIR/90_verdict.txt" <<EOF
PROD_DASHBOARD_GREEN RULE-C SECRET AUDIT v3 — VERDICT
Timestamp_UTC: $(utc_now)
Repo_HEAD: $(cat "$RUN_DIR/01_head.txt")
Repo_Gate: $(cat "$RUN_DIR/98_repo_gate_result.txt")
Bundle: $BUNDLE

SECRETS_GATE: PASS (rg exit-code based)
Location:
$(cat "$RUN_DIR/31_location_extracted.txt")

Redirect_Chain_Head (first 80 lines):
$(cat "$RUN_DIR/32_redirect_chain_head.txt")

Classification:
$(cat "$RUN_DIR/42_classification.txt")

Integrity_SHA256 (required files):
$(cat "$RUN_DIR/13_bundle_sha256.txt")

Notes:
- This reports redirect behavior only (no cause claims).
- No cookies/Authorization headers are emitted by this script.
EOF

ls -lh "$RUN_DIR" | tee "$RUN_DIR/97_ls_final.txt" >/dev/null
echo "DONE RUN_DIR=$RUN_DIR"
