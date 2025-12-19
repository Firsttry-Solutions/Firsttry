#!/usr/bin/env bash
set -euo pipefail

cd "${WORKSPACE_FOLDER:-$PWD}"

echo "[postCreate] starting (hardened, non-fatal)"

# Always succeed even if provisioning fails — don't brick Codespaces.
fail() { echo "[postCreate] WARNING: $*"; return 0; }

# Create venv (non-fatal)
if [ ! -d ".venv" ]; then
  python3 -m venv .venv || fail "venv creation failed"
fi

# Activate (non-fatal)
if [ -f ".venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate || fail "venv activate failed"
else
  fail "no activate script found"
fi

# Pip bootstrap (non-fatal, with simple retry)
pip_try() {
  python -m pip install "$@" && return 0
  sleep 2
  python -m pip install "$@" && return 0
  sleep 4
  python -m pip install "$@" && return 0
  return 1
}

pip_try -U pip setuptools wheel || fail "pip bootstrap failed"

# Install requirements if present (non-fatal)
if [ -f requirements-dev.txt ]; then
  pip_try -r requirements-dev.txt || fail "requirements-dev.txt install failed"
elif [ -f requirements.txt ]; then
  pip_try -r requirements.txt || fail "requirements.txt install failed"
fi

# Node deps are optional (non-fatal)
if [ -f package.json ]; then
  corepack enable || true
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund || true
fi

echo "[postCreate] done"
exit 0
