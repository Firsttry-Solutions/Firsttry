#!/bin/bash
# Verify Commit Allowlist Guardian (Scoped)
# Purpose: Ensure proof/test changes only touch allowlisted files
# Scope: scripts/proof/ and tests/playwright/ paths only
# Other commits pass (no bricking of normal development)
# Usage: bash scripts/proof/verify_commit_allowlist.sh <commit-hash>

set -euo pipefail

# === INPUT VALIDATION ===
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <commit-hash>"
  echo ""
  echo "Example:"
  echo "  $0 a402dfcc"
  echo ""
  exit 1
fi

COMMIT_HASH="$1"

# === ALLOWLIST (proof/test files only) ===
ALLOWLIST=(
  "scripts/proof/guard_no_state_json_commit.sh"
  "scripts/proof/run_playwright_enterprise_proof.sh"
  "scripts/proof/generate_playwright_state.sh"
  "scripts/proof/ship_phase2_gate.sh"
  "scripts/proof/verify_commit_allowlist.sh"
)

# === GET CHANGED FILES IN COMMIT ===
CHANGED=$(git diff-tree --no-commit-id --name-only -r "$COMMIT_HASH" 2>/dev/null || echo "")

if [[ -z "$CHANGED" ]]; then
  echo "[FT_PROOF] COMMIT_ALLOWLIST_PASS"
  exit 0
fi

# === SCOPE TO PROOF/TEST PATHS ONLY ===
# Only check files that touch proof or test infrastructure
# Other files are ignored (normal development unaffected)
SCOPED=$(echo "$CHANGED" | grep -E '^(scripts/proof/|tests/playwright/)' || true)

if [[ -z "$SCOPED" ]]; then
  # No proof/test changes - this is a normal commit, PASS
  echo "[FT_PROOF] COMMIT_ALLOWLIST_PASS"
  exit 0
fi

# === VERIFY SCOPED FILES AGAINST ALLOWLIST ===
echo "=== COMMIT ALLOWLIST VERIFICATION (SCOPED) ==="
echo ""
echo "Commit: $COMMIT_HASH"
echo "Scope: scripts/proof/ and tests/playwright/ only"
echo ""

UNEXPECTED_FILES=()
while IFS= read -r file; do
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
done <<< "$SCOPED"

echo ""

# === FAIL-CLOSED CHECK FOR SCOPED FILES ===
if [[ ${#UNEXPECTED_FILES[@]} -gt 0 ]]; then
  echo "[FT_PROOF] COMMIT_ALLOWLIST_FAIL"
  echo ""
  echo "❌ FAIL: Proof/test changes touch unexpected file(s)"
  echo ""
  echo "Unexpected files:"
  printf '%s\n' "${UNEXPECTED_FILES[@]}" | sort | sed 's/^/  /'
  echo ""
  echo "Allowed proof/test files:"
  printf '%s\n' "${ALLOWLIST[@]}" | sort | sed 's/^/  /'
  echo ""
  exit 1
fi

echo "[FT_PROOF] COMMIT_ALLOWLIST_PASS"
echo ""
echo "✅ PASS: All proof/test changes are allowlisted"
echo ""
