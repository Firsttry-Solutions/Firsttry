#!/usr/bin/env bash
set -euo pipefail

umask 077
export GIT_TERMINAL_PROMPT=0
export GIT_OPTIONAL_LOCKS=0
export GIT_LFS_SKIP_SMUDGE=1

# -----------------------------------------------------------------------------
# Proof Harness: Phase 2 Real Runner Out-of-Sync (Crash-Resistant, Fail-Closed)
# -----------------------------------------------------------------------------

T="/tmp/ft_phase2_real_runner_$(date -u +%Y%m%dT%H%M%SZ)"
export T
mkdir -p "$T"/{00_env,01_cmd,02_phase_setup,03_runner,04_checks,05_artifacts,99_verdict,pollution_guard}

PROOF_SUMMARY="$T/PROOF_SUMMARY.txt"
FINAL_VERDICT="$T/99_verdict/FINAL_VERDICT.txt"
FINAL_REPORT="$T/99_verdict/FINAL_REPORT.md"
export PROOF_SUMMARY FINAL_VERDICT FINAL_REPORT

# Keep terminal output minimal.
log() { printf '%s\n' "$*" ; }
die() {
  local msg="$1"
  mkdir -p "$T/99_verdict"
  echo "FAIL: $msg" > "$FINAL_VERDICT"
  write_report "FAIL" "$msg"
  {
    echo "FAIL"
    echo "Reason: $msg"
    echo "Evidence root: $T"
    echo "See: $FINAL_REPORT"
  } >> "$PROOF_SUMMARY" 2>/dev/null || true
  log "FAIL: $msg"
  log "EVIDENCE: $T"
  exit 1
}

pad_to_500() {
  local f="$1"
  local min=500
  local sz
  sz=$(wc -c < "$f" | tr -d ' ')
  if [ "$sz" -lt "$min" ]; then
    {
      echo ""
      echo "---- PADDING (to satisfy >=500 bytes invariant) ----"
      echo "This report is padded to ensure deterministic minimum size for regression detection."
      echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      echo "Evidence root: $T"
      echo "---------------------------------------------------"
      echo "Logs:"
      echo "  - $T/runner_stdout.log"
      echo "  - $T/runner_stderr.log"
      echo "  - $T/02_phase_setup/"
      echo "  - $T/04_checks/"
      echo ""
      echo "End."
    } >> "$f"
  fi
}

write_report() {
  local status="$1"
  local reason="$2"

  mkdir -p "$T/99_verdict"
  {
    echo "# Phase 2 Real Runner Proof - Final Report"
    echo ""
    echo "**Generated (UTC):** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "**Status:** $status"
    echo "**Reason:** $reason"
    echo ""
    echo "## Evidence Root"
    echo ""
    echo "\`$T\`"
    echo ""
    echo "## Key Files"
    echo ""
    echo "- PROOF_SUMMARY: \`$PROOF_SUMMARY\`"
    echo "- Runner stdout: \`$T/runner_stdout.log\`"
    echo "- Runner stderr: \`$T/runner_stderr.log\`"
    echo "- Runner RC: \`$T/03_runner/runner_rc.txt\`"
    echo ""
    echo "## Setup Logs"
    echo ""
    echo "- \`$T/02_phase_setup/\`"
    echo ""
    echo "## Checks"
    echo ""
    echo "- \`$T/04_checks/\`"
    echo ""
    echo "## Pollution Guard"
    echo ""
    echo "- Before paths: \`$T/pollution_guard/before_paths.txt\`"
    echo "- After  paths: \`$T/pollution_guard/after_paths.txt\`"
    echo "- Before symlink: \`$T/pollution_guard/before_symlink.txt\`"
    echo "- After  symlink: \`$T/pollution_guard/after_symlink.txt\`"
    echo ""
  } > "$FINAL_REPORT"

  # Add additional context if present
  if [ -f "$T/02_phase_setup/shas.txt" ]; then
    {
      echo "## SHAs"
      echo ""
      echo '```'
      cat "$T/02_phase_setup/shas.txt"
      echo '```'
      echo ""
    } >> "$FINAL_REPORT"
  fi

  if [ -f "$T/03_runner/evidence_root.txt" ]; then
    {
      echo "## Runner Evidence Root"
      echo ""
      echo '```'
      cat "$T/03_runner/evidence_root.txt"
      echo '```'
      echo ""
    } >> "$FINAL_REPORT"
  fi

  pad_to_500 "$FINAL_REPORT"
}

