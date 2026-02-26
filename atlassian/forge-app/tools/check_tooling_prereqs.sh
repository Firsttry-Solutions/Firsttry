#!/bin/bash
set -euo pipefail

# check_tooling_prereqs.sh - Deterministic verification of required tools
# Exit code 2 if any critical tool is missing or invalid

MISSING_TOOLS=()
NODE_VERSION_ERROR=""

# Required tools
REQUIRED_TOOLS=("node" "npm" "forge" "trivy" "sha256sum")

# Check each required tool
for tool in "${REQUIRED_TOOLS[@]}"; do
  if ! command -v "$tool" &> /dev/null; then
    MISSING_TOOLS+=("$tool")
  fi
done

# Check Node version explicitly
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v)
  if [[ ! "$NODE_VERSION" =~ ^v20\. ]]; then
    NODE_VERSION_ERROR="Node v20 required. Current: $NODE_VERSION"
  fi
fi

# Report errors first
if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
  echo "ERROR: missing tool(s): ${MISSING_TOOLS[*]}. Install and re-run." >&2
  exit 2
fi

if [ -n "$NODE_VERSION_ERROR" ]; then
  echo "ERROR: $NODE_VERSION_ERROR" >&2
  exit 2
fi

# Success
echo "✓ All prerequisite tools verified (Node v20, npm, node, forge, trivy, sha256sum)"
exit 0
