#!/bin/bash
# audit/manual_runtime_proof_validate.sh
# Validator for manual browser-captured runtime proof.
# Classifies console errors into FirstTry-origin (FAIL), Atlassian noise (ALLOWLIST), or Unknown (FAIL).
#
# Usage:
#   RUN_DIR=/tmp/ft_runtime_proof_prod_manual_... bash audit/manual_runtime_proof_validate.sh
#
# Exit codes:
#   0 = all checks pass (0 FirstTry errors, 0 unknown errors)
#   1 = missing/empty required files
#   2 = login redirect detected
#   3 = FirstTry-origin errors found
#   4 = unknown errors found (not classified as FirstTry or allowlist)
#   5 = screenshot not PNG or empty
#   99 = internal error

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Require RUN_DIR to be passed
if [ -z "${RUN_DIR:-}" ]; then
  echo "ERROR: RUN_DIR env var not set"
  exit 99
fi

if [ ! -d "$RUN_DIR" ]; then
  echo "ERROR: RUN_DIR not found: $RUN_DIR"
  exit 99
fi

echo "[VALIDATE] RUN_DIR=$RUN_DIR"
echo ""

# ============================================================================
# PREREQUISITE FILES
# ============================================================================
echo "[FILES] Checking required files..."

REQUIRED_FILES=(
  "20_console.log"
  "21_console_errors_only.log"
  "22_network.har"
  "24_final_url.txt"
  "30_dashboard.png"
)

MISSING=0
for FILE in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$RUN_DIR/$FILE" ]; then
    echo "  ❌ MISSING: $FILE"
    MISSING=1
  elif [ ! -s "$RUN_DIR/$FILE" ]; then
    echo "  ❌ EMPTY: $FILE"
    MISSING=1
  else
    SIZE=$(stat -c%s "$RUN_DIR/$FILE" 2>/dev/null || echo "?")
    echo "  ✓ $FILE ($SIZE bytes)"
  fi
done

if [ $MISSING -eq 1 ]; then
  echo "ERROR: Required files missing or empty"
  exit 1
fi

# ============================================================================
# AUTH CHECK: Must NOT be login redirect
# ============================================================================
echo ""
echo "[AUTH] Checking final URL for login redirect..."

FINAL_URL=$(cat "$RUN_DIR/24_final_url.txt")
echo "  URL: $FINAL_URL"

if grep -Eqi "id\.atlassian\.com/login|/login\.jsp" "$RUN_DIR/24_final_url.txt"; then
  echo "  ❌ FAIL: Login redirect detected in final URL"
  exit 2
fi

echo "  ✓ Final URL is NOT login redirect"

# ============================================================================
# SCREENSHOT VALIDATION
# ============================================================================
echo ""
echo "[SCREENSHOT] Validating PNG..."

if ! file "$RUN_DIR/30_dashboard.png" | grep -qi "png"; then
  echo "  ❌ FAIL: Screenshot is not PNG format"
  file "$RUN_DIR/30_dashboard.png"
  exit 5
fi

SCREENSHOT_SIZE=$(stat -c%s "$RUN_DIR/30_dashboard.png")
if [ "$SCREENSHOT_SIZE" -lt 100 ]; then
  echo "  ❌ FAIL: Screenshot too small ($SCREENSHOT_SIZE bytes)"
  exit 5
fi

echo "  ✓ Screenshot is PNG ($SCREENSHOT_SIZE bytes)"

# ============================================================================
# CONSOLE ERROR CLASSIFICATION
# ============================================================================
echo ""
echo "[ERRORS] Classifying console errors..."

# Load allowlist
ALLOWLIST_FILE="$SCRIPT_DIR/manual_runtime_console_allowlist.txt"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "ERROR: Allowlist not found: $ALLOWLIST_FILE"
  exit 99
fi

# Read errors from console log
ERROR_COUNT=$(wc -l < "$RUN_DIR/21_console_errors_only.log" | tr -d ' ')
echo "  Total errors: $ERROR_COUNT"

if [ "$ERROR_COUNT" -eq 0 ]; then
  echo "  ✓ ZERO console errors (perfect)"
  echo "FirstTry_errors=0" | tee "$RUN_DIR/41_error_classification.txt"
  echo "Allowlisted_errors=0" >> "$RUN_DIR/41_error_classification.txt"
  echo "Unknown_errors=0" >> "$RUN_DIR/41_error_classification.txt"
  exit 0
fi

# Classify each error
FIRSTTRY_ERRORS=0
ALLOWLISTED_ERRORS=0
UNKNOWN_ERRORS=0
FIRSTTRY_LIST=()
UNKNOWN_LIST=()

