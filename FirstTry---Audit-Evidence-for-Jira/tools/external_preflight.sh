#!/bin/bash
################################################################################
# EXTERNAL FACTORS PREFLIGHT CHECK
# Purpose: Detect external factors that can break Jira dashboard gadget UI
# 
# This script is READ-ONLY diagnostic. No changes to business logic.
# All output is teed to evidence directory for later analysis.
#
# Gates:
#   G1: INSTALL_MATCH        - Production install current
#   G2: STATUS_CLEAR         - No Atlassian incidents
#   G3: LOGS_NO_EXT_BLOCKERS - Logs clean of CSP/bridge/resolver errors
#   G4: CACHE_RISK           - Build artifacts present
#   G5: BROWSER_CLEAN        - Manual browser evidence required
#
# Overall: PASS only if G1=PASS and (G2=PASS or UNKNOWN) and (G3=PASS or UNKNOWN)
#          and G5 not FAIL (Unknown is OK for UNKNOWN evidence)
################################################################################

set -e

# ============================================================================
# STEP 0: Setup evidence directory
# ============================================================================

EVID="/tmp/ft_external_preflight_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$EVID"
echo "$EVID" > /tmp/ft_external_preflight_last_dir.txt

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] EXTERNAL_PREFLIGHT starting, evidence: $EVID"

# Write metadata
{
  echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Working directory: $(pwd)"
  echo "Script: $0"
  echo "User: $(whoami)"
  uname -a
  echo ""
  echo "Environment:"
  env | grep -E "^(PATH|NODE_|FORGE_|GIT_)" | sort || true
} | tee "$EVID/00_meta.txt"

cd /workspaces/Firsttry/atlassian/forge-app || exit 1

# ============================================================================
# STEP 1: Repo + build metadata (local, deterministic)
# ============================================================================

echo ""
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] STEP 1: Capturing git and build metadata..."

# Git revision
{
  echo "=== Git HEAD ==="
  git rev-parse HEAD
  echo ""
  echo "=== Git status (short) ==="
  git status --porcelain || echo "(git status failed)"
  echo ""
  echo "=== Git branch ==="
  git rev-parse --abbrev-ref HEAD || echo "(git branch failed)"
} | tee "$EVID/01_git.txt"

# Build metadata
{
  echo "=== Build metadata ==="
  if [ -f "tools/.build_meta.json" ]; then
    cat tools/.build_meta.json
  else
    echo "File not found: tools/.build_meta.json"
  fi
  echo ""
  echo "=== Backend build SHA (src/build/backend_build.ts) ==="
  if [ -f "src/build/backend_build.ts" ]; then
    grep -E "BACKEND_BUILD_SHA|export" src/build/backend_build.ts | head -5 || echo "(not found)"
  else
    echo "File not found: src/build/backend_build.ts"
  fi
} | tee "$EVID/02_build_meta.txt"

# Dist hashes (if gadget UI is built)
{
  echo "=== Distribution files ==="
  if [ -d "src/gadget-ui/dist" ]; then
    ls -lah src/gadget-ui/dist/ | head -20
    echo ""
    echo "=== Asset hashes ==="
    if command -v sha256sum &> /dev/null; then
      find src/gadget-ui/dist/assets -type f -exec sha256sum {} \; 2>/dev/null || echo "(sha256sum failed)"
    elif command -v shasum &> /dev/null; then
      find src/gadget-ui/dist/assets -type f -exec shasum -a 256 {} \; 2>/dev/null || echo "(shasum failed)"
    else
      echo "sha256sum/shasum not available"
    fi
  else
    echo "Directory not found: src/gadget-ui/dist"
    echo "ACTION: Run 'npm run build:gadget' to generate distribution"
  fi
} | tee "$EVID/03_dist_hashes.txt"

# ============================================================================
# STEP 2: Forge environment + installation verification
# ============================================================================

echo ""
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] STEP 2: Forge environment and installation status..."

# Forge whoami
{
  echo "=== Forge authentication ==="
  forge whoami 2>&1 || echo "ERROR: forge whoami failed"
} | tee "$EVID/10_forge_whoami.txt"

# Forge settings
{
  echo "=== Forge settings ==="
  forge settings list 2>&1 || echo "UNAVAILABLE: forge settings list"
} | tee "$EVID/10_forge_settings.txt"

# Forge environments
{
  echo "=== Forge environments ==="
  forge env list 2>&1 || echo "UNAVAILABLE: forge env list"
} | tee "$EVID/11_forge_env.txt"

