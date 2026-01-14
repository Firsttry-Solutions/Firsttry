#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C
ALLOW="tools/brand_allowlist.txt"
test -f "$ALLOW" || { echo "FAIL: missing $ALLOW"; exit 2; }

mapfile -t allow < <(grep -vE '^\s*#|^\s*$' "$ALLOW" || true)
for p in "${allow[@]}"; do
  git ls-files --error-unmatch "$p" >/dev/null 2>&1 || { echo "FAIL: allowlist contains untracked path: $p"; exit 1; }
done

# Update banned terms to your known legacy names/domains (keep list explicit).
BANNED=(
  "old-product-name-goes-here"
  "old-domain-goes-here"
)

# Scan tracked text-like files
files=$(git ls-files | grep -E '\.(md|ts|tsx|js|json|yml|yaml|html)$' || true)
if [ "${#allow[@]}" -gt 0 ]; then
  for p in "${allow[@]}"; do
    files=$(printf "%s\n" "$files" | grep -v -F -x "$p" || true)
  done
fi

hits=""
for term in "${BANNED[@]}"; do
  [ -z "$term" ] && continue
  h=$(printf "%s\n" "$files" | xargs -r grep -nF "$term" || true)
  [ -n "$h" ] && hits="${hits}"$'\n'"$h"
done

if [ -n "$hits" ]; then
  echo "FAIL BRAND_DRIFT: legacy branding detected"
  echo "$hits"
  exit 1
fi

echo "PASS BRAND_DRIFT"
