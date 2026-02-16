#!/bin/bash
# Phase 5.1.2 Guard Script
# Verifies hard constraints before deployment

set -euo pipefail

RUN_DIR="${1:-/tmp/ft_phase5_1_2_guard_$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$RUN_DIR"

cd /workspaces/Firsttry/atlassian/forge-app

echo "=== PHASE 5.1.2 GUARD SCRIPT ===" | tee "$RUN_DIR/00_guard_start.txt"
echo "Run DIR: $RUN_DIR" | tee -a "$RUN_DIR/00_guard_start.txt"

FAIL_COUNT=0

# A) Check package.json unchanged
echo "A) Checking package.json..." | tee "$RUN_DIR/10_check_packagejson.txt"
if git diff --exit-code package.json > /dev/null 2>&1; then
  echo "✅ package.json unchanged" | tee -a "$RUN_DIR/10_check_packagejson.txt"
else
  echo "❌ FAIL: package.json has changes" | tee -a "$RUN_DIR/10_check_packagejson.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# B) Check lockfiles unchanged
echo "B) Checking lockfiles..." | tee "$RUN_DIR/11_check_lockfiles.txt"
if git diff --exit-code package-lock.json > /dev/null 2>&1; then
  echo "✅ package-lock.json unchanged" | tee -a "$RUN_DIR/11_check_lockfiles.txt"
else
  echo "❌ FAIL: package-lock.json has changes" | tee -a "$RUN_DIR/11_check_lockfiles.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# C) Check for outbound networking
echo "C) Scanning for outbound networking..." | tee "$RUN_DIR/12_check_networking.txt"
if rg -n "(axios|fetch\s*\(|http\b|https\b|WebSocket|invokeRemote)" src/export/auditor src/diff src/security src/remediation > "$RUN_DIR/12_networking_found.txt" 2>&1; then
  echo "❌ FAIL: Outbound networking detected" | tee -a "$RUN_DIR/12_check_networking.txt"
  cat "$RUN_DIR/12_networking_found.txt" | tee -a "$RUN_DIR/12_check_networking.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "✅ No outbound networking detected" | tee -a "$RUN_DIR/12_check_networking.txt"
fi

# D) Check for Jira mutations
echo "D) Scanning for Jira mutations..." | tee "$RUN_DIR/13_check_mutations.txt"
if rg -n "requestJira.*\b(POST|PUT|DELETE)\b" src/export/auditor src/diff src/security src/remediation > "$RUN_DIR/13_mutations_found.txt" 2>&1; then
  echo "⚠️  WARN: Possible Jira mutations detected (best-effort)" | tee -a "$RUN_DIR/13_check_mutations.txt"
  cat "$RUN_DIR/13_mutations_found.txt" | tee -a "$RUN_DIR/13_check_mutations.txt"
else
  echo "✅ No Jira POST/PUT/DELETE patterns detected" | tee -a "$RUN_DIR/13_check_mutations.txt"
fi

# H) Obsolete smoke harness ban (PHASE 5.1.3)
echo "H) Checking obsolete smoke harness..." | tee "$RUN_DIR/13b_check_harness.txt"
if test -f tests/export/auditor/packer.smoke.spec.ts && test -f scripts/proof/smoke_generate_packet.mjs; then
  echo "❌ FAIL: BOTH vitest and mjs smoke harnesses exist (must use only vitest)" | tee -a "$RUN_DIR/13b_check_harness.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
elif test -f scripts/proof/smoke_generate_packet.mjs; then
  echo "❌ FAIL: Obsolete mjs smoke harness present (use vitest instead)" | tee -a "$RUN_DIR/13b_check_harness.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "✅ No obsolete smoke harness detected" | tee -a "$RUN_DIR/13b_check_harness.txt"
fi

# I) Runtime clock ban in auditor path (PHASE 5.1.3)
echo "I) Scanning for runtime clock in auditor path..." | tee "$RUN_DIR/13c_check_clock.txt"
if rg -n "new Date\(|toISOString\(" src/export/auditor src/diff src/remediation > "$RUN_DIR/13c_clock_found.txt" 2>&1; then
  echo "❌ FAIL: Runtime clock detected in auditor path (use buildUtc metadata instead)" | tee -a "$RUN_DIR/13c_check_clock.txt"
  cat "$RUN_DIR/13c_clock_found.txt" | tee -a "$RUN_DIR/13c_check_clock.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "✅ No runtime clock in auditor packet path" | tee -a "$RUN_DIR/13c_check_clock.txt"
fi

# J) Verify HTML download buttons (PHASE 5.1.3)
echo "J) Checking HTML download buttons..." | tee "$RUN_DIR/13d_check_downloads.txt"
if rg -q "Download verify\.sh|onclick=\"downloadVerifyS" src/export/auditor/htmlReport.ts; then
  echo "✅ verify.sh download button present" | tee -a "$RUN_DIR/13d_check_downloads.txt"
