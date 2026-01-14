#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

# Validator: enforce contact@firsttry.run as sole non-example email in docs
# (Excludes audit reports which document historical/example emails for reference)
REQ="contact@firsttry.run"

DOC_FILES=$(git ls-files | grep -E '^(docs/.*\.md|[^/]+\.md)$' | grep -vE '^docs/STOP_|AUDIT|ENFORCEMENT' || true)

if [ -z "$DOC_FILES" ]; then
  echo "✅ VALIDATE_DOCS_EMAIL_IDENTITY: no doc files to check"
  exit 0
fi

# Find all emails in docs
hits=$(printf "%s\n" "$DOC_FILES" | xargs -r grep -nE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" 2>/dev/null || true)

# Extract unique emails
emails=$(echo "$hits" | grep -oE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" | sort | uniq || true)

if [ -z "$emails" ]; then
  echo "✅ VALIDATE_DOCS_EMAIL_IDENTITY: no emails found in docs"
  exit 0
fi

# Allow:
# - contact@firsttry.run (canonical)
# - *example.com (test examples)
bad=$(echo "$emails" | grep -vE "^${REQ}$" | grep -vE "example\.com$" || true)

if [ -n "$bad" ]; then
  echo "❌ VALIDATE_DOCS_EMAIL_IDENTITY: forbidden emails found in docs"
  echo ""
  echo "Forbidden emails:"
  echo "$bad"
  echo ""
  echo "These files contain non-canonical, non-example emails:"
  echo "$hits" | grep -E "$(echo "$bad" | paste -sd'|' -)" | cut -d: -f1 | sort | uniq
  echo ""
  echo "Action: Replace all non-canonical emails with: $REQ"
  exit 1
fi

echo "✅ VALIDATE_DOCS_EMAIL_IDENTITY: PASSED"
echo "   - Canonical email: $REQ ($(echo "$emails" | wc -l) occurrences checked)"
echo "   - Test emails allowed: *.example.com only"
