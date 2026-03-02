#!/usr/bin/env bash
# compose_pages_urls.sh
# Generate expected GitHub Pages URLs (offline, deterministic)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORKSPACE_ROOT="$(cd "${REPO_ROOT}/../.." && pwd)"

# Evidence directory
E="${1:-/tmp/ft_marketplace_gap_closure_latest}"
if [[ ! -d "$E" ]]; then
  E="/tmp/ft_marketplace_gap_closure_latest"
fi
E=$(readlink -f "$E" 2>/dev/null || echo "$E")

OUTPUT_TXT="$E/01_pages/pages_urls.txt"
OUTPUT_JSON="$E/01_pages/pages_urls.json"

echo "[PAGES URLS] Composing expected GitHub Pages URLs..."

# Extract owner/repo from git remote
cd "$WORKSPACE_ROOT"
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [[ -z "$REMOTE_URL" ]]; then
  echo "ERROR: No git remote 'origin' found"
  exit 1
fi

# Parse owner/repo from URL
# Handles: https://github.com/owner/repo.git or git@github.com:owner/repo.git
OWNER_REPO=$(echo "$REMOTE_URL" | sed -E 's#.*(github\.com[:/])([^/]+/[^/]+)(\.git)?$#\2#')
OWNER=$(echo "$OWNER_REPO" | cut -d'/' -f1)
REPO=$(echo "$OWNER_REPO" | cut -d'/' -f2 | sed 's/\.git$//')

if [[ -z "$OWNER" ]] || [[ -z "$REPO" ]]; then
  echo "ERROR: Could not parse owner/repo from git remote: $REMOTE_URL"
  exit 1
fi

echo "  Owner: $OWNER"
echo "  Repo: $REPO"

# Default GitHub Pages URL
BASE_URL="https://${OWNER}.github.io/${REPO}"

echo "  Base URL: $BASE_URL"

# List trust docs
declare -A URLS
TRUST_DOCS=(
  "docs/trust/README.md"
  "docs/trust/privacy-policy.md"
  "docs/trust/security.md"
  "docs/trust/data-retention-deletion.md"
  "docs/trust/subprocessors.md"
  "docs/trust/vulnerability-disclosure.md"
  "docs/trust/support-sla.md"
  "docs/trust/incident-response.md"
  "docs/trust/data-processing.md"
  "docs/trust/access-scope-and-permissions.md"
)

# Generate URLs (removing atlassian/forge-app prefix if present)
{
  echo "# GitHub Pages URLs (Expected)"
  echo "# Base: $BASE_URL"
  echo ""
  for doc in "${TRUST_DOCS[@]}"; do
    # Remove atlassian/forge-app/ prefix if present
    RELATIVE_PATH="${doc#atlassian/forge-app/}"
    # Convert .md to .html for Pages
    HTML_PATH="${RELATIVE_PATH%.md}.html"
    URL="${BASE_URL}/${HTML_PATH}"
    echo "$doc -> $URL"
    URLS["$doc"]="$URL"
  done
} > "$OUTPUT_TXT"

# Generate JSON
JSON_CONTENT="{"
FIRST=true
for doc in "${TRUST_DOCS[@]}"; do
  RELATIVE_PATH="${doc#atlassian/forge-app/}"
  HTML_PATH="${RELATIVE_PATH%.md}.html"
  URL="${BASE_URL}/${HTML_PATH}"
  if [[ "$FIRST" == "true" ]]; then
    FIRST=false
  else
    JSON_CONTENT+=","
  fi
  JSON_CONTENT+="\"$doc\":\"$URL\""
done
JSON_CONTENT+="}"

echo "$JSON_CONTENT" | jq '.' > "$OUTPUT_JSON"

echo "  Output (txt): $OUTPUT_TXT"
echo "  Output (json): $OUTPUT_JSON"
