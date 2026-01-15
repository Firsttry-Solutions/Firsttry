#!/bin/bash
set -euo pipefail

# marketplace_push_and_deploy.sh
# Comprehensive deployment script with hard proof capture

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
PROOF_DIR="/tmp/marketplace_deploy_proof_${TIMESTAMP}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Create proof directory
mkdir -p "${PROOF_DIR}"

# Helper to stop on error
fail() {
    echo "❌ STOP: $1" >&2
    exit 1
}

# Helper to capture output to both console and file
capture_output() {
    local file_path="$1"
    local command="$2"
    
    echo "  → Running: $command"
    if eval "$command" 2>&1 | tee "${file_path}"; then
        return 0
    else
        return 1
    fi
}

echo "================================================================================"
echo "MARKETPLACE PUSH AND DEPLOY - COMPREHENSIVE VALIDATION"
echo "================================================================================"
echo ""
echo "Timestamp: ${TIMESTAMP}"
echo "Proof Directory: ${PROOF_DIR}"
echo ""

# ============================================================================
# PHASE 1: Preflight Safety Checks
# ============================================================================
echo "PHASE 1: Preflight Safety Checks"
echo "================================================================================"

cd "${REPO_ROOT}" || fail "Cannot cd to ${REPO_ROOT}"
echo "✓ Repository root: ${REPO_ROOT}"

# Check branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "${CURRENT_BRANCH}" == "main" ]] || fail "Not on main branch; current: ${CURRENT_BRANCH}"
echo "✓ On branch: main"

# Check git status
GIT_STATUS=$(git status --porcelain)
[[ -z "${GIT_STATUS}" ]] || fail "Uncommitted changes detected:\n${GIT_STATUS}"
echo "✓ Git status clean"

# Environment versions
echo ""
echo "Environment Versions:"
{
    echo "=== ENVIRONMENT INFO ==="
    echo "Timestamp: ${TIMESTAMP}"
    echo ""
    echo "=== Node Version ==="
    node --version
    echo ""
    echo "=== NPM Version ==="
    npm --version
    echo ""
    echo "=== Python Version ==="
    python3 --version
    echo ""
    echo "=== Forge CLI Version ==="
    cd "${REPO_ROOT}/atlassian/forge-app"
    forge --version || echo "Forge not yet installed globally"
    cd "${REPO_ROOT}"
} | tee "${PROOF_DIR}/00_env.txt"

echo "✓ Environment captured"
echo ""

# ============================================================================
# PHASE 2: Git Status and Sync
# ============================================================================
echo "PHASE 2: Git Status and Sync"
echo "================================================================================"

echo "Git Status:" | tee "${PROOF_DIR}/01_git_status.txt"
git status --porcelain | tee -a "${PROOF_DIR}/01_git_status.txt"

echo ""
echo "Current HEAD:" | tee "${PROOF_DIR}/02_git_head.txt"
LOCAL_HEAD=$(git rev-parse HEAD)
echo "${LOCAL_HEAD}" | tee -a "${PROOF_DIR}/02_git_head.txt"

echo ""
echo "Fetching origin..." 
git fetch origin --prune 2>&1 | tee -a "${PROOF_DIR}/02_git_head.txt"

echo ""
echo "Git Divergence:" | tee "${PROOF_DIR}/03_git_divergence.txt"
AHEAD=$(git rev-list --count origin/main..main)
BEHIND=$(git rev-list --count main..origin/main)
ORIGIN_HEAD=$(git rev-parse origin/main)

echo "Local HEAD: ${LOCAL_HEAD}" | tee -a "${PROOF_DIR}/03_git_divergence.txt"
echo "Origin/main HEAD: ${ORIGIN_HEAD}" | tee -a "${PROOF_DIR}/03_git_divergence.txt"
echo "Commits ahead: ${AHEAD}" | tee -a "${PROOF_DIR}/03_git_divergence.txt"
echo "Commits behind: ${BEHIND}" | tee -a "${PROOF_DIR}/03_git_divergence.txt"

[[ ${BEHIND} -eq 0 ]] || fail "Branch is behind origin/main by ${BEHIND} commits. Run 'git rebase origin/main' manually; do not force push."

echo "✓ Git status clean, no divergence"
echo ""

# ============================================================================
# PHASE 3: Validator Checks
# ============================================================================
echo "PHASE 3: Validator Checks"
echo "================================================================================"

