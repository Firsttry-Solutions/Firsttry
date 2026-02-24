#!/usr/bin/env bash

set -euo pipefail

# ============================================================================
# Enterprise Repo Gates — Fail-Closed
# ============================================================================
# Purpose:
#   Enforce security and setup gates for CI to prevent:
#   - Accidental commits of auth/session artifacts
#   - Missing .gitignore protections
#   - ESM safety in critical scripts
#   - Missing documentation/runbooks
#   - Unsafe shell configurations
#
# Exit: 0 if all gates pass, 1 on any violation
# Output: PASS/FAIL summary

cd /workspaces/Firsttry

PASS_COUNT=0
FAIL_COUNT=0

# Helper functions
gate_pass() {
    echo "  ✓ $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

gate_fail() {
    echo "  ✗ $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

echo "=== Enterprise Repo Gates ==="
echo ""

# ============================================================================
# Gate A: Never-commit auth/session artifacts
# ============================================================================
echo "Gate A: Checking for auth/session artifacts in tracked files..."

FOUND_VIOLATIONS=0

# Check each pattern
if git ls-files 2>/dev/null | grep -q "e2e/.auth/storageState.json"; then
    gate_fail "Tracked file: e2e/.auth/storageState.json"
    FOUND_VIOLATIONS=1
fi

if git ls-files 2>/dev/null | grep -q "storageState.json"; then
    gate_fail "Tracked file: storageState.json"
    FOUND_VIOLATIONS=1
fi

if git ls-files 2>/dev/null | grep -q "\.har$"; then
    gate_fail "Tracked file: *.har"
    FOUND_VIOLATIONS=1
fi

if git ls-files 2>/dev/null | grep -q "trace.*\.zip"; then
    gate_fail "Tracked file: *trace*.zip"
    FOUND_VIOLATIONS=1
fi

if git ls-files 2>/dev/null | grep -q "playwright-report"; then
    gate_fail "Tracked file: playwright-report/"
    FOUND_VIOLATIONS=1
fi

if git ls-files 2>/dev/null | grep -q "test-results"; then
    gate_fail "Tracked file: test-results/"
    FOUND_VIOLATIONS=1
fi

if [ $FOUND_VIOLATIONS -eq 0 ]; then
    gate_pass "No auth/session artifacts in tracked files"
fi

echo ""

# ============================================================================
# Gate B: Verify .gitignore contains hard blocks
# ============================================================================
echo "Gate B: Checking .gitignore for auth/evidence blocks..."

GITIGNORE_OK=1

# Check for e2e/.auth/
if grep -q "e2e/.auth/" .gitignore 2>/dev/null; then
    gate_pass ".gitignore contains: e2e/.auth/"
else
    gate_fail ".gitignore missing protection: e2e/.auth/"
    GITIGNORE_OK=0
fi

# Check for playwright-report
if grep -q "playwright-report" .gitignore 2>/dev/null; then
    gate_pass ".gitignore contains: playwright-report"
else
    gate_fail ".gitignore missing protection: playwright-report"
    GITIGNORE_OK=0
fi

# Check for test-results
if grep -q "test-results" .gitignore 2>/dev/null; then
    gate_pass ".gitignore contains: test-results"
else
    gate_fail ".gitignore missing protection: test-results"
    GITIGNORE_OK=0
fi

echo ""

# ============================================================================
# Gate C: Prove auth_login.mjs is ESM-safe (no CommonJS)
# ============================================================================
echo "Gate C: Verifying auth_login.mjs is ESM-safe..."

AUTH_SCRIPT="e2e/scripts/auth_login.mjs"
if [ ! -f "$AUTH_SCRIPT" ]; then
    gate_fail "$AUTH_SCRIPT does not exist"
else
    ESM_OK=1
    
    # Check for CommonJS require
    if grep -q "require(" "$AUTH_SCRIPT" 2>/dev/null; then
        gate_fail "$AUTH_SCRIPT contains require() call"
        ESM_OK=0
    else
        gate_pass "$AUTH_SCRIPT: no require() calls"
    fi
    
    # Check for createRequire
    if grep -q "createRequire" "$AUTH_SCRIPT" 2>/dev/null; then
        gate_fail "$AUTH_SCRIPT contains createRequire"
        ESM_OK=0
    else
        gate_pass "$AUTH_SCRIPT: no createRequire"
    fi
    
    # Check for module.exports
    if grep -q "module\.exports" "$AUTH_SCRIPT" 2>/dev/null; then
        gate_fail "$AUTH_SCRIPT contains module.exports"
        ESM_OK=0
    else
        gate_pass "$AUTH_SCRIPT: no module.exports"
    fi
fi

echo ""

# ============================================================================
# Gate D: Prove prod smoke runner exists and is executable
# ============================================================================
echo "Gate D: Verifying prod smoke runner..."

RUNNER="e2e/scripts/run_prod_dashboard_smoke_failclosed.sh"
if [ ! -f "$RUNNER" ]; then
    gate_fail "$RUNNER does not exist"
else
    if [ -x "$RUNNER" ]; then
        gate_pass "$RUNNER exists and is executable"
    else
        gate_fail "$RUNNER exists but is not executable"
    fi
fi

echo ""

# ============================================================================
# Gate E: Prove runbooks exist
# ============================================================================
echo "Gate E: Verifying runbooks exist..."

RUNBOOK_SMOKE="e2e/RUNBOOK_PROD_SMOKE.md"
if [ -f "$RUNBOOK_SMOKE" ]; then
    gate_pass "$RUNBOOK_SMOKE exists"
else
    gate_fail "$RUNBOOK_SMOKE missing"
fi

RUNBOOK_AUTH="e2e/RUNBOOK_PROD_AUTH_REFRESH.md"
if [ -f "$RUNBOOK_AUTH" ]; then
    gate_pass "$RUNBOOK_AUTH exists"
else
    gate_fail "$RUNBOOK_AUTH missing"
fi

echo ""

# ============================================================================
# Gate F: Shell safety check — both scripts use strict mode
# ============================================================================
echo "Gate F: Verifying shell safety (set -euo pipefail)..."

RUNNER="e2e/scripts/run_prod_dashboard_smoke_failclosed.sh"
if [ -f "$RUNNER" ]; then
    if grep -q "set -euo pipefail" "$RUNNER" 2>/dev/null; then
        gate_pass "$RUNNER has strict mode"
    else
        gate_fail "$RUNNER missing strict mode"
    fi
fi

GATESCRIPT="e2e/scripts/ci_repo_gates_failclosed.sh"
if [ -f "$GATESCRIPT" ]; then
    if grep -q "set -euo pipefail" "$GATESCRIPT" 2>/dev/null; then
        gate_pass "$GATESCRIPT has strict mode"
    else
        gate_fail "$GATESCRIPT missing strict mode"
    fi
fi

echo ""

# ============================================================================
# Gate G: Read-Only Proof Gate
# ============================================================================
echo "Gate G: Running read-only proof gate..."

if bash e2e/scripts/ci_readonly_proof_gate_failclosed.sh >/dev/null 2>&1; then
    gate_pass "Read-only proof gate passed"
else
    gate_fail "Read-only proof gate failed"
fi

echo ""

# ============================================================================
# Gate H: Runtime Non-Mutation Proof Gate — presence checks only
# ============================================================================
echo "Gate H: Verifying runtime non-mutation proof gate files..."

NOMUTATION_RUNNER="e2e/scripts/run_prod_dashboard_network_nomutation_failclosed.sh"
if [ ! -f "$NOMUTATION_RUNNER" ]; then
    gate_fail "$NOMUTATION_RUNNER does not exist"
else
    if [ -x "$NOMUTATION_RUNNER" ]; then
        gate_pass "$NOMUTATION_RUNNER exists and is executable"
    else
        gate_fail "$NOMUTATION_RUNNER exists but is not executable"
    fi
fi

NOMUTATION_TEST="e2e/tests/prod_dashboard_network_nomutation.spec.ts"
if [ -f "$NOMUTATION_TEST" ]; then
    gate_pass "$NOMUTATION_TEST exists"
else
    gate_fail "$NOMUTATION_TEST missing"
fi

echo ""

# ============================================================================
# Gate I: Stability Contract Gate — presence checks only
# ============================================================================
echo "Gate I: Verifying stability contract gate files..."

STABILITY_RUNNER="e2e/scripts/run_prod_dashboard_stability_contract_failclosed.sh"
if [ ! -f "$STABILITY_RUNNER" ]; then
    gate_fail "$STABILITY_RUNNER does not exist"
else
    if [ -x "$STABILITY_RUNNER" ]; then
        gate_pass "$STABILITY_RUNNER exists and is executable"
    else
        gate_fail "$STABILITY_RUNNER exists but is not executable"
    fi
fi

STABILITY_TEST="e2e/tests/prod_dashboard_stability_contract.spec.ts"
if [ -f "$STABILITY_TEST" ]; then
    gate_pass "$STABILITY_TEST exists"
else
    gate_fail "$STABILITY_TEST missing"
fi

echo ""

# ============================================================================
# Gate J: Centralized Allowlist Policy Validation
# ============================================================================
echo "Gate J: Verifying centralized allowlist policy..."

POLICY_FILE="e2e/policy/prod_proof_allowlist.json"
if [ ! -f "$POLICY_FILE" ]; then
    gate_fail "$POLICY_FILE does not exist"
else
    gate_pass "$POLICY_FILE exists"
    
    # Validate JSON parsing
    if ! node -e "const p=require('./$POLICY_FILE'); if(!p.version||!p.rules||!Array.isArray(p.rules)){throw new Error('invalid schema')}" 2>/dev/null; then
        gate_fail "$POLICY_FILE: invalid JSON or schema"
    else
        gate_pass "$POLICY_FILE: JSON schema valid"
    fi
    
    # Validate no expired rules
    if ! node -e "
      const fs=require('fs');
      const p=JSON.parse(fs.readFileSync('./$POLICY_FILE','utf8'));
      const now=new Date();
      p.rules.forEach(r=>{
        const exp=new Date(r.expires_utc);
        if(exp<=now)throw new Error('rule '+r.id+' expired');
      });
    " 2>/dev/null; then
        gate_fail "$POLICY_FILE: contains expired rules"
    else
        gate_pass "$POLICY_FILE: all rules valid and non-expired"
    fi
fi

echo ""

# ============================================================================
# Gate K: Network Domain Allowlist Gate — presence and policy checks
# ============================================================================
echo "Gate K: Verifying network domain allowlist gate files..."

DOMAIN_ALLOWLIST_RUNNER="e2e/scripts/run_prod_dashboard_network_domain_allowlist_failclosed.sh"
if [ ! -f "$DOMAIN_ALLOWLIST_RUNNER" ]; then
    gate_fail "$DOMAIN_ALLOWLIST_RUNNER does not exist"
else
    if [ -x "$DOMAIN_ALLOWLIST_RUNNER" ]; then
        gate_pass "$DOMAIN_ALLOWLIST_RUNNER exists and is executable"
    else
        gate_fail "$DOMAIN_ALLOWLIST_RUNNER exists but is not executable"
    fi
fi

DOMAIN_ALLOWLIST_TEST="e2e/tests/prod_dashboard_network_domain_allowlist.spec.ts"
if [ -f "$DOMAIN_ALLOWLIST_TEST" ]; then
    gate_pass "$DOMAIN_ALLOWLIST_TEST exists"
else
    gate_fail "$DOMAIN_ALLOWLIST_TEST missing"
fi

# Validate network_domain_allowlist in policy
POLICY_FILE="e2e/policy/prod_proof_allowlist.json"
if [ -f "$POLICY_FILE" ]; then
    # Check network_domain_allowlist exists
    if ! node -e "const p=require('./$POLICY_FILE'); if(!p.network_domain_allowlist){throw new Error('missing network_domain_allowlist')}" 2>/dev/null; then
        gate_fail "$POLICY_FILE: missing network_domain_allowlist object"
    else
        gate_pass "$POLICY_FILE: network_domain_allowlist object exists"
    fi
    
    # Validate network_domain_allowlist schema
    if ! node -e "
      const fs=require('fs');
      const p=JSON.parse(fs.readFileSync('./$POLICY_FILE','utf8'));
      const nda=p.network_domain_allowlist;
      if(!nda.version||!nda.expires_utc||!nda.allowed_hosts||!Array.isArray(nda.allowed_hosts)||!nda.allowed_host_suffixes||!Array.isArray(nda.allowed_host_suffixes)){
        throw new Error('invalid network_domain_allowlist schema');
      }
    " 2>/dev/null; then
        gate_fail "$POLICY_FILE: network_domain_allowlist invalid schema"
    else
        gate_pass "$POLICY_FILE: network_domain_allowlist schema valid"
    fi
    
    # Validate network_domain_allowlist not expired
    if ! node -e "
      const fs=require('fs');
      const p=JSON.parse(fs.readFileSync('./$POLICY_FILE','utf8'));
      const exp=new Date(p.network_domain_allowlist.expires_utc);
      const now=new Date();
      if(exp<=now)throw new Error('network_domain_allowlist expired');
    " 2>/dev/null; then
        gate_fail "$POLICY_FILE: network_domain_allowlist is expired"
    else
        gate_pass "$POLICY_FILE: network_domain_allowlist expires in future"
    fi
fi

echo ""

# ============================================================================
# Gate L: Network Domain Allowlist Policy Validation
# ============================================================================
echo "Gate L: Validating network domain allowlist policy rules..."

POLICY_FILE="e2e/policy/prod_proof_allowlist.json"
if [ ! -f "$POLICY_FILE" ]; then
    gate_fail "$POLICY_FILE does not exist"
else
    # Define allowed Atlassian suffixes (hardcoded whitelist)
    ALLOWED_SUFFIXES=".atlassian.net .atl-paas.net .atlassian.com .atlassian-dev.net"
    
    # Extract all suffixes from allowed_host_suffixes and verify against whitelist
    if ! node -e "
      const fs=require('fs');
      const p=JSON.parse(fs.readFileSync('./$POLICY_FILE','utf8'));
      const nda=p.network_domain_allowlist;
      if(!nda.allowed_host_suffixes||!Array.isArray(nda.allowed_host_suffixes)){
        throw new Error('allowed_host_suffixes missing or not array');
      }
      const allowed=['.atlassian.net','.atl-paas.net','.atlassian.com','.atlassian-dev.net'];
      const offending=nda.allowed_host_suffixes.filter(s=>!allowed.includes(s));
      if(offending.length>0){
        throw new Error('Non-Atlassian suffixes found: '+offending.join(', '));
      }
    " 2>/dev/null; then
        gate_fail "$POLICY_FILE: found non-Atlassian suffixes in allowed_host_suffixes"
    else
        gate_pass "$POLICY_FILE: allowed_host_suffixes contains only Atlassian-owned domains"
    fi
    
    # Validate third_party_exact_hosts are exact hosts only (no suffixes)
    if node -e "
      const fs=require('fs');
      const p=JSON.parse(fs.readFileSync('./$POLICY_FILE','utf8'));
      const nda=p.network_domain_allowlist;
      if(!nda.third_party_exact_hosts){
        throw new Error('third_party_exact_hosts missing');
      }
      if(!Array.isArray(nda.third_party_exact_hosts)){
        throw new Error('third_party_exact_hosts not an array');
      }
      const invalid=nda.third_party_exact_hosts.filter(h=>h.startsWith('.'));
      if(invalid.length>0){
        throw new Error('wildcard suffixes found in third_party_exact_hosts: '+invalid.join(', '));
      }
    " 2>/dev/null; then
        gate_pass "$POLICY_FILE: third_party_exact_hosts contains only exact hosts (no wildcards)"
    else
        gate_fail "$POLICY_FILE: third_party_exact_hosts contains invalid suffixes"
    fi
fi

echo ""

# ============================================================================
# Final Result
# ============================================================================
echo "=== Gate Summary ==="
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "PASS: enterprise repo gates ok"
    exit 0
else
    echo "FAIL: enterprise repo gates violated"
    exit 1
fi

