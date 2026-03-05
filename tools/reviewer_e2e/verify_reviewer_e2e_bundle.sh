#!/bin/bash
set -euo pipefail

# Reviewer E2E Evidence Bundle Verifier
# Validates integrity and completeness of evidence packages

TARBALL="${1:-}"
CHECKSUM_FILE="${2:-}"

if [ -z "$TARBALL" ] || [ -z "$CHECKSUM_FILE" ]; then
  echo "[USAGE] $0 <bundle.tar.gz> <bundle.tar.gz.sha256>" >&2
  exit 2
fi

if [ ! -f "$TARBALL" ]; then
  echo "[FATAL] Tarball not found: $TARBALL" >&2
  exit 1
fi

if [ ! -f "$CHECKSUM_FILE" ]; then
  echo "[FATAL] Checksum file not found: $CHECKSUM_FILE" >&2
  exit 1
fi

echo "============================================================"
echo "REVIEWER E2E BUNDLE VERIFIER"
echo "============================================================"
echo "Tarball: $TARBALL"
echo "Checksum: $CHECKSUM_FILE"
echo ""

# ============================================================================
# Step 1: Verify Checksum
# ============================================================================
echo "=== STEP 1: VERIFY CHECKSUM ==="

TARBALL_DIR="$(dirname "$TARBALL")"
TARBALL_NAME="$(basename "$TARBALL")"

cd "$TARBALL_DIR"

# Verify checksum
if command -v sha256sum >/dev/null 2>&1; then
  if ! sha256sum -c "$CHECKSUM_FILE"; then
    echo "[FATAL] Checksum verification FAILED" >&2
    exit 1
  fi
else
  if ! shasum -a 256 -c "$CHECKSUM_FILE"; then
    echo "[FATAL] Checksum verification FAILED" >&2
    exit 1
  fi
fi

echo "[OK] Checksum verification PASSED"
echo ""

# ============================================================================
# Step 2: Extract Bundle
# ============================================================================
echo "=== STEP 2: EXTRACT BUNDLE ==="

EXTRACT_DIR="/tmp/ft_reviewer_verify_$$"
mkdir -p "$EXTRACT_DIR"

echo "[INFO] Extracting to: $EXTRACT_DIR"
tar -xzf "$TARBALL" -C "$EXTRACT_DIR"

# Find extracted directory (should be single top-level dir)
BUNDLE_DIR=$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -1)

if [ -z "$BUNDLE_DIR" ]; then
  echo "[FATAL] No directory found in tarball" >&2
  rm -rf "$EXTRACT_DIR"
  exit 1
fi

echo "[OK] Extracted to: $BUNDLE_DIR"
echo ""

# ============================================================================
# Step 3: Verify Required Files
# ============================================================================
echo "=== STEP 3: VERIFY REQUIRED FILES ==="

check_file() {
  local file="$1"
  local desc="$2"
  
  if [ ! -f "$BUNDLE_DIR/$file" ]; then
    echo "[FAIL] Missing: $file ($desc)" >&2
    return 1
  fi
  echo "[OK] Found: $file"
  return 0
}

check_dir() {
  local dir="$1"
  local desc="$2"
  
  if [ ! -d "$BUNDLE_DIR/$dir" ]; then
    echo "[FAIL] Missing directory: $dir ($desc)" >&2
    return 1
  fi
  echo "[OK] Found directory: $dir"
  return 0
}

ALL_GOOD=1

check_file "FINAL_VERDICT.txt" "Final verdict" || ALL_GOOD=0
check_file "PACKHASH.sha256" "Evidence checksums" || ALL_GOOD=0

check_dir "docs_overclaim" "Documentation audit" || ALL_GOOD=0
check_file "docs_overclaim/verdict.txt" "Overclaim verdict" || ALL_GOOD=0
check_file "docs_overclaim/scan_targets.txt" "Scan targets" || ALL_GOOD=0
check_file "docs_overclaim/findings.txt" "Findings" || ALL_GOOD=0

check_dir "01_deploy" "Deployment logs" || ALL_GOOD=0
check_file "01_deploy/deploy.log" "Deploy log" || ALL_GOOD=0

