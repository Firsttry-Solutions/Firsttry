#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
umask 077

AUTH_DIR="tests/playwright/.auth"
mkdir -p "$AUTH_DIR"

# Remove only generator temp scripts (safe)
find "$AUTH_DIR" -maxdepth 1 -type f -name 'auth_gen_*.mjs' -print -delete || true

# Fail-closed if any non-ignored files would show up in git status
# (This protects ops clean-tree gating)
ST="$(git status --porcelain)"
if [ -n "$ST" ]; then
  echo "FAIL-CLOSED: repo not clean after pw_auth_cleanup_guard"
  echo "$ST"
  exit 1
fi

echo "PW_AUTH_CLEANUP_GUARD=PASS"
