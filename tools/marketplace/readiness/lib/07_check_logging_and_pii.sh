#!/bin/bash
# Phase 07: Logging and PII Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_07_logging"

PHASE_DIR="$EVIDENCE_DIR/PHASE_07_logging"
mkdir -p "$PHASE_DIR"

info "Phase 07: Logging and PII"

cd "$REPO_ROOT/atlassian/forge-app"

# Find console.* usage in production code (exclude tests, tools, docs)
# Pattern 1: Standard console.log/debug/error/warn
echo "# Pattern 1: Standard console methods" > "$PHASE_DIR/console_usage.txt"
find src -type f \( -name "*.ts" -o -name "*.js" \) ! -name "*.test.*" ! -name "*.spec.*" ! -path "*/test/*" ! -path "*/tests/*" ! -path "*/tools/*" 2>/dev/null | \
  xargs grep -HnE "console\.(log|debug|error|warn|info|trace|dir|table)" 2>/dev/null >> "$PHASE_DIR/console_usage.txt" || true

# Pattern 2: Bracket notation console access
echo "# Pattern 2: Bracket notation console access" >> "$PHASE_DIR/console_usage.txt"
find src -type f \( -name "*.ts" -o -name "*.js" \) ! -name "*.test.*" ! -name "*.spec.*" ! -path "*/test/*" ! -path "*/tests/*" ! -path "*/tools/*" 2>/dev/null | \
  xargs grep -HnE 'console\[["'\''][a-z]+["'\'']\]' 2>/dev/null >> "$PHASE_DIR/console_usage.txt" || true

# Pattern 3: Optional chaining console
echo "# Pattern 3: Optional chaining console" >> "$PHASE_DIR/console_usage.txt"
find src -type f \( -name "*.ts" -o -name "*.js" \) ! -name "*.test.*" ! -name "*.spec.*" ! -path "*/test/*" ! -path "*/tests/*" ! -path "*/tools/*" 2>/dev/null | \
  xargs grep -HnE 'console\?\.(log|debug|error|warn)' 2>/dev/null >> "$PHASE_DIR/console_usage.txt" || true

# Count hits (exclude header lines)
CONSOLE_COUNT=$(grep -c '^/' "$PHASE_DIR/console_usage.txt" 2>/dev/null || echo 0)
if [ "$CONSOLE_COUNT" -gt 0 ]; then
  phase_fail "Found $CONSOLE_COUNT console statements in production code - not allowed" "$PHASE_DIR/console_usage.txt"
fi
ok "No console logging in production code"

# Check for risky logging patterns (headers, auth, tokens)
echo "# Risky logging patterns" > "$PHASE_DIR/pii_risky_logs.txt"
find src -type f \( -name "*.ts" -o -name "*.js" \) 2>/dev/null | \
  xargs grep -HnE "(log|logger).*\b(headers|Authorization|Bearer|token|apiToken|password|secret)\b" 2>/dev/null >> "$PHASE_DIR/pii_risky_logs.txt" || true
find src -type f \( -name "*.ts" -o -name "*.js" \) 2>/dev/null | \
  xargs grep -HnE "(log|logger).*(request|response)\.body" 2>/dev/null >> "$PHASE_DIR/pii_risky_logs.txt" || true
find src -type f \( -name "*.ts" -o -name "*.js" \) 2>/dev/null | \
  xargs grep -HnE "(log|logger).*(req|res)\.(body|headers)" 2>/dev/null >> "$PHASE_DIR/pii_risky_logs.txt" || true

RISKY_COUNT=$(grep -c '^/' "$PHASE_DIR/pii_risky_logs.txt" 2>/dev/null || echo 0)
if [ "$RISKY_COUNT" -gt 0 ]; then
  phase_fail "Found $RISKY_COUNT potentially risky logging patterns (request bodies, auth headers, tokens)" "$PHASE_DIR/pii_risky_logs.txt"
fi
ok "No risky PII logging patterns detected"

# Check for logger library usage that might log sensitive data
echo "# Logger library usage check" > "$PHASE_DIR/logger_libs.txt"
find src -type f \( -name "*.ts" -o -name "*.js" \) 2>/dev/null | \
  xargs grep -HnE "(pino|winston|bunyan|loglevel)" 2>/dev/null >> "$PHASE_DIR/logger_libs.txt" || true

LOGGER_COUNT=$(grep -c '^/' "$PHASE_DIR/logger_libs.txt" 2>/dev/null || echo 0)
if [ "$LOGGER_COUNT" -gt 0 ]; then
  warn "Found $LOGGER_COUNT logger library usages - verify they don't log sensitive data"
  # Cross-check with risky patterns - if both present, fail
  if [ "$RISKY_COUNT" -gt 0 ]; then
    phase_fail "Logger libraries present AND risky patterns detected - high risk of PII logging" "$PHASE_DIR/logger_libs.txt"
  fi
fi

write_section "$REPORT_PATH" "Phase 07: Logging and PII - PASS"
echo "- Console statements: none in production code" >> "$REPORT_PATH"
echo "- Risky logging patterns: none detected" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 07: Logging and PII - PASS"