echo "Running validate_no_roadmap.sh..."
VALIDATE_NO_ROADMAP_EXIT=0
bash tools/validate_no_roadmap.sh 2>&1 | tee "${PROOF_DIR}/10_validate_no_roadmap.txt" || VALIDATE_NO_ROADMAP_EXIT=$?

echo ""
echo "Running validate_docs.sh..."
VALIDATE_DOCS_EXIT=0
bash tools/validate_docs.sh 2>&1 | tee "${PROOF_DIR}/11_validate_docs.txt" || VALIDATE_DOCS_EXIT=$?

echo ""
echo "Running validate_docs_strict.sh..."
VALIDATE_DOCS_STRICT_EXIT=0
bash tools/validate_docs_strict.sh 2>&1 | tee "${PROOF_DIR}/12_validate_docs_strict.txt" || VALIDATE_DOCS_STRICT_EXIT=$?

echo ""
echo "Validator Exit Codes:"
echo "  validate_no_roadmap.sh: ${VALIDATE_NO_ROADMAP_EXIT}"
echo "  validate_docs.sh: ${VALIDATE_DOCS_EXIT}"
echo "  validate_docs_strict.sh: ${VALIDATE_DOCS_STRICT_EXIT}"

[[ ${VALIDATE_NO_ROADMAP_EXIT} -eq 0 ]] || fail "validate_no_roadmap.sh exit: ${VALIDATE_NO_ROADMAP_EXIT}"
[[ ${VALIDATE_DOCS_EXIT} -eq 0 ]] || fail "validate_docs.sh exit: ${VALIDATE_DOCS_EXIT}"
[[ ${VALIDATE_DOCS_STRICT_EXIT} -eq 0 ]] || fail "validate_docs_strict.sh exit: ${VALIDATE_DOCS_STRICT_EXIT}"

echo "✓ All validators passed"
echo ""

# ============================================================================
# PHASE 4: Manifest Scopes Verification
# ============================================================================
echo "PHASE 4: Manifest Scopes Verification"
echo "================================================================================"

python3 << 'PYTHON_MANIFEST_CHECK'
import yaml
import sys

manifest_path = "/workspaces/Firsttry/atlassian/forge-app/manifest.yml"

try:
    with open(manifest_path, 'r') as f:
        manifest = yaml.safe_load(f)
    
    scopes = manifest.get('permissions', {}).get('scopes', [])
    print(f"Manifest scopes: {scopes}")
    
    # Check exact match (order-insensitive)
    expected = {'storage:app', 'read:jira-work'}
    actual = set(scopes)
    
    if actual == expected:
        print("✓ Manifest scopes match exactly: storage:app, read:jira-work")
        sys.exit(0)
    else:
        print(f"❌ Scope mismatch!")
        print(f"   Expected: {expected}")
        print(f"   Actual: {actual}")
        sys.exit(1)
except Exception as e:
    print(f"❌ Error parsing manifest: {e}")
    sys.exit(1)
PYTHON_MANIFEST_CHECK
} | tee "${PROOF_DIR}/20_manifest_scopes.txt"

[[ $? -eq 0 ]] || fail "Manifest scopes verification failed"
echo ""

# ============================================================================
# PHASE 5: SCOPES.md Alignment Check
# ============================================================================
echo "PHASE 5: SCOPES.md Alignment Check"
echo "================================================================================"

echo "Checking SCOPES.md for scope declarations..." | tee "${PROOF_DIR}/21_scopes_md_grep.txt"

# Check that forbidden scopes appear only in "NOT DECLARED" sections
echo "" | tee -a "${PROOF_DIR}/21_scopes_md_grep.txt"
echo "Forbidden scopes check (should only appear with 'NOT DECLARED'):" | tee -a "${PROOF_DIR}/21_scopes_md_grep.txt"

FORBIDDEN=("write:jira-work" "manage:jira-configuration" "storage:cloud" "read:jira-user" "external:fetch")
SCOPE_ERRORS=0

