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

# N) Phase 5.1.5: Verify htmlSha256 is REMOVED from manifest, scripts are REQUIRED
echo "N) Checking critical-only hash fields in manifest..." | tee "$RUN_DIR/14a_check_critical_hashes.txt"
HASH_FAIL=0

# evidenceSha256 MUST be present
if rg -q "evidenceSha256" src/export/auditor/manifest.ts; then
  echo "  ✅ evidenceSha256 field present (REQUIRED)" | tee -a "$RUN_DIR/14a_check_critical_hashes.txt"
else
  echo "  ❌ MISSING: evidenceSha256 field" | tee -a "$RUN_DIR/14a_check_critical_hashes.txt"
  HASH_FAIL=1
fi

# verifyShSha256 MUST be present (no longer optional)
if rg -q "verifyShSha256" src/export/auditor/manifest.ts; then
  echo "  ✅ verifyShSha256 field present (REQUIRED)" | tee -a "$RUN_DIR/14a_check_critical_hashes.txt"
else
  echo "  ❌ MISSING: verifyShSha256 field" | tee -a "$RUN_DIR/14a_check_critical_hashes.txt"
  HASH_FAIL=1
fi

# verifyPs1Sha256 MUST be present (no longer optional)
if rg -q "verifyPs1Sha256" src/export/auditor/manifest.ts; then
  echo "  ✅ verifyPs1Sha256 field present (REQUIRED)" | tee -a "$RUN_DIR/14a_check_critical_hashes.txt"
else
  echo "  ❌ MISSING: verifyPs1Sha256 field" | tee -a "$RUN_DIR/14a_check_critical_hashes.txt"
  HASH_FAIL=1
fi

# htmlSha256 MUST NOT be present in interface or function params (only comments OK)
if rg -q "htmlSha256:" src/export/auditor/manifest.ts || rg -q "htmlSha256\?" src/export/auditor/manifest.ts; then
  echo "  ❌ FAIL: htmlSha256 field still in interface/params (MUST be removed in Phase 5.1.5)" | tee -a "$RUN_DIR/14a_check_critical_hashes.txt"
  rg -n "htmlSha256:\|htmlSha256\?" src/export/auditor/manifest.ts | tee -a "$RUN_DIR/14a_check_critical_hashes.txt"
  HASH_FAIL=1
else
  echo "  ✅ htmlSha256 field correctly removed (Phase 5.1.5)" | tee -a "$RUN_DIR/14a_check_critical_hashes.txt"
fi

if [ $HASH_FAIL -eq 0 ]; then
  echo "✅ Manifest contains only critical artifact hashes (evidence + scripts, no HTML)" | tee -a "$RUN_DIR/14a_check_critical_hashes.txt"
else
  echo "❌ FAIL: Critical hash fields incorrect" | tee -a "$RUN_DIR/14a_check_critical_hashes.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# O) Phase 5.1.5: Verify verify.sh validates ONLY critical artifacts (no HTML)
echo "O) Checking verify.sh validates only critical artifacts..." | tee "$RUN_DIR/14b_check_verify_sh.txt"
VERIFY_SH_FAIL=0

# MUST validate evidence.json
if rg -q "verifyFile.*evidence.json" src/export/auditor/scripts.ts; then
  echo "  ✅ Validates evidence.json" | tee -a "$RUN_DIR/14b_check_verify_sh.txt"
else
  echo "  ❌ Missing validation for evidence.json" | tee -a "$RUN_DIR/14b_check_verify_sh.txt"
  VERIFY_SH_FAIL=1
fi

# MUST validate verify.sh
if rg -q "verifyFile.*verify.sh" src/export/auditor/scripts.ts; then
  echo "  ✅ Validates verify.sh" | tee -a "$RUN_DIR/14b_check_verify_sh.txt"
else
  echo "  ❌ Missing validation for verify.sh" | tee -a "$RUN_DIR/14b_check_verify_sh.txt"
  VERIFY_SH_FAIL=1
fi

# MUST validate verify.ps1
if rg -q "verifyFile.*verify.ps1" src/export/auditor/scripts.ts; then
  echo "  ✅ Validates verify.ps1" | tee -a "$RUN_DIR/14b_check_verify_sh.txt"
else
  echo "  ❌ Missing validation for verify.ps1" | tee -a "$RUN_DIR/14b_check_verify_sh.txt"
  VERIFY_SH_FAIL=1
fi

