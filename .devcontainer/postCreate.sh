#!/usr/bin/env bash
set -euo pipefail

# This script runs as the 'vscode' user. It is idempotent and makes a best-effort
# attempt to provision a workspace-local `.venv` and install dev/test tooling.
# This version is minimal and deterministic - install only what's defined in requirements files.

echo "--- [postCreate] Starting setup ---"

cd "${WORKSPACE_FOLDER:-$PWD}"

echo "--- [postCreate] Setting up Python .venv ---"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

echo "--- [postCreate] Activating .venv ---"
# shellcheck disable=SC1091
source .venv/bin/activate

# Upgrade pip/setuptools/wheel once (not -U every time)
python -m pip install --quiet pip setuptools wheel

# Install from requirements files only (deterministic, not random -U installs)
if [[ -f requirements-dev.txt ]]; then
    echo "--- [postCreate] Installing requirements-dev.txt ---"
    python -m pip install --quiet -r requirements-dev.txt
elif [[ -f requirements.txt ]]; then
    echo "--- [postCreate] Installing requirements.txt ---"
    python -m pip install --quiet -r requirements.txt
fi

# Install project in editable mode
if [[ -f pyproject.toml ]]; then
    echo "--- [postCreate] Installing editable package ---"
    python -m pip install --quiet -e ".[dev]" 2>/dev/null || python -m pip install --quiet -e .
fi

# Node.js dependencies (only if package.json exists)
if [[ -f package.json ]]; then
    echo "--- [postCreate] Installing Node.js dependencies ---"
    npm ci --quiet --no-audit --no-fund || npm install --quiet --no-audit --no-fund
fi

echo "--- [postCreate] Done ---"