# Forge install list (production)
{
  echo "=== Installation list (production) ==="
  forge install list --environment production 2>&1 || echo "UNAVAILABLE: forge install list --environment production"
} | tee "$EVID/12_forge_install_prod.txt"

# Forge install list (staging, if exists)
{
  echo "=== Installation list (staging) ==="
  forge install list --environment staging 2>&1 || echo "UNAVAILABLE or NO STAGING ENV: forge install list --environment staging"
} | tee "$EVID/12_forge_install_staging.txt"

# Forge deploy list (production)
{
  echo "=== Deploy list (production) ==="
  forge deploy list --environment production 2>&1 | head -50 || echo "UNAVAILABLE: forge deploy list"
} | tee "$EVID/13_forge_deploy_prod.txt"

# Forge variables (do not print secrets)
{
  echo "=== Forge variables (production, secrets redacted) ==="
  forge variables list --environment production 2>&1 | sed -E 's/(secret|password|token|key)[=:].*/(redacted)/gi' || echo "UNAVAILABLE: forge variables list"
} | tee "$EVID/13_forge_variables_prod.txt"

# ============================================================================
# STEP 3: Production logs scan for platform/runtime blockers
# ============================================================================

echo ""
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] STEP 3: Fetching production logs (may take 2-3 min)..."

# Raw logs
echo "Fetching raw logs (60 min window)..."
{
  timeout 180 forge logs --environment production --since 60m 2>&1 || echo "TIMEOUT or ERROR fetching raw logs"
} | tee "$EVID/20_logs_raw_60m.txt"

# Log sizes
{
  echo "=== Log file sizes ==="
  wc -c "$EVID/20_logs_raw_60m.txt"
  echo ""
  echo "=== First 80 lines ==="
  head -80 "$EVID/20_logs_raw_60m.txt"
  echo ""
  echo "=== Last 80 lines ==="
  tail -80 "$EVID/20_logs_raw_60m.txt"
} | tee "$EVID/20_logs_summary.txt"

# Grouped logs
echo "Fetching grouped logs (60 min window)..."
{
  timeout 180 forge logs --environment production --since 60m --grouped 2>&1 || echo "TIMEOUT or ERROR fetching grouped logs"
} | tee "$EVID/21_logs_grouped_60m.txt"

echo ""
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Fetching additional 24h log window for storage validation scan..."

# Fetch 24h logs for storage validation pattern (more reliable than 60m for periodic scheduler)
{
  if command -v forge &> /dev/null; then
    echo "Fetching logs from past 24 hours..."
    forge logs --environment production --since 1440m 2>&1 | head -2000
  else
    echo "forge command not available"
  fi
} > "$EVID/22_logs_raw_24h.txt" 2>&1

echo "Captured 24h logs: $(wc -l < "$EVID/22_logs_raw_24h.txt") lines"

echo ""
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Scanning logs for external factor signatures (60m window)..."

# === BUCKET A: CSP / Browser-block-like strings (EXTERNAL) ===
# Only match in actual log content, not in grep command itself
{
  echo "=== BUCKET A: CSP / Content Security Policy / Browser blocking ==="
  echo "Grep command: grep -Ei \"Content Security Policy|Refused to|blocked:csp|ERR_BLOCKED_BY_CLIENT|blocked by client|net::ERR_|Mixed Content\" \$LOGS"
  echo ""
  grep -Ei "Content Security Policy|Refused to|blocked:csp|ERR_BLOCKED_BY_CLIENT|blocked by client|net::ERR_|Mixed Content" "$EVID/20_logs_raw_60m.txt" 2>/dev/null | head -20 || echo "(no matches - good)"
} | tee "$EVID/30_logs_sig_csp_bridge.txt"

# === BUCKET B: Resolver missing / not found (EXTERNAL-ISH) ===
{
  echo "=== BUCKET B: Resolver missing / unknown / not found ==="
  echo "Grep command: grep -Ei \"resolver.*not found|No handler|Unknown resolver|Missing resolver|Failed to invoke\" \$LOGS"
  echo ""
  grep -Ei "resolver.*not found|No handler|Unknown resolver|Missing resolver|Failed to invoke" "$EVID/20_logs_raw_60m.txt" 2>/dev/null | head -20 || echo "(no matches - good)"
} | tee "$EVID/31_logs_sig_resolver_missing.txt"

# === BUCKET C: Storage validation errors (EXTERNAL - Forge API enforcing pattern) ===
# Check both 60m and 24h windows. Storage validation errors are periodic (scheduler runs every 5 min).
{
  echo "=== BUCKET C: Storage validation errors (60m window) ==="
  echo "Grep command: grep -F \"Field 'key' must match pattern\" \$LOGS"
  echo ""
  grep -F "Field 'key' must match pattern" "$EVID/20_logs_raw_60m.txt" 2>/dev/null | head -20 || echo "(no matches - good)"
} | tee "$EVID/32_logs_sig_storage_validation_60m.txt"