else
  echo "❌ FAIL: verify.sh download button missing" | tee -a "$RUN_DIR/13d_check_downloads.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# K) Verify honest trust wording (PHASE 5.1.3)
echo "K) Checking trust wording..." | tee "$RUN_DIR/13e_check_trust.txt"
TRUST_FAIL=0
if rg -qi "tamper-proof|^\\s*immutable|^\\s*unbreakable" src/export/auditor/htmlReport.ts > "$RUN_DIR/13e_trust_fails.txt" 2>&1; then
  echo "❌ FAIL: Forbidden marketing words found (tamper-proof/immutable/unbreakable)" | tee -a "$RUN_DIR/13e_check_trust.txt"
  cat "$RUN_DIR/13e_trust_fails.txt" | tee -a "$RUN_DIR/13e_check_trust.txt"
  TRUST_FAIL=1
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

if ! rg -q "Internal Consistency" src/export/auditor/htmlReport.ts; then
  echo "❌ FAIL: Missing Internal Consistency wording" | tee -a "$RUN_DIR/13e_check_trust.txt"
  TRUST_FAIL=1
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

if ! rg -q "Paste expected hash" src/export/auditor/htmlReport.ts; then
  echo "❌ FAIL: Missing external hash verification UI text" | tee -a "$RUN_DIR/13e_check_trust.txt"
  TRUST_FAIL=1
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

if [ $TRUST_FAIL -eq 0 ]; then
  echo "✅ Trust wording is honest and complete" | tee -a "$RUN_DIR/13e_check_trust.txt"
fi

# E) Check for proof markers
echo "E) Checking proof markers..." | tee "$RUN_DIR/14_check_markers.txt"
MARKERS=(
  "FT_PROOF_AUDITOR_MANIFEST_v1"
  "FT_PROOF_NO_CIRCULAR_HASH_v1"
  "FT_PROOF_VERIFY_SH_v1"
  "FT_PROOF_VERIFY_PS1_v1"
  "FT_PROOF_AUDITOR_HTML_v1"
  "FT_PROOF_HTML_SELF_VERIFY_v1"
  "FT_PROOF_EXTERNAL_HASH_MODE_v1"
  "FT_PROOF_PACKER_v1"
  "FT_PROOF_DIFF_ENGINE_v1"
  "FT_PROOF_SHADOW_ADMIN_v1"
  "FT_PROOF_REVERT_GENERATOR_v1"
)

MISSING_MARKERS=0
for marker in "${MARKERS[@]}"; do
  if rg -q "$marker" src/export/auditor src/diff src/security src/remediation; then
    echo "  ✅ $marker" | tee -a "$RUN_DIR/14_check_markers.txt"
  else
    echo "  ❌ MISSING: $marker" | tee -a "$RUN_DIR/14_check_markers.txt"
    MISSING_MARKERS=$((MISSING_MARKERS + 1))
  fi
done

if [ $MISSING_MARKERS -gt 0 ]; then
  echo "❌ FAIL: $MISSING_MARKERS proof markers missing" | tee -a "$RUN_DIR/14_check_markers.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "✅ All required proof markers present" | tee -a "$RUN_DIR/14_check_markers.txt"
fi

# L) Run tests
echo "L) Running tests..." | tee "$RUN_DIR/15_tests.txt"
if npm test -- tests/diff tests/security tests/remediation >> "$RUN_DIR/15_tests.txt" 2>&1; then
  echo "✅ Tests passed" | tee -a "$RUN_DIR/15_tests.txt"
else
  echo "❌ FAIL: Tests failed" | tee -a "$RUN_DIR/15_tests.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# M) Run build
echo "M) Running build..." | tee "$RUN_DIR/16_build.txt"
if npm run build >> "$RUN_DIR/16_build.txt" 2>&1; then
  echo "✅ Build passed" | tee -a "$RUN_DIR/16_build.txt"
else
  echo "❌ FAIL: Build failed" | tee -a "$RUN_DIR/16_build.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Summary
echo "" | tee "$RUN_DIR/99_summary.txt"
echo "=== GUARD SUMMARY ===" | tee -a "$RUN_DIR/99_summary.txt"
echo "Failures: $FAIL_COUNT" | tee -a "$RUN_DIR/99_summary.txt"

if [ $FAIL_COUNT -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED" | tee -a "$RUN_DIR/99_summary.txt"
  exit 0
else
  echo "❌ GUARD FAILED ($FAIL_COUNT checks failed)" | tee -a "$RUN_DIR/99_summary.txt"
  exit 1
fi
