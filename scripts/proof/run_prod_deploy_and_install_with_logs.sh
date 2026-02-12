#!/usr/bin/env bash
set -euo pipefail

# Production Deploy and Install with Log Validation
# Verifies real logs exist and contain success keywords

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../" && pwd)"
FORGE_APP_ROOT="${REPO_ROOT}/atlassian/forge-app"

echo "════════════════════════════════════════════════════════════════"
echo "STEP 1: Build Application"
echo "════════════════════════════════════════════════════════════════"

cd "${FORGE_APP_ROOT}" || exit 1

if ! npm run build 2>&1 | tail -20; then
  echo "❌ Build failed"
  exit 1
fi

echo "✅ Build succeeded"
echo ""

echo "════════════════════════════════════════════════════════════════"
echo "STEP 2: Production Deploy"
echo "════════════════════════════════════════════════════════════════"

# Clear previous logs
rm -f /tmp/forge_deploy_prod.log
rm -f /tmp/forge_install_prod.log

# Run forge deploy and capture to log file
if ! forge deploy -e production 2>&1 | tee /tmp/forge_deploy_prod.log; then
  echo "❌ forge deploy command failed"
  echo "Log tail:"
  tail -80 /tmp/forge_deploy_prod.log
  exit 1
fi

# Verify log file exists
if [[ ! -f /tmp/forge_deploy_prod.log ]]; then
  echo "❌ Deploy log file not created: /tmp/forge_deploy_prod.log"
  exit 1
fi

# Verify success keyword in log (using grep, fail-closed = exit 1 if not found)
if ! grep -q "Deployed .* to the production environment" /tmp/forge_deploy_prod.log; then
  echo "❌ Deploy log does not contain success keyword: 'Deployed ... to the production environment'"
  echo "Log contents:"
  cat /tmp/forge_deploy_prod.log
  exit 1
fi

echo ""
echo "✅ Production Deploy succeeded"
echo "   Verified: Success keyword found in /tmp/forge_deploy_prod.log"
echo ""

echo "════════════════════════════════════════════════════════════════"
echo "STEP 3: Production Install/Upgrade"
echo "════════════════════════════════════════════════════════════════"

# Run forge install and capture to log file
if ! forge install -e production -s firsttry.atlassian.net -p jira --upgrade 2>&1 | tee /tmp/forge_install_prod.log; then
  echo "❌ forge install command failed"
  echo "Log tail:"
  tail -80 /tmp/forge_install_prod.log
  exit 1
fi

# Verify log file exists
if [[ ! -f /tmp/forge_install_prod.log ]]; then
  echo "❌ Install log file not created: /tmp/forge_install_prod.log"
  exit 1
fi

# Verify success keyword in log (using grep, fail-closed = exit 1 if not found)
# Accept either "Install in Jira complete" or "Site is already at the latest version"
if ! grep -qE "Install in Jira complete|Site is already at the latest version" /tmp/forge_install_prod.log; then
  echo "❌ Install log does not contain success keyword"
  echo "Expected: 'Install in Jira complete' OR 'Site is already at the latest version'"
  echo "Log contents:"
  cat /tmp/forge_install_prod.log
  exit 1
fi

echo ""
echo "✅ Production Install/Upgrade succeeded"
echo "   Verified: Success keyword found in /tmp/forge_install_prod.log"
echo ""

echo "════════════════════════════════════════════════════════════════"
echo "EVIDENCE SUMMARY"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Deploy Log: /tmp/forge_deploy_prod.log"
echo "  Size: $(wc -c < /tmp/forge_deploy_prod.log) bytes"
echo "  Last 5 lines:"
tail -5 /tmp/forge_deploy_prod.log
echo ""
echo "Install Log: /tmp/forge_install_prod.log"
echo "  Size: $(wc -c < /tmp/forge_install_prod.log) bytes"
echo "  Last 5 lines:"
tail -5 /tmp/forge_install_prod.log
echo ""

echo "✅ ALL PRODUCTION DEPLOYMENT STEPS PASSED"
exit 0
