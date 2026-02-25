#!/bin/bash
set -euo pipefail

# verify_proof_discipline.sh
# Proof-discipline gate: prevent proof-weakening patterns in production gates.
# Exit 0: PASS (no violations)
# Exit 1: FAIL (violations or missing prerequisites)

# ----------------------------
# Resolve evidence directory (FAIL-CLOSED)
# ----------------------------
E="${FT_PROD_READY_E:-}"
if [[ -z "$E" ]] && [[ -f /tmp/ft_prod_ready_dir.txt ]]; then
  E="$(cat /tmp/ft_prod_ready_dir.txt)"
fi

if [[ -z "$E" ]] || [[ ! -d "$E" ]]; then
  echo "[DISCIPLINE] FAIL: Evidence directory not set or does not exist. Set FT_PROD_READY_E or create /tmp/ft_prod_ready_dir.txt" >&2
  exit 1
fi

mkdir -p "$E/13_repo_scans"

OUT="$E/13_repo_scans/phase2_discipline.txt"
EXIT_EVID="$E/13_repo_scans/verify_proof_discipline.exit_code.txt"

# Initialize exit evidence as FAIL by default (fail-closed)
echo "1" > "$EXIT_EVID"

# ----------------------------
# Files to check (orchestrator + the 6 invoked scripts)
# ----------------------------
FILES=(
  "tools/production/run_prod_ready_audit.sh"
  "tools/production/verify_tests_clean.sh"
  "tools/production/run_build_proof.sh"
  "tools/production/verify_ui_markers.sh"
  "tools/production/verify_no_outbound_runtime.sh"
  "tools/production/verify_scopes_justified.mjs"
)

# ----------------------------
# Forbidden patterns (ERE-safe, portable)
# ----------------------------
PATTERNS=(
  "\\|\\|[[:space:]]*true"
  "(^|[^[:alnum:]_])timeout([^[:alnum:]_]|$)"
  "(^|[^[:alnum:]_])sleep([^[:alnum:]_]|$)"
  "(^|[^[:alnum:]_])nohup([^[:alnum:]_]|$)"
  "(^|[^[:alnum:]_])disown([^[:alnum:]_]|$)"
  "&[[:space:]]*$"
  "\\|\\|[[:space:]]*:"
  "\\|\\|[[:space:]]*exit[[:space:]]+0([^[:alnum:]_]|$)"
  ";[[:space:]]*true([^[:alnum:]_]|$)"
)

# Start evidence (overwrite)
{
  echo "[DISCIPLINE] Proof discipline check"
  echo "Checked files:"
  for f in "${FILES[@]}"; do echo "  - $f"; done
  echo "Checked patterns:"
  for p in "${PATTERNS[@]}"; do echo "  - /$p/"; done
  echo ""
} > "$OUT"

VIOLATIONS=0

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "[DISCIPLINE] VIOLATION: Missing file: $f" | tee -a "$OUT"
    VIOLATIONS=$((VIOLATIONS + 1))
    continue
  fi
  if [[ ! -r "$f" ]]; then
    echo "[DISCIPLINE] VIOLATION: Unreadable file: $f" | tee -a "$OUT"
    VIOLATIONS=$((VIOLATIONS + 1))
    continue
  fi

  echo "[DISCIPLINE] Checking: $f" | tee -a "$OUT"

  for p in "${PATTERNS[@]}"; do
    HITS="$(mktemp)"
    # grep returns: 0 match, 1 no match, 2 error
    if grep -nE "$p" "$f" >"$HITS" 2>/dev/null; then
      echo "[DISCIPLINE] VIOLATION: pattern=/$p/ in $f" | tee -a "$OUT"
      head -20 "$HITS" | sed 's/^/  /' | tee -a "$OUT"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
    rm -f "$HITS"
  done

  echo "" | tee -a "$OUT"
done

echo "[DISCIPLINE] Violations found: $VIOLATIONS" | tee -a "$OUT"

if [[ "$VIOLATIONS" -gt 0 ]]; then
  echo "1" > "$EXIT_EVID"
  echo "[DISCIPLINE] VERDICT: FAIL" | tee -a "$OUT"
  exit 1
else
  echo "0" > "$EXIT_EVID"
  echo "[DISCIPLINE] VERDICT: PASS" | tee -a "$OUT"
  exit 0
fi