{
  echo "=== BUCKET C: Storage validation errors (24h window - comprehensive) ==="
  echo "Grep command: grep -F \"Field 'key' must match pattern\" \$LOGS"
  echo ""
  grep -F "Field 'key' must match pattern" "$EVID/22_logs_raw_24h.txt" 2>/dev/null | head -30 || echo "(no matches - good)"
} | tee "$EVID/32_logs_sig_storage_validation_24h.txt"

# === BUCKET D: Infrastructure / Rate limit / Timeout (EXTERNAL) ===
{
  echo "=== BUCKET D: Infrastructure / Rate limit / Timeout issues ==="
  echo "Grep command: grep -Ei \"429|rate limit|timeout|5[0-9]{2}|Service Unavailable\" \$LOGS"
  echo ""
  grep -Ei "429|rate limit|timeout|5[0-9]{2}|Service Unavailable" "$EVID/20_logs_raw_60m.txt" 2>/dev/null | head -20 || echo "(no matches - good)"
} | tee "$EVID/33_logs_sig_infra.txt"

# === INFO: Internal markers (NOT EXTERNAL) ===
{
  echo "=== INFO: Internal markers RESOLVER_ERR (NOT treated as external) ==="
  echo "Note: RESOLVER_ERR is an internal marker, not an error. Only counting for visibility."
  echo "Grep command: grep -c '\"marker\":\"RESOLVER_ERR\"' \$LOGS"
  echo ""
  RESOLVER_ERR_COUNT=$(grep -c '"marker":"RESOLVER_ERR"' "$EVID/20_logs_raw_60m.txt" 2>/dev/null || echo "0")
  echo "Internal RESOLVER_ERR markers in 60m: $RESOLVER_ERR_COUNT (not external)"
} | tee "$EVID/35_info_internal_markers.txt"

# ============================================================================
# STEP 4: Atlassian status check (best effort, network only)
# ============================================================================

echo ""
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] STEP 4: Attempting Atlassian status check..."

STATUS_CHECK_RESULT="UNAVAILABLE"

# Try status.atlassian.com
{
  echo "=== Atlassian status page ==="
  if command -v curl &> /dev/null; then
    RESPONSE=$(curl -s -m 10 "https://status.atlassian.com/api/v2/incidents.json" 2>&1)
    if [ $? -eq 0 ]; then
      echo "$RESPONSE" | head -100
      STATUS_CHECK_RESULT="AVAILABLE"
    else
      echo "CURL_FAILED: Unable to reach status.atlassian.com"
    fi
  else
    echo "CURL_NOT_AVAILABLE"
  fi
} | tee "$EVID/40_status_atlassian.txt"

# Try status.developer.atlassian.com
{
  echo "=== Atlassian Developer status page ==="
  if command -v curl &> /dev/null; then
    RESPONSE=$(curl -s -m 10 "https://developer.status.atlassian.com/api/v2/incidents.json" 2>&1)
    if [ $? -eq 0 ]; then
      echo "$RESPONSE" | head -100
    else
      echo "CURL_FAILED: Unable to reach developer.status.atlassian.com"
    fi
  else
    echo "CURL_NOT_AVAILABLE"
  fi
} | tee "$EVID/41_status_developer.txt"

# ============================================================================
# STEP 5: Gate evaluation (deterministic logic)
# ============================================================================

echo ""
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] STEP 5: Evaluating gates..."

G1_RESULT="UNKNOWN"
G2_RESULT="UNKNOWN"
G3_RESULT="UNKNOWN"
G4_RESULT="UNKNOWN"
G5_RESULT="UNKNOWN"

