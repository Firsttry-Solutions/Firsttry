#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C
REQ="contact@firsttry.run"

# Validator: enforce contact@firsttry.run as sole non-example email in live docs
# Exclusion: docs/audit_reports/** (deterministic path-based, non-bypassable)
# Rationale: Audit reports document enforcement metadata; not live user-facing docs

DOC_FILES="$(git ls-files | grep -E '^(docs/.*\.md|[^/]+\.md)$' \
  | grep -vE '^docs/audit_reports/')"

if [ -z "$DOC_FILES" ]; then
  echo "PASS DOC EMAIL IDENTITY: no live docs to check"
  exit 0
fi

# Find all emails in live docs
hits=$(printf "%s\n" "$DOC_FILES" | xargs -r grep -nE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" 2>/dev/null || true)

# Extract unique emails
emails=$(echo "$hits" | grep -oE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" | sort | uniq || true)

if [ -z "$emails" ]; then
  echo "PASS DOC EMAIL IDENTITY: no emails found"
  exit 0
fi

# Allow only:
# - canonical contact@firsttry.run
# - *.example.com (test placeholders)
bad=$(echo "$emails" | grep -vE "^${REQ}$" | grep -vE "example\.com$" || true)

if [ -n "$bad" ]; then
  echo "FAIL DOC EMAIL IDENTITY: forbidden emails in live docs"
  echo ""
  echo "Non-canonical emails found:"
  echo "$bad"
  echo ""
  echo "Files:"
  echo "$hits" | grep -E "$(echo "$bad" | paste -sd'|' -)" || true
  exit 1
fi

echo "PASS DOC EMAIL IDENTITY"
