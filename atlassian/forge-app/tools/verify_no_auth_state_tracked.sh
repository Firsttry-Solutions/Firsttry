#!/bin/bash
# Verify that auth state files are NEVER tracked by git
# Fail-closed: Exit 1 if any auth state is tracked, backing up files, or similar

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EXIT_CODE=0

# Function to print error and set exit code
fail() {
  echo "FAIL: $1"
  EXIT_CODE=1
}

# Check 1: No files under e2e/.auth are tracked by git
if [ -d "$PROJECT_ROOT/e2e/.auth" ]; then
  TRACKED_IN_AUTH=$(git -C "$PROJECT_ROOT" ls-files "e2e/.auth" 2>/dev/null || true)
  if [ -n "$TRACKED_IN_AUTH" ]; then
    fail "files under e2e/.auth are tracked by git:"
    echo "$TRACKED_IN_AUTH" | sed 's/^/  - /'
  fi
fi

# Check 2: No storageState*.json files anywhere are tracked by git
TRACKED_STORAGE_STATE=$(git -C "$PROJECT_ROOT" ls-files | grep -i "storagestate.*\.json" || true)
if [ -n "$TRACKED_STORAGE_STATE" ]; then
  fail "storageState*.json files are tracked by git:"
  echo "$TRACKED_STORAGE_STATE" | sed 's/^/  - /'
fi

# Check 3: No .bak.* backup files exist under e2e/.auth
if [ -d "$PROJECT_ROOT/e2e/.auth" ]; then
  BACKUP_FILES=$(find "$PROJECT_ROOT/e2e/.auth" -name "*.bak.*" 2>/dev/null || true)
  if [ -n "$BACKUP_FILES" ]; then
    fail "backup files (.bak.*) found under e2e/.auth (should be cleaned):"
    echo "$BACKUP_FILES" | sed 's/^/  - /'
  fi
fi

# Report overall status
if [ "$EXIT_CODE" -ne 0 ]; then
  echo "ERROR: Auth state tracking gate FAILED"
  echo "HARD RULE: Auth state must never be tracked by git"
  echo "REMEDY: Remove tracked auth files using: git rm --cached [file]"
  exit 1
else
  echo "PASS: No auth state files tracked by git"
  echo "  ✅ No files under e2e/.auth are tracked"
  echo "  ✅ No storageState*.json files are tracked"
  echo "  ✅ No backup files (.bak.*) in e2e/.auth"
  exit 0
fi