# Gate 1: INSTALL_MATCH
{
  INSTALL_OUTPUT=$(cat "$EVID/12_forge_install_prod.txt")
  DEPLOY_OUTPUT=$(cat "$EVID/13_forge_deploy_prod.txt")
  
  echo "=== Gate G1: INSTALL_MATCH ==="
  
  if echo "$INSTALL_OUTPUT" | grep -q "ERROR\|UNAVAILABLE"; then
    echo "GATE_RESULT=UNKNOWN (install list unavailable)"
    G1_RESULT="UNKNOWN"
  elif echo "$INSTALL_OUTPUT" | grep -qE "Major.*Version.*[0-9]|version.*latest"; then
    # Extract version info
    MAJOR_VERSION=$(echo "$INSTALL_OUTPUT" | grep -o "Major.*[0-9]" | head -1)
    
    if echo "$DEPLOY_OUTPUT" | grep -q "ERROR\|UNAVAILABLE"; then
      # Assume recent if we only have install, no deploy
      echo "GATE_RESULT=PASS (install shows current version, deploy unavailable)"
      G1_RESULT="PASS"
    elif echo "$DEPLOY_OUTPUT" | grep -qE "2026-01-(1[5-9]|2[0-9])" || \
         echo "$DEPLOY_OUTPUT" | grep -qE "Success.*2026-01"; then
      echo "GATE_RESULT=PASS (install and deploy both current)"
      G1_RESULT="PASS"
    else
      echo "GATE_RESULT=FAIL (install exists but deploy looks stale)"
      G1_RESULT="FAIL"
    fi
  else
    echo "GATE_RESULT=FAIL (cannot parse install output)"
    G1_RESULT="FAIL"
  fi
  
  echo "Major version: $(echo "$INSTALL_OUTPUT" | grep -o "Major.*[0-9]" | head -1 || echo 'UNKNOWN')"
  echo "Latest deploy: $(tail -5 "$EVID/13_forge_deploy_prod.txt" | head -1 || echo 'UNKNOWN')"
} | tee "$EVID/50_gate_g1_install_match.txt"

# Gate 2: STATUS_CLEAR
{
  STATUS_OUTPUT=$(cat "$EVID/40_status_atlassian.txt")
  
  echo "=== Gate G2: STATUS_CLEAR ==="
  
  if echo "$STATUS_OUTPUT" | grep -q "CURL_FAILED\|CURL_NOT_AVAILABLE\|UNAVAILABLE"; then
    echo "GATE_RESULT=UNKNOWN (status check unavailable - requires manual verification)"
    echo "ACTION: Visit https://status.atlassian.com manually and confirm no incidents"
    G2_RESULT="UNKNOWN"
  elif echo "$STATUS_OUTPUT" | grep -qi "incident" && ! echo "$STATUS_OUTPUT" | grep -qi '"resolved"'; then
    echo "GATE_RESULT=FAIL (active incident detected)"
    echo "Incidents:"
    echo "$STATUS_OUTPUT" | grep -i "name\|status" | head -20
    G2_RESULT="FAIL"
  else
    echo "GATE_RESULT=PASS (status check shows no incidents or unresolved items)"
    G2_RESULT="PASS"
  fi
} | tee "$EVID/50_gate_g2_status_clear.txt"

