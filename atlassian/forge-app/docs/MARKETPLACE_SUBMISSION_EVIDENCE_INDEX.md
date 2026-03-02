# Marketplace Submission Evidence Index

**Document Type**: Marketplace Submission Compliance  
**Audience**: Atlassian Marketplace reviewers, FirstTry stakeholders  
**Last Updated**: 2026-01-10

---

## Overview

This document indexes all **enterprise trust artifacts** required for FirstTry marketplace submission:

1. ✅ **8 Enterprise Trust Documents** (reviewer reference)
2. ✅ **Non-Bypassable Release Gate** (proof of validation)
3. ✅ **Evidence Pack** (gate execution artifacts)
4. ✅ **Submission Checklist** (pre-submission verification)

---

## Part 1: 8 Required Enterprise Trust Documents

### 1. SCOPES_JUSTIFICATION.md

**Path**: `docs/SCOPES_JUSTIFICATION.md`

**Reviewer Question**: Why does FirstTry need these exact permissions?

**Required Content**:
- ✅ Extract scopes from `manifest.yml` (permissions.scopes section)
- ✅ For EACH scope, document:
  - Why required
  - What data it accesses
  - Why it's the minimum needed
  - What would break without it

---

### 2. DATA_HANDLING.md

**Path**: `docs/DATA_HANDLING.md`

**Reviewer Question**: How is customer data stored, protected, and deleted?

**Required Content** (must include these exact sections):
- ✅ **Data Accessed**: Specific metadata (project names, issue types, status, field schema—NOT content)
- ✅ **Data Stored**: What is persisted and where
- ✅ **Storage Location Details**: Service (Forge Storage), region, encryption, backup
- ✅ **Data Retention Period**: Default durations (30/90/365 days) and rationale
- ✅ **Data Deletion Policy**: Automatic deletion timing, uninstall behavior, irreversibility
- ✅ **Data Egress Policy**: Explicit "NO external transmission" or list exact vendors
- ✅ **Data Handling Contact**: Email address for data privacy questions

---

### 3. SUPPORT.md

**Path**: `docs/SUPPORT.md`

**Reviewer Question**: How will my customers get help?

**Required Content**:
- ✅ **Support Email/Channel**: Primary contact method (e.g., GitHub issues)
- ✅ **Response Expectation**: Time window (e.g., "best effort", "24 hours", "48-72 hours")
- ✅ **Escalation Path**: How issues escalate (severity levels, on-call, management)
- ✅ **Scope**: What IS/ISN'T supported (bugs, features, platform issues)

---

### 4. RELEASE_GATE_RUNBOOK.md

**Path**: `docs/RELEASE_GATE_RUNBOOK.md`

**Reviewer Question**: Can I independently verify this app passed validation?

**Required Content**:
- ✅ **Gate Overview**: What phases it validates (tree integrity, manifest, docs, auth, deploy, install)
- ✅ **Prerequisites**: Forge CLI, authentication, environment setup
- ✅ **7 Phases**: Each phase's requirement and what it validates
- ✅ **Evidence Directory**: Structure of `/tmp/forge_marketplace_gate_*/` output
- ✅ **Failure Remediation**: Step-by-step fixes for each phase
- ✅ **No Bypasses**: No phase removal allowed; all phases must pass

---

### 5. ADMIN_GUIDE.md

**Path**: `docs/ADMIN_GUIDE.md`

**Reviewer Question**: Can Jira admins self-serve install/uninstall?

**Required Content**:
- ✅ **What It Does**: Read-only governance, evidence collection, no data modification
- ✅ **Where It Appears**: Dashboard location, permission requirements
- ✅ **Installation**: Prerequisites, step-by-step install, post-install setup
- ✅ **Uninstallation**: Steps, automatic data deletion, no recovery
- ✅ **Troubleshooting**: Common issues + fixes (no dashboard, no snapshots, errors)
- ✅ **Support & Escalation**: How to contact support, security reporting
- ✅ **Scopes Explained**: Table of scopes and why each is needed
- ✅ **FAQ**: Data modification, content access, retention, export, offline

---

### 6. SECURITY.md

**Path**: `SECURITY.md` (repo root) or `docs/SECURITY.md` (if that exists)

**Reviewer Question**: What are the real security guarantees?

**Required Content**:
- ✅ **Security Model**: What Forge platform provides (auth, encryption, isolation)
- ✅ **Threat Model**: Threats mitigated by Forge vs. out-of-scope (insider threats, platform vulns)
- ✅ **Security Features**: What app DOES (read-only, no external egress)
- ✅ **What App DOES NOT DO**: No encryption impl, no audit logging, no cert storage
- ✅ **NO FALSE CERTIFICATIONS**: Explicit "NOT certified" for SOC2/ISO/HIPAA/GDPR (if not independently certified)

---

### 7. INCIDENT_RESPONSE.md

**Path**: `docs/INCIDENT_RESPONSE.md`

**Reviewer Question**: How does the vendor respond to incidents?

