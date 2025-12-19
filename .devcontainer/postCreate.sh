#!/usr/bin/env bash
set -euo pipefail

# This script runs as the 'vscode' user. It is idempotent and makes a best-effort
# attempt to provision a workspace-local `.venv` and install dev/test tooling.

echo "--- [postCreate] Starting setup ---"

# System packages are installed in onCreate (OS-agnostic)
# postCreate focuses on venv, pip packages, and node dependencies only

cd "${WORKSPACE_FOLDER:-$PWD}"

echo "--- [postCreate] Setting up Python .venv ---"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

echo "--- [postCreate] Activating .venv and installing tools ---"
# shellcheck disable=SC1091
source .venv/bin/activate

# 2) Toolchain inside venv only
python -m pip install -U pip setuptools wheel

# 3) Core dev/test stack
echo "--- [postCreate] Installing Python dev packages ---"
python -m pip install -U \
    pytest ruff black mypy pip-audit \
    pytest-xdist pytest-randomly pytest-repeat pytest-profiling \
    sqlalchemy || true

# 4) Project-specific dependencies
if [[ -f requirements.txt ]]; then
    echo "--- [postCreate] Installing requirements.txt ---"
    python -m pip install -r requirements.txt || true
fi
if [[ -f requirements-dev.txt ]]; then
    echo "--- [postCreate] Installing requirements-dev.txt ---"
    python -m pip install -r requirements-dev.txt || true
fi
if [[ -f pyproject.toml ]]; then
    echo "--- [postCreate] Installing editable package (dev extras if present) ---"
    python -m pip install -e ".[dev]" || python -m pip install -e . || true
fi

# --- Node.js Setup (optional) ---
if [[ -f package.json ]]; then
    echo "--- [postCreate] Found package.json, installing Node.js dependencies ---"
    corepack enable || true
    npm ci --no-audit --no-fund || npm install --no-audit --no-fund || true
fi

# --- Sanity Check ---
echo "--- [postCreate] Running quick sanity check (pytest smoke) ---"
export PYTEST_DISABLE_PLUGIN_AUTOLOAD=1
python - <<'PY'
import sys, subprocess
print("Quick sanity: python", sys.version)
print(f"Python executable: {sys.executable}")
try:
    subprocess.run([sys.executable, "-m", "pytest", "-q", "-k", ""], check=False)
except Exception as e:
    print("pytest sanity failed (non-fatal):", e)
PY

echo "--- [postCreate] Done ---"