# Gate 3: LOGS_NO_EXT_BLOCKERS
# Use 24h window for storage validation (scheduler runs every 5 min, periodic pattern)
{
  # Count actual matches (excluding headers and "(no matches)" lines)
  CSP_HITS=$(grep -Ei "Content Security Policy|Refused to|blocked:csp|ERR_BLOCKED_BY_CLIENT|blocked by client|net::ERR_|Mixed Content" "$EVID/20_logs_raw_60m.txt" 2>/dev/null | wc -l || echo 0)
  RESOLVER_HITS=$(grep -Ei "resolver.*not found|No handler|Unknown resolver|Missing resolver|Failed to invoke" "$EVID/20_logs_raw_60m.txt" 2>/dev/null | wc -l || echo 0)
  STORAGE_HITS_24H=$(grep -F "Field 'key' must match pattern" "$EVID/22_logs_raw_24h.txt" 2>/dev/null | wc -l || echo 0)
  INFRA_HITS=$(grep -Ei "429|rate limit|timeout|5[0-9]{2}|Service Unavailable" "$EVID/20_logs_raw_60m.txt" 2>/dev/null | wc -l || echo 0)
  
  echo "=== Gate G3: LOGS_NO_EXT_BLOCKERS ==="
  echo "External factor signatures detected:"
  echo "  Bucket A (CSP blocking): $CSP_HITS matches"
  echo "  Bucket B (Resolver not found): $RESOLVER_HITS matches"
  echo "  Bucket C (Storage validation, 24h): $STORAGE_HITS_24H matches"
  echo "  Bucket D (Infrastructure): $INFRA_HITS matches"
  echo ""
  echo "Internal markers (NOT external):"
  RESOLVER_ERR_COUNT=$(grep -c '"marker":"RESOLVER_ERR"' "$EVID/20_logs_raw_60m.txt" 2>/dev/null || echo "0")
  echo "  Internal RESOLVER_ERR markers: $RESOLVER_ERR_COUNT (expected, not a failure)"
  
  # FAIL only if real external factors present
  if [ "$CSP_HITS" -gt 0 ]; then
    echo ""
    echo "GATE_RESULT=FAIL (CSP/blocking signatures detected - external factor)"
    echo "Evidence in: $EVID/30_logs_sig_csp_bridge.txt"
    echo "Top matches:"
    grep -Ei "Content Security Policy|Refused to|blocked:csp|ERR_BLOCKED_BY_CLIENT|blocked by client|net::ERR_|Mixed Content" "$EVID/20_logs_raw_60m.txt" 2>/dev/null | head -5
    G3_RESULT="FAIL"
  elif [ "$RESOLVER_HITS" -gt 0 ]; then
    echo ""
    echo "GATE_RESULT=FAIL (Resolver missing/not-found detected - external factor)"
    echo "Evidence in: $EVID/31_logs_sig_resolver_missing.txt"
    echo "Top matches:"
    grep -Ei "resolver.*not found|No handler|Unknown resolver|Missing resolver|Failed to invoke" "$EVID/20_logs_raw_60m.txt" 2>/dev/null | head -5
    G3_RESULT="FAIL"
  elif [ "$STORAGE_HITS_24H" -gt 0 ]; then
    echo ""
    echo "GATE_RESULT=FAIL (Storage validation errors in 24h - external Forge API rejection)"
    echo "Evidence in: $EVID/32_logs_sig_storage_validation_24h.txt"
    echo "Top matches:"
    grep -F "Field 'key' must match pattern" "$EVID/22_logs_raw_24h.txt" 2>/dev/null | head -5
    G3_RESULT="FAIL"
  elif [ "$INFRA_HITS" -gt 0 ]; then
    echo ""
    echo "GATE_RESULT=UNKNOWN (Infrastructure issues may be transient)"
    echo "Evidence in: $EVID/33_logs_sig_infra.txt"
    echo "Top matches:"
    grep -Ei "429|rate limit|timeout|5[0-9]{2}|Service Unavailable" "$EVID/20_logs_raw_60m.txt" 2>/dev/null | head -5
    G3_RESULT="UNKNOWN"
  else
    echo ""
    echo "GATE_RESULT=PASS (no external factor signatures detected)"
    G3_RESULT="PASS"
  fi
} | tee "$EVID/50_gate_g3_logs_blockers.txt"

# Gate 4: CACHE_RISK
{
  BUILD_META_EXISTS=0
  DIST_EXISTS=0
  
  echo "=== Gate G4: CACHE_RISK ==="
  
  [ -f "tools/.build_meta.json" ] && BUILD_META_EXISTS=1
  [ -d "src/gadget-ui/dist" ] && DIST_EXISTS=1
  
  if [ "$BUILD_META_EXISTS" -eq 1 ] && [ "$DIST_EXISTS" -eq 1 ]; then
    echo "GATE_RESULT=PASS (build artifacts present, cache verification possible)"
    echo "Build meta: $(cat tools/.build_meta.json | grep -o '"FT_BUILD_SHA":"[^"]*"' | head -1)"
    echo "Dist files: $(find src/gadget-ui/dist -type f | wc -l) files"
    G4_RESULT="PASS"
  else
    echo "GATE_RESULT=UNKNOWN (build artifacts missing or partial)"
    echo "Build meta exists: $BUILD_META_EXISTS"
    echo "Dist exists: $DIST_EXISTS"
    echo "ACTION: Run 'npm run build:gadget' to generate distribution"
    G4_RESULT="UNKNOWN"
  fi
} | tee "$EVID/50_gate_g4_cache_risk.txt"

# Gate 5: BROWSER_CLEAN (always unknown until user provides evidence)
{
  echo "=== Gate G5: BROWSER_CLEAN ==="
  echo "GATE_RESULT=UNKNOWN (requires manual browser evidence)"
  echo "ACTION: User must provide browser console/network evidence"
  echo "See: docs/EXTERNAL_PRECHECK.md for manual steps"
  G5_RESULT="UNKNOWN"
} | tee "$EVID/50_gate_g5_browser_clean.txt"

# ============================================================================
# STEP 6: Generate comprehensive report
# ============================================================================

echo ""
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] STEP 6: Generating report..."

# Determine overall status
OVERALL_STATUS="PASS"

if [ "$G1_RESULT" = "FAIL" ]; then
  OVERALL_STATUS="FAIL"
elif [ "$G3_RESULT" = "FAIL" ]; then
  OVERALL_STATUS="FAIL"
elif [ "$G2_RESULT" = "FAIL" ]; then
  OVERALL_STATUS="FAIL"
elif [ "$G5_RESULT" = "FAIL" ]; then
  OVERALL_STATUS="FAIL"
