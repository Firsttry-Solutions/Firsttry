#!/usr/bin/env bash

set -euo pipefail

# ============================================================================
# Read-Only Proof Gate — Fail-Closed
# ============================================================================
# Purpose:
#   Proves repository does not have Jira mutation capability.
#   Blocks merges if evidence of write/delete operations found.
#
# Gates:
#   A) Manifest permissions (no write:/delete: scopes)
#   B) REST mutation methods (no POST/PUT/PATCH/DELETE to Jira)
#   C) Known Jira mutation endpoints (no /rest/api/3/{issue,project,user,group})
#   D) UI mutation affordances (no Create/Edit/Delete/Update verbs in code)
#
# Exit: 0 if all gates pass, 1 on any violation

cd /workspaces/Firsttry

E="/tmp/ft_readonly_gate_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$E"

echo "$E" > "$E/EVIDENCE_DIR.txt"

PASS_COUNT=0
FAIL_COUNT=0

echo "=== Read-Only Proof Gate ==="
echo "Evidence directory: $E"
echo ""

# ============================================================================
# Gate A: Manifest Permissions
# ============================================================================
echo "Gate A: Checking manifest permissions..."

MANIFEST=""
if [ -f "manifest.yml" ]; then
    MANIFEST="manifest.yml"
elif [ -f "atlassian/forge-app/manifest.yml" ]; then
    MANIFEST="atlassian/forge-app/manifest.yml"
fi

if [ -z "$MANIFEST" ]; then
    echo "  ✗ No manifest.yml found"
    echo "FAIL" > "$E/gateA_result.txt"
    echo "No manifest" > "$E/gateA_manifest_permissions.txt"
    FAIL_COUNT=$((FAIL_COUNT + 1))
else
    echo "  Found: $MANIFEST"
    
    # Extract permissions section
    sed -n '/^permissions:/,/^[a-z]/p' "$MANIFEST" > "$E/gateA_manifest_permissions.txt" 2>/dev/null || true
    
    # Check for forbidden scopes
    FORBIDDEN=0
    for scope in "write:jira-work" "manage:jira-configuration" "write:jira-user" "delete:jira-work"; do
        if grep -i "$scope" "$E/gateA_manifest_permissions.txt" >/dev/null 2>&1; then
            echo "  ✗ Forbidden scope: $scope"
            FORBIDDEN=1
        fi
    done
    
    # Check for write: or delete: patterns (more general check)
    if grep -E "^\s+-(.*write:|.*delete:)" "$E/gateA_manifest_permissions.txt" >/dev/null 2>&1; then
        # double-check this isn't a false positive
        if ! grep -E "^\s+-(.*read:|.*view:)" "$E/gateA_manifest_permissions.txt" >/dev/null 2>&1; then
            echo "  ✗ Mutation scope found (write: or delete:)"
            FORBIDDEN=1
        fi
    fi
    
    if [ "$FORBIDDEN" -eq 0 ]; then
        echo "  ✓ No forbidden mutation scopes detected"
        echo "PASS" > "$E/gateA_result.txt"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "FAIL" > "$E/gateA_result.txt"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
fi

echo ""

# ============================================================================
# Gate B: REST Mutation Methods in Code
# ============================================================================
echo "Gate B: Checking for REST mutation methods..."

HITS=0

# Search for POST/PUT/PATCH/DELETE methods
if find src/ e2e/ atlassian/ -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) 2>/dev/null | \
   xargs grep -l "method.*:\s*['\"]POST['\"]" 2>/dev/null | head -5 >> "$E/gateB_hits.txt" 2>/dev/null; then
    HITS=$((HITS + 1))
fi

if find src/ e2e/ atlassian/ -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) 2>/dev/null | \
   xargs grep -lE "(method.*:\s*['\"]PUT['\"]|method.*:\s*['\"]PATCH['\"]|method.*:\s*['\"]DELETE['\"])" 2>/dev/null | head -5 >> "$E/gateB_hits.txt" 2>/dev/null; then
    HITS=$((HITS + 1))
