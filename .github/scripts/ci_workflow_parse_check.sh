#!/bin/bash
# Check all workflow files for valid YAML parsing
set -euo pipefail

PASS=0
FAIL=0
ERRORS=""

echo "Checking workflow YAML parsing..."
echo ""

for f in .github/workflows/*.yml .github/workflows/*.yaml; do
  if [ ! -f "$f" ]; then
    continue
  fi
  
  # Try to parse with ruby
  if ruby -ryaml -e "YAML.load_file(ARGV[0])" "$f" > /dev/null 2>&1; then
    echo "✓ $f"
    ((PASS++))
  else
    echo "❌ $f"
    ((FAIL++))
    ERRORS="$ERRORS\n$f: $(ruby -ryaml -e "YAML.load_file(ARGV[0])" "$f" 2>&1 | head -1)"
  fi
done

echo ""
echo "========================================"
echo "RESULTS: $PASS passed, $FAIL failed"
echo "========================================"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "Failed workflows:"
  echo -e "$ERRORS"
  exit 1
fi

exit 0
