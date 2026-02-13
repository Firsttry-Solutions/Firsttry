#!/bin/bash

#==============================================================================
# Forge CLI Environment Variable Setup Helper
#
# This script provides instructions for setting up Forge authentication via
# environment variables (required in Codespaces, where keychain is unavailable)
#
# Do NOT attempt forge login in Codespaces.
#==============================================================================

echo ""
echo "════════════════════════════════════════════════════════════════════════════"
echo "Forge CLI Authentication Setup for Codespaces"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""

# Check if variables are already set
if [ -n "${FORGE_EMAIL:-}" ] && [ -n "${FORGE_API_TOKEN:-}" ]; then
    echo "✅ Both FORGE_EMAIL and FORGE_API_TOKEN are set."
    echo ""
    echo "You can now run:"
    echo "  bash scripts/proof/ship_phase2_gate.sh"
    echo ""
    exit 0
fi

# Print setup instructions
echo "To enable Forge CLI in Codespaces, export these environment variables:"
echo "with your REAL Atlassian account credentials (not placeholders):"
echo ""
echo "  export FORGE_EMAIL=<your-real-atlassian-email>"
echo "  export FORGE_API_TOKEN=<your-real-api-token>"
echo ""
echo "How to get your API token:"
echo "  1. Go to: https://id.atlassian.com/manage/api-tokens"
echo "  2. Click 'Create API token'"
echo "  3. Copy the generated token"
echo "  4. Paste it in the command above"
echo ""
echo "⚠️  CRITICAL REQUIREMENTS:"
echo "  - FORGE_EMAIL MUST be your real Atlassian account email"
echo "  - FORGE_EMAIL MUST NOT be a placeholder like test@example.com"
echo "  - FORGE_API_TOKEN MUST be a valid token from your Atlassian account"
echo "  - Do NOT use 'forge login' in Codespaces (requires keychain)"
echo "  - Do NOT commit API tokens to git"
echo "  - Do NOT print tokens in logs or terminal output"
echo "  - Tokens are only stored in memory (they are not persisted to files)"
echo ""
echo "Once set, verify with:"
echo "  bash scripts/proof/ship_phase2_gate.sh"
echo ""

exit 0