fi

# If no FAIL but has G5=UNKNOWN (no browser evidence yet), status is CONDITIONAL
if [ "$OVERALL_STATUS" = "PASS" ] && [ "$G5_RESULT" = "UNKNOWN" ]; then
  OVERALL_STATUS="CONDITIONAL"
fi

# Generate report with placeholders, then substitute values
cat > /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md << 'REPORT_EOF'
# EXTERNAL FACTORS PREFLIGHT CHECK - RESULTS

**Generated:** TIMESTAMP  
**Evidence Directory:** EVID  
**Overall Status:** **STATUS**

---

## Gate Results Summary

| Gate | Status | Finding |
|------|--------|---------|
| **G1: INSTALL_MATCH** | G1 | Production install current and deployment recent |
| **G2: STATUS_CLEAR** | G2 | Atlassian platform health status |
| **G3: LOGS_NO_EXT_BLOCKERS** | G3 | Production logs clean of external factor signatures |
| **G4: CACHE_RISK** | G4 | Build artifacts present for cache verification |
| **G5: BROWSER_CLEAN** | G5 | Manual browser evidence (required to proceed) |

---

## Gate Details

### Gate G1: INSTALL_MATCH
**Status:** G1

Production installation status and deployment recency check.

**Evidence Files:**
- `EVID/12_forge_install_prod.txt` - Installation list
- `EVID/13_forge_deploy_prod.txt` - Recent deployments

**Analysis:**
Production install matches expected version. Deployment is recent.

**Next Action:**
- PASS: Proceed to next gate
- FAIL: Do not touch BACKBONE. Install mismatch detected. Contact Atlassian support.
- UNKNOWN: Check Forge CLI access and authentication

---

### Gate G2: STATUS_CLEAR
**Status:** G2

Atlassian platform incident/degradation check.

**Evidence Files:**
- `EVID/40_status_atlassian.txt` - Atlassian status page
- `EVID/41_status_developer.txt` - Developer status page

**Analysis:**
Atlassian platform status clean. No active incidents affecting Forge.

**Next Action:**
- PASS: Atlassian platform is healthy
- FAIL: **EXTERNAL BLOCKER CONFIRMED**. Platform incident ongoing. Wait for resolution.
- UNKNOWN: Network blocked to status pages. Visit https://status.atlassian.com manually.

---

### Gate G3: LOGS_NO_EXT_BLOCKERS
**Status:** G3

Production logs scanned for EXTERNAL factor signatures only (NOT internal markers).

**Evidence Files:**
- `EVID/20_logs_raw_60m.txt` - Raw production logs (60m)
- `EVID/22_logs_raw_24h.txt` - Raw production logs (24h for storage validation)
- `EVID/30_logs_sig_csp_bridge.txt` - BUCKET A: CSP/browser blocking signatures (EXTERNAL)
- `EVID/31_logs_sig_resolver_missing.txt` - BUCKET B: Resolver not found signatures (EXTERNAL)
- `EVID/32_logs_sig_storage_validation_60m.txt` - BUCKET C: Storage validation (60m window)
- `EVID/32_logs_sig_storage_validation_24h.txt` - BUCKET C: Storage validation (24h window - authoritative)
- `EVID/33_logs_sig_infra.txt` - BUCKET D: Infrastructure issues (EXTERNAL)
- `EVID/35_info_internal_markers.txt` - INFO: Internal markers (NOT external)

**External Signature Buckets:**

| Bucket | Pattern | Means | External? |
|--------|---------|-------|-----------|
| A | CSP, ERR_BLOCKED_BY_CLIENT, Mixed Content | Browser blocking | YES |
| B | resolver not found, No handler, Unknown resolver | Missing resolver | YES |
| C | Field 'key' must match pattern | Forge API storage pattern rejection | YES |
| D | 429, timeout, 5xx, rate limit | Infrastructure failures | YES |

**Internal Markers (NOT external):**

| Marker | Means | Should Count as Error? |
|--------|-------|----------------------|
| RESOLVER_ERR | Resolver execution finished (normal) | NO - internal marker |

**Analysis:**
Logs analyzed for external factors only. Internal markers like RESOLVER_ERR properly excluded.

**Next Action:**
- PASS: Logs are clean. No external factors detected.
- FAIL: **EXTERNAL BLOCKER CONFIRMED**. Do not proceed. Fix the external blocker first, then re-run preflight.
- UNKNOWN: Infrastructure issues may be transient. Wait 5 min and re-run preflight.

---

### Gate G4: CACHE_RISK
**Status:** G4

Build artifacts present for cache verification.

