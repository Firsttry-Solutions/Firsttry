#!/usr/bin/env bash
set -euo pipefail

# Jira Credentials Diagnostics
# Validates that LIVE mode can connect to Jira before running full evidence collection

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==============================================================="
echo "FirstTry LIVE Mode - Jira Connectivity Diagnostics"
echo "==============================================================="
echo ""

# Check environment variables
echo "1. Checking environment variables..."
echo ""

MISSING_VARS=0

if [[ -z "${JIRA_BASE_URL:-}" ]]; then
  echo "  ❌ JIRA_BASE_URL not set"
  MISSING_VARS=$((MISSING_VARS + 1))
else
  echo "  ✅ JIRA_BASE_URL: $JIRA_BASE_URL"
fi

if [[ -z "${JIRA_EMAIL:-}" ]]; then
  echo "  ❌ JIRA_EMAIL not set"
  MISSING_VARS=$((MISSING_VARS + 1))
else
  echo "  ✅ JIRA_EMAIL: $JIRA_EMAIL"
fi

if [[ -z "${JIRA_API_TOKEN:-}" ]]; then
  echo "  ❌ JIRA_API_TOKEN not set"
  MISSING_VARS=$((MISSING_VARS + 1))
else
  echo "  ✅ JIRA_API_TOKEN: ***${JIRA_API_TOKEN:(-10)}"
fi

echo ""

if [[ $MISSING_VARS -gt 0 ]]; then
  echo "❌ FAILURE: Missing $MISSING_VARS required environment variable(s)"
  echo ""
  echo "Required variables for LIVE mode:"
  echo "  export JIRA_BASE_URL='https://your-domain.atlassian.net'"
  echo "  export JIRA_EMAIL='your-email@example.com'"
  echo "  export JIRA_API_TOKEN='your_api_token'"
  echo ""
  exit 1
fi

# Check network connectivity
echo "2. Testing network connectivity to Jira..."
echo ""

# Extract host from URL
JIRA_HOST=$(echo "$JIRA_BASE_URL" | sed 's|^https://||' | sed 's|^http://||' | cut -d'/' -f1)

if command -v ping >/dev/null 2>&1; then
  if timeout 3 ping -c 1 "$JIRA_HOST" >/dev/null 2>&1; then
    echo "  ✅ Can reach Jira host: $JIRA_HOST"
  else
    echo "  ⚠️ Cannot ping Jira host (may be OK if ICMP blocked): $JIRA_HOST"
  fi
fi

# Test HTTPS connectivity
if command -v curl >/dev/null 2>&1; then
  if curl -s --connect-timeout 5 -m 10 "$JIRA_BASE_URL/rest/api/3" >/dev/null 2>&1; then
    echo "  ✅ HTTPS connectivity to Jira: OK"
  else
    echo "  ⚠️ HTTPS connectivity check inconclusive (may fail below)"
  fi
fi

echo ""

# Test Jira API authentication
echo "3. Testing Jira API authentication..."
echo ""

# Create Basic Auth header
AUTH_HEADER=$(echo -n "${JIRA_EMAIL}:${JIRA_API_TOKEN}" | base64)

# Try to get current user info (requires minimal permissions)
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Basic $AUTH_HEADER" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/myself" 2>/dev/null || true)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | head -n-1)

case "$HTTP_CODE" in
  200)
    echo "  ✅ Jira API authentication: SUCCESS"
    if command -v jq >/dev/null 2>&1; then
      USERNAME=$(echo "$RESPONSE_BODY" | jq -r '.name // .emailAddress // "unknown"' 2>/dev/null || echo "unknown")
      echo "  ✅ Authenticated as: $USERNAME"
    fi
    ;;
  401)
    echo "  ❌ Jira API authentication: FAILED (Invalid credentials)"
    echo "     Check JIRA_EMAIL and JIRA_API_TOKEN"
    exit 1
    ;;
  403)
    echo "  ❌ Jira API access: FORBIDDEN (Permission denied)"
    echo "     Check that your user has permission to browse issues"
    exit 1
    ;;
  404)
    echo "  ❌ Jira API endpoint: NOT FOUND"
    echo "     Check JIRA_BASE_URL is correct (e.g., https://mycompany.atlassian.net)"
    exit 1
    ;;
  *)
    echo "  ❌ Jira API error: HTTP $HTTP_CODE"
    echo "     Response: $RESPONSE_BODY"
    exit 1
    ;;
esac

echo ""

# Test JQL query
echo "4. Testing Jira search (JQL)..."
echo ""

# Try a simple JQL query
JQL='project = FIRSTTRY ORDER BY key ASC'
JQL_ENCODED=$(echo -n "$JQL" | python3 -c "import sys; from urllib.parse import quote; print(quote(sys.stdin.read()))" 2>/dev/null || echo "$JQL")

SEARCH_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Basic $AUTH_HEADER" \
  -H "Accept: application/json" \
  "$JIRA_BASE_URL/rest/api/3/search?jql=${JQL_ENCODED}&maxResults=1" 2>/dev/null || true)

SEARCH_CODE=$(echo "$SEARCH_RESPONSE" | tail -n1)
SEARCH_BODY=$(echo "$SEARCH_RESPONSE" | head -n-1)

case "$SEARCH_CODE" in
  200)
    if command -v jq >/dev/null 2>&1; then
      TOTAL=$(echo "$SEARCH_BODY" | jq -r '.total // 0' 2>/dev/null || echo "?")
      echo "  ✅ JQL search: SUCCESS"
      echo "  ℹ️  FIRSTTRY project has $TOTAL issues"
    else
      echo "  ✅ JQL search: SUCCESS (can't parse with jq)"
    fi
    ;;
  *)
    echo "  ⚠️ JQL search: HTTP $SEARCH_CODE (non-blocking)"
    echo "     This may be OK if FIRSTTRY project doesn't exist"
    ;;
esac

echo ""

# Summary
echo "==============================================================="
echo "Diagnostics Complete"
echo "==============================================================="
echo ""
echo "✅ All checks passed! Ready to run LIVE mode evidence collection."
echo ""
echo "Run evidence collection with:"
echo "  bash tools/reviewer_demo/run_online_demo_live.sh"
echo ""
echo "Or with explicit MODE:"
echo "  MODE=LIVE bash tools/reviewer_demo/run_reviewer_demo.sh"
echo ""

exit 0