for scope in "${FORBIDDEN[@]}"; do
    echo "" | tee -a "${PROOF_DIR}/21_scopes_md_grep.txt"
    echo "Checking: $scope" | tee -a "${PROOF_DIR}/21_scopes_md_grep.txt"
    
    MATCHES=$(grep -n "$scope" docs/SCOPES.md || true)
    if [[ -z "$MATCHES" ]]; then
        echo "  ✓ Not found in SCOPES.md" | tee -a "${PROOF_DIR}/21_scopes_md_grep.txt"
    else
        echo "  Found on lines:" | tee -a "${PROOF_DIR}/21_scopes_md_grep.txt"
        echo "$MATCHES" | tee -a "${PROOF_DIR}/21_scopes_md_grep.txt"
        
        # Verify all matches have "NOT DECLARED"
        while IFS= read -r line; do
            if ! echo "$line" | grep -q "NOT DECLARED"; then
                echo "  ⚠ WARNING: Found without 'NOT DECLARED'" | tee -a "${PROOF_DIR}/21_scopes_md_grep.txt"
                SCOPE_ERRORS=$((SCOPE_ERRORS + 1))
            fi
        done <<< "$MATCHES"
    fi
done

[[ ${SCOPE_ERRORS} -eq 0 ]] || fail "Found forbidden scopes not marked as NOT DECLARED"
echo ""
echo "✓ SCOPES.md alignment verified"
echo ""

# ============================================================================
# PHASE 6: Docs Gate Workflow Check
# ============================================================================
echo "PHASE 6: Docs Gate Workflow Check"
echo "================================================================================"

echo "Docs Gate Workflow excerpt (.github/workflows/docs-gate.yml, first 220 lines):" | tee "${PROOF_DIR}/22_docs_gate_workflow_excerpt.txt"
head -220 .github/workflows/docs-gate.yml | tee -a "${PROOF_DIR}/22_docs_gate_workflow_excerpt.txt"

# Verify validate_docs.sh is a required job
if grep -q "tools/validate_docs.sh" .github/workflows/docs-gate.yml; then
    echo "" | tee -a "${PROOF_DIR}/22_docs_gate_workflow_excerpt.txt"
    echo "✓ validate_docs.sh is referenced in docs-gate workflow" | tee -a "${PROOF_DIR}/22_docs_gate_workflow_excerpt.txt"
else
    echo "" | tee -a "${PROOF_DIR}/22_docs_gate_workflow_excerpt.txt"
    echo "⚠ WARNING: validate_docs.sh not found in docs-gate workflow" | tee -a "${PROOF_DIR}/22_docs_gate_workflow_excerpt.txt"
fi

echo ""
echo "✓ Docs gate workflow captured"
echo ""

# ============================================================================
# PHASE 7: Git Push
# ============================================================================
echo "PHASE 7: Git Push"
echo "================================================================================"

echo "Pushing main → origin/main..." | tee "${PROOF_DIR}/04_git_push.txt"

if git push origin main 2>&1 | tee -a "${PROOF_DIR}/04_git_push.txt"; then
    echo "" | tee -a "${PROOF_DIR}/04_git_push.txt"
    PUSHED_HEAD=$(git rev-parse HEAD)
    REMOTE_HEAD=$(git rev-parse origin/main)
    
    echo "Local HEAD after push: ${PUSHED_HEAD}" | tee -a "${PROOF_DIR}/04_git_push.txt"
    echo "origin/main HEAD: ${REMOTE_HEAD}" | tee -a "${PROOF_DIR}/04_git_push.txt"
    
    if [[ "${PUSHED_HEAD}" == "${REMOTE_HEAD}" ]]; then
        echo "✓ Local HEAD matches origin/main" | tee -a "${PROOF_DIR}/04_git_push.txt"
    else
        fail "Post-push SHA mismatch: local=${PUSHED_HEAD} remote=${REMOTE_HEAD}"
    fi
else
    fail "git push failed"
fi

echo "✓ Push successful"
echo ""

# ============================================================================
# PHASE 8: Forge App Deployment
# ============================================================================
echo "PHASE 8: Forge App Deployment"
echo "================================================================================"

cd "${REPO_ROOT}/atlassian/forge-app"
echo "Working directory: $(pwd)"

# Forge version
echo "Forge CLI version:" | tee "${PROOF_DIR}/30_forge_lint.txt"
forge --version | tee -a "${PROOF_DIR}/30_forge_lint.txt"