require_tools() {
  local missing=()
  for t in git bash timeout readlink wc grep sed head tail; do
    command -v "$t" >/dev/null 2>&1 || missing+=("$t")
  done
  if [ "${#missing[@]}" -ne 0 ]; then
    die "Missing required tools: ${missing[*]}"
  fi
}

# run_step NAME TIMEOUT_SECS <<'EOF'
#   commands...
# EOF
STEP_N=0
run_step() {
  local name="$1"
  local secs="$2"
  STEP_N=$((STEP_N+1))
  local nn
  nn=$(printf "%02d" "$STEP_N")
  local stepfile="$T/01_cmd/${nn}_${name}.sh"
  local out="$T/02_phase_setup/${nn}_${name}.stdout"
  local err="$T/02_phase_setup/${nn}_${name}.stderr"

  cat > "$stepfile"
  chmod +x "$stepfile"

  # Execute with timeout, capture output to files only.
  if ! timeout -k 5s "${secs}s" bash "$stepfile" >"$out" 2>"$err"; then
    {
      echo "Step failed: $name"
      echo "Timeout secs: $secs"
      echo "Stdout: $out"
      echo "Stderr: $err"
    } > "$T/04_checks/step_fail_${nn}_${name}.txt"
    die "Step '$name' failed (see $out and $err)"
  fi

  # Ensure output files exist (even if empty) for proof consistency.
  [ -f "$out" ] || echo "" > "$out"
  [ -f "$err" ] || echo "" > "$err"
}

# -----------------------------------------------------------------------------
# Start
# -----------------------------------------------------------------------------
require_tools

# Environment capture
{
  echo "UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "UNAME=$(uname -a)"
  echo "PWD=$(pwd)"
  echo "GIT=$(git --version)"
  echo "BASH=$(bash --version | head -1)"
  echo "TIMEOUT=$(timeout --version | head -1)"
} > "$T/00_env/env.txt"

# Pollution guard BEFORE
# paths list: exact order/bytes must match, so normalize sort for determinism
{
  if compgen -G "/tmp/ft_marketplace_release_*" > /dev/null; then
    ls -1d /tmp/ft_marketplace_release_* 2>/dev/null | sort
  else
    echo "NONE"
  fi
} > "$T/pollution_guard/before_paths.txt"

if [ -L "/tmp/ft_marketplace_release_latest" ]; then
  readlink -f "/tmp/ft_marketplace_release_latest" > "$T/pollution_guard/before_symlink.txt" || echo "BROKEN" > "$T/pollution_guard/before_symlink.txt"
else
  echo "NOTEXIST" > "$T/pollution_guard/before_symlink.txt"
fi

# Setup repo paths
export ORIGIN="$T/origin.git"
export SEED="$T/seed"
export CLONE="$T/clone"

# 1) init bare origin
run_step "init_origin" 20 <<'STEP_EOF'
set -euo pipefail
git init --bare --quiet "$ORIGIN"
echo "OK: origin=$ORIGIN"
STEP_EOF

# 2) clone local workspace to SEED and push to origin/main
run_step "seed_clone_and_push" 120 <<'STEP_EOF'
set -euo pipefail

# Always remove any existing SEED dir before cloning (in case of partial clone)
rm -rf "$SEED"

# Attempt FAST clone first (local optimization)
set +e
GIT_TERMINAL_PROMPT=0 GIT_LFS_SKIP_SMUDGE=1 git -c core.hooksPath=/dev/null clone --quiet --no-tags --local /workspaces/Firsttry "$SEED"
CLONE_RC=$?
set -e

CLONE_MODE=""
if [ "$CLONE_RC" -eq 0 ]; then
  CLONE_MODE="FAST_LOCAL"
  echo "CLONE_MODE=FAST_LOCAL"
