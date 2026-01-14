#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

ALLOW="tools/readonly_allowlist.txt"
test -f "$ALLOW" || { echo "FAIL: missing $ALLOW"; exit 2; }

mapfile -t allow < <(grep -vE '^\s*#|^\s*$' "$ALLOW" || true)
for p in "${allow[@]}"; do
  git ls-files --error-unmatch "$p" >/dev/null 2>&1 || { echo "FAIL: allowlist contains untracked path: $p"; exit 1; }
done

files=$(git ls-files | grep -E '^atlassian/forge-app/src/' || true)

if [ "${#allow[@]}" -gt 0 ]; then
  for p in "${allow[@]}"; do
    files=$(printf "%s\n" "$files" | grep -v -F -x "$p" || true)
  done
fi

# Disallow write primitives to EXTERNAL systems via HTTP/REST
# ALLOWED: storage.set (Forge Storage), storage.delete (Forge Storage) - these are approved channels
# FORBIDDEN: requestJira with POST/PUT/DELETE (uncontrolled mutations to Jira), setSecret, deleteSecret, HTTP requests with mutation verbs
pat='(asApp\(\)\.requestJira\([^)]*method["\s]*:["\s]*(POST|PUT|DELETE)|asUser\(\)\.requestJira\([^)]*method["\s]*:["\s]*(POST|PUT|DELETE)|setSecret\b|deleteSecret\b|https\.request.*method["\s]*:["\s]*(POST|PUT|DELETE)|http\.request.*method["\s]*:["\s]*(POST|PUT|DELETE))'

hits=$(printf "%s\n" "$files" | xargs -r grep -nE "$pat" || true)
if [ -n "$hits" ]; then
  echo "FAIL READONLY: write-capable calls detected"
  echo "$hits"
  exit 1
fi

echo "PASS READONLY"
