#!/usr/bin/env bash
set -euo pipefail

# Fail-closed gate: enforce canonical contact email everywhere
# Canonical source: docs/CONTACTS.md

if [ ! -f "docs/CONTACTS.md" ]; then
  echo "❌ FAIL: docs/CONTACTS.md not found"
  exit 1
fi

CANONICAL=$(grep -oE "contact@firsttry\.run" docs/CONTACTS.md | head -1)

if [ -z "$CANONICAL" ]; then
  echo "❌ FAIL: contact@firsttry.run not found in docs/CONTACTS.md"
  exit 1
fi

# Scan for FirstTry internal emails in committed src+docs only (not node_modules, dist, build artifacts)
# Only flag FirstTry-branded emails that should be canonical
NONCANONICAL=$(find src docs -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" -o -name "*.js" \) \
  -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | \
  xargs grep -hE "@firstry\.(io|governance|solutions)" 2>/dev/null || true)

if [ -n "$NONCANONICAL" ]; then
  echo "❌ FAIL: Non-canonical FirstTry emails found (must be contact@firsttry.run):"
  echo "$NONCANONICAL" | head -10
  exit 1
fi

echo "✅ PASS: All contact emails are canonical ($CANONICAL)"
exit 0