else
  # Fast clone failed, fall back to regular clone without --local
  echo "FAST_CLONE_FAILED: falling back"
  rm -rf "$SEED"
  GIT_TERMINAL_PROMPT=0 GIT_LFS_SKIP_SMUDGE=1 git -c core.hooksPath=/dev/null clone --quiet --no-tags /workspaces/Firsttry "$SEED"
  CLONE_MODE="FALLBACK"
  echo "CLONE_MODE=FALLBACK"
fi

cd "$SEED"
git config gc.auto 0
git config fetch.prune true
git config user.email "proof@firsttry.local"
git config user.name "FirstTry Proof"
git checkout -B main --quiet

# Debug artifact: seed clone info
{
  echo "CLONE_MODE=$CLONE_MODE"
  echo "HEAD_SHA=$(git rev-parse HEAD)"
  echo "STATUS:"
  git status --porcelain
  echo "REMOTES:"
  git remote -v
} > "$T/02_phase_setup/seed_clone_info.txt"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$ORIGIN"
else
  git remote add origin "$ORIGIN"
fi

git push --quiet -u origin main
echo "OK: seed pushed to origin/main"
STEP_EOF

# 3) advance origin by one commit, record PREV_SHA
run_step "advance_origin_one_commit" 60 <<'STEP_EOF'
set -euo pipefail
cd "$SEED"
BASE_SHA=$(git rev-parse HEAD)
git commit --allow-empty -m "origin-ahead" --no-gpg-sign --quiet
ORIGIN_AHEAD_SHA=$(git rev-parse HEAD)
git push --quiet origin main
PREV_SHA=$(git rev-parse HEAD~1)
{
  echo "BASE_SHA=$BASE_SHA"
  echo "ORIGIN_AHEAD_SHA=$ORIGIN_AHEAD_SHA"
  echo "PREV_SHA=$PREV_SHA"
} > "$T/02_phase_setup/shas.txt"
echo "OK: origin advanced by 1 commit"
STEP_EOF

# 4) create CLONE behind by 1 commit (checkout PREV_SHA), ensure origin points to ORIGIN
run_step "create_clone_behind" 120 <<'STEP_EOF'
set -euo pipefail
PREV_SHA=$(grep '^PREV_SHA=' "$T/02_phase_setup/shas.txt" | cut -d= -f2)
git clone --quiet --no-tags "$ORIGIN" "$CLONE"
cd "$CLONE"
git config gc.auto 0
git config fetch.prune true
git config user.email "proof@firsttry.local"
git config user.name "FirstTry Proof"
git checkout -B main "$PREV_SHA" --quiet
git fetch --quiet origin main

LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse origin/main)

{
  echo "LOCAL_SHA=$LOCAL_SHA"
  echo "REMOTE_SHA=$REMOTE_SHA"
} >> "$T/02_phase_setup/shas.txt"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  echo "ERROR: expected out-of-sync but LOCAL_SHA == REMOTE_SHA"
  echo "origin remote:"
  git remote -v
  echo "log:"
  git log -3 --oneline
  exit 1
fi

echo "OK: clone behind origin/main"
STEP_EOF

# -----------------------------------------------------------------------------
# Run the actual release runner (isolated evidence paths under T)
# -----------------------------------------------------------------------------
export FT_RELEASE_EVIDENCE_PREFIX="$T/runner_evidence_"
export FT_RELEASE_LATEST_SYMLINK="$T/runner_latest"

RUNNER_DIR="$CLONE/atlassian/forge-app"
RUNNER="$RUNNER_DIR/tools/marketplace/release_marketplace_ready_e2e.sh"

# Configurable runner timeout (default 900s = 15 minutes)
RUNNER_TIMEOUT_SECS="${FT_PROOF_RUNNER_TIMEOUT_SECS:-900}"

# Pre-check runner exists
[ -f "$RUNNER" ] || die "Runner script not found at $RUNNER"
[ -d "$RUNNER_DIR" ] || die "Runner dir not found: $RUNNER_DIR"

