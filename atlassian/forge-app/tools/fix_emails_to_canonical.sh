#!/usr/bin/env bash
set -euo pipefail

# Deterministic email replacement to contact@firsttry.run
# Reads canonical from docs/CONTACTS.md

CANONICAL_EMAIL="contact@firsttry.run"

if [ ! -f "docs/CONTACTS.md" ]; then
  echo "FAIL: docs/CONTACTS.md not found"
  exit 1
fi

# Verify canonical is in file
if ! grep -q "$CANONICAL_EMAIL" docs/CONTACTS.md; then
  echo "FAIL: $CANONICAL_EMAIL not found in docs/CONTACTS.md"
  exit 1
fi

# List of replacements to make (non-canonical → canonical)
declare -a REPLACEMENTS=(
  "contact@firsttry.run"
  "contact@firsttry.run"
  "contact@firsttry.run"
)

CHANGED_FILES=()
CHANGE_COUNT=0

for EMAIL in "${REPLACEMENTS[@]}"; do
  # Find all files with this email (excluding node_modules, dist, .git)
  FILES=$(rg -l --hidden --no-ignore -g'!node_modules/**' -g'!**/dist/**' -g'!**/.git/**' -g'!package-lock.json' \
    "$(echo "$EMAIL" | sed 's/\./\\./g')" 2>/dev/null || true)
  
  if [ -n "$FILES" ]; then
    while IFS= read -r FILE; do
      if [ -f "$FILE" ]; then
        # Use sed to replace
        sed -i "s|$EMAIL|$CANONICAL_EMAIL|g" "$FILE"
        CHANGE_COUNT=$((CHANGE_COUNT + 1))
        CHANGED_FILES+=("$FILE")
        echo "FIXED: $FILE ($EMAIL → $CANONICAL_EMAIL)"
      fi
    done <<< "$FILES"
  fi
done

if [ $CHANGE_COUNT -gt 0 ]; then
  echo "✅ Replaced $CHANGE_COUNT occurrences in ${#CHANGED_FILES[@]} files"
  printf '%s\n' "${CHANGED_FILES[@]}" | sort -u
  exit 0
else
  echo "✅ No non-canonical emails found (all already set to $CANONICAL_EMAIL)"
  exit 0
fi
