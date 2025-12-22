# Enterprise End-to-End Acceptance Pack

**Version**: 1.0.0  
**Last Updated**: 2025-12-22  
**Purpose**: Enterprise-grade acceptance testing runbook for FirstTry Governance after Marketplace installation

---

## Overview

This runbook provides step-by-step instructions for enterprise administrators and security reviewers to verify FirstTry Governance is operating correctly in their Jira Cloud tenant after installation from the Atlassian Marketplace.

**What this validates**:
- ✅ App installs correctly with minimal read-only permissions
- ✅ Scheduled pipelines execute automatically (daily/weekly)
- ✅ Data remains tenant-isolated in Forge Storage
- ✅ No external network egress occurs
- ✅ Evidence generation is deterministic and reproducible
- ✅ Documentation claims match implementation reality

---

## Preconditions

### Required Access
1. **Jira Cloud Site**: Active Jira Cloud instance with administrator privileges
2. **Marketplace Install**: FirstTry Governance installed from Atlassian Marketplace
3. **Permissions Review**: App permissions accepted during installation (storage:app scope only)

### Required Tools
- **For Mode A (Real Tenant E2E)**: Forge CLI (`npm install -g @forge/cli`)
- **For Mode B (Local Simulation)**: Node.js 20+ and npm
- **Optional**: Git client to clone this repository

---

## Execution Modes

### Mode A: Real Tenant E2E (Recommended)
- **When**: You have Forge CLI installed and can authenticate to your Jira Cloud tenant
- **Validates**: 100% of acceptance criteria including live scheduler execution and Jira API integration
- **Evidence**: Full audit bundle with real tenant data (sanitized)

### Mode B: Local Simulation (Limited)
- **When**: Forge CLI unavailable or running in restricted environment
- **Validates**: ~80% of acceptance criteria via simulation and static analysis
- **Evidence**: Audit bundle with clear markers for "not executed" checks
- **Limitations**: Cannot verify live scheduler execution or real Jira API interaction

---

## Mode A: Real Tenant E2E

### Step 1: Environment Setup

```bash
# Authenticate with Forge CLI (one-time)
forge login

# Verify your Jira site is accessible
forge sites
```

**Expected Output**: List of your Jira Cloud sites with active installation IDs

### Step 2: Export Environment Variables

```bash
export FORGE_SITE_ID="your-site-id"  # From 'forge sites' output
export JIRA_SITE="yourcompany.atlassian.net"
export MODE="REAL_TENANT"
```

### Step 3: Run Acceptance Suite

```bash
# From repository root
cd /workspaces/Firstry
bash scripts/enterprise_e2e.sh
```

**Duration**: ~5-10 minutes  
**Output Location**: `audit_artifacts/enterprise_acceptance/<TIMESTAMP>/`

### Step 4: Review Results

```bash
# View summary
cat audit_artifacts/enterprise_acceptance/latest/summary.md

# View machine-readable evidence index
cat audit_artifacts/enterprise_acceptance/latest/evidence_index.json
```

**PASS Criteria**:
- All checks in `evidence_index.json` show `"status": "PASS"`
- No `FAIL` status in any check
- `summary.md` reports "Overall Status: PASS"

---

## Mode B: Local Simulation

### Step 1: Clone Repository (if not already done)

```bash
git clone https://github.com/Firsttry-Solutions/Firstry.git
cd Firstry
```

### Step 2: Install Dependencies

```bash
cd atlassian/forge-app
npm install
```

### Step 3: Run Simulation Mode

```bash
# From repository root
cd /workspaces/Firstry
export MODE="SIMULATION"
bash scripts/enterprise_e2e.sh
```

**Duration**: ~3-5 minutes  
**Output Location**: `audit_artifacts/enterprise_acceptance/<TIMESTAMP>/`

### Step 4: Review Simulation Results

```bash
# View summary with limitations
cat audit_artifacts/enterprise_acceptance/latest/summary.md

# Check which tests were skipped
jq '.checks[] | select(.status == "SKIPPED")' audit_artifacts/enterprise_acceptance/latest/evidence_index.json
```

**PASS Criteria**:
- All executed checks show `"status": "PASS"`
- Skipped checks have `"status": "SKIPPED"` with clear `"known_limits"`
- No `FAIL` status in any executed check

---

## Acceptance Checks Reference

### 1. Install Lifecycle Sanity
- **What**: Validates manifest.yml structure, required modules, handlers
- **Mode A**: ✅ Full validation
- **Mode B**: ✅ Full validation (simulation-safe)
- **Evidence**: `manifest_validation.json`

### 2. Auth Boundary Sanity
- **What**: Verifies no Jira write APIs used, minimal permissions
- **Mode A**: ✅ Full validation
- **Mode B**: ✅ Full validation (static analysis)
- **Evidence**: `auth_boundary.json`

### 3. Event Ingestion Correctness
- **What**: Token validation, schema validation, idempotency
- **Mode A**: ✅ Full validation with live endpoints
- **Mode B**: ⚠️ Unit test validation only
- **Evidence**: `ingestion_validation.json`
- **Mode B Limitation**: Cannot test live token validation endpoint

### 4. Scheduler/Run Ledger Correctness
- **What**: Daily/weekly scheduler definitions, append-only ledger enforcement
- **Mode A**: ✅ Full validation with real scheduler execution
- **Mode B**: ⚠️ Static definition checks only
- **Evidence**: `scheduler_validation.json`
- **Mode B Limitation**: Cannot verify live scheduler execution or ledger appends