**Required Content**:
- ✅ **SEV Definitions**: SEV-1 (critical), SEV-2 (high), SEV-3 (medium), SEV-4 (low)
- ✅ **Communication & Escalation**: Who to notify, timeline, escalation path
- ✅ **Incident Workflow**: Detection → triage → response → recovery → postmortem
- ✅ **Security Incident Handling**: Separate workflow for security vs. operational
- ✅ **Post-Incident Review**: Postmortem process + root cause analysis

---

### 8. MARKETPLACE_SUBMISSION_EVIDENCE_INDEX.md

**Path**: `docs/MARKETPLACE_SUBMISSION_EVIDENCE_INDEX.md`

**This document itself.**

**Required Content**:
- ✅ Index of all 8 docs above
- ✅ Evidence directory format description
- ✅ Submission checklist
- ✅ How marketplace reviewers will audit the submission

---

## Part 2: Release Gate (Non-Bypassable)

### Gate Script Location

**Path**: `audit/marketplace_submission/run_marketplace_gate.sh`

### Gate Execution

```bash
cd /workspaces/Firsttry/atlassian/forge-app
export FIRSTTRY_FORGE_SITE="https://mycompany.atlassian.net"
./audit/marketplace_submission/run_marketplace_gate.sh
echo "EXIT=$?"
```

### 7 Phases (All Must Pass)

| Phase | Validation | Exit Code Must Be |
|-------|-----------|-------------------|
| **0** | Tree integrity (clean repo) | 0 |
| **1** | Repo state capture (branch/SHA/origin-main) | 0 |
| **2** | Forge whoami (authentication) | 0 |
| **3** | Forge version + lint (manifest valid) | 0 |
| **4** | Forge deploy (code deployable) | 0 |
| **5** | Forge install --upgrade (code installable) | **0 (NON-NEGOTIABLE)** |
| **6** | Docs validation (8 docs complete) | 0 |
| **7** | FINAL_SUBMISSION_PROOF.md generation | 0 |

### Exit Code Truth

- **Exit 0** = ALL phases passed → MARKETPLACE-READY
- **Exit non-zero** = ANY phase failed → NOT READY (fix + re-run entire gate)

---

## Part 3: Evidence Directory

### Location

**Path**: `/tmp/forge_marketplace_gate_YYYYMMDD_HHMMSS/`

(Timestamped at gate start; exact timestamp shown in gate output)

### Required Artifacts

If gate PASSES (exit 0), evidence directory contains:

```
/tmp/forge_marketplace_gate_20260110_HHMMSS/
├── git_repo_state.txt               # branch, HEAD SHA, origin/main SHA
├── git_repo_state_exit.txt          # Exit code from git commands
├── forge_whoami.txt                 # Authenticated user/site proof
├── forge_whoami_exit.txt            # Exit code (0 = authenticated)
├── forge_version.txt                # Forge CLI version output
├── forge_version_exit.txt           # Exit code
├── manifest_lint.txt                # Lint validation output
├── manifest_lint_exit.txt           # Exit code (0 = no issues)
├── forge_deploy.txt                 # Deployment output
├── forge_deploy_exit.txt            # Exit code (0 = deployable)
├── forge_install.txt                # Installation output
├── forge_install_exit.txt           # Exit code (0 = installable)
├── forge_install_help.txt           # `forge install --help` (for audit)
├── docs_validation_report.txt       # Doc completeness check
├── FINAL_SUBMISSION_PROOF.md        # Summary + decision + checklist
└── CHECKSUMS.sha256                 # SHA256 integrity hashes
```

### Proof Integrity

All artifacts are hashed in `CHECKSUMS.sha256`:

```bash
sha256sum -c /tmp/forge_marketplace_gate_*/CHECKSUMS.sha256
# All files must show: OK
```

If any file fails checksum verification, that indicates tampering.

---

## Part 4: Pre-Submission Checklist

Before submitting to Atlassian Marketplace:

### Documentation Completeness

- [ ] `docs/SCOPES_JUSTIFICATION.md` exists + lists all scopes + justification for each
- [ ] `docs/DATA_HANDLING.md` exists + has 7 required section headings
- [ ] `docs/SUPPORT.md` exists + email + response time + escalation path
- [ ] `docs/RELEASE_GATE_RUNBOOK.md` exists + describes all 7 phases
- [ ] `docs/ADMIN_GUIDE.md` exists + install/uninstall/troubleshooting
- [ ] `SECURITY.md` or `docs/SECURITY.md` exists + no false cert claims
- [ ] `docs/INCIDENT_RESPONSE.md` exists + SEV definitions + escalation
- [ ] `docs/MARKETPLACE_SUBMISSION_EVIDENCE_INDEX.md` exists (this document)

### Gate Execution

- [ ] Repository state: `git status --porcelain=v1` returns empty
- [ ] Branch: On `main` and `HEAD == origin/main`
- [ ] Gate runs: `./audit/marketplace_submission/run_marketplace_gate.sh`
- [ ] Exit code: `0` (success)
- [ ] Evidence dir created: `/tmp/forge_marketplace_gate_YYYYMMDD_HHMMSS/`
- [ ] All 7 exit code files exist and show `0`
- [ ] Checksums verified: `sha256sum -c .../CHECKSUMS.sha256` → all OK
- [ ] FINAL_SUBMISSION_PROOF.md exists + says "MARKETPLACE-READY"

