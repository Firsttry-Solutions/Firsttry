#!/usr/bin/env bash
set -euo pipefail

# Read canonical email from docs/CONTACTS.md
if [ ! -f docs/CONTACTS.md ]; then
  echo "FAIL: docs/CONTACTS.md not found"
  exit 1
fi

CANONICAL_EMAIL=$(rg -m 1 -o "[a-z]+@[a-z.]+\.[a-z]+" docs/CONTACTS.md)
if [ -z "$CANONICAL_EMAIL" ]; then
  echo "FAIL: canonical email not found in docs/CONTACTS.md"
  exit 1
fi

echo "Using canonical email: $CANONICAL_EMAIL"
echo ""

# Define non-canonical emails to replace
REPLACEMENTS=(
  "support@firstry.io"
  "security@firstry.io"
  "security@firstry.governance"
  "contact@firstry.io"
  "support@firstry.run"
  "security@firstry.run"
)

TOTAL_REPLACED=0
TOTAL_FILES=0

# For each non-canonical email, find and replace in src/ and docs/
for EMAIL in "${REPLACEMENTS[@]}"; do
  # Use rg to find files containing this email in src/ and docs/ only
  FILES=$(rg -l --hidden --no-ignore -g'!node_modules/**' -g'!**/dist/**' -g'!**/.git/**' -g'!package-lock.json' \
    "$(printf '%s\n' "$EMAIL" | sed 's/[[\.*^$/]/\\&/g')" src docs 2>/dev/null || true)
  
  if [ -z "$FILES" ]; then
    continue
  fi
  
  while IFS= read -r FILE; do
    # Use sed to replace the email deterministically
    sed -i "s/$(printf '%s\n' "$EMAIL" | sed 's/[[\.*^$/]/\\&/g')/${CANONICAL_EMAIL}/g" "$FILE"
    echo "FIXED: $FILE ($EMAIL → $CANONICAL_EMAIL)"
    ((TOTAL_FILES++))
    ((TOTAL_REPLACED++))
  done <<< "$FILES"
done

echo ""
echo "✅ Replaced $TOTAL_REPLACED occurrences in $TOTAL_FILES files"