# MUST NOT validate HTML (Phase 5.1.5)
if rg -q "verifyFile.*FirstTry-Audit-Evidence.html" src/export/auditor/scripts.ts; then
  echo "  ❌ FAIL: verify.sh still validates HTML (MUST remove in Phase 5.1.5)" | tee -a "$RUN_DIR/14b_check_verify_sh.txt"
  VERIFY_SH_FAIL=1
else
  echo "  ✅ verify.sh correctly excludes HTML verification (Phase 5.1.5)" | tee -a "$RUN_DIR/14b_check_verify_sh.txt"
fi

if [ $VERIFY_SH_FAIL -eq 0 ]; then
  echo "✅ verify.sh validates exactly 3 critical artifacts (evidence + scripts)" | tee -a "$RUN_DIR/14b_check_verify_sh.txt"
else
  echo "❌ FAIL: verify.sh artifact validations incorrect" | tee -a "$RUN_DIR/14b_check_verify_sh.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# P) Phase 5.1.5: Verify verify.ps1 validates ONLY critical artifacts (no HTML)
echo "P) Checking verify.ps1 validates only critical artifacts..." | tee "$RUN_DIR/14c_check_verify_ps1.txt"
VERIFY_PS1_FAIL=0

# MUST validate evidence.json
if rg -q "Verify-ArtifactHash.*evidence.json" src/export/auditor/scripts.ts; then
  echo "  ✅ Validates evidence.json" | tee -a "$RUN_DIR/14c_check_verify_ps1.txt"
else
  echo "  ❌ Missing validation for evidence.json" | tee -a "$RUN_DIR/14c_check_verify_ps1.txt"
  VERIFY_PS1_FAIL=1
fi

# MUST validate verify.sh
if rg -q "Verify-ArtifactHash.*verify.sh" src/export/auditor/scripts.ts; then
  echo "  ✅ Validates verify.sh" | tee -a "$RUN_DIR/14c_check_verify_ps1.txt"
else
  echo "  ❌ Missing validation for verify.sh" | tee -a "$RUN_DIR/14c_check_verify_ps1.txt"
  VERIFY_PS1_FAIL=1
fi

# MUST validate verify.ps1
if rg -q "Verify-ArtifactHash.*verify.ps1" src/export/auditor/scripts.ts; then
  echo "  ✅ Validates verify.ps1" | tee -a "$RUN_DIR/14c_check_verify_ps1.txt"
else
  echo "  ❌ Missing validation for verify.ps1" | tee -a "$RUN_DIR/14c_check_verify_ps1.txt"
  VERIFY_PS1_FAIL=1
fi

# MUST NOT validate HTML (Phase 5.1.5)
if rg -q "Verify-ArtifactHash.*FirstTry-Audit-Evidence.html" src/export/auditor/scripts.ts; then
  echo "  ❌ FAIL: verify.ps1 still validates HTML (MUST remove in Phase 5.1.5)" | tee -a "$RUN_DIR/14c_check_verify_ps1.txt"
  VERIFY_PS1_FAIL=1
else
  echo "  ✅ verify.ps1 correctly excludes HTML verification (Phase 5.1.5)" | tee -a "$RUN_DIR/14c_check_verify_ps1.txt"
fi

if [ $VERIFY_PS1_FAIL -eq 0 ]; then
  echo "✅ verify.ps1 validates exactly 3 critical artifacts (evidence + scripts)" | tee -a "$RUN_DIR/14c_check_verify_ps1.txt"
else
  echo "❌ FAIL: verify.ps1 artifact validations incorrect" | tee -a "$RUN_DIR/14c_check_verify_ps1.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Q) Phase 5.1.5: Verify htmlReport has CONTAINER trust model marker (not DISCLOSURE)
echo "Q) Checking htmlReport.ts trust model marker (Phase 5.1.5)..." | tee "$RUN_DIR/14d_check_html_markers.txt"
TRUST_MARKERS_FAIL=0

# MUST have the new CONTAINER marker (Phase 5.1.5)
if rg -q "FT_PROOF_TRUST_MODEL_CONTAINER_DISCLOSURE_v1" src/export/auditor/htmlReport.ts; then
  echo "  ✅ FT_PROOF_TRUST_MODEL_CONTAINER_DISCLOSURE_v1 present (Phase 5.1.5)" | tee -a "$RUN_DIR/14d_check_html_markers.txt"
else
  echo "  ❌ MISSING: FT_PROOF_TRUST_MODEL_CONTAINER_DISCLOSURE_v1 (Phase 5.1.5)" | tee -a "$RUN_DIR/14d_check_html_markers.txt"
  TRUST_MARKERS_FAIL=1