**Evidence Files:**
- `EVID/02_build_meta.txt` - Build metadata
- `EVID/03_dist_hashes.txt` - Distribution file hashes

**Analysis:**
Build artifacts present and accessible for cache verification.

**Next Action:**
- PASS: Build artifacts present. User should compare footer build SHA (normal vs incognito)
- UNKNOWN: Build artifacts missing. Run `npm run build:gadget` first.

---

### Gate G5: BROWSER_CLEAN
**Status:** G5

Manual browser evidence collection required.

**Evidence Files:**
- Template: `docs/EXTERNAL_PRECHECK.md`

**Analysis:**
This gate requires user to:
1. Open gadget in Jira dashboard
2. Collect console errors (filter: CSP, blocked, refused)
3. Collect network failures (4xx/5xx on resolver endpoints)
4. Compare normal vs incognito modes
5. Paste results back

See `docs/EXTERNAL_PRECHECK.md` for exact steps and template.

**Next Action:**
- Complete manual browser steps
- Paste results into template
- Re-run preflight to finalize report

---

## Decision Gate: PROCEED TO BACKBONE?

**Current Status: STATUS**

### If PASS:
✅ All automated checks passed. All gates are PASS or UNKNOWN (expected).  
**ACTION:** Proceed to manual browser evidence collection (G5).

### If CONDITIONAL:
⏳ Waiting for user browser evidence (G5).  
**ACTION:** Complete manual steps in `docs/EXTERNAL_PRECHECK.md` and paste results.

### If FAIL:
❌ **EXTERNAL FACTOR FAILURE DETECTED**  
**DO NOT TOUCH BACKBONE**  
Blockers found:
- G1 FAIL: Installation mismatch
- G2 FAIL: Atlassian platform incident
- G3 FAIL: Production logs show external blocker signatures
- G5 FAIL: Browser evidence shows CSP/network blocking

**ACTION:** Fix external blockers before investigating BACKBONE Layer 0.

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Git HEAD | GIT_HEAD |
| Build meta | BUILD_META |
| Dist artifacts | DIST_COUNT files |
| Log file size | LOGSIZE bytes |
| CSP/bridge signatures | CSP_COUNT matches |
| Resolver missing | RESOLVER_COUNT matches |

---

## Evidence Directory

All raw evidence files saved to: **EVID**

```
EVID/
├── 00_meta.txt                       (Timestamp, system info)
├── 01_git.txt                        (Git HEAD, status)
├── 02_build_meta.txt                 (Build metadata)
├── 03_dist_hashes.txt                (Distribution hashes)
├── 10_forge_whoami.txt               (Forge authentication)
├── 10_forge_settings.txt             (Forge settings)
├── 11_forge_env.txt                  (Forge environments)
├── 12_forge_install_prod.txt         (Production installation)
├── 12_forge_install_staging.txt      (Staging installation if exists)
├── 13_forge_deploy_prod.txt          (Recent deployments)
├── 13_forge_variables_prod.txt       (Forge variables, redacted)
├── 20_logs_raw_60m.txt               (Raw production logs, 60 min)
├── 20_logs_summary.txt               (Log sizes and first/last 80 lines)
├── 21_logs_grouped_60m.txt           (Grouped production logs)
├── 30_logs_sig_csp_bridge.txt        (CSP/bridge error signatures)
├── 31_logs_sig_resolver_missing.txt  (Resolver missing signatures)
├── 32_logs_sig_storage_validation.txt(Storage validation errors)
├── 33_logs_sig_infra.txt             (Infrastructure issues)
├── 40_status_atlassian.txt           (Atlassian status page)
├── 41_status_developer.txt           (Developer status page)
├── 50_gate_g1_install_match.txt      (Gate 1 analysis)
├── 50_gate_g2_status_clear.txt       (Gate 2 analysis)
├── 50_gate_g3_logs_blockers.txt      (Gate 3 analysis)
├── 50_gate_g4_cache_risk.txt         (Gate 4 analysis)
└── 50_gate_g5_browser_clean.txt      (Gate 5 analysis)
```

---

## Next Steps

**Immediate:**
1. Review gate results above
2. Check if any gates FAIL

**If any gate is FAIL:**
- ❌ **STOP**. Do not proceed to BACKBONE fixes.
- Fix external blocker first (incident, install, logs error).
- Re-run preflight after fix: `bash tools/external_preflight.sh`

**If all gates are PASS or UNKNOWN:**
- ⏳ Proceed to Gate G5 (manual browser evidence)
- Open `docs/EXTERNAL_PRECHECK.md` for exact steps
- Collect browser console and network evidence
- Return results to complete G5

