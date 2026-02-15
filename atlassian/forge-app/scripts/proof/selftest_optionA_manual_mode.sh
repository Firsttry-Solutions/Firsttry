#!/usr/bin/env bash
set -euo pipefail

# Selftest: Option A Manual Mode
# Verifies run_playwright_with_novnc.sh in manual mode:
# - Does NOT require JIRA_EMAIL or JIRA_PASSWORD
# - Does require JIRA_BASE_URL with exact value match

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== SELFTEST: Option A Manual Mode ==="
echo ""

# === TEST 1: Manual mode with only JIRA_BASE_URL (should pass env validation) ===
echo "Test 1: Manual mode with only JIRA_BASE_URL..."
export FT_SELFTEST=1
export FT_PW_AUTH_MODE="manual"
export FT_AUTH_GENERATE_STATE="1"
export FT_PLAYWRIGHT_MODE="headed"
export JIRA_BASE_URL="https://firsttry.atlassian.net"
unset JIRA_EMAIL || true
unset JIRA_PASSWORD || true
unset JIRA_DASHBOARD_URL || true

if bash "${SCRIPT_DIR}/run_playwright_with_novnc.sh" > /tmp/test1.log 2>&1; then
  echo "✅ Test 1 PASSED (manual mode with JIRA_BASE_URL only)"
else
  echo "❌ Test 1 FAILED"
  cat /tmp/test1.log >&2
  exit 1
fi

# === TEST 2: Manual mode with wrong JIRA_BASE_URL (should fail) ===
echo "Test 2: Manual mode with wrong JIRA_BASE_URL (should fail)..."
export JIRA_BASE_URL="https://wrong.atlassian.net"

if bash "${SCRIPT_DIR}/run_playwright_with_novnc.sh" > /tmp/test2.log 2>&1; then
  echo "❌ Test 2 FAILED (should have rejected wrong JIRA_BASE_URL)"
  exit 1
else
  # Expected failure
  if grep -q "JIRA_BASE_URL must equal exactly" /tmp/test2.log; then
    echo "✅ Test 2 PASSED (correctly rejected wrong JIRA_BASE_URL)"
  else
    echo "❌ Test 2 FAILED (wrong error message)"
    cat /tmp/test2.log >&2
    exit 1
  fi
fi

# === TEST 3: Credential mode with JIRA_EMAIL missing (should fail) ===
echo "Test 3: Credential mode with JIRA_EMAIL missing (should fail)..."
export FT_PW_AUTH_MODE="cred"
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
unset JIRA_EMAIL || true
unset JIRA_PASSWORD || true

if bash "${SCRIPT_DIR}/run_playwright_with_novnc.sh" > /tmp/test3.log 2>&1; then
  echo "❌ Test 3 FAILED (should have required JIRA_EMAIL in cred mode)"
  exit 1
else
  # Expected failure
  if grep -q "JIRA_EMAIL not set" /tmp/test3.log; then
    echo "✅ Test 3 PASSED (correctly required JIRA_EMAIL in cred mode)"
  else
    echo "❌ Test 3 FAILED (wrong error message)"
    cat /tmp/test3.log >&2
    exit 1
  fi
fi

# === TEST 4: Credential mode with all required vars (should pass env validation) ===
echo "Test 4: Credential mode with all required vars..."
export JIRA_EMAIL="test@example.com"
export JIRA_PASSWORD="testpass123"

if bash "${SCRIPT_DIR}/run_playwright_with_novnc.sh" > /tmp/test4.log 2>&1; then
  echo "✅ Test 4 PASSED (credential mode with all required vars)"
else
  echo "❌ Test 4 FAILED"
  cat /tmp/test4.log >&2
  exit 1
fi

# === SUMMARY ===
echo ""
echo "=== ALL SELFTEST CHECKS PASSED ==="
echo "✓ Manual mode does NOT require JIRA_EMAIL or JIRA_PASSWORD"
echo "✓ Manual mode still requires JIRA_BASE_URL with exact match"
echo "✓ Credential mode properly enforces JIRA_EMAIL validation"
echo "✓ Credential mode accepts credentials when provided"
exit 0