# Lint
echo "" | tee -a "${PROOF_DIR}/30_forge_lint.txt"
echo "Running forge lint..." | tee -a "${PROOF_DIR}/30_forge_lint.txt"
if forge lint 2>&1 | tee -a "${PROOF_DIR}/30_forge_lint.txt"; then
    echo "✓ Forge lint passed" | tee -a "${PROOF_DIR}/30_forge_lint.txt"
else
    LINT_EXIT=$?
    fail "forge lint failed with exit code ${LINT_EXIT}"
fi

echo ""
echo "✓ Forge lint successful"
echo ""

# Deploy
echo "PHASE 8A: Forge Deploy"
echo "================================================================================"
echo "Deploying to production..." | tee "${PROOF_DIR}/31_forge_deploy_prod.txt"

if forge deploy --environment production 2>&1 | tee -a "${PROOF_DIR}/31_forge_deploy_prod.txt"; then
    echo "" | tee -a "${PROOF_DIR}/31_forge_deploy_prod.txt"
    echo "✓ Deploy successful" | tee -a "${PROOF_DIR}/31_forge_deploy_prod.txt"
else
    DEPLOY_EXIT=$?
    fail "forge deploy failed with exit code ${DEPLOY_EXIT}"
fi

echo "✓ Forge deploy successful"
echo ""

# Install / Upgrade
echo "PHASE 8B: Forge Install Upgrade"
echo "================================================================================"
echo "Upgrading Forge installation in production..." | tee "${PROOF_DIR}/32_forge_install_upgrade_prod.txt"

if forge install --upgrade --environment production 2>&1 | tee -a "${PROOF_DIR}/32_forge_install_upgrade_prod.txt"; then
    echo "" | tee -a "${PROOF_DIR}/32_forge_install_upgrade_prod.txt"
    echo "✓ Install upgrade successful" | tee -a "${PROOF_DIR}/32_forge_install_upgrade_prod.txt"
else
    INSTALL_EXIT=$?
    fail "forge install --upgrade failed with exit code ${INSTALL_EXIT}"
fi

echo "✓ Forge install upgrade successful"
echo ""

# ============================================================================
# PHASE 9: Final Summary
# ============================================================================
echo "PHASE 9: Final Summary"
echo "================================================================================"

cd "${REPO_ROOT}"

FINAL_HEAD=$(git rev-parse HEAD)
FINAL_ORIGIN=$(git rev-parse origin/main)

{
    echo "================================================================================"
    echo "MARKETPLACE DEPLOYMENT - FINAL SUMMARY"
    echo "================================================================================"
    echo ""
    echo "Timestamp: ${TIMESTAMP}"
    echo ""
    echo "=== REPOSITORY STATE ==="
    echo "Local HEAD SHA: ${FINAL_HEAD}"
    echo "origin/main SHA: ${FINAL_ORIGIN}"
    echo "SHA match: $([ "${FINAL_HEAD}" == "${FINAL_ORIGIN}" ] && echo "✓ YES" || echo "✗ NO")"
    echo ""
    echo "=== VALIDATOR EXIT CODES ==="
    echo "validate_no_roadmap.sh: ${VALIDATE_NO_ROADMAP_EXIT} ✓"
    echo "validate_docs.sh: ${VALIDATE_DOCS_EXIT} ✓"
    echo "validate_docs_strict.sh: ${VALIDATE_DOCS_STRICT_EXIT} ✓"
    echo ""
    echo "=== MANIFEST SCOPES ==="
    echo "Scopes verified: storage:app, read:jira-work ✓"
    echo ""
    echo "=== PROOF ARTIFACTS ==="
    echo "Proof directory: ${PROOF_DIR}"
    echo "Available files:"
    ls -1 "${PROOF_DIR}/" | sed 's/^/  - /'
    echo ""
    echo "=== DEPLOY/INSTALL LOGS ==="
    echo "Lint log: ${PROOF_DIR}/30_forge_lint.txt"
    echo "Deploy log: ${PROOF_DIR}/31_forge_deploy_prod.txt"
    echo "Install upgrade log: ${PROOF_DIR}/32_forge_install_upgrade_prod.txt"
    echo ""
    echo "================================================================================"
    echo "✅ ALL GREEN: READY FOR MARKETPLACE SUBMISSION"
    echo "================================================================================"
} | tee "${PROOF_DIR}/99_FINAL_SUMMARY.txt"

echo ""
echo "Proof pack created at: ${PROOF_DIR}"
echo ""