check_dir "02_tunnel" "Tunnel logs" || ALL_GOOD=0
check_file "02_tunnel/tunnel.log" "Tunnel log" || ALL_GOOD=0
check_file "02_tunnel/tunnel_url.txt" "Tunnel URL" || ALL_GOOD=0

check_dir "03_forge_logs" "Forge logs" || ALL_GOOD=0
check_file "03_forge_logs/forge_logs.txt" "Forge logs" || ALL_GOOD=0

check_dir "04_playwright" "Playwright results" || ALL_GOOD=0
check_file "04_playwright/console.log" "Console log" || ALL_GOOD=0
check_file "04_playwright/console_errors.log" "Console errors" || ALL_GOOD=0
check_file "04_playwright/page_errors.log" "Page errors" || ALL_GOOD=0
check_file "04_playwright/summary.json" "Summary JSON" || ALL_GOOD=0

check_dir "04_playwright/screenshots" "Screenshots" || ALL_GOOD=0

if [ $ALL_GOOD -eq 0 ]; then
  echo ""
  echo "[FATAL] Required files missing" >&2
  rm -rf "$EXTRACT_DIR"
  exit 1
fi

echo ""

# ============================================================================
# Step 4: Verify FINAL_VERDICT is PASS
# ============================================================================
echo "=== STEP 4: VERIFY FINAL VERDICT ==="

if ! grep -q "^PASS" "$BUNDLE_DIR/FINAL_VERDICT.txt"; then
  echo "[FATAL] FINAL_VERDICT is not PASS" >&2
  cat "$BUNDLE_DIR/FINAL_VERDICT.txt" >&2
  rm -rf "$EXTRACT_DIR"
  exit 1
fi

echo "[OK] FINAL_VERDICT: PASS"
echo ""

# ============================================================================
# Step 5: Verify Documentation Overclaim Verdict
# ============================================================================
echo "=== STEP 5: VERIFY DOCUMENTATION OVERCLAIM VERDICT ==="

if ! grep -q "^PASS" "$BUNDLE_DIR/docs_overclaim/verdict.txt"; then
  echo "[FATAL] Documentation overclaim verdict is not PASS" >&2
  cat "$BUNDLE_DIR/docs_overclaim/verdict.txt" >&2
  rm -rf "$EXTRACT_DIR"
  exit 1
fi

echo "[OK] Documentation overclaim verdict: PASS"
echo ""

# ============================================================================
# Step 6: Verify Screenshots
# ============================================================================
echo "=== STEP 6: VERIFY SCREENSHOTS ==="

# Jira dashboard test requires 5 screenshots
SCREENSHOTS=(
  "reviewer_01_dashboard.png"
  "reviewer_02_gadget_visible.png"
  "reviewer_03_gadget_scrolled.png"
  "reviewer_04_about_or_panel.png"
  "reviewer_05_final.png"
)

ALL_SCREENSHOTS_OK=1

for screenshot in "${SCREENSHOTS[@]}"; do
  SCREENSHOT_PATH="$BUNDLE_DIR/04_playwright/screenshots/$screenshot"
  
  if [ ! -f "$SCREENSHOT_PATH" ]; then
    echo "[FAIL] Screenshot missing: $screenshot" >&2
    ALL_SCREENSHOTS_OK=0
    continue
  fi
  
  # Check PNG magic bytes
  if ! file "$SCREENSHOT_PATH" | grep -q "PNG image data"; then
    echo "[FAIL] Screenshot is not PNG: $screenshot" >&2
    ALL_SCREENSHOTS_OK=0
    continue
  fi
  
  # Check size - MUST be >= 30KB for real dashboard screenshots
  SIZE=$(stat -f%z "$SCREENSHOT_PATH" 2>/dev/null || stat -c%s "$SCREENSHOT_PATH" 2>/dev/null)
  SIZE_KB=$(echo "scale=1; $SIZE / 1024" | bc)
  
  if [ "$SIZE" -lt 30720 ]; then
    echo "[FAIL] Screenshot too small (${SIZE_KB} KB < 30 KB): $screenshot" >&2
    ALL_SCREENSHOTS_OK=0
    continue
  fi
  
  echo "[OK] Screenshot valid: $screenshot (${SIZE_KB} KB)"