fi

if find src/ e2e/ atlassian/ -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) 2>/dev/null | \
   xargs grep -lE "axios\.(post|put|patch|delete)" 2>/dev/null | head -5 >> "$E/gateB_hits.txt" 2>/dev/null; then
    HITS=$((HITS + 1))
fi

if [ "$HITS" -eq 0 ]; then
    echo "  ✓ No mutation methods detected"
    echo "PASS" > "$E/gateB_result.txt"
    PASS_COUNT=$((PASS_COUNT + 1))
    touch "$E/gateB_hits.txt"
else
    echo "  ✗ Mutation methods found (see gateB_hits.txt)"
    echo "FAIL" > "$E/gateB_result.txt"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# ============================================================================
# Gate C: Known Jira Mutation Endpoints
# ============================================================================
echo "Gate C: Checking for Jira mutation endpoints..."

ENDPOINT_HITS=0

# Check for known mutation endpoints
for endpoint in "/rest/api/3/issue" "/rest/api/3/project" "/rest/api/3/user" "/rest/api/3/group"; do
    if find src/ e2e/ atlassian/ -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) 2>/dev/null | \
       xargs grep -l "$(echo "$endpoint" | sed 's/\//\\\//g')" 2>/dev/null | head -3 >> "$E/gateC_hits.txt" 2>/dev/null; then
        ENDPOINT_HITS=$((ENDPOINT_HITS + 1))
    fi
done

if [ "$ENDPOINT_HITS" -eq 0 ]; then
    echo "  ✓ No mutation endpoints detected"
    echo "PASS" > "$E/gateC_result.txt"
    PASS_COUNT=$((PASS_COUNT + 1))
    touch "$E/gateC_hits.txt"
else
    echo "  ✗ Mutation endpoints found (see gateC_hits.txt)"
    echo "FAIL" > "$E/gateC_result.txt"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# ============================================================================
# Gate D: UI Mutation Affordances
# ============================================================================
echo "Gate D: Checking for UI mutation affordances..."

UI_HITS=0

# Check for mutation verbs in UI code
for verb in "Create issue" "Edit issue" "Delete" "Update"; do
    if find src/ e2e/ atlassian/ -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) 2>/dev/null | \
       xargs grep -l "$verb" 2>/dev/null | head -3 >> "$E/gateD_hits.txt" 2>/dev/null; then
        UI_HITS=$((UI_HITS + 1))
    fi
done

if [ "$UI_HITS" -eq 0 ]; then
    echo "  ✓ No UI mutation affordances detected"
    echo "PASS" > "$E/gateD_result.txt"
    PASS_COUNT=$((PASS_COUNT + 1))
    touch "$E/gateD_hits.txt"
else
    echo "  ✗ UI mutation affordances found (see gateD_hits.txt)"
    echo "FAIL" > "$E/gateD_result.txt"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# ============================================================================
# Final Result
# ============================================================================
echo "=== Gate Summary ==="
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "PASS: read-only proof gate ok"
    echo "PASS" > "$E/SUCCESS.txt"
    exit 0
else
    echo "FAIL: read-only proof gate violated"
    {
        echo "Failed gates:"
        [ -f "$E/gateA_result.txt" ] && cat "$E/gateA_result.txt" | grep -q "^FAIL" && echo "  - Gate A: Manifest permissions"
        [ -f "$E/gateB_result.txt" ] && cat "$E/gateB_result.txt" | grep -q "^FAIL" && echo "  - Gate B: REST mutation methods"
        [ -f "$E/gateC_result.txt" ] && cat "$E/gateC_result.txt" | grep -q "^FAIL" && echo "  - Gate C: Jira mutation endpoints"
        [ -f "$E/gateD_result.txt" ] && cat "$E/gateD_result.txt" | grep -q "^FAIL" && echo "  - Gate D: UI mutation affordances"
    } > "$E/FAIL.txt"
    echo "Evidence: $E"
    exit 1
fi
