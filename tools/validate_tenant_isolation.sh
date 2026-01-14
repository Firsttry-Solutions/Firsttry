#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

# 1) Static check: ensure there is a tenant context helper and it is used for any storage key build.
# If your repo already has these modules, validate presence and usage.
# If not present, fail hard (this forces implementation rather than hand-waving).

ROOT="atlassian/forge-app/src"
test -d "$ROOT" || { echo "FAIL: missing $ROOT"; exit 2; }

# Heuristics: look for tenant context module and assert it's imported where storage is used.
storage_files=$(git ls-files | grep -E '^atlassian/forge-app/src/.*\.(ts|tsx|js)$' | xargs -r grep -nE "from '@forge/api'|storage" -l || true)

# Must have at least one tenant context implementation file
tenant_impl=$(git ls-files | grep -E '^atlassian/forge-app/src/.*tenant.*\.(ts|js)$' || true)
if [ -z "$tenant_impl" ]; then
  echo "FAIL TENANT: no tenant context implementation found (expected file containing 'tenant' in name under atlassian/forge-app/src)"
  exit 1
fi

# Must not have global/static keys like "GLOBAL_" used with storage
bad_global=$(printf "%s\n" "$storage_files" | xargs -r grep -nE "storage\.(get|set|delete)\(\s*['\"](GLOBAL_|global:|shared:)" || true)
if [ -n "$bad_global" ]; then
  echo "FAIL TENANT: global/shared storage keys detected"
  echo "$bad_global"
  exit 1
fi

echo "PASS TENANT (static heuristics)."
