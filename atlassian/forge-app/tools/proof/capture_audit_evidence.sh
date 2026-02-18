#!/usr/bin/env bash
# capture_audit_evidence.sh
# Deterministic audit evidence capture script
# Usage: bash tools/proof/capture_audit_evidence.sh [RUN_DIR]
# If RUN_DIR not provided, creates /tmp/ft_audit_YYYY...

set -euo pipefail

# Args
RUN_DIR="${1:-/tmp/ft_audit_$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$RUN_DIR"

# Run from repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Audit Evidence Capture Script ===" >&2
echo "RUN_DIR: $RUN_DIR" >&2
echo "Repo root: $REPO_ROOT" >&2

# Step 1: Clean state
echo "[1/5] Cleaning node_modules..." >&2
rm -rf node_modules

# Step 2: npm ci (deterministic install)
echo "[2/5] Running npm ci --include=dev..." >&2
npm ci --include=dev 2>&1 | tee "$RUN_DIR/10_ci.txt"

# Step 3: npm audit (all dependencies)
echo "[3/5] Capturing npm audit (all)..." >&2
# npm audit may return non-zero if vulns exist, so use || true
npm audit 2>&1 | tee "$RUN_DIR/20_audit_all.txt" || true
npm audit --json 2>&1 | tee "$RUN_DIR/21_audit_all.json" || true

# Step 4: npm audit (prod-only)
echo "[4/5] Capturing npm audit (prod-only --omit=dev)..." >&2
npm audit --omit=dev 2>&1 | tee "$RUN_DIR/30_audit_prod.txt" || true
npm audit --omit=dev --json 2>&1 | tee "$RUN_DIR/31_audit_prod.json" || true

# Step 5: npm ls
echo "[5/5] Capturing npm ls --depth=0..." >&2
npm ls --depth=0 2>&1 | tee "$RUN_DIR/40_ls_depth0.txt" || true

echo "" >&2
echo "✅ Audit evidence capture complete" >&2
echo "AUDIT_EVIDENCE_OK RUN_DIR=$RUN_DIR"