# Execute runner with timeout; capture stdout/stderr to files (no terminal spam).
set +e
( cd "$RUNNER_DIR" ; timeout -k 10s "${RUNNER_TIMEOUT_SECS}s" bash "$RUNNER" >"$T/runner_stdout.log" 2>"$T/runner_stderr.log" )
RC=$?
set -e
echo "$RC" > "$T/03_runner/runner_rc.txt"
echo "$RUNNER_TIMEOUT_SECS" > "$T/03_runner/runner_timeout_secs.txt"

# Classify runner exit
if [ "$RC" -eq 124 ]; then
  echo "TIMEOUT" > "$T/03_runner/runner_timeout_class.txt"
elif [ "$RC" -eq 137 ]; then
  echo "KILLED" > "$T/03_runner/runner_timeout_class.txt"
else
  echo "EXITED" > "$T/03_runner/runner_timeout_class.txt"
fi

{
  echo "runner_dir=$RUNNER_DIR"
  echo "runner_path=$RUNNER"
  echo "pwd_before=$(pwd)"
  echo "pwd_used_for_runner=$RUNNER_DIR"
  echo "timeout_secs=$RUNNER_TIMEOUT_SECS"
} > "$T/03_runner/runner_context.txt"

# If runner timed out or was killed, fail immediately (do not check phase evidence)
if [ "$RC" -eq 124 ] || [ "$RC" -eq 137 ]; then
  mkdir -p "$T/04_checks/runner_diag"
  
  # Capture last 200 lines of stdout/stderr for diagnostics
  if [ -f "$T/runner_stdout.log" ] && [ -s "$T/runner_stdout.log" ]; then
    tail -200 "$T/runner_stdout.log" > "$T/04_checks/runner_diag/stdout_tail.txt"
  else
    echo "MISSING" > "$T/04_checks/runner_diag/stdout_tail.txt"
  fi
  
  if [ -f "$T/runner_stderr.log" ] && [ -s "$T/runner_stderr.log" ]; then
    tail -200 "$T/runner_stderr.log" > "$T/04_checks/runner_diag/stderr_tail.txt"
  else
    echo "MISSING" > "$T/04_checks/runner_diag/stderr_tail.txt"
  fi
  
  die "Runner did not complete (timeout/kill). RC=$RC. Do not trust phase evidence checks. See $T/04_checks/runner_diag/*."
fi

# Resolve evidence root from isolated symlink
if ! E="$(readlink -f "$FT_RELEASE_LATEST_SYMLINK" 2>/dev/null)"; then
  die "Failed to resolve isolated latest symlink: $FT_RELEASE_LATEST_SYMLINK"
fi
echo "$E" > "$T/03_runner/evidence_root.txt"

# -----------------------------------------------------------------------------
# Validate evidence (fail-closed)
# -----------------------------------------------------------------------------
mkdir -p "$T/04_checks"

# Expected failure (out-of-sync): RC must be non-zero
if [ "$RC" -eq 0 ]; then
  die "Runner returned RC=0 but expected non-zero (out-of-sync should fail at Phase 2)"
fi

[ -d "$E" ] || die "Evidence root does not exist: $E"

# Helper for file checks
must_exist_nonempty() {
  local path="$1"
  [ -f "$path" ] || die "Missing required file: $path"
  [ -s "$path" ] || die "File is empty (must be non-empty): $path"
}

must_exist_nonempty "$E/02_merge/VERDICT.txt"
must_exist_nonempty "$E/02_merge/merge.log"
must_exist_nonempty "$E/02_merge/fetch.log"
must_exist_nonempty "$E/02_merge/rev.txt"
must_exist_nonempty "$E/02_merge/branch.txt"
must_exist_nonempty "$E/99_verdict/FINAL_VERDICT.txt"
must_exist_nonempty "$E/99_verdict/FINAL_REPORT.md"

# Content checks
if ! grep -q '^FAIL:' "$E/02_merge/VERDICT.txt"; then
  die "02_merge/VERDICT.txt does not start with FAIL:"
fi
if ! grep -qi 'out of sync\|out-of-sync' "$E/02_merge/VERDICT.txt"; then
  die "02_merge/VERDICT.txt does not mention out-of-sync"
fi

