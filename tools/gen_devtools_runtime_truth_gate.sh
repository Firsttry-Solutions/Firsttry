#!/bin/bash
# gen_devtools_runtime_truth_gate.sh
# Generates a deterministic DevTools runtime truth gate (JS snippet)
# that verifies UI identity fields display real values (not placeholders)
#
# Usage: ./gen_devtools_runtime_truth_gate.sh <RUN_DIR>
# Output: <RUN_DIR>/20_DEVTOOLS_RUNTIME_TRUTH_GATE.js
#         <RUN_DIR>/21_gate_files.txt

set -euo pipefail

RUN_DIR="${1:-.}"
GATE_FILES=()

# Validate RUN_DIR
if [[ ! -d "$RUN_DIR" ]]; then
  echo "ERROR: RUN_DIR does not exist: $RUN_DIR" >&2
  exit 1
fi

# Create timestamp
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")

# Output file for the JS gate
JS_GATE_FILE="$RUN_DIR/20_DEVTOOLS_RUNTIME_TRUTH_GATE.js"
GATE_INDEX_FILE="$RUN_DIR/21_gate_files.txt"

# JavaScript gate content
# This is deterministic and can be evaluated in DevTools console
cat > "$JS_GATE_FILE" << 'EOF'
/**
 * DevTools Runtime Truth Gate v1
 * Verifies that UI identity fields display real values (not placeholders)
 * 
 * How to use in DevTools console:
 * 1. Open DevTools (F12)
 * 2. Go to Console tab
 * 3. Paste this entire script
 * 4. Press Enter
 * 5. Check the result (should be GATE_PASS=1, GATE_FAIL=0)
 */

(function() {
  const GATE_PASS = 0;
  const GATE_FAIL = 0;
  
  // Test 1: proof-ui-build-sha element exists and has real value
  const proofUiBuildShaElem = document.querySelector('[data-qa="proof-ui-build-sha"]') || 
                              document.getElementById('proof-ui-build-sha') ||
                              Array.from(document.querySelectorAll('*')).find(el => el.textContent.includes('Build SHA') && el.nextElementSibling);
  
  if (proofUiBuildShaElem) {
    const text = proofUiBuildShaElem.textContent || '';
    const isSHA = /^[a-f0-9]{40}$/.test(text);
    const isPlaceholder = /UNSET|NOT_AVAILABLE|NOT_DECLARED|placeholder/i.test(text);
    
    if (isSHA && !isPlaceholder) {
      console.log('✅ GATE 1: proof-ui-build-sha has real 40-char hex SHA');
      ((++GATE_PASS)) || true;
    } else {
      console.log(`❌ GATE 1 FAIL: proof-ui-build-sha="${text}" (expected 40-char hex, got placeholder or invalid)`);
      ((++GATE_FAIL)) || true;
    }
  } else {
    console.log('❌ GATE 1 FAIL: proof-ui-build-sha element not found');
    ((++GATE_FAIL)) || true;
  }
  
  // Test 2: proof-ui-build-time element exists and has real ISO timestamp
  const proofUiBuildTimeElem = document.querySelector('[data-qa="proof-ui-build-time"]') ||
                               document.getElementById('proof-ui-build-time') ||
                               Array.from(document.querySelectorAll('*')).find(el => el.textContent.includes('Build Time') && el.nextElementSibling);
  
  if (proofUiBuildTimeElem) {
    const text = proofUiBuildTimeElem.textContent || '';
    const isISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/.test(text);
    const isPlaceholder = /UNSET|NOT_AVAILABLE|NOT_DECLARED|placeholder/i.test(text);
    
    if (isISO && !isPlaceholder) {
      console.log('✅ GATE 2: proof-ui-build-time has real ISO timestamp');
      ((++GATE_PASS)) || true;
    } else {
      console.log(`❌ GATE 2 FAIL: proof-ui-build-time="${text}" (expected ISO timestamp, got placeholder or invalid)`);
      ((++GATE_FAIL)) || true;
    }
  } else {
    console.log('❌ GATE 2 FAIL: proof-ui-build-time element not found');
    ((++GATE_FAIL)) || true;
  }
  
  // Test 3: Verify no placeholders exist anywhere in proof panel
  const proofPanel = document.querySelector('[data-qa="proof-panel"]') ||
                     Array.from(document.querySelectorAll('*')).find(el => el.id === 'proof-panel' || el.className.includes('proof'));
  
  if (proofPanel) {
    const panelText = proofPanel.textContent || '';
    const placeholderCount = (panelText.match(/UNSET|NOT_AVAILABLE|NOT_DECLARED_IN_SNAPSHOT|placeholder/gi) || []).length;
    
    if (placeholderCount === 0) {
      console.log('✅ GATE 3: proof panel contains 0 placeholder strings');
      ((++GATE_PASS)) || true;
    } else {
      console.log(`❌ GATE 3 FAIL: proof panel contains ${placeholderCount} placeholder strings`);
      ((++GATE_FAIL)) || true;
    }
  } else {
    console.log('⚠️  GATE 3 SKIP: proof panel element not found (may not be visible yet)');
  }
  
  // Final result
  console.log(`\n========================================`);
  console.log(`RUNTIME TRUTH GATE RESULT`);
  console.log(`GATE_PASS=${GATE_PASS}`);
  console.log(`GATE_FAIL=${GATE_FAIL}`);
  console.log(`Status: ${GATE_FAIL === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`========================================`);
  
  return {
    GATE_PASS,
    GATE_FAIL,
    status: GATE_FAIL === 0 ? 'PASS' : 'FAIL',
    timestamp: new Date().toISOString()
  };
})();
EOF

GATE_FILES+=("$JS_GATE_FILE")

# Create index file listing all gate files
{
  echo "# DevTools Runtime Truth Gate Generator"
  echo "# Generated: $TIMESTAMP"
  echo ""
  echo "## Generated Gate Files"
  echo ""
  for f in "${GATE_FILES[@]}"; do
    echo "- $(basename "$f")"
  done
  echo ""
  echo "## Usage"
  echo ""
  echo "1. Open DevTools (F12)"
  echo "2. Go to Console tab"
  echo "3. Open \`20_DEVTOOLS_RUNTIME_TRUTH_GATE.js\` in editor"
  echo "4. Copy entire script from lines 1-end"
  echo "5. Paste into DevTools Console"
  echo "6. Press Enter to run"
  echo "7. Result should show:"
  echo "   - ✅ GATE 1: proof-ui-build-sha has real 40-char hex SHA"
  echo "   - ✅ GATE 2: proof-ui-build-time has real ISO timestamp"
  echo "   - ✅ GATE 3: proof panel contains 0 placeholder strings"
  echo "   - Status: PASS"
} > "$GATE_INDEX_FILE"

GATE_FILES+=("$GATE_INDEX_FILE")

echo "✅ Runtime truth gate generator complete"
echo ""
echo "Generated files:"
for f in "${GATE_FILES[@]}"; do
  echo "  - $(basename "$f") ($(wc -l < "$f") lines)"
done
echo ""
echo "Next: npm run build && npm test"
