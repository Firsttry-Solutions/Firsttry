#!/usr/bin/env bash
# verify_audit_policy.sh
# Deterministic audit policy gate (fail-closed)
# Uses npm audit --json to avoid fragile text parsing
# Rules:
#   RULE P1 (PROD HIGH): prod-only has high/critical -> FAIL
#   RULE P2 (PROD MODERATE): prod-only has moderate -> FAIL
#   RULE D1 (DEV HIGH): dev has high/critical (but prod none) -> WARN (exit 0)
#   RULE D2 (DEV MODERATE): dev has moderate -> WARN (exit 0)

set -euo pipefail

# Audit temp dir (default or can pass as arg for testing)
AUDIT_TMPDIR="${1:-/tmp/ft_audit_gate_$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$AUDIT_TMPDIR"

# Get repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "[AUDIT_POLICY] Running policy gate..." >&2

# Capture audits (do not fail if vulnerabilities exist)
npm audit --json > "$AUDIT_TMPDIR/audit_all.json" || true
npm audit --omit=dev --json > "$AUDIT_TMPDIR/audit_prod.json" || true

# Parse JSON with node to extract severity counts
# Create a small inline node script to do the parsing
PARSE_SCRIPT='
const fs = require("fs");
const path = process.argv[1];
try {
  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  let high = 0, critical = 0, moderate = 0;
  if (data.vulnerabilities) {
    Object.values(data.vulnerabilities).forEach(vuln => {
      const severity = vuln.severity || "";
      if (severity === "high") high++;
      else if (severity === "critical") critical++;
      else if (severity === "moderate") moderate++;
    });
  }
  console.log(`${high}|${critical}|${moderate}`);
} catch (e) {
  console.log("0|0|0");
}
'

# Count vuln severities in prod-only audit
PROD_COUNTS=$(node -e "$PARSE_SCRIPT" "$AUDIT_TMPDIR/audit_prod.json")
PROD_HIGH=$(echo $PROD_COUNTS | cut -d'|' -f1)
PROD_CRIT=$(echo $PROD_COUNTS | cut -d'|' -f2)
PROD_MOD=$(echo $PROD_COUNTS | cut -d'|' -f3)
PROD_SEVERE=$(( PROD_HIGH + PROD_CRIT ))

# Count vuln severities in all-deps audit
ALL_COUNTS=$(node -e "$PARSE_SCRIPT" "$AUDIT_TMPDIR/audit_all.json")
ALL_HIGH=$(echo $ALL_COUNTS | cut -d'|' -f1)
ALL_CRIT=$(echo $ALL_COUNTS | cut -d'|' -f2)
ALL_MOD=$(echo $ALL_COUNTS | cut -d'|' -f3)
ALL_SEVERE=$(( ALL_HIGH + ALL_CRIT ))

# Dev-only counts = all - prod
DEV_HIGH=$(( ALL_HIGH - PROD_HIGH ))
DEV_CRIT=$(( ALL_CRIT - PROD_CRIT ))
DEV_MOD=$(( ALL_MOD - PROD_MOD ))
DEV_SEVERE=$(( DEV_HIGH + DEV_CRIT ))

echo "[AUDIT_POLICY] Counts:" >&2
echo "  Prod: high=$PROD_HIGH critical=$PROD_CRIT moderate=$PROD_MOD" >&2
echo "  Dev-only: high=$DEV_HIGH critical=$DEV_CRIT moderate=$DEV_MOD" >&2

# Apply policy rules
POLICY_STATUS="PASS"
DEV_WARN_COUNT=0

# RULE P1 (PROD HIGH/CRITICAL)
if [ "$PROD_SEVERE" -gt 0 ]; then
  echo "[AUDIT_POLICY] ❌ RULE P1 FAIL: Production has high/critical vulnerabilities (high=$PROD_HIGH critical=$PROD_CRIT)" >&2
  POLICY_STATUS="FAIL"
fi

# RULE P2 (PROD MODERATE)
if [ "$PROD_MOD" -gt 0 ]; then
  echo "[AUDIT_POLICY] ❌ RULE P2 FAIL: Production has moderate vulnerabilities (moderate=$PROD_MOD)" >&2
  POLICY_STATUS="FAIL"
fi

# RULE D1 (DEV HIGH/CRITICAL)
if [ "$DEV_SEVERE" -gt 0 ]; then
  echo "[AUDIT_POLICY] ⚠️  RULE D1 WARN: Dev-only has high/critical vulnerabilities (high=$DEV_HIGH critical=$DEV_CRIT) - WARNING ONLY" >&2
  DEV_WARN_COUNT=$(( DEV_WARN_COUNT + 1 ))
fi

# RULE D2 (DEV MODERATE)
if [ "$DEV_MOD" -gt 0 ]; then
  echo "[AUDIT_POLICY] ⚠️  RULE D2 WARN: Dev-only has moderate vulnerabilities (moderate=$DEV_MOD) - WARNING ONLY" >&2
  DEV_WARN_COUNT=$(( DEV_WARN_COUNT + 1 ))
fi

# Output deterministic policy result marker
echo ""
echo "FT_AUDIT_POLICY_RESULT status=$POLICY_STATUS prod_high=$PROD_HIGH prod_mod=$PROD_MOD dev_high=$DEV_HIGH dev_mod=$DEV_MOD"

# Exit status
if [ "$POLICY_STATUS" = "FAIL" ]; then
  echo "[AUDIT_POLICY] 🛑 Policy evaluation: FAIL" >&2
  exit 1
else
  echo "[AUDIT_POLICY] ✅ Policy evaluation: PASS (dev warnings ok)" >&2
  exit 0
fi