if ! grep -q '^LOCAL=' "$E/02_merge/rev.txt" || ! grep -q '^REMOTE=' "$E/02_merge/rev.txt"; then
  die "02_merge/rev.txt missing LOCAL= or REMOTE="
fi

if ! grep -q '^main$' "$E/02_merge/branch.txt"; then
  die "02_merge/branch.txt is not exactly 'main'"
fi

if ! grep -q '^FAIL' "$E/99_verdict/FINAL_VERDICT.txt"; then
  die "99_verdict/FINAL_VERDICT.txt does not start with FAIL"
fi

# FINAL_REPORT size >= 500 bytes
REPORT_SZ=$(wc -c < "$E/99_verdict/FINAL_REPORT.md" | tr -d ' ')
if [ "$REPORT_SZ" -lt 500 ]; then
  die "Runner FINAL_REPORT.md is < 500 bytes ($REPORT_SZ) — regression"
fi

# -----------------------------------------------------------------------------
# Pollution guard AFTER (production paths must not change)
# -----------------------------------------------------------------------------
{
  if compgen -G "/tmp/ft_marketplace_release_*" > /dev/null; then
    ls -1d /tmp/ft_marketplace_release_* 2>/dev/null | sort
  else
    echo "NONE"
  fi
} > "$T/pollution_guard/after_paths.txt"

if [ -L "/tmp/ft_marketplace_release_latest" ]; then
  readlink -f "/tmp/ft_marketplace_release_latest" > "$T/pollution_guard/after_symlink.txt" || echo "BROKEN" > "$T/pollution_guard/after_symlink.txt"
else
  echo "NOTEXIST" > "$T/pollution_guard/after_symlink.txt"
fi

if ! diff -u "$T/pollution_guard/before_paths.txt" "$T/pollution_guard/after_paths.txt" > "$T/04_checks/pollution_paths.diff" 2>&1; then
  die "Production evidence paths changed (pollution detected). See $T/04_checks/pollution_paths.diff"
fi

if ! diff -u "$T/pollution_guard/before_symlink.txt" "$T/pollution_guard/after_symlink.txt" > "$T/04_checks/pollution_symlink.diff" 2>&1; then
  die "Production latest symlink changed/created (pollution detected). See $T/04_checks/pollution_symlink.diff"
fi

# -----------------------------------------------------------------------------
# Workspace cleanliness check
# -----------------------------------------------------------------------------
mkdir -p "$T/04_checks"
git -C /workspaces/Firsttry status --porcelain > "$T/04_checks/workspace_status.txt"
if [ -s "$T/04_checks/workspace_status.txt" ]; then
  die "Workspace /workspaces/Firsttry has uncommitted changes after proof run. See $T/04_checks/workspace_status.txt"
fi

# -----------------------------------------------------------------------------
# PASS
# -----------------------------------------------------------------------------
echo "PASS" > "$FINAL_VERDICT"
{
  echo "PASS"
  echo "What was proven:"
  echo "  - origin/main is ahead of clone main by 1 commit (out-of-sync)"
  echo "  - Release runner fails (non-zero RC) on out-of-sync at Phase 2"
  echo "  - Evidence files exist and are non-empty:"
  echo "      * 02_merge/VERDICT.txt (FAIL + out-of-sync)"
  echo "      * 02_merge/merge.log"
  echo "      * 02_merge/fetch.log"
  echo "      * 02_merge/rev.txt (LOCAL/REMOTE)"
  echo "      * 02_merge/branch.txt (main)"
  echo "      * 99_verdict/FINAL_VERDICT.txt (FAIL)"
  echo "      * 99_verdict/FINAL_REPORT.md (>=500 bytes)"
  echo "  - No pollution of production paths /tmp/ft_marketplace_release_* and /tmp/ft_marketplace_release_latest"
  echo ""
  echo "Evidence root: $T"
  echo "Runner evidence root: $E"
  echo "Runner RC: $RC"
} > "$PROOF_SUMMARY"

write_report "PASS" "All checks passed (real runner out-of-sync evidence complete; no production pollution)"

log "PASS"
log "EVIDENCE: $T"
log "Runner evidence: $E"
log "Logs: $T/runner_stdout.log and $T/runner_stderr.log"
exit 0
