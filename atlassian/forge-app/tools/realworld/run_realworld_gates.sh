#!/usr/bin/env bash
# tools/realworld/run_realworld_gates.sh
# Real-World Capability Gates (Scale + Concurrency + License)
# Deterministic, fail-closed, no network dependencies

set -euo pipefail

BOLD='\033[1m'
RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[0;33m'
RST='\033[0m'

# ============================================================================
# PREFLIGHT: Working Directory
# ============================================================================

if [[ ! -f "package.json" ]]; then
  echo -e "${RED}ERROR: package.json not found${RST}"
  echo "Must run from atlassian/forge-app directory"
  exit 1
fi

echo -e "${BOLD}[REALWORLD GATES] Real-World Capability Tests${RST}"
echo ""

# ============================================================================
# EVIDENCE DIRECTORY
# ============================================================================

EROOT="/tmp/ft_realworld_$(date -u +%Y%m%dT%H%M%SZ)_$$"
mkdir -p "${EROOT}"/{00_env,01_scale,02_concurrency,03_license,artifacts}

echo "Evidence: ${EROOT}"
echo ""

# Create stable symlink (atomic)
ln -sfn "${EROOT}" /tmp/ft_realworld_latest

# Export for child processes
export EROOT

# ============================================================================
# PHASE 00: Environment Capture
# ============================================================================

echo -e "${BOLD}[00] Capturing environment...${RST}"

# Environment variables (sorted, no secrets)
env | grep -E '^(FT_|NODE_|NPM_|PATH=|HOME=|USER=|PWD=)' | sort > "${EROOT}/00_env/env.txt" || true

# Git state
git rev-parse HEAD > "${EROOT}/00_env/git.txt" 2>&1 || echo "unknown" > "${EROOT}/00_env/git.txt"
git status --porcelain >> "${EROOT}/00_env/git.txt" 2>&1 || true

# Node version
node -v > "${EROOT}/00_env/node.txt" 2>&1 || echo "unknown" > "${EROOT}/00_env/node.txt"
npm -v >> "${EROOT}/00_env/node.txt" 2>&1 || true

# Command invocation
echo "$0 $*" > "${EROOT}/00_env/command.txt"

GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
echo "  Git SHA: ${GIT_SHA}"
echo ""

# ============================================================================
# PHASE 01: Scale Test (5000 objects)
# ============================================================================

echo -e "${BOLD}[01] Running scale test (5000 objects)...${RST}"

SCALE_STATUS="FAIL"
SCALE_DURATION=0
SCALE_OUTPUT_BYTES=0
SCALE_PEAK_RSS=0
SCALE_DETERMINISM="FAIL"

if npx ts-node tools/realworld/scale_5000_snapshot.ts 2>&1 | tee "${EROOT}/01_scale/run.log"; then
  SCALE_STATUS="PASS"
  echo -e "${GRN}  Scale test: PASS${RST}"
else
  echo -e "${RED}  Scale test: FAIL${RST}"
fi

# Extract metrics from JSON
if [[ -f "${EROOT}/01_scale/metrics.json" ]]; then
  SCALE_DURATION=$(jq -r '.duration_ms' "${EROOT}/01_scale/metrics.json" 2>/dev/null || echo 0)
  SCALE_OUTPUT_BYTES=$(jq -r '.output_bytes' "${EROOT}/01_scale/metrics.json" 2>/dev/null || echo 0)
  SCALE_PEAK_RSS=$(jq -r '.rss_bytes_after' "${EROOT}/01_scale/metrics.json" 2>/dev/null || echo 0)
  SCALE_DETERMINISM=$(jq -r '.determinism' "${EROOT}/01_scale/metrics.json" 2>/dev/null || echo "FAIL")
fi

echo "  Duration: ${SCALE_DURATION}ms"
echo "  Output: ${SCALE_OUTPUT_BYTES} bytes"
echo "  Determinism: ${SCALE_DETERMINISM}"
echo ""

# ============================================================================
# PHASE 02: Concurrency Stress Test
# ============================================================================

echo -e "${BOLD}[02] Running concurrency stress test...${RST}"

CONCURRENCY_STATUS="FAIL"
CONCURRENCY_100_MS=0
CONCURRENCY_500_MS=0
CONCURRENCY_1000_MS=0
CONCURRENCY_100_FAIL=0
CONCURRENCY_500_FAIL=0
CONCURRENCY_1000_FAIL=0

if npx ts-node tools/realworld/concurrency_stress.ts 2>&1 | tee "${EROOT}/02_concurrency/run.log"; then
  CONCURRENCY_STATUS="PASS"
  echo -e "${GRN}  Concurrency test: PASS${RST}"
else
  echo -e "${RED}  Concurrency test: FAIL${RST}"
fi

# Extract metrics
if [[ -f "${EROOT}/02_concurrency/results.json" ]]; then
  CONCURRENCY_100_MS=$(jq -r '.results[0].duration_ms' "${EROOT}/02_concurrency/results.json" 2>/dev/null || echo 0)
  CONCURRENCY_500_MS=$(jq -r '.results[1].duration_ms' "${EROOT}/02_concurrency/results.json" 2>/dev/null || echo 0)
  CONCURRENCY_1000_MS=$(jq -r '.results[2].duration_ms' "${EROOT}/02_concurrency/results.json" 2>/dev/null || echo 0)
  CONCURRENCY_100_FAIL=$(jq -r '.results[0].failure_count' "${EROOT}/02_concurrency/results.json" 2>/dev/null || echo 0)
  CONCURRENCY_500_FAIL=$(jq -r '.results[1].failure_count' "${EROOT}/02_concurrency/results.json" 2>/dev/null || echo 0)
  CONCURRENCY_1000_FAIL=$(jq -r '.results[2].failure_count' "${EROOT}/02_concurrency/results.json" 2>/dev/null || echo 0)
fi

echo "  Level 100: ${CONCURRENCY_100_MS}ms (${CONCURRENCY_100_FAIL} failures)"
echo "  Level 500: ${CONCURRENCY_500_MS}ms (${CONCURRENCY_500_FAIL} failures)"
echo "  Level 1000: ${CONCURRENCY_1000_MS}ms (${CONCURRENCY_1000_FAIL} failures)"
echo ""

# ============================================================================
# PHASE 03: License State Tests
# ============================================================================

echo -e "${BOLD}[03] Running license/entitlement tests...${RST}"

LICENSE_STATUS="FAIL"
LICENSE_PASSED=0
LICENSE_TOTAL=0

if npx ts-node tools/realworld/license_state_tests.ts 2>&1 | tee "${EROOT}/03_license/run.log"; then
  LICENSE_STATUS="PASS"
  echo -e "${GRN}  License tests: PASS${RST}"
else
  echo -e "${RED}  License tests: FAIL${RST}"
fi

# Extract results
if [[ -f "${EROOT}/03_license/results.json" ]]; then
  LICENSE_PASSED=$(jq -r '.summary.passed' "${EROOT}/03_license/results.json" 2>/dev/null || echo 0)
  LICENSE_TOTAL=$(jq -r '.summary.total' "${EROOT}/03_license/results.json" 2>/dev/null || echo 0)
fi

echo "  Passed: ${LICENSE_PASSED}/${LICENSE_TOTAL}"
echo ""

# ============================================================================
# FINAL SUMMARY
# ============================================================================

echo -e "${BOLD}[SUMMARY] Assembling final summary...${RST}"

FAIL_REASONS=()
FINAL_STATUS="PASS"

if [[ "${SCALE_STATUS}" != "PASS" ]]; then
  FINAL_STATUS"FAIL"
  FAIL_REASONS+=("Scale test failed")
fi

if [[ "${SCALE_DETERMINISM}" != "PASS" ]]; then
  FINAL_STATUS="FAIL"
  FAIL_REASONS+=("Scale test non-deterministic")
fi

if [[ "${CONCURRENCY_STATUS}" != "PASS" ]]; then
  FINAL_STATUS="FAIL"
  FAIL_REASONS+=("Concurrency test failed")
fi

if [[ "${LICENSE_STATUS}" != "PASS" ]]; then
  FINAL_STATUS="FAIL"
  FAIL_REASONS+=("License tests failed")
fi

# Build summary JSON
TIMESTAMP_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Build fail_reasons array for JSON
FAIL_REASONS_JSON="[]"
if [[ ${#FAIL_REASONS[@]} -gt 0 ]]; then
  FAIL_REASONS_JSON=$(printf '%s\n' "${FAIL_REASONS[@]}" | jq -R . | jq -s .)
fi

# Create REALWORLD_SUMMARY.json
cat > "${EROOT}/artifacts/REALWORLD_SUMMARY.json" << EOF
{
  "version": "1.0",
  "timestamp_utc": "${TIMESTAMP_UTC}",
  "git_sha": "${GIT_SHA}",
  "scale": {
    "status": "${SCALE_STATUS}",
    "n": 5000,
    "duration_ms": ${SCALE_DURATION},
    "peak_rss_bytes": ${SCALE_PEAK_RSS},
    "output_bytes": ${SCALE_OUTPUT_BYTES},
    "determinism": "${SCALE_DETERMINISM}"
  },
  "concurrency": {
    "status": "${CONCURRENCY_STATUS}",
    "levels": [100, 500, 1000],
    "failures": {
      "100": ${CONCURRENCY_100_FAIL},
      "500": ${CONCURRENCY_500_FAIL},
      "1000": ${CONCURRENCY_1000_FAIL}
    },
    "duration_ms": {
      "100": ${CONCURRENCY_100_MS},
      "500": ${CONCURRENCY_500_MS},
      "1000": ${CONCURRENCY_1000_MS}
    },
    "peak_rss_bytes": ${SCALE_PEAK_RSS}
  },
  "license": {
    "status": "${LICENSE_STATUS}",
    "cases": ${LICENSE_PASSED},
    "total": ${LICENSE_TOTAL},
    "notes": ["Uses src/entitlements/ system", "No network calls", "Verifies paid feature gating"]
  },
  "final": {
    "status": "${FINAL_STATUS}",
    "exit_code": $([[ "${FINAL_STATUS}" == "PASS" ]] && echo 0 || echo 1),
    "fail_reasons": ${FAIL_REASONS_JSON}
  }
}
EOF

echo ""
echo "============================================================"
echo "  REALWORLD GATES — FINAL RESULT"
echo "============================================================"
echo ""
echo "Status:     ${FINAL_STATUS}"
echo "Evidence:   ${EROOT}"
echo "Symlink:    /tmp/ft_realworld_latest"
echo ""

if [[ "${FINAL_STATUS}" == "FAIL" ]]; then
  echo -e "${RED}EXIT 1 — FAIL${RST}"
  echo ""
  echo "Fail reasons:"
  for reason in "${FAIL_REASONS[@]}"; do
    echo "  - ${reason}"
  done
  echo ""
  exit 1
else
  echo -e "${GRN}EXIT 0 — PASS${RST}"
  echo ""
  exit 0
fi
