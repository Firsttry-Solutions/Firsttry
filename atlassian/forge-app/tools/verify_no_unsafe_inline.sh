#!/usr/bin/env bash
set -euo pipefail

# Fail-closed gate: forbid unsafe-inline in manifest.yml
# This gate MUST pass before build:gadget can run.
# Use case: Marketplace security review will flag unsafe-inline as potential XSS vector.

if rg -n "unsafe-inline" manifest.yml >/dev/null 2>&1; then
  echo "FAIL: unsafe-inline present in manifest.yml"
  echo "---"
  rg -n "unsafe-inline" manifest.yml
  echo "---"
  echo "ACTION: Remove unsafe-inline from permissions.content.styles in manifest.yml"
  exit 1
fi

echo "PASS: no unsafe-inline in manifest.yml"
exit 0