done

if [ $ALL_SCREENSHOTS_OK -eq 0 ]; then
  rm -rf "$EXTRACT_DIR"
  exit 1
fi

echo ""

# ============================================================================
# Step 7: Verify Videos and Traces
# ============================================================================
echo "=== STEP 7: VERIFY VIDEOS AND TRACES ==="

# Check for at least one video file
VIDEO_COUNT=$(find "$BUNDLE_DIR/04_playwright/test-results" -name "*.webm" 2>/dev/null | wc -l)
if [ "$VIDEO_COUNT" -lt 1 ]; then
  echo "[FAIL] No videos found (expected at least 1)" >&2
  rm -rf "$EXTRACT_DIR"
  exit 1
fi
echo "[OK] Videos found: $VIDEO_COUNT"

# Check for at least one trace file
TRACE_COUNT=$(find "$BUNDLE_DIR/04_playwright/test-results" -name "*.zip" 2>/dev/null | wc -l)
if [ "$TRACE_COUNT" -lt 1 ]; then
  echo "[FAIL] No traces found (expected at least 1)" >&2
  rm -rf "$EXTRACT_DIR"
  exit 1
fi
echo "[OK] Traces found: $TRACE_COUNT"

echo ""

# ============================================================================
# Step 8: Verify Console and Page Errors (FAIL-CLOSED)
# ============================================================================
echo "=== STEP 8: VERIFY NO ERRORS (FAIL-CLOSED) ==="

# Jira dashboard tests must have NO console or page errors
# FAIL-CLOSED: any errors = verification failure

if [ -s "$BUNDLE_DIR/04_playwright/console_errors.log" ]; then
  ERROR_COUNT=$(wc -l < "$BUNDLE_DIR/04_playwright/console_errors.log")
  echo "[FAIL] Console errors detected: $ERROR_COUNT" >&2
  head -20 "$BUNDLE_DIR/04_playwright/console_errors.log" >&2
  rm -rf "$EXTRACT_DIR"
  exit 1
fi
echo "[OK] No console errors"

if [ -s "$BUNDLE_DIR/04_playwright/page_errors.log" ]; then
  ERROR_COUNT=$(wc -l < "$BUNDLE_DIR/04_playwright/page_errors.log")
  echo "[FAIL] Page errors detected: $ERROR_COUNT" >&2
  head -20 "$BUNDLE_DIR/04_playwright/page_errors.log" >&2
  rm -rf "$EXTRACT_DIR"
  exit 1
fi
echo "[OK] No page errors"

echo ""

# ============================================================================
# Step 9: Verify Tunnel URL
# ============================================================================
echo "=== STEP 9: VERIFY TUNNEL URL ==="

if [ ! -f "$BUNDLE_DIR/02_tunnel/tunnel_url.txt" ]; then
  echo "[FAIL] Tunnel URL file missing" >&2
  rm -rf "$EXTRACT_DIR"
  exit 1
fi

TUNNEL_URL=$(cat "$BUNDLE_DIR/02_tunnel/tunnel_url.txt")

if ! echo "$TUNNEL_URL" | grep -qE "^https://[a-zA-Z0-9-]+\.tunnel\.atlassian"; then
  echo "[FAIL] Invalid tunnel URL format: $TUNNEL_URL" >&2
  rm -rf "$EXTRACT_DIR"
  exit 1
fi

echo "[OK] Tunnel URL: $TUNNEL_URL"
echo ""

# ============================================================================
# Cleanup and Summary
# ============================================================================
echo "=== CLEANUP ==="
rm -rf "$EXTRACT_DIR"
echo "[OK] Temporary files removed"
echo ""

echo "============================================================"
echo "✓ BUNDLE VERIFICATION: PASS"
echo "============================================================"
echo ""
echo "Bundle: $TARBALL"
echo "All checks passed successfully"
echo ""
exit 0
