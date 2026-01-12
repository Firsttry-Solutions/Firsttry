#!/usr/bin/env bash
# Single source of truth: generates all marketplace proof evidence
# Used by both CI (.github/workflows/marketplace-proof.yml) and local validation

set -euo pipefail
export LC_ALL=C
export LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN_ID="${1:-$(date -u +"%Y%m%dT%H%M%SZ")}"
OUT_DIR="${2:-$ROOT/audit/proof_runs/marketplace-proof-${RUN_ID}}"

mkdir -p "$OUT_DIR"
echo "RUN_ID=$RUN_ID" > "$OUT_DIR/00_run_id.txt"
echo "OUT_DIR=$OUT_DIR" > "$OUT_DIR/00_out_dir.txt"

cd "$ROOT"

# 00 baseline (repository state at run time)
{
  echo "TOP=$(git rev-parse --show-toplevel)"
  echo "BRANCH=$(git branch --show-current)"
  echo "HEAD=$(git rev-parse HEAD)"
  echo "--- status ---"
  git status --porcelain=v1
} > "$OUT_DIR/00_baseline.txt"

# 01 repo map (inventory of key files)
{
  echo "--- manifest extract ---"
  rg -n "app:|id:|name:|runtime:|permissions:|scopes:|modules:" atlassian/forge-app/manifest.yml || true
  echo
  echo "--- repo map ---"
  find . -maxdepth 6 -name manifest.yml -print
  find . -maxdepth 6 -name package.json -print
  find . -maxdepth 4 -name README.md -print
} > "$OUT_DIR/01_repo_map.txt"

# 01 feature inventory (what the app does)
{
  echo "--- feature inventory ---"
  rg -n "^\s*modules:|^\s*function:|^\s*trigger:|^\s*dashboardGadget:" atlassian/forge-app/manifest.yml || true
  rg -n "schedule:|interval:|cron:" atlassian/forge-app/manifest.yml || true
  rg -n "resolver|asUser\(\)\.requestJira|storage\.|@forge/api" atlassian/forge-app/src -S || true
} > "$OUT_DIR/01_feature_inventory.txt"

# 02 build/test/typecheck/lint
pushd atlassian/forge-app >/dev/null
npm ci 2>&1 | tee "$OUT_DIR/02_npm_ci.txt"
npm test 2>&1 | tee "$OUT_DIR/02_tests.txt"
npm run build 2>&1 | tee "$OUT_DIR/02_build.txt"
npx tsc --noEmit 2>&1 | tee "$OUT_DIR/02_typecheck.txt"
forge --version 2>&1 | tee "$OUT_DIR/02_forge_version.txt" || true
forge lint 2>&1 | tee "$OUT_DIR/02_forge_lint.txt" || true
popd >/dev/null

# 03 credential scan
{
  echo "=== CREDENTIAL PATTERN SCAN ==="
  rg -i "AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{48}|github.{0,20}['\"][0-9a-zA-Z]{35,40}['\"]" \
    --iglob "!*.md" --iglob "!node_modules" --iglob "!dist" --iglob "!*.lock" --iglob "!*.json" . || echo "No credentials detected"
} > "$OUT_DIR/03_credential_scan.txt"

# 04 scopes + requestJira + write ops + admin POST context + egress
{
  echo "=== SCOPES (manifest.yml) ==="
  rg -n "permissions:|scopes:" atlassian/forge-app/manifest.yml || true
  echo
  echo "=== STORAGE USAGE ==="
  rg -n "@forge/api|storage\." atlassian/forge-app/src -S || true
  echo
  echo "=== requestJira USAGE ==="
  rg -n "requestJira\(" atlassian/forge-app/src -S || true
} > "$OUT_DIR/04_scopes_and_usage.txt"

# 04 write ops scan (method patterns)
{
  echo "=== WRITE OPS SCAN (method patterns) ==="
  rg -n "method:\s*'(POST|PUT|DELETE|PATCH)'" -S atlassian/forge-app/src || true
  echo
  echo "=== requestJira call sites ==="
  rg -n "requestJira\(" -S atlassian/forge-app/src || true
} > "$OUT_DIR/04_write_ops_scan.txt"

# 04 admin POST context (prove it's NOT requestJira write)
{
  echo "=== ADMIN POST CONTEXT ==="
  # show POST line + nearby context to prove it's not requestJira write
  rg -n "method:\s*'POST'" atlassian/forge-app/src/admin/phase5_admin_page.ts || true
  echo "--- context (±30 lines around method: 'POST') ---"
  python3 - <<'PY'
import pathlib, re
p = pathlib.Path("atlassian/forge-app/src/admin/phase5_admin_page.ts")
if not p.exists():
    print("MISSING: phase5_admin_page.ts")
    raise SystemExit(0)
lines = p.read_text().splitlines()
hits = [i for i,l in enumerate(lines) if "method: 'POST'" in l]
for i in hits:
    lo=max(0,i-30)
    hi=min(len(lines), i+31)
    print(f"--- HIT at line {i+1} ---")
    for j in range(lo,hi):
        print(f"{j+1}: {lines[j]}")
PY
} > "$OUT_DIR/04_admin_post_context.txt"

# 04 egress scan
{
  echo "=== EGRESS SCAN: backend ==="
  rg -t ts -t js "fetch\(|axios|http\.request|https\.request" atlassian/forge-app/src/ --no-heading || echo "No egress detected"
  echo
  echo "=== EGRESS SCAN: gadget ui ==="
  rg -t ts -t tsx -t js -t jsx "fetch\(|axios" atlassian/forge-app/src/gadget-ui/src/ --no-heading || echo "No gadget egress detected"
} > "$OUT_DIR/04_egress_scan.txt"

# 05 freeze generate + verify twice (MUST EXIT 0 TWICE)
pushd atlassian/forge-app >/dev/null
bash audit/freeze_generate.sh 2>&1 | tee "$OUT_DIR/05_freeze_generate.txt"
bash audit/verify_freeze_lock.sh 2>&1 | tee "$OUT_DIR/05_freeze_verify_1.txt"
bash audit/verify_freeze_lock.sh 2>&1 | tee "$OUT_DIR/05_freeze_verify_2.txt"
popd >/dev/null

# 06 docs validation must pass
bash tools/validate_docs.sh 2>&1 | tee "$OUT_DIR/06_validate_docs.txt"

echo "OK: evidence generated at $OUT_DIR"
