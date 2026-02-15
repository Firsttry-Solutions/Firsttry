#!/bin/bash
# FIRSTTRY PHASE 3 — STRONG MANIFEST GUARD (ALLOWLIST MODE)
# Validates that manifest.yml scopes match EXACT allowlist
# No additional scopes allowed. No missing scopes allowed.
# Enforced at CI-core workflow.

set -e

MANIFEST_FILE="${1:-atlassian/forge-app/manifest.yml}"

echo "[FT_SCOPE_GUARD_START] Validating manifest scopes against allowlist..."

# Expected scopes in exact order (canonical)
EXPECTED_SCOPES=(
  "read:jira-configuration"
  "read:jira-project"
  "read:jira-user"
  "read:jira-work"
  "storage:app"
)

# Check if manifest file exists
if [ ! -f "$MANIFEST_FILE" ]; then
  echo "[FT_SCOPE_ALLOWLIST_FAIL] Manifest file not found: $MANIFEST_FILE"
  exit 1
fi

# Extract scopes from manifest using grep and sort them
# More precise: look for lines that start with "    - " under permissions: scopes:
ACTUAL_SCOPES=($(sed -n '/permissions:/,/external:/p' "$MANIFEST_FILE" | sed -n '/scopes:/,/^  [^ ]/p' | grep '^\s*-\s*read\|^\s*-\s*storage' | awk '{print $NF}' | sort))

echo "[FT_SCOPE_DEBUG] Expected: ${EXPECTED_SCOPES[@]}"
echo "[FT_SCOPE_DEBUG] Actual: ${ACTUAL_SCOPES[@]}"

# Check if arrays have same length
if [ "${#EXPECTED_SCOPES[@]}" -ne "${#ACTUAL_SCOPES[@]}" ]; then
  echo "[FT_SCOPE_ALLOWLIST_FAIL] Scope count mismatch. Expected ${#EXPECTED_SCOPES[@]}, got ${#ACTUAL_SCOPES[@]}"
  exit 1
fi

# Check if all expected scopes are present
for scope in "${EXPECTED_SCOPES[@]}"; do
  found=0
  for actual in "${ACTUAL_SCOPES[@]}"; do
    if [ "$scope" = "$actual" ]; then
      found=1
      break
    fi
  done
  if [ $found -eq 0 ]; then
    echo "[FT_SCOPE_ALLOWLIST_FAIL] Missing required scope: $scope"
    exit 1
  fi
done

# Check if there are no extra scopes
for actual in "${ACTUAL_SCOPES[@]}"; do
  found=0
  for scope in "${EXPECTED_SCOPES[@]}"; do
    if [ "$actual" = "$scope" ]; then
      found=1
      break
    fi
  done
  if [ $found -eq 0 ]; then
    echo "[FT_SCOPE_ALLOWLIST_FAIL] Unexpected additional scope: $actual"
    exit 1
  fi
done

# All validations passed
echo "[FT_SCOPE_ALLOWLIST_OK] Manifest scopes validated against allowlist"
echo "[FT_SCOPE_ALLOWLIST_OK] Expected scopes: ${EXPECTED_SCOPES[@]}"
echo "[FT_SCOPE_ALLOWLIST_OK] Verified: All required scopes present, no extras allowed"

exit 0
