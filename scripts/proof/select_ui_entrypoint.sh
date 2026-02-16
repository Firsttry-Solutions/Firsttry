#!/usr/bin/env bash
set -euo pipefail

# UI Entrypoint Discovery (deterministic, no human choice)
# Find candidate UI entry files and pick first match by lexicographic path order

REPO_ROOT="$(git rev-parse --show-toplevel)"
SRC_DIR="$REPO_ROOT/atlassian/forge-app/src"

# Check for ForgeReconciler.render pattern first
if command -v rg >/dev/null 2>&1; then
  RECONCILER_MATCHES=$(rg "ForgeReconciler\.render" "$SRC_DIR" --files-with-matches 2>/dev/null | sort | head -1 || true)
else
  RECONCILER_MATCHES=$(grep -r "ForgeReconciler\.render" "$SRC_DIR" 2>/dev/null | cut -d: -f1 | sort -u | head -1 || true)
fi

if [ -n "$RECONCILER_MATCHES" ]; then
  echo "[FT_UI_ENTRYPOINT_SELECTED forge_reconciler $RECONCILER_MATCHES]" >&2
  echo "$RECONCILER_MATCHES"
  exit 0
fi

# Check for @forge/react + App export pattern
if command -v rg >/dev/null 2>&1; then
  REACT_FILES=$(rg "@forge/react" "$SRC_DIR" --files-with-matches 2>/dev/null | sort || true)
else
  REACT_FILES=$(grep -r "@forge/react" "$SRC_DIR" 2>/dev/null | cut -d: -f1 | sort -u || true)
fi

if [ -n "$REACT_FILES" ]; then
  while IFS= read -r file; do
    if grep -E "(export default function App|function App\s*\()" "$file" >/dev/null 2>&1; then
      echo "[FT_UI_ENTRYPOINT_SELECTED forge_react $file]" >&2
      echo "$file"
      exit 0
    fi
  done <<< "$REACT_FILES"
fi

# No UI entrypoint found
echo "[ERROR] UI_ENTRYPOINT_NOT_FOUND" >&2
exit 1
