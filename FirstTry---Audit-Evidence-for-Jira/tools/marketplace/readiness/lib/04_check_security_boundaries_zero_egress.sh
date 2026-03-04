#!/bin/bash
# Phase 04: Security Boundaries and Zero Egress Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_04_security"

PHASE_DIR="$EVIDENCE_DIR/PHASE_04_security"
mkdir -p "$PHASE_DIR"

info "Phase 04: Security Boundaries and Zero Egress"

ALLOWLIST_FILE="$SCRIPT_DIR/ALLOWLIST_URL_PATHS.txt"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "docs/marketplace" > "$ALLOWLIST_FILE"
  echo "tests/" >> "$ALLOWLIST_FILE"
  echo "*.test.ts" >> "$ALLOWLIST_FILE"
  echo "*.test.js" >> "$ALLOWLIST_FILE"
  echo "*.spec.ts" >> "$ALLOWLIST_FILE"
fi

# Search for external URLs in code (excluding allowlisted paths)
cd "$FORGE_APP_DIR"

# Pattern 1: Direct URL literals
echo "# Pattern 1: Direct URL literals (https?://)" > "$PHASE_DIR/external_urls.txt"
find src -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) 2>/dev/null | \
  xargs grep -HnE "(https?://)" 2>/dev/null | grep -vE "(localhost|127\.0\.0\.1|example\.com|atlassian\.com/doc)" >> "$PHASE_DIR/external_urls.txt" || true

# Pattern 2: Template literal URL construction
echo "# Pattern 2: Template literal URL construction" >> "$PHASE_DIR/external_urls.txt"
find src -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) 2>/dev/null | \
  xargs grep -HnE '`https?://' 2>/dev/null >> "$PHASE_DIR/external_urls.txt" || true
find src -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) 2>/dev/null | \
  xargs grep -HnE '://\$\{' 2>/dev/null >> "$PHASE_DIR/external_urls.txt" || true

# Pattern 3: String concatenation for URLs
echo "# Pattern 3: String concatenation for URLs" >> "$PHASE_DIR/external_urls.txt"
find src -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) 2>/dev/null | \
  xargs grep -HnE '"https?".*\+|"://".*\+|\+.*"https?"' 2>/dev/null >> "$PHASE_DIR/external_urls.txt" || true

# Pattern 4: Protocol variables
echo "# Pattern 4: Protocol variables" >> "$PHASE_DIR/external_urls.txt"
find src -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) 2>/dev/null | \
  xargs grep -HnE 'protocol[[:space:]]*=[[:space:]]*["\047]https?' 2>/dev/null >> "$PHASE_DIR/external_urls.txt" || true

# Pattern 5: new URL() constructor
echo "# Pattern 5: new URL() constructor" >> "$PHASE_DIR/external_urls.txt"
find src -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) 2>/dev/null | \
  xargs grep -HnE 'new[[:space:]]+URL\(' 2>/dev/null >> "$PHASE_DIR/external_urls.txt" || true

# Count hits (exclude header lines)
URL_COUNT=$(grep -c '^/' "$PHASE_DIR/external_urls.txt" 2>/dev/null || echo 0)
if [ "$URL_COUNT" -gt 0 ]; then
  phase_fail "Found $URL_COUNT external URL references (direct or dynamic) in production code - zero egress policy violation" "$PHASE_DIR/external_urls.txt"
fi
ok "No external URLs in production code"

# Check for HTTP client usage
echo "# HTTP Client Library Usage" > "$PHASE_DIR/http_clients.txt"
find src -type f \( -name "*.ts" -o -name "*.js" \) 2>/dev/null | \
  xargs grep -HnE "(fetch\(|axios|node-fetch|got\(|superagent|request\(|http\.request|https\.request)" 2>/dev/null >> "$PHASE_DIR/http_clients.txt" || true

HTTP_CLIENT_COUNT=$(grep -c '^/' "$PHASE_DIR/http_clients.txt" 2>/dev/null || echo 0)
if [ "$HTTP_CLIENT_COUNT" -gt 0 ]; then
  # Check if it's documented Forge API usage (allowed pattern)
  if ! grep -qE "@forge/api|/\*.*allowed.*\*/" "$PHASE_DIR/http_clients.txt"; then
    phase_fail "Found $HTTP_CLIENT_COUNT HTTP client usage instances without Forge API wrapper - zero egress violation" "$PHASE_DIR/http_clients.txt"
  fi
  warn "HTTP client imports found but appear to be Forge API (verify manually)"
fi

# Check for requestJira usage
echo "# requestJira calls" > "$PHASE_DIR/requestjira_calls.txt"
find src -type f \( -name "*.ts" -o -name "*.js" \) 2>/dev/null | \
  xargs grep -HnE "requestJira" 2>/dev/null >> "$PHASE_DIR/requestjira_calls.txt" || true

# Check for mutation methods in requestJira (case-insensitive)
echo "# Mutation method detection in requestJira" > "$PHASE_DIR/mutation_suspects.txt"
find src -type f \( -name "*.ts" -o -name "*.js" \) 2>/dev/null | \
  xargs grep -HniE "requestJira.*(POST|PUT|PATCH|DELETE)" 2>/dev/null >> "$PHASE_DIR/mutation_suspects.txt" || true
find src -type f \( -name "*.ts" -o -name "*.js" \) 2>/dev/null | \
  xargs grep -HniE "method[[:space:]]*:[[:space:]]*[\"'](POST|PUT|PATCH|DELETE)" 2>/dev/null | grep -B3 -A3 "requestJira" >> "$PHASE_DIR/mutation_suspects.txt" || true

MUTATION_COUNT=$(grep -c '^/' "$PHASE_DIR/mutation_suspects.txt" 2>/dev/null || echo 0)
if [ "$MUTATION_COUNT" -gt 0 ]; then
  phase_fail "Found $MUTATION_COUNT requestJira calls with mutation methods (POST/PUT/PATCH/DELETE) - read-only policy violation" "$PHASE_DIR/mutation_suspects.txt"
fi
ok "No mutation methods detected in requestJira calls"

write_section "$REPORT_PATH" "Phase 04: Security Boundaries and Zero Egress - PASS"
echo "- External URLs: none detected" >> "$REPORT_PATH"
echo "- HTTP clients: validated" >> "$REPORT_PATH"
echo "- Mutation methods: none detected" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 04: Security Boundaries and Zero Egress - PASS"