### Manifest & Code

- [ ] `manifest.yml` passes `forge lint` (exit 0, no issues)
- [ ] All function keys < 23 characters
- [ ] All scopes match those listed in `SCOPES_JUSTIFICATION.md`
- [ ] Code deployable: `forge deploy -e production` exits 0
- [ ] Code installable: `forge install --upgrade -s $SITE -e production` exits 0

### Documentation Truthfulness

- [ ] No false SOC2/ISO/HIPAA/GDPR certification claims
- [ ] SECURITY.md explicitly states "NOT independently certified" if applicable
- [ ] All feature claims are backed by code
- [ ] DATA_HANDLING.md states "No external egress" or lists actual vendors

### Final Submission

- [ ] Evidence directory copied to submission package
- [ ] All 8 docs included in package
- [ ] FINAL_SUBMISSION_PROOF.md attached to submission
- [ ] Submission notes reference RELEASE_GATE_RUNBOOK.md + gate exit code 0
- [ ] Reviewer can independently verify: `sha256sum -c CHECKSUMS.sha256`

---

## Part 5: Marketplace Reviewer Audit Trail

### How Reviewers Will Validate Your Submission

1. **Download Evidence**:
   - Extract evidence directory from submission package
   - Verify all 7 artifact files present

2. **Verify Integrity**:
   - Run: `sha256sum -c CHECKSUMS.sha256`
   - Confirm all files show "OK"

3. **Check Repo State**:
   - Review `git_repo_state.txt`
   - Confirm branch is `main` and HEAD matches origin/main
   - Verify all exit code files show `0`

4. **Review Artifacts**:
   - `forge_whoami.txt`: User authenticated + site accessible
   - `manifest_lint.txt`: Lint output shows "No issues found"
   - `forge_deploy_exit.txt`: Deployment succeeded (exit 0)
   - `forge_install_exit.txt`: Installation succeeded (exit 0)
   - `docs_validation_report.txt`: All 8 docs present + required sections
   - `FINAL_SUBMISSION_PROOF.md`: Summary states "MARKETPLACE-READY"

5. **Manual Spot-Checks**:
   - Verify DATA_HANDLING.md contains data egress policy
   - Verify SECURITY.md doesn't claim false certifications
   - Verify SUPPORT.md includes response time expectations
   - Verify INCIDENT_RESPONSE.md includes escalation path

6. **Sign-Off**:
   - If all checks pass: Approve for marketplace listing
   - If any check fails: Request resubmission with corrected evidence

---

## Part 6: Evidence Submission Format

### Recommended Package Structure

```
FirstTry-Marketplace-Submission-20260110/
│
├── docs/
│   ├── SCOPES_JUSTIFICATION.md
│   ├── DATA_HANDLING.md
│   ├── SUPPORT.md
│   ├── RELEASE_GATE_RUNBOOK.md
│   ├── ADMIN_GUIDE.md
│   ├── INCIDENT_RESPONSE.md
│   ├── MARKETPLACE_SUBMISSION_EVIDENCE_INDEX.md
│   └── SECURITY.md
│
├── evidence/
│   └── forge_marketplace_gate_20260110_HHMMSS/
│       ├── git_repo_state.txt
│       ├── git_repo_state_exit.txt
│       ├── forge_whoami.txt
│       ├── forge_whoami_exit.txt
│       ├── forge_version.txt
│       ├── forge_version_exit.txt
│       ├── manifest_lint.txt
│       ├── manifest_lint_exit.txt
│       ├── forge_deploy.txt
│       ├── forge_deploy_exit.txt
│       ├── forge_install.txt
│       ├── forge_install_exit.txt
│       ├── forge_install_help.txt
│       ├── docs_validation_report.txt
│       ├── FINAL_SUBMISSION_PROOF.md
│       └── CHECKSUMS.sha256
│
└── SUBMISSION_NOTES.txt
    (Reference gate execution + link to RELEASE_GATE_RUNBOOK.md)
```

---

## Glossary

| Term | Definition |
|------|-----------|
| **Gate** | Automated validation script (non-bypassable) |
| **Phase** | One validation step in the gate (0-7) |
| **Exit Code** | Process result (0 = success, non-zero = failure) |
| **Evidence Directory** | `/tmp/forge_marketplace_gate_*/` with all artifacts |
| **Proof Integrity** | SHA256 hashes verify no tampering |
| **Marketplace-Ready** | Gate exits 0 + all docs present + no false claims |

---

## Questions?

**For gate execution questions**: See [RELEASE_GATE_RUNBOOK.md](RELEASE_GATE_RUNBOOK.md)  
**For app security questions**: See [SECURITY.md](trust/generated/security_overview_mirror.md)  
**For data privacy questions**: See [DATA_HANDLING.md](DATA_HANDLING.md)  
**For support questions**: See [SUPPORT.md](SUPPORT.md)  
**For installation questions**: See [ADMIN_GUIDE.md](ADMIN_GUIDE.md)  

---

**Last Updated**: 2026-01-10  
**Status**: Ready for marketplace submission (after gate passes)