while IFS= read -r line; do
  [ -z "$line" ] && continue
  
  CLASSIFIED=0
  
  # Check for Jira platform CSP inline-style error FIRST (very narrow, must match ALL three signatures)
  # This must come before FirstTry check because the CSP error contains "firsttry.atlassian.net" in the allowlist domain
  if echo "$line" | rg -F '_ctx_H4sIA' > /dev/null 2>&1 && \
     echo "$line" | rg -F 'Applying inline style violates the following Content Security Policy directive' > /dev/null 2>&1 && \
     echo "$line" | rg -F 'style-src' > /dev/null 2>&1; then
    ALLOWLISTED_ERRORS=$((ALLOWLISTED_ERRORS + 1))
    CLASSIFIED=1
  fi
  
  # Check FirstTry-origin patterns (very specific to FirstTry code)
  # Use rg with regex for more precise matching
  if [ $CLASSIFIED -eq 0 ]; then
    if echo "$line" | rg 'app\.[a-f0-9]{8,}\.js' > /dev/null 2>&1 || \
       echo "$line" | rg '\[UI_' > /dev/null 2>&1 || \
       echo "$line" | rg 'UI_DASHBOARD|FT_PROOF|/govGadget|L0_DASHBOARD' > /dev/null 2>&1 || \
       echo "$line" | rg 'forge\.cdn\.prod\.atlassian-dev\.net' > /dev/null 2>&1; then
      FIRSTTRY_ERRORS=$((FIRSTTRY_ERRORS + 1))
      FIRSTTRY_LIST+=("$line")
      CLASSIFIED=1
    fi
  fi
  
  # Check allowlist patterns (using rg -F for fixed strings)
  if [ $CLASSIFIED -eq 0 ]; then
    while IFS= read -r pattern; do
      [ -z "$pattern" ] && continue
      [[ "$pattern" =~ ^# ]] && continue  # skip comments
      if echo "$line" | rg -F "$pattern" > /dev/null 2>&1; then
        ALLOWLISTED_ERRORS=$((ALLOWLISTED_ERRORS + 1))
        CLASSIFIED=1
        break
      fi
    done < "$ALLOWLIST_FILE"
  fi
  
  # Unknown
  if [ $CLASSIFIED -eq 0 ]; then
    UNKNOWN_ERRORS=$((UNKNOWN_ERRORS + 1))
    UNKNOWN_LIST+=("$line")
  fi
  
done < "$RUN_DIR/21_console_errors_only.log"

echo "  FirstTry-origin: $FIRSTTRY_ERRORS"
echo "  Allowlisted: $ALLOWLISTED_ERRORS"
echo "  Unknown: $UNKNOWN_ERRORS"

# Save counts
{
  echo "FirstTry_errors=$FIRSTTRY_ERRORS"
  echo "Allowlisted_errors=$ALLOWLISTED_ERRORS"
  echo "Unknown_errors=$UNKNOWN_ERRORS"
} | tee "$RUN_DIR/41_error_classification.txt"

# ============================================================================
# FAIL-CLOSED VALIDATION
# ============================================================================
echo ""
echo "[STRICT] Fail-closed validation..."

FAIL=0

if [ $FIRSTTRY_ERRORS -gt 0 ]; then
  echo "  ❌ FAIL: FirstTry-origin errors detected ($FIRSTTRY_ERRORS)"
  echo ""
  echo "FirstTry-origin errors:"
  printf '    %s\n' "${FIRSTTRY_LIST[@]}"
  {
    echo "# FirstTry-origin errors (FAIL)"
    printf '%s\n' "${FIRSTTRY_LIST[@]}"
  } > "$RUN_DIR/40_firsttry_errors.log"
  FAIL=1
fi

if [ $UNKNOWN_ERRORS -gt 0 ]; then
  echo "  ❌ FAIL: Unknown errors detected ($UNKNOWN_ERRORS)"
  echo ""
  echo "Unknown errors (not classified):"
  printf '    %s\n' "${UNKNOWN_LIST[@]}"
  {
    echo "# Unknown errors (not classified as FirstTry or Allowlist)"
    printf '%s\n' "${UNKNOWN_LIST[@]}"
  } > "$RUN_DIR/40_unknown_errors.log"
  FAIL=1
fi

if [ $FAIL -eq 1 ]; then
  if [ $FIRSTTRY_ERRORS -gt 0 ]; then
    exit 3
  else
    exit 4
  fi
fi

if [ $ALLOWLISTED_ERRORS -gt 0 ]; then
  echo "  ✓ Allowlisted $ALLOWLISTED_ERRORS Jira noise errors (expected)"
else
  echo "  ✓ No noise errors (clean run)"
fi

echo ""
echo "✅ VALIDATION PASS"
echo "  FirstTry errors: 0"
echo "  Unknown errors: 0"
exit 0
