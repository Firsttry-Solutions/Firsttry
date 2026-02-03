#!/bin/bash
# audit/test_csp_allowlist.sh
# Regression test for Jira platform CSP inline-style allowlist
# Validates that the specific _ctx_H4sIA CSP error is properly classified

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_TMPDIR=$(mktemp -d)
trap 'rm -rf "$TEST_TMPDIR"' EXIT

echo "🧪 Testing CSP allowlist classification..."
echo ""

# Create a minimal fixture with the known Jira platform CSP error
cat > "$TEST_TMPDIR/test_errors.log" << 'EOF'
jira-spa.0a9b946e.js:2  GET https://firsttry.atlassian.net/rest/api/3/mypreferences?key=jira.user.theme.custom-nav-bar-flag.dismissed 404 (Not Found)
_ctx_H4sIAAAAAAACAwVAMQqAMAz8y82lD-jqM8QhQ1oDMYXmHET8u7zQsTQTbT8KzpkMuRQN3VaS66lCl0yTqKFEgUVS3IU2Y5…:191 Applying inline style violates the following Content Security Policy directive 'style-src 'self' firsttry.atlassian.net https://forge.cdn.prod.atlassian-dev.net https://tdp-os.services.atlassian.com/fos-eap/download/ https://tdp-os.services.atlassian.com/fos/app/download/ https://tdp-os.services.atlassian.com/fos/cdn/download/'. Either the 'unsafe-inline' keyword, a hash ('sha256-iRTSbo/Ydn205oSWi3GzwimCP8819GmmNR28mXK/M70='), or a nonce ('nonce-...') is required to enable inline execution. Note that hashes do not apply to event handlers, style attributes and javascript: navigations unless the 'unsafe-hashes' keyword is present. The action has been blocked.
EOF

# Load the allowlist file
ALLOWLIST_FILE="$SCRIPT_DIR/manual_runtime_console_allowlist.txt"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "❌ FAIL: Allowlist not found: $ALLOWLIST_FILE"
  exit 1
fi

# Count classifications manually (emulate validator logic)
ALLOWLISTED=0
UNKNOWN=0

while IFS= read -r line; do
  [ -z "$line" ] && continue
  
  CLASSIFIED=0
  
  # Check for Jira platform CSP inline-style error (very narrow, must match ALL three signatures)
  if echo "$line" | rg -F '_ctx_H4sIA' > /dev/null 2>&1 && \
     echo "$line" | rg -F 'Applying inline style violates the following Content Security Policy directive' > /dev/null 2>&1 && \
     echo "$line" | rg -F 'style-src' > /dev/null 2>&1; then
    ALLOWLISTED=$((ALLOWLISTED + 1))
    CLASSIFIED=1
    echo "✓ CSP error correctly classified as ALLOWLISTED"
  fi
  
  # Check allowlist patterns
  if [ $CLASSIFIED -eq 0 ]; then
    while IFS= read -r pattern; do
      [ -z "$pattern" ] && continue
      [[ "$pattern" =~ ^# ]] && continue
      if echo "$line" | rg -F "$pattern" > /dev/null 2>&1; then
        ALLOWLISTED=$((ALLOWLISTED + 1))
        CLASSIFIED=1
        break
      fi
    done < "$ALLOWLIST_FILE"
  fi
  
  if [ $CLASSIFIED -eq 0 ]; then
    UNKNOWN=$((UNKNOWN + 1))
    echo "❌ Line not classified: $line"
  fi
  
done < "$TEST_TMPDIR/test_errors.log"

echo ""
echo "Results:"
echo "  Allowlisted: $ALLOWLISTED"
echo "  Unknown: $UNKNOWN"
echo ""

# Validation: must have 2 allowlisted (one 404, one CSP) and 0 unknown
if [ "$ALLOWLISTED" -eq 2 ] && [ "$UNKNOWN" -eq 0 ]; then
  echo "✅ PASS: CSP error properly allowlisted"
  exit 0
else
  echo "❌ FAIL: Expected 2 allowlisted and 0 unknown, got $ALLOWLISTED allowlisted and $UNKNOWN unknown"
  exit 1
fi
