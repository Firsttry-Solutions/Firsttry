#!/bin/bash
# Guard Against Accidental state.json Commits
# Purpose: Fail if state.json is tracked or staged in git, or exists without provenance
# Integration: Call from pre-commit hook or CI gate (ship_phase2_gate.sh CHECK-2B)
# Exit: 0 if safe, 1 if state.json would be committed or exists without provenance

set -euo pipefail

# === CONSTANTS ===
STATE_JSON_PATH="tests/playwright/.auth/state.json"
STATE_PROVENANCE_PATH="tests/playwright/.auth/state.provenance.json"

# === MAIN ===
echo "[CHECK-2B] Verifying Playwright state.json is not tracked by git..."
echo ""

# === CHECK 1: Is state.json currently tracked? ===
TRACKED=$(git ls-files 2>/dev/null | grep -F "$STATE_JSON_PATH" || true)

if [[ -n "$TRACKED" ]]; then
  echo "[FT_PROOF] STATE_JSON_NOT_TRACKED_FAIL"
  echo ""
  echo "❌ FAIL: state.json is tracked in git"
  echo ""
  echo "  File: $STATE_JSON_PATH"
  echo "  Status: TRACKED (in git index)"
  echo ""
  echo "This violates security policy: state.json contains session secrets"
  echo "Remediation: git rm --cached $STATE_JSON_PATH && git commit"
  echo ""
  exit 1
fi

# === CHECK 2: Is state.json staged for commit? ===
STAGED=$(git status --porcelain 2>/dev/null | grep "^[ADD]" | grep -F "$STATE_JSON_PATH" || true)

if [[ -n "$STAGED" ]]; then
  echo "[FT_PROOF] STATE_JSON_NOT_TRACKED_FAIL"
  echo ""
  echo "❌ FAIL: state.json is staged for commit"
  echo ""
  echo "  File: $STATE_JSON_PATH"
  echo "  Status: STAGED (added/modified in index)"
  echo "  Line: $STAGED"
  echo ""
  echo "This violates security policy: state.json contains session secrets"
  echo "Remediation: git restore --staged $STATE_JSON_PATH"
  echo ""
  exit 1
fi

# === CHECK 3: If state.json exists, it MUST have provenance ===
if [[ -f "$STATE_JSON_PATH" ]]; then
  if [[ ! -f "$STATE_PROVENANCE_PATH" ]]; then
    echo "[FT_PROOF] STATE_JSON_NOT_TRACKED_FAIL"
    echo ""
    echo "❌ FAIL: state.json exists but state.provenance.json is missing"
    echo ""
    echo "  state.json: EXISTS (but orphaned, no provenance)"
    echo "  provenance: MISSING"
    echo ""
    echo "This is a critical safety violation: state.json without provenance"
    echo "indicates manual/fake state creation (forbidden)."
    echo ""
    echo "Remediation: Generate state.json properly with:"
    echo "  FT_AUTH_GENERATE_STATE=1 FT_PLAYWRIGHT_MODE=headed bash scripts/proof/generate_playwright_state.sh"
    echo ""
    exit 1
  fi
fi

# === CHECK 4: If state.json absent, that's OK ===
if [[ ! -f "$STATE_JSON_PATH" ]]; then
  echo "[FT_PROOF] STATE_JSON_ABSENT_OK"
  echo ""
  echo "✅ PASS: state.json is absent (will be generated on demand or provided via secrets)"
  echo ""
  exit 0
fi

# === CHECK 5: Is state.json untracked but present AND not in .gitignore? ===
# This is a "leak-ready" condition - fail to force explicit .gitignore
if ! git check-ignore -q "$STATE_JSON_PATH" 2>/dev/null; then
  echo "[FT_PROOF] STATE_JSON_NOT_TRACKED_FAIL"
  echo ""
  echo "❌ FAIL: state.json exists but is NOT protected by .gitignore"
  echo ""
  echo "  File: $STATE_JSON_PATH"
  echo "  Status: Untracked + unignored = LEAK-READY condition"
  echo ""
  echo "This is a critical safety gap: state.json could be accidentally committed"
  echo "Remediation: Ensure .gitignore has entry for tests/playwright/.auth/"
  echo ""
  exit 1
fi

# === ALL CHECKS PASSED ===
echo "[FT_PROOF] STATE_JSON_NOT_TRACKED_PASS"
echo ""
echo "✅ PASS: state.json is safe (not tracked, not staged, protected by .gitignore, provenance-backed)"
echo ""

exit 0
