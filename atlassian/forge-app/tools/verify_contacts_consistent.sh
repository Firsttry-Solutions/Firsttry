#!/usr/bin/env bash
set -euo pipefail

# Fail-closed contact consistency gate
# Rule 1: docs/CONTACTS.md must exist
if [ ! -f docs/CONTACTS.md ]; then
  echo "FAIL: docs/CONTACTS.md not found"
  exit 1
fi

# Rule 2: contact@firsttry.run must be in CONTACTS.md
if ! rg -q "contact@firsttry\.run" docs/CONTACTS.md; then
  echo "FAIL: contact@firsttry.run not found in docs/CONTACTS.md"
  exit 1
fi

# Rule 3: Extract canonical email from CONTACTS.md
CANONICAL=$(rg -m 1 -o "[a-z]+@[a-z.]+\.[a-z]+" docs/CONTACTS.md)

# Rule 4: Scan src/ and docs/ for any emails NOT matching canonical
# Fail if any non-canonical email found
NONCANONICAL=$(rg -n --hidden --no-ignore -S -g'!node_modules/**' -g'!**/node_modules/**' -g'!**/dist/**' -g'!**/.git/**' -g'!package-lock.json' \
  "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z0-9.-]+\.[A-Za-z]{2,}" src docs 2>/dev/null | rg -v "$CANONICAL" || true)

if [ -n "$NONCANONICAL" ]; then
  echo "FAIL: Non-canonical emails found:"
  echo "$NONCANONICAL"
  exit 1
fi

echo "PASS: All contact emails are canonical ($CANONICAL)"
exit 0
