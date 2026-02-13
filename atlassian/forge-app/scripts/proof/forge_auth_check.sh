#!/bin/bash

##
# Forge CLI Authentication Check (Hard Fail, No Fallback)
# 
# This script:
# - Verifies FORGE_EMAIL and FORGE_API_TOKEN are set
# - Rejects placeholder emails (test@example.com, @example.com)
# - Validates authentication with `forge whoami`
# - Fails permanently on any error
#
# NO skips. NO bypasses. Codespaces-safe (no keychain).
##

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "=== Forge CLI Authentication Check ==="
echo

# Check 1: FORGE_EMAIL must be set
if [ -z "${FORGE_EMAIL:-}" ]; then
  echo -e "${RED}ERROR: FORGE_EMAIL environment variable not set.${NC}"
  echo "Set FORGE_EMAIL to your real Atlassian account email."
  exit 1
fi

# Check 2: FORGE_EMAIL must not be a placeholder
if [[ "$FORGE_EMAIL" == "test@example.com" ]] || [[ "$FORGE_EMAIL" == *"@example.com" ]]; then
  echo -e "${RED}ERROR: FORGE_EMAIL is a placeholder.${NC}"
  echo "Use your real Atlassian account email (not example.com)."
  exit 1
fi

# Check 3: FORGE_API_TOKEN must be set
if [ -z "${FORGE_API_TOKEN:-}" ]; then
  echo -e "${RED}ERROR: FORGE_API_TOKEN environment variable not set.${NC}"
  echo "Set FORGE_API_TOKEN to a valid Atlassian API token."
  exit 1
fi

# Check 4: Run forge whoami to validate credentials
echo "Validating Forge credentials..."
if ! forge whoami 2>/dev/null; then
  echo -e "${RED}ERROR: Forge authentication failed.${NC}"
  echo "Ensure FORGE_EMAIL and FORGE_API_TOKEN are set to a valid Atlassian account."
  exit 1
fi

echo -e "${GREEN}✅ Forge authentication successful${NC}"
exit 0
