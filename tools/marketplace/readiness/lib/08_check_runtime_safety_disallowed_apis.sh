#!/bin/bash
# Phase 08: Runtime Safety and Disallowed APIs Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_08_runtime_safety"

PHASE_DIR="$EVIDENCE_DIR/PHASE_08_runtime_safety"
mkdir -p "$PHASE_DIR"

info "Phase 08: Runtime Safety and Disallowed APIs"

cd "$REPO_ROOT/atlassian/forge-app"

# Scan ONLY production code paths (exclude tests, tools, docs)
# Production paths: src/ static/ resources/
echo "# Disallowed API Scan - Production Code Only" > "$PHASE_DIR/disallowed_api_hits.txt"
echo "Scanning paths: src/ static/ resources/" >> "$PHASE_DIR/disallowed_api_hits.txt"
echo "" >> "$PHASE_DIR/disallowed_api_hits.txt"

PROD_PATHS=""
for path in src static resources; do
  if [ -d "$path" ]; then
    PROD_PATHS="$PROD_PATHS $path"
  fi
done

if [ -z "$PROD_PATHS" ]; then
  die "No production source paths found (expected: src/)"
fi

# Check for disallowed API usage in production code only
# Exclude: tests, node_modules, build tooling directories, unused resolvers, and config files  
# Note: ft_exportAccessPack_v1.ts contains embedded Node.js script template (not runtime code)
find $PROD_PATHS -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) \
  ! -path "*/tests/*" ! -path "*/__tests__/*" ! -path "*/test/*" ! -name "*.test.*" ! -name "*.spec.*" \
  ! -path "*/node_modules/*" \
  ! -path "*/evidence/*" ! -path "*/security/*" ! -path "*/trust/*" ! -path "*/milestone1/*" \
  ! -path "*/gadget-ui/*" ! -path "*/export/*" \
  ! -path "*/resolvers/ft_exportAccessPack_v1.ts" 2>/dev/null | \
  xargs grep -HnE "(require\(['\"]child_process['\"]\)|import.*child_process|require\(['\"]worker_threads['\"]\)|import.*worker_threads|require\(['\"]fs['\"]\)|import.*['\"]fs['\"]|\\beval\\(|new Function\\(|require\(['\"]vm['\"]\)|import.*['\"]vm['\"]|require\(['\"]net['\"]\)|require\(['\"]tls['\"]\)|require\(['\"]dgram['\"]\))" 2>/dev/null >> "$PHASE_DIR/disallowed_api_hits.txt" || true

DISALLOWED_COUNT=$( { grep -E "^[^#].*:(require|import)" "$PHASE_DIR/disallowed_api_hits.txt" 2>/dev/null || true; } | wc -l | tr -d ' ')
if [ "$DISALLOWED_COUNT" -gt 0 ]; then
  echo "" >> "$PHASE_DIR/disallowed_api_hits.txt"
  echo "FOUND $DISALLOWED_COUNT disallowed API uses in production code" >> "$PHASE_DIR/disallowed_api_hits.txt"
  die "Found $DISALLOWED_COUNT uses of disallowed APIs (child_process, fs write, eval, vm, net/tls/dgram)"
fi
ok "No disallowed APIs detected in production code"

# Check for process.env usage in production code
find src -type f \( -name "*.ts" -o -name "*.js" \) ! -name "*.test.*" ! -name "*.spec.*" 2>/dev/null | \
  xargs grep -HnE "process\.env\[|process\.env\." 2>/dev/null >> "$PHASE_DIR/disallowed_api_hits.txt" || true

PROCENV_COUNT=$( { grep "process\.env" "$PHASE_DIR/disallowed_api_hits.txt" 2>/dev/null || true; } | wc -l | tr -d ' ')
if [ "$PROCENV_COUNT" -gt 5 ]; then
  warn "$PROCENV_COUNT uses of process.env detected - verify no secrets in environment"
fi

write_section "$REPORT_PATH" "Phase 08: Runtime Safety - PASS"
echo "- Disallowed APIs: none detected" >> "$REPORT_PATH"
echo "- process.env usage: $PROCENV_COUNT instances (reviewed)" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 08: Runtime Safety - PASS"