### 5. Evidence Regeneration
- **What**: Deterministic evidence generation from stored snapshots
- **Mode A**: ✅ Full validation
- **Mode B**: ✅ Full validation (deterministic by design)
- **Evidence**: `evidence_determinism.json`

### 6. Tenant Isolation Proof
- **What**: Storage keys include tenant identifiers, isolation enforced
- **Mode A**: ✅ Full validation with multi-tenant simulation
- **Mode B**: ✅ Static isolation mechanism checks
- **Evidence**: `tenant_isolation.json`

### 7. External Dependency Declaration Consistency
- **What**: Documentation claims match code reality
- **Mode A**: ✅ Full validation
- **Mode B**: ✅ Full validation (static analysis)
- **Evidence**: `docs_consistency.json`

### 8. Zero-Alert Default
- **What**: No outbound notifications enabled by default
- **Mode A**: ✅ Full validation
- **Mode B**: ✅ Full validation (config check)
- **Evidence**: `zero_alert_validation.json`

### 9. Determinism ≥10 Runs
- **What**: 10 repeated test runs produce identical results
- **Mode A**: ✅ Full validation
- **Mode B**: ✅ Full validation (timestamps normalized)
- **Evidence**: `determinism_10_runs.json`

---

## Data Handling Notes

### Storage Location
- **Where**: Atlassian Forge hosted storage (tenant-isolated)
- **Scope**: Only `storage:app` permission used (read/write to own storage)
- **Isolation**: Forge platform enforces strict tenant boundaries

### Retention Expectations
- **Policy**: Data stored in Forge hosted storage follows Atlassian's Forge data lifecycle
- **After Uninstall**: Data retained for limited period per Atlassian platform behavior (not immediately purged)
- **Deletion**: Hosted storage data deleted after platform retention period expires

### Zero-Alert Posture
- **Default Behavior**: No outbound notifications or alerts
- **Reporting Surface**: Admin UI provides on-demand report viewing only
- **User Action Required**: Admin must manually navigate to app to view status

### Read-Only Jira Access
- **API Calls**: All Jira API calls are GET-equivalent reads (projects, issue types, fields, statuses, workflows, automations)
- **No Writes**: App does not create, modify, or delete any Jira issues, projects, or configuration
- **Evidence**: `atlassian/forge-app/docs/EXTERNAL_APIS.md` documents all 7 Jira API calls with proof they are read-only

---

## What Cannot Be Proven Without Real Tenant

When running Mode B (simulation), the following checks are skipped with explicit documentation:

1. **Live Scheduler Execution**
   - **Why**: Requires Forge runtime environment and scheduled trigger invocation
   - **Mitigation**: Manual verification post-install by checking app admin UI for scheduled report generation

2. **Real Jira API Integration**
   - **Why**: Requires authenticated Jira Cloud API access
   - **Mitigation**: Static code analysis verifies all API calls are reads; logs confirm after install

3. **Token Validation Endpoint Behavior**
   - **Why**: Requires deployed Forge function with real HTTP trigger
   - **Mitigation**: Unit tests simulate token validation logic; integration tests require Mode A

4. **Multi-Tenant Storage Isolation (Runtime)**
   - **Why**: Requires multiple Jira tenants with live installations
   - **Mitigation**: Static key format analysis + Forge platform enforces isolation by design

---

## Troubleshooting

### Issue: `forge: command not found`
**Solution**: Install Forge CLI: `npm install -g @forge/cli`

### Issue: `evidence_index.json` contains `FAIL` status
**Solution**: 
1. Check `summary.md` for detailed failure reason
2. Review raw logs in `audit_artifacts/enterprise_acceptance/<TIMESTAMP>/logs/`
3. If claims inconsistency, verify documentation vs code matches

### Issue: Mode A fails with authentication error
**Solution**:
1. Re-authenticate: `forge login`
2. Verify site access: `forge sites`
3. Ensure app is installed: check Jira Admin → Manage Apps

### Issue: Determinism check fails (different digests)
**Solution**:
1. Review `determinism_10_runs.json` for which fields differ
2. Ensure timestamps are properly normalized
3. Check for non-deterministic test data generation

---

## Evidence Bundle Structure

```
audit_artifacts/enterprise_acceptance/<YYYYMMDD_HHMMSS>/
├── evidence_index.json        # Machine-readable manifest
├── summary.md                  # Human-readable summary
├── logs/
│   ├── lint_typecheck.log
│   ├── unit_tests.log
│   ├── shakedown_tests.log
│   ├── credibility_tests.log
│   ├── acceptance_suite.log
│   └── determinism_10_runs.log
├── evidence/
│   ├── manifest_validation.json
│   ├── auth_boundary.json
│   ├── ingestion_validation.json
│   ├── scheduler_validation.json
│   ├── evidence_determinism.json
│   ├── tenant_isolation.json
│   ├── docs_consistency.json
│   ├── zero_alert_validation.json
│   └── determinism_10_runs.json
└── junit.xml                   # Optional JUnit report
```

---

## Maintenance Schedule

- **Quarterly**: Re-run acceptance suite to verify no regressions
- **After Major Updates**: Run before promoting to production tenants
- **Security Audits**: Provide evidence bundle to auditors

---

## Support

- **GitHub Issues**: https://github.com/Firsttry-Solutions/Firstry/issues
- **Security Contact**: security@firsttry.run
- **Documentation**: https://github.com/Firsttry-Solutions/Firstry/tree/main/docs

---

**Last Review**: 2025-12-22  
**Next Review**: 2026-03-22
