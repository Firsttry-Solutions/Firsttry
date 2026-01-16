#!/bin/bash
#
# tools/validate_dashboard_title.sh
# Validates that the dashboard title is correctly set to "Firsttry: Audit Evidence for Jira"
# in all user-visible places
#
set -euo pipefail

REPO_ROOT="${1:-.}"
if [ "$REPO_ROOT" = "." ]; then
  REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

REQUIRED_TITLE="Firsttry: Audit Evidence for Jira"
FAILURES=0

echo "========================================="
echo "Validating dashboard title consistency"
echo "========================================="
echo "Required title: $REQUIRED_TITLE"
echo ""

# Check 1: manifest.yml contains the required title in jira:dashboardGadget
echo "[1] Checking manifest.yml jira:dashboardGadget title..."
if grep -q "jira:dashboardGadget:" "$REPO_ROOT/atlassian/forge-app/manifest.yml"; then
  # Accept both quoted and unquoted versions
  if grep -A 3 "jira:dashboardGadget:" "$REPO_ROOT/atlassian/forge-app/manifest.yml" | grep -E "title: \"?$REQUIRED_TITLE\"?" > /dev/null; then
    echo "[PASS] manifest.yml has correct gadget title"
  else
    echo "[FAIL] manifest.yml jira:dashboardGadget title does not match required title"
    echo "  Expected: title: $REQUIRED_TITLE (or quoted)"
    echo "  Found:"
    grep -A 3 "jira:dashboardGadget:" "$REPO_ROOT/atlassian/forge-app/manifest.yml" | grep "title:" || true
    FAILURES=$((FAILURES + 1))
  fi
else
  echo "[FAIL] jira:dashboardGadget not found in manifest.yml"
  FAILURES=$((FAILURES + 1))
fi

# Check 2: index.html title tag
echo ""
echo "[2] Checking index.html <title> tag..."
if grep -q "<title>$REQUIRED_TITLE</title>" "$REPO_ROOT/atlassian/forge-app/src/gadget-ui/index.html"; then
  echo "[PASS] index.html <title> tag is correct"
else
  echo "[FAIL] index.html <title> tag does not match required title"
  echo "  Expected: <title>$REQUIRED_TITLE</title>"
  echo "  Found:"
  grep "<title>" "$REPO_ROOT/atlassian/forge-app/src/gadget-ui/index.html" || true
  FAILURES=$((FAILURES + 1))
fi

# Check 3: index.html h1 header
echo ""
echo "[3] Checking index.html <h1> header..."
if grep -q "<h1>$REQUIRED_TITLE</h1>" "$REPO_ROOT/atlassian/forge-app/src/gadget-ui/index.html"; then
  echo "[PASS] index.html <h1> header is correct"
else
  echo "[FAIL] index.html <h1> header does not match required title"
  echo "  Expected: <h1>$REQUIRED_TITLE</h1>"
  echo "  Found:"
  grep "<h1>" "$REPO_ROOT/atlassian/forge-app/src/gadget-ui/index.html" || true
  FAILURES=$((FAILURES + 1))
fi

# Check 4: No old names in manifest
echo ""
echo "[4] Checking for old dashboard names in manifest.yml..."
if grep -i "Governance Dashboard\|Governance Status" "$REPO_ROOT/atlassian/forge-app/manifest.yml" | grep -v "^#" > /dev/null 2>&1; then
  echo "[FAIL] Old dashboard names found in manifest.yml (non-comment lines)"
  grep -n -i "Governance Dashboard\|Governance Status" "$REPO_ROOT/atlassian/forge-app/manifest.yml" | grep -v "^#" || true
  FAILURES=$((FAILURES + 1))
else
  echo "[PASS] No old dashboard names in manifest.yml"
fi

# Check 5: No old names in main UI source files
echo ""
echo "[5] Checking for old dashboard names in UI source files..."
OLD_NAMES_FOUND=0
for file in "$REPO_ROOT/atlassian/forge-app/src/gadget-ui/index.html" \
            "$REPO_ROOT/atlassian/forge-app/src/gadget-ui/src/main.ts" \
            "$REPO_ROOT/atlassian/forge-app/src/gadget-ui/src/summaryText.ts"; do
  if [ -f "$file" ]; then
    # Look for old patterns but exclude comments and code logic that uses "Governance"
    if grep -E "FirstTry\s*[–-]\s*Governance Dashboard|FirstTry\s*[–-]\s*Governance Status|FirstTry\s*[–-]\s*Audit Evidence Snapshot" "$file" 2>/dev/null | grep -v "^[[:space:]]*//\|^[[:space:]]*\*" > /dev/null; then
      echo "  [FAIL] Old names found in $(basename "$file")"
      grep -n -E "FirstTry\s*[–-]\s*Governance Dashboard|FirstTry\s*[–-]\s*Governance Status|FirstTry\s*[–-]\s*Audit Evidence Snapshot" "$file" | grep -v "^[[:space:]]*//\|^[[:space:]]*\*" || true
      OLD_NAMES_FOUND=1
    fi
  fi
done

if [ $OLD_NAMES_FOUND -eq 0 ]; then
  echo "[PASS] No old dashboard names in UI source files"
else
  FAILURES=$((FAILURES + 1))
fi

# Summary
echo ""
echo "========================================="
if [ $FAILURES -eq 0 ]; then
  echo "✓ ALL CHECKS PASSED"
  echo "========================================="
  exit 0
else
  echo "✗ $FAILURES CHECK(S) FAILED"
  echo "========================================="
  exit 1
fi