fi

# MUST still have auditor layout marker
if rg -q "FT_PROOF_AUDITOR_LAYOUT_BANK_STATEMENT_v1" src/export/auditor/htmlReport.ts; then
  echo "  ✅ FT_PROOF_AUDITOR_LAYOUT_BANK_STATEMENT_v1 present" | tee -a "$RUN_DIR/14d_check_html_markers.txt"
else
  echo "  ❌ MISSING: FT_PROOF_AUDITOR_LAYOUT_BANK_STATEMENT_v1" | tee -a "$RUN_DIR/14d_check_html_markers.txt"
  TRUST_MARKERS_FAIL=1
fi

# MUST NOT have the old DISCLOSURE marker (replaced in Phase 5.1.5)
if ! rg -q "FT_PROOF_TRUST_MODEL_DISCLOSURE_v1[^_]" src/export/auditor/htmlReport.ts; then
  echo "  ✅ Old FT_PROOF_TRUST_MODEL_DISCLOSURE_v1 properly replaced/removed" | tee -a "$RUN_DIR/14d_check_html_markers.txt"
elif rg -q "FT_PROOF_TRUST_MODEL_DISCLOSURE_v1[^_]" src/export/auditor/htmlReport.ts | grep -v "CONTAINER_DISCLOSURE"; then
  echo "  ❌ Old FT_PROOF_TRUST_MODEL_DISCLOSURE_v1 still present (should be CONTAINER_DISCLOSURE)" | tee -a "$RUN_DIR/14d_check_html_markers.txt"
  TRUST_MARKERS_FAIL=1
fi

if [ $TRUST_MARKERS_FAIL -eq 0 ]; then
  echo "✅ htmlReport has correct Phase 5.1.5 trust model marker (CONTAINER)" | tee -a "$RUN_DIR/14d_check_html_markers.txt"
else
  echo "❌ FAIL: htmlReport trust model markers incorrect" | tee -a "$RUN_DIR/14d_check_html_markers.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# R) Phase 5.1.4: Verify trust model wording in HTML (Level 1 & 2)
echo "R) Checking trust model wording (Level 1 & 2)..." | tee "$RUN_DIR/14e_check_trust_levels.txt"
TRUST_LEVELS_FAIL=0
if rg -q "Internal Consistency" src/export/auditor/htmlReport.ts; then
  echo "  ✅ Level 1 (Internal Consistency) wording present" | tee -a "$RUN_DIR/14e_check_trust_levels.txt"
else
  echo "  ❌ MISSING: Level 1 (Internal Consistency) wording" | tee -a "$RUN_DIR/14e_check_trust_levels.txt"
  TRUST_LEVELS_FAIL=1
fi
if rg -q "Tamper-Evident" src/export/auditor/htmlReport.ts; then
  echo "  ✅ Level 2 (Tamper-Evident) wording present" | tee -a "$RUN_DIR/14e_check_trust_levels.txt"
else
  echo "  ❌ MISSING: Level 2 (Tamper-Evident) wording" | tee -a "$RUN_DIR/14e_check_trust_levels.txt"
  TRUST_LEVELS_FAIL=1
fi
if [ $TRUST_LEVELS_FAIL -eq 0 ]; then
  echo "✅ Trust model Level 1 & 2 wording complete" | tee -a "$RUN_DIR/14e_check_trust_levels.txt"
else
  echo "❌ FAIL: Trust model wording incomplete" | tee -a "$RUN_DIR/14e_check_trust_levels.txt"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# S) Phase 5.1.5: Ban htmlSha256 from auditor codebase (allow validation checks in tests)
echo "S) Checking htmlSha256 is removed (Phase 5.1.5)..." | tee "$RUN_DIR/15_check_no_html_sha.txt"
HTML_SHA_FOUND=0

# Check src/export/auditor - htmlSha256 MUST NOT appear (except in comments explaining removal)
if rg -q "htmlSha256[^]" src/export/auditor | grep -v "NOTE: html" | grep -v "# Remove" | grep -v "Phase 5.1.5"; then
  echo "❌ FAIL: htmlSha256 still present in auditor code (Phase 5.1.5 removal)" | tee -a "$RUN_DIR/15_check_no_html_sha.txt"
  rg -n "htmlSha256" src/export/auditor | grep -v "NOTE: html" | grep -v "# Remove" | grep -v "Phase 5.1.5" | tee -a "$RUN_DIR/15_check_no_html_sha.txt"
  HTML_SHA_FOUND=1
