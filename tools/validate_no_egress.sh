#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

ALLOW="tools/no_egress_allowlist.txt"
test -f "$ALLOW" || { echo "FAIL: missing $ALLOW"; exit 2; }

mapfile -t allow < <(grep -vE '^\s*#|^\s*$' "$ALLOW" || true)
for p in "${allow[@]}"; do
  git ls-files --error-unmatch "$p" >/dev/null 2>&1 || { echo "FAIL: allowlist contains untracked path: $p"; exit 1; }
done

# Build tracked file list under code roots
files=$(git ls-files | grep -E '^(atlassian/forge-app/src|src)/' || true)

# subtract allowlist
if [ "${#allow[@]}" -gt 0 ]; then
  for p in "${allow[@]}"; do
    files=$(printf "%s\n" "$files" | grep -v -F -x "$p" || true)
  done
fi

# Patterns (runtime usage) - strict patterns to avoid comments
# Matches: fetch(...), axios.*, https.request(...), http.request(...)
# Avoids: comment lines and word boundaries
pat='(^\s*fetch\s*\(|axios\.[a-z]|https\.request|http\.request)'

hits=$(printf "%s\n" "$files" | xargs -r grep -nE "$pat" || true)

if [ -n "$hits" ]; then
  echo "FAIL NO_EGRESS: outbound-capable calls detected"
  echo "$hits"
  exit 1
fi

echo "PASS NO_EGRESS"
