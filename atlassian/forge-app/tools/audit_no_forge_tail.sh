#!/bin/bash
# audit_no_forge_tail.sh
#
# Audit gate to prevent regression of unsupported `forge logs --tail`.
# Forge CLI does NOT support --tail flag (only --since and --limit).
# This gate fails CI if any tracked file contains active forge logs --tail command.
#
# Exit codes:
#   0 - No violations found
#   1 - Violations found (offending files listed)

set -euo pipefail

VIOLATIONS=0
VIOLATIONS_FILE="/tmp/forge_tail_violations.txt"

# Trap to clean up on exit
trap "rm -f '$VIOLATIONS_FILE'" EXIT

touch "$VIOLATIONS_FILE"

echo "🔍 Auditing for unsupported 'forge logs --tail'..."

# Search for files containing "forge logs" followed by "--tail" (not just in comments)
# Pattern: forge logs ... --tail (allowing for whitespace and parameters)
while IFS= read -r file; do
  if [[ -z "$file" ]]; then
    continue
  fi
  
  # Use grep to find lines that have "forge logs" and "--tail" together
  # Exclude lines that are pure comments (start with #)
  # Allow for format like: forge logs ... --tail
  if grep -E "^[^#]*forge\s+logs.*--tail" "$file" 2>/dev/null; then
    echo "❌ VIOLATION: $file"
    {
      echo "File: $file"
      echo "Matching lines:"
      grep -n "^[^#]*forge\s+logs.*--tail" "$file"
      echo ""
    } >> "$VIOLATIONS_FILE"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done < <(cd /workspaces/Firsttry && git ls-files --full-name 2>/dev/null | grep -E "\.(sh|md|ts|js)$")

if [[ $VIOLATIONS -gt 0 ]]; then
  echo ""
  echo "❌ AUDIT FAILED: Found $VIOLATIONS file(s) with unsupported 'forge logs --tail'"
  echo ""
  cat "$VIOLATIONS_FILE"
  echo "ℹ️  FIX: Replace 'forge logs --tail' with:"
  echo "   bash tools/forge_logs_tail.sh --env production --since '5m' --limit 200 --interval 5 --pattern '...' --outdir /tmp/ft_logs"
  echo ""
  exit 1
else
  echo "✅ AUDIT PASSED: No unsupported 'forge logs --tail' found."
  exit 0
fi

