#!/bin/bash
set -euo pipefail

# ==============================================================================
# run_build_proof.sh
# ==============================================================================
# Purpose: Extract build command from package.json, run it with full proof
# Requirements:
#   - E dir from /tmp/ft_prod_ready_dir.txt
#   - Hard gate on dirty tree (allowlist: docs/production/*, tools/production/*, tests/production/*)
#   - Determine build command from package.json scripts
#   - Save build output, exit code, gatekeeping summary

# Read E from lock file
if [[ ! -f /tmp/ft_prod_ready_dir.txt ]]; then
  echo "FAIL: /tmp/ft_prod_ready_dir.txt not found. Run production audit setup first."
  exit 1
fi

E=$(cat /tmp/ft_prod_ready_dir.txt)
if [[ ! -d "$E/04_build" ]]; then
  echo "FAIL: Evidence directory $E/04_build does not exist."
  exit 1
fi

cd /workspaces/Firsttry/atlassian/forge-app

# ==============================================================================
# Dirty tree gate (canonical policy)
# ==============================================================================
echo "=== GATE 1: Dirty Tree Check ==="

if ! bash tools/production/verify_clean_tree_allowlist.sh; then
  exit 1
fi

# ==============================================================================
# Determine build command from package.json
# ==============================================================================
echo ""
echo "=== GATE 2: Extract Build Command ==="

# Extract scripts section
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts||{},null,2));" \
  | tee "$E/04_build/package_scripts.json"

# Find build command
SCRIPT_JSON="$E/04_build/package_scripts.json"

# Prefer "build" if present
if grep -q '"build"' "$SCRIPT_JSON"; then
  BUILD_CMD="build"
  echo "Found: npm run build"
else
  # Else prefer "build:gadget" or any script containing "build" AND "gadget"
  BUILD_CMD=$(grep -o '"[^"]*build[^"]*gadget[^"]*"' "$SCRIPT_JSON" | head -1 | tr -d '"' || true)
  
  if [[ -z "$BUILD_CMD" ]]; then
    # Last attempt: any script with "build" in name
    BUILD_CMD=$(grep -o '"[^"]*build[^"]*"' "$SCRIPT_JSON" | head -1 | tr -d '"' || true)
  fi
  
  if [[ -z "$BUILD_CMD" ]]; then
    echo "FAIL: Could not find build command in package.json scripts"
    exit 1
  fi
  
  echo "Found: npm run $BUILD_CMD"
fi

echo "$BUILD_CMD" | tee "$E/04_build/build_command.txt"

# ==============================================================================
# Run build command
# ==============================================================================
echo ""
echo "=== GATE 3: Running Build ==="

npm run "$BUILD_CMD" > "$E/04_build/build_full.log" 2>&1
BUILD_EXIT=$?

# Capture summary (tail)
tail -200 "$E/04_build/build_full.log" | tee "$E/04_build/build_gate_summary.txt"

# Write exit code
echo "$BUILD_EXIT" | tee "$E/04_build/build_exit_code.txt"

if [[ $BUILD_EXIT -ne 0 ]]; then
  echo ""
  echo "FAIL: npm run $BUILD_CMD exited with code $BUILD_EXIT"
  echo "Full log: $E/04_build/build_full.log"
  exit $BUILD_EXIT
fi

echo ""
echo "PASS: npm run $BUILD_CMD exited with code 0"
echo "Evidence:"
echo "  Build command: $E/04_build/build_command.txt"
echo "  Full log: $E/04_build/build_full.log"
echo "  Exit code: $E/04_build/build_exit_code.txt"
echo "  Summary: $E/04_build/build_gate_summary.txt"

exit 0