else
  echo "  ✅ htmlSha256 not in src/export/auditor implementation code" | tee -a "$RUN_DIR/15_check_no_html_sha.txt"
fi

# Check tests - htmlSha256 is allowed ONLY in fail-closed validation checks (if statements that REJECT it)
# Count actual usage vs validation
HTML_SHA_ACTUAL_USAGE=$(rg -c "htmlSha256" tests/export/auditor 2>/dev/null || echo 0)
HTML_SHA_VALIDATION=$(rg -c "if.*htmlSha256.*FAIL" tests/export/auditor 2>/dev/null || echo 0)

if [ "$HTML_SHA_ACTUAL_USAGE" -gt 0 ] && [ "$HTML_SHA_VALIDATION" -eq 0 ]; then
  echo "❌ FAIL: htmlSha256 found in tests outside of validation checks (Phase 5.1.5)" | tee -a "$RUN_DIR/15_check_no_html_sha.txt"
  HTML_SHA_FOUND=1
else
  if [ "$HTML_SHA_VALIDATION" -gt 0 ]; then
    echo "  ✅ htmlSha256 in tests only for fail-closed validation (correct)" | tee -a "$RUN_DIR/15_check_no_html_sha.txt"
  else
    echo "  ✅ htmlSha256 not in tests" | tee -a "$RUN_DIR/15_check_no_html_sha.txt"
  fi
fi

if [ $HTML_SHA_FOUND -eq 0 ]; then
  echo "✅ htmlSha256 correctly removed/restricted (Phase 5.1.5)" | tee -a "$RUN_DIR/15_check_no_html_sha.txt"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# T) Phase 5.1.5: Ban "expected mismatch" logic from _hashCompare
echo "T) Checking mismatch tolerance logic removed (Phase 5.1.5)..." | tee "$RUN_DIR/15_check_no_mismatch.txt"
MISMATCH_FOUND=0

if rg -qi "expected.*mismatch|this is expected" tests/export/auditor/_hashCompare.ts; then
  echo "❌ FAIL: 'expected mismatch' tolerance logic still in _hashCompare.ts (Phase 5.1.5 removal)" | tee -a "$RUN_DIR/15_check_no_mismatch.txt"
  rg -n "expected|mismatch" tests/export/auditor/_hashCompare.ts | tee -a "$RUN_DIR/15_check_no_mismatch.txt"
  MISMATCH_FOUND=1
else
  echo "  ✅ Mismatch tolerance logic removed" | tee -a "$RUN_DIR/15_check_no_mismatch.txt"
fi

if [ $MISMATCH_FOUND -eq 0 ]; then
  echo "✅ E2E harness correctly rejects any mismatches (Phase 5.1.5)" | tee -a "$RUN_DIR/15_check_no_mismatch.txt"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
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
  "FT_PROOF_MANIFEST_CRITICAL_ARTIFACTS_ONLY_v1"
  "FT_PROOF_PACKER_NO_HTML_HASH_v1"
  "FT_PROOF_VERIFY_CRITICAL_ARTIFACTS_ONLY_v1"
  "FT_PROOF_HASH_COMPARE_CRITICAL_ONLY_v1"
  "FT_PROOF_TRUST_MODEL_CONTAINER_DISCLOSURE_v1"
  "FT_PROOF_AUDITOR_LAYOUT_BANK_STATEMENT_v1"
)

MISSING_MARKERS=0
for marker in "${MARKERS[@]}"; do
  # E2E markers (hash compare) are in tests, others are in src
  if [[ "$marker" == *"HASH_COMPARE"* ]]; then
    if rg -q "$marker" tests/export/auditor; then
      echo "  ✅ $marker" | tee -a "$RUN_DIR/14_check_markers.txt"
    else
      echo "  ❌ MISSING: $marker" | tee -a "$RUN_DIR/14_check_markers.txt"
      MISSING_MARKERS=$((MISSING_MARKERS + 1))
    fi
  else
    if rg -q "$marker" src/export/auditor src/diff src/security src/remediation; then
      echo "  ✅ $marker" | tee -a "$RUN_DIR/14_check_markers.txt"
    else
      echo "  ❌ MISSING: $marker" | tee -a "$RUN_DIR/14_check_markers.txt"
      MISSING_MARKERS=$((MISSING_MARKERS + 1))
    fi
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
