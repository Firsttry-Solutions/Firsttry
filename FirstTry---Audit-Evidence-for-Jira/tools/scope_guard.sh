#!/bin/bash
#
# Scope Guard: Ensure changes are scoped to atlassian/forge-app/src/gadget-ui/** only
#
# Fails (exit 1) if:
#   - Any tracked changes outside gadget-ui/
#   - Any untracked files that would be committed outside gadget-ui/
#
# This is a FAIL-CLOSED check: any ambiguity = FAIL
#

set -e

echo "================================================================"
echo "SCOPE GUARD: Verifying all changes are in gadget-ui/ only"
echo "================================================================"

# Get all changes (staged and unstaged)
echo ""
echo "=== GIT STATUS (porcelain format) ==="
git status --porcelain=v1 || true

echo ""
echo "=== Checking changed files ==="
CHANGED=$(git status --porcelain=v1 | awk '{print $2}' | sort -u)

if [ -z "$CHANGED" ]; then
  echo "✅ No changes detected (clean tree)"
  exit 0
fi

BAD_FILES=""
GOOD_COUNT=0
BAD_COUNT=0

while IFS= read -r file; do
  if [[ "$file" =~ ^atlassian/forge-app/src/gadget-ui/ ]]; then
    echo "  ✓ $file"
    ((GOOD_COUNT++))
  else
    echo "  ✗ $file"
    BAD_FILES="$BAD_FILES
$file"
    ((BAD_COUNT++))
  fi
done <<< "$CHANGED"

echo ""
echo "=== Summary ==="
echo "  ✓ In scope: $GOOD_COUNT"
echo "  ✗ Out of scope: $BAD_COUNT"

if [ "$BAD_COUNT" -gt 0 ]; then
  echo ""
  echo "❌ SCOPE GUARD FAILED"
  echo ""
  echo "Files outside gadget-ui/ detected:"
  echo "$BAD_FILES" | grep .
  echo ""
  echo "Rule: ALL changes MUST be in atlassian/forge-app/src/gadget-ui/"
  echo ""
  exit 1
fi

echo ""
echo "✅ SCOPE GUARD PASSED"
echo "  All changes are within gadget-ui/ scope"
exit 0
