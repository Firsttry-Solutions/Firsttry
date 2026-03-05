#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
STRICT_RUNNER="${REPO_ROOT}/tools/reviewer_e2e/run_reviewer_e2e_strict.sh"
PROOF_BUILDER="${SCRIPT_DIR}/proof_pack/build_reviewer_proof_pack.sh"

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: ${cmd}" >&2
    exit 2
  fi
}

redact_url() {
  local raw="$1"
  printf "%s" "${raw}" | sed -E 's#^(https?://[^/]+).*$#\1#'
}

find_latest_e2e_dir() {
  ls -1dt /tmp/ft_reviewer_e2e_* 2>/dev/null | head -n1 || true
}

copy_if_exists() {
  local src="$1"
  local dest="$2"
  if [[ -e "${src}" ]]; then
    mkdir -p "${dest}"
    cp -a "${src}" "${dest}/"
    return 0
  fi
  return 1
}

echo "[1/8] Preflight binary checks"
require_cmd bash
require_cmd node
require_cmd npm
require_cmd forge
require_cmd sha256sum

if [[ -z "${JIRA_BASE_URL:-}" ]]; then
  echo "ERROR: Required environment variable missing: JIRA_BASE_URL" >&2
  exit 2
fi
if [[ -z "${JIRA_DASHBOARD_URL:-}" ]]; then
  echo "ERROR: Required environment variable missing: JIRA_DASHBOARD_URL" >&2
  exit 2
fi

if [[ ! -x "${STRICT_RUNNER}" ]]; then
  echo "ERROR: Required strict runner missing or not executable: ${STRICT_RUNNER}" >&2
  exit 2
fi
if [[ ! -x "${PROOF_BUILDER}" ]]; then
  echo "ERROR: Required proof builder missing or not executable: ${PROOF_BUILDER}" >&2
  exit 2
fi

echo "[2/8] Verifying Forge authentication"
if ! forge whoami >/dev/null 2>&1; then
  echo "ERROR: forge whoami failed. Authenticate Forge CLI before running demo." >&2
  exit 2
fi

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
EVID="/tmp/ft_reviewer_demo_${RUN_ID}"
mkdir -p "${EVID}"

BEFORE_LATEST="$(find_latest_e2e_dir)"

echo "[3/8] Running strict reviewer E2E"
STRICT_EXIT=0
"${STRICT_RUNNER}" || STRICT_EXIT=$?

AFTER_LATEST="$(find_latest_e2e_dir)"
SOURCE_E2E=""
if [[ -n "${AFTER_LATEST}" && "${AFTER_LATEST}" != "${BEFORE_LATEST}" ]]; then
  SOURCE_E2E="${AFTER_LATEST}"
elif [[ -n "${AFTER_LATEST}" ]]; then
  SOURCE_E2E="${AFTER_LATEST}"
fi

if [[ -z "${SOURCE_E2E}" || ! -d "${SOURCE_E2E}" ]]; then
  echo "ERROR: Could not locate strict runner evidence directory (/tmp/ft_reviewer_e2e_*)" >&2
  exit 1
fi

echo "[4/8] Collecting strict runner artifacts"
COPIED_ANY=0
if copy_if_exists "${SOURCE_E2E}/01_deploy" "${EVID}"; then COPIED_ANY=1; fi
if copy_if_exists "${SOURCE_E2E}/02_tunnel" "${EVID}"; then COPIED_ANY=1; fi
if copy_if_exists "${SOURCE_E2E}/03_forge_logs" "${EVID}"; then COPIED_ANY=1; fi
if copy_if_exists "${SOURCE_E2E}/04_playwright" "${EVID}"; then COPIED_ANY=1; fi
if copy_if_exists "${SOURCE_E2E}/docs_overclaim" "${EVID}"; then COPIED_ANY=1; fi

for f in summary.json allowlists.json gadget_verdict.json reviewer_env.json FINAL_VERDICT.txt PACKHASH.sha256; do
  if [[ -f "${SOURCE_E2E}/${f}" ]]; then
    cp -a "${SOURCE_E2E}/${f}" "${EVID}/"
    COPIED_ANY=1
  fi
done

if [[ "${COPIED_ANY}" -ne 1 ]]; then
  echo "ERROR: No strict-runner artifacts were copied into ${EVID}" >&2
  exit 1
fi

echo "[5/8] Writing deterministic metadata"
GIT_COMMIT="$(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || echo unknown)"
UTC_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
FORGE_VERSION="$(forge --version 2>&1 | head -n1 | tr -d '\r')"
NODE_VERSION="$(node --version 2>&1 | head -n1 | tr -d '\r')"

cat > "${EVID}/METADATA.json" <<EOF
{
  "git_commit": "${GIT_COMMIT}",
  "timestamp_utc": "${UTC_TS}",
  "jira_base_url": "$(redact_url "${JIRA_BASE_URL}")",
  "jira_dashboard_url": "$(redact_url "${JIRA_DASHBOARD_URL}")",
  "forge_version": "${FORGE_VERSION}",
  "node_version": "${NODE_VERSION}",
  "strict_runner_exit_code": ${STRICT_EXIT}
}
EOF

echo "[6/8] Running no-external-networking proof"
NO_EGRESS_REPORT="${EVID}/no_egress_report.txt"
if [[ -x "${REPO_ROOT}/tools/validate_no_egress.sh" ]]; then
  (
    cd "${REPO_ROOT}"
    bash tools/validate_no_egress.sh
  ) > "${NO_EGRESS_REPORT}" 2>&1 || true
elif [[ -f "${REPO_ROOT}/tools/scan_network_surface.py" ]]; then
  SCAN_EXIT=0
  (
    cd "${REPO_ROOT}"
    python3 tools/scan_network_surface.py
  ) > "${NO_EGRESS_REPORT}" 2>&1 || SCAN_EXIT=$?
  if [[ "${SCAN_EXIT}" -eq 0 ]]; then
    echo "PASS NO_EGRESS" >> "${NO_EGRESS_REPORT}"
  else
    echo "FAIL NO_EGRESS" >> "${NO_EGRESS_REPORT}"
  fi
else
  echo "ERROR: Missing network proof tool. Expected tools/validate_no_egress.sh or tools/scan_network_surface.py" >&2
  exit 2
fi

NO_EGRESS_PASS=0
if grep -q "^PASS NO_EGRESS$" "${NO_EGRESS_REPORT}"; then
  NO_EGRESS_PASS=1
fi

FINAL_STATUS="PASS"
if [[ "${STRICT_EXIT}" -ne 0 || "${NO_EGRESS_PASS}" -ne 1 ]]; then
  FINAL_STATUS="FAIL"
fi

echo "[7/8] Writing final reviewer verdict"
cat > "${EVID}/FINAL_VERDICT.txt" <<EOF
${FINAL_STATUS}
- strict_runner_exit_code: ${STRICT_EXIT}
- strict_source_evidence: ${SOURCE_E2E}
- metadata: ${EVID}/METADATA.json
- no_egress_report: ${EVID}/no_egress_report.txt
- manifest: ${EVID}/manifest.sha256
- proof_pack_hash: ${EVID}/PROOF_PACK_SHA256.txt
EOF

echo "[8/8] Building proof pack files in evidence directory"
"${PROOF_BUILDER}" "${EVID}" >/dev/null

echo "EVIDENCE_DIR=${EVID}"
echo "Offline verify command: bash tools/reviewer_demo/verify_demo_results.sh ${EVID}"

if [[ "${FINAL_STATUS}" != "PASS" ]]; then
  exit 1
fi
