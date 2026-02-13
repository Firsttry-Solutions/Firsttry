#!/bin/bash
# Verify Commit Allowlist Guardian
# Purpose: Ensure commit only touches files in explicit allowlist
# Fail-closed: Any unexpected path causes non-zero exit
# Usage: bash scripts/proof/verify_commit_allowlist.sh <commit-hash>

set -euo pipefail

# === INPUT VALIDATION ===
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <commit-hash> [allowlist-item ...]"
  echo ""
  echo "Example:"
  echo "  $0 1373e634 tests/playwright/auth.setup.ts scripts/proof/generate_playwright_state.sh"
  echo ""
  exit 1
fi

COMMIT_HASH="$1"
shift

# === ALLOWLIST ===
# Tight allowlist for Playwright SSO provenance hardening work
# If you need to modify files outside this set, run this script with explicit args:
#   bash scripts/proof/verify_commit_allowlist.sh <hash> file1 file2 ...
if [[ $# -eq 0 ]]; then
  ALLOWLIST=(
    "scripts/proof/guard_no_state_json_commit.sh"
    "scripts/proof/run_playwright_enterprise_proof.sh"
    "scripts/proof/generate_playwright_state.sh"
    "scripts/proof/ship_phase2_gate.sh"
    "scripts/proof/verify_commit_allowlist.sh"
  )
else
  ALLOWLIST=("$@")
fi

# === COLLECT COMMIT FILES ===
FILES_IN_COMMIT=$(git show --name-only --pretty="" "$COMMIT_HASH" 2>/dev/null || echo "")

if [[ -z "$FILES_IN_COMMIT" ]]; then
  echo "❌ FAIL: Cannot read commit $COMMIT_HASH"
  exit 1
fi

# === NORMALIZE PATHS ===
# Remove repository prefix (e.g., "atlassian/forge-app/" if at root)
# This handles cases where git shows full paths from workspace root
declare -a NORMALIZED_FILES
while IFS= read -r file; do
  # Strip everything up to and including the last "forge-app/" if present
  normalized="${file##*forge-app/}"
  # If no strip occurred (file doesn't have forge-app/), use original
  normalized="${normalized:-$file}"
  NORMALIZED_FILES+=("$normalized")
done <<< "$FILES_IN_COMMIT"

# === VERIFY ALL FILES ARE ALLOWLISTED ===
echo "=== COMMIT ALLOWLIST VERIFICATION ==="
echo ""
echo "Commit: $COMMIT_HASH"
echo "Allowlist has ${#ALLOWLIST[@]} items"
echo ""

UNEXPECTED_FILES=()
for file in "${NORMALIZED_FILES[@]}"; do
  if [[ -z "$file" ]]; then
    continue
  fi
  
  # Check if file is in allowlist
  found=0
  for allowed in "${ALLOWLIST[@]}"; do
    if [[ "$file" == "$allowed" ]]; then
      found=1
      break
    fi
  done
  
  if [[ $found -eq 0 ]]; then
    UNEXPECTED_FILES+=("$file")
    echo "  ❌ UNEXPECTED: $file"
  else
    echo "  ✅ ALLOWED: $file"
  fi
done

echo ""

# === FAIL-CLOSED CHECK ===
if [[ ${#UNEXPECTED_FILES[@]} -gt 0 ]]; then
  echo "[FT_PROOF] COMMIT_ALLOWLIST_FAIL"
  echo ""
  echo "❌ FAIL: Commit touches $(echo "${#UNEXPECTED_FILES[@]}") unexpected file(s)"
  echo ""
  echo "Unexpected files (sorted):"
  printf '%s\n' "${UNEXPECTED_FILES[@]}" | sort | sed 's/^/  /'
  echo ""
  echo "Allowed files:"
  printf '%s\n' "${ALLOWLIST[@]}" | sort | sed 's/^/  /'
  echo ""
  exit 1
fi

echo "[FT_PROOF] COMMIT_ALLOWLIST_PASS"
echo ""
echo "✅ PASS: All files in commit are allowlisted"
echo "Protected: No unintended files were modified"
echo ""
