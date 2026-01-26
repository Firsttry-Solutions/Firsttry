#!/bin/bash
# Gate: Prevent reintroduction of invalid requestStorage API usage
# 
# BACKGROUND: requestStorage is NOT a function in Forge.
# Correct patterns: storage.get(), storage.set(), storage.delete(), storage.query()
# Invalid pattern: asApp().requestStorage(...) or api.requestStorage(...)
# 
# This gate prevents accidental reintroduction of broken code.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Gate: verify_no_requestStorage_usage"
echo "  Project root: $PROJECT_ROOT"

# Search for invalid patterns
echo "Searching for requestStorage usage..."
if rg -n "requestStorage" "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" "$PROJECT_ROOT/tools" 2>/dev/null || true | grep -q "requestStorage"; then
    echo "❌ FAIL: Found requestStorage references (invalid Forge API)"
    rg -n "requestStorage" "$PROJECT_ROOT/src" "$PROJECT_ROOT/tests" "$PROJECT_ROOT/tools" 2>/dev/null || true
    exit 1
else
    echo "✅ PASS: No requestStorage references found"
    exit 0
fi