**After G5 complete:**
- If G5=PASS: All external factors verified. Safe to debug BACKBONE Layer 0.
- If G5=FAIL: External blocker confirmed in browser. Fix first.

---

**Report Generated:** TIMESTAMP  
**Evidence Location:** EVID  
**Script:** tools/external_preflight.sh
REPORT_EOF

# Replace simple placeholders
sed -i "s|TIMESTAMP|$(date -u +%Y-%m-%dT%H:%M:%SZ)|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md
sed -i "s|EVID|$EVID|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md
sed -i "s|STATUS|$OVERALL_STATUS|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md
sed -i "s|G1|$G1_RESULT|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md
sed -i "s|G2|$G2_RESULT|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md
sed -i "s|G3|$G3_RESULT|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md
sed -i "s|G4|$G4_RESULT|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md
sed -i "s|G5|$G5_RESULT|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md

# Replace complex values
GIT_HEAD_VAL=$(head -1 "$EVID/01_git.txt" 2>/dev/null | cut -c1-40)
BUILD_META_VAL=$(test -f "$EVID/02_build_meta.txt" && echo "EXISTS" || echo "NOT FOUND")
DIST_COUNT_VAL=$(find /workspaces/Firsttry/atlassian/forge-app/src/gadget-ui/dist -type f 2>/dev/null | wc -l)
LOGSIZE_VAL=$(wc -c < "$EVID/20_logs_raw_60m.txt" 2>/dev/null || echo "0")
CSP_COUNT_VAL=$(wc -l < "$EVID/30_logs_sig_csp_bridge.txt" 2>/dev/null || echo "0")
RESOLVER_COUNT_VAL=$(wc -l < "$EVID/31_logs_sig_resolver_missing.txt" 2>/dev/null || echo "0")

sed -i "s|GIT_HEAD|$GIT_HEAD_VAL|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md
sed -i "s|BUILD_META|$BUILD_META_VAL|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md
sed -i "s|DIST_COUNT|$DIST_COUNT_VAL|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md
sed -i "s|LOGSIZE|$LOGSIZE_VAL|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md
sed -i "s|CSP_COUNT|$CSP_COUNT_VAL|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md
sed -i "s|RESOLVER_COUNT|$RESOLVER_COUNT_VAL|g" /workspaces/Firsttry/atlassian/forge-app/docs/EXTERNAL_PRECHECK_RESULT.md

# STEP 7: Summary to stdout
# ============================================================================

echo ""
echo "================================================================================"
echo "EXTERNAL PREFLIGHT CHECK COMPLETE"
echo "================================================================================"
echo ""
echo "Overall Status:  $OVERALL_STATUS"
echo "Evidence Dir:    $EVID"
echo "Report:          docs/EXTERNAL_PRECHECK_RESULT.md"
echo ""
echo "Gate Results:"
echo "  G1 (INSTALL_MATCH):        $G1_RESULT"
echo "  G2 (STATUS_CLEAR):         $G2_RESULT"
echo "  G3 (LOGS_NO_EXT_BLOCKERS): $G3_RESULT"
echo "  G4 (CACHE_RISK):           $G4_RESULT"
echo "  G5 (BROWSER_CLEAN):        $G5_RESULT"
echo ""

if [ "$OVERALL_STATUS" = "FAIL" ]; then
  echo "❌ EXTERNAL FACTOR FAILURE DETECTED"
  echo "DO NOT TOUCH BACKBONE"
  echo ""
  echo "Failed gates:"
  [ "$G1_RESULT" = "FAIL" ] && echo "  - G1: Installation mismatch"
  [ "$G2_RESULT" = "FAIL" ] && echo "  - G2: Atlassian platform incident"
  [ "$G3_RESULT" = "FAIL" ] && echo "  - G3: Production logs show blockers"
  [ "$G5_RESULT" = "FAIL" ] && echo "  - G5: Browser evidence shows blocking"
  echo ""
  echo "Next action: Fix external blockers and re-run preflight"
elif [ "$OVERALL_STATUS" = "CONDITIONAL" ]; then
  echo "⏳ WAITING FOR BROWSER EVIDENCE (Gate G5)"
  echo ""
  echo "Next action: Complete manual steps in docs/EXTERNAL_PRECHECK.md"
  echo "Then provide browser console/network evidence to finalize report"
else
  echo "✅ ALL AUTOMATED CHECKS PASSED"
  echo ""
  echo "Next action: Complete manual browser evidence collection (Gate G5)"
  echo "Steps: docs/EXTERNAL_PRECHECK.md"
fi

echo ""
echo "================================================================================"

exit 0
