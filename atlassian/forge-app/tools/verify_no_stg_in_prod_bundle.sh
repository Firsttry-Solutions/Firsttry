#!/bin/bash
# Tools script: Verify that production builds do NOT contain "STG" badge/label
# This runs after npm run build to ensure staging-only markers are removed from prod

set -e

echo "=== Verifying NO STG in production bundle ==="

DIST_DIR="./dist/build"

if [ ! -d "$DIST_DIR" ]; then
    echo "❌ FAIL: dist/build directory not found"
    exit 1
fi

# Check if STG appears in any built JavaScript files
# (excluding node_modules and test-only markers)
if grep -r "STG\|\"STG\"\|'STG'" "$DIST_DIR" --include="*.js" --include="*.mjs" --exclude-dir=node_modules 2>/dev/null | grep -v "test\|spec\|STORY"; then
    echo "❌ FAIL: Found 'STG' string in production build output"
    exit 1
fi

echo "✅ PASS: No STG markers in production build"
exit 0
