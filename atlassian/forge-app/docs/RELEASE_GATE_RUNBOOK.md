# Release Gate Runbook

**Document Type**: Operational Procedure  
**Purpose**: Non-bypassable validation gate for Atlassian Marketplace submission  
**Last Updated**: 2026-01-10

---

## Overview

The **FirstTry Marketplace Release Gate** is an automated, non-interactive validation script that:

1. ✅ Verifies repository state (clean tree, HEAD matches release branch)
2. ✅ Confirms manifest passes Forge lint validation
3. ✅ Validates all required marketplace trust documentation exists
4. ✅ Tests Forge whoami (authentication)
5. ✅ Runs forge deploy (deployment validation)
6. ✅ Runs forge install --upgrade (installation validation)
7. ✅ Generates cryptographic proof of compliance

**Exit Code Truth**: Only exit code `0` indicates full success (POSIX standard). Exit code non-zero = FAIL.

**Non-Bypassable**: Any phase failure stops the gate immediately. No retries or phase-skipping allowed.

---

## Prerequisites

### System Requirements

- **OS**: Linux/macOS with bash 4.0+
- **Tools Required**: 
  - `git` (command-line)
  - `forge` (Atlassian Forge CLI, authenticated)
  - `python3` (optional, for evidence analysis)
  
### Authentication

The gate requires valid Forge CLI authentication:

```bash
forge whoami
# Output: Must show a valid cloudId or user ID; exit code must be 0
```

If `forge whoami` exits non-zero, the gate cannot proceed. Set up auth:

```bash
forge login
# Follow interactive prompts to authenticate with Atlassian account
# Select target Jira Cloud site when prompted
```

### Environment Variables (Required for Install Phase)

The gate requires:

```bash
export FIRSTTRY_FORGE_SITE="<your-jira-cloud-site-url>"
# Example: export FIRSTTRY_FORGE_SITE="https://mycompany.atlassian.net"
```

If `FIRSTTRY_FORGE_SITE` is empty, the gate FAILS at the install phase.

### Repository State

1. **Clean working tree**: `git status --porcelain=v1` returns empty
2. **Current branch**: Must be the release branch (typically `main`)
3. **HEAD matches release source**: HEAD must equal `origin/main` (or approved release branch)

---

## Execution

### Quick Start

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Set required environment variable
export FIRSTTRY_FORGE_SITE="https://mycompany.atlassian.net"

# Run gate (single execution, no retries)
./audit/marketplace_submission/run_marketplace_gate.sh

# Capture exit code
echo "Gate exit code: $?"
```

### Non-Interactive Flags

All Forge commands in the gate use **only non-interactive flags** discovered from official Forge CLI help:

```bash
forge install --help      # Discover valid flags for --upgrade, --e (environment), etc.
forge deploy --help       # Discover valid flags
```

If a prompt appears (e.g., "Enter site URL?"), the gate FAILS (non-interactive requirement violated).

---

## Phases (7 Total)

### PHASE 0: Hard Clean-Tree Check

**Requirement**: Repository must be in clean state (no uncommitted changes).

**Validation**:
```bash
git status --porcelain=v1
# Expected output: (empty line only)
# If any output: FAIL
```

**Why**: Ensures gate validates the exact code you intend to submit.

**On Failure**: Commit pending changes, then re-run gate.

---

### PHASE 1: Evidence Directory & Repo State Capture

**Requirement**: Create evidence directory and capture proof of repo state.

**Actions**:
- Create `/tmp/forge_marketplace_gate_YYYYMMDD_HHMMSS/`
- Capture `git branch --show-current`
- Capture `git rev-parse HEAD`
- Capture `git rev-parse origin/main`
- Write `git_repo_state.txt` with all above

**Why**: Proves which commit and branch were tested.

---

### PHASE 2: Forge Whoami (Authentication Check)

**Requirement**: `forge whoami` must exit 0 (user is authenticated).

**Command**:
```bash
forge whoami 2>&1 | tee "$EVIDENCE_DIR/forge_whoami.txt"
# Capture exit code via PIPESTATUS[0]
```

**Expected Output**: Valid cloudId, site, user email (varies by Forge version).

**On Failure** (exit non-zero): 
- User is not authenticated
- Run `forge login` and re-run gate

---

### PHASE 3: Forge Version & Lint Validation

**Requirement**: `forge --version` and `forge lint` must both exit 0.

**Commands**:
```bash
forge --version 2>&1 | tee "$EVIDENCE_DIR/forge_version.txt"
forge lint 2>&1 | tee "$EVIDENCE_DIR/manifest_lint.txt"
# Capture exit codes
```

**Expected Output**:
- Version: e.g., `@forge/cli v12.13.0`
- Lint: `No issues found`

**On Failure**:
- Version may be outdated (warning only; gate continues)
- Lint must exit 0 or FAIL (fix manifest.yml and re-run)

---

### PHASE 4: Forge Deploy (Deployment Validation)

**Requirement**: `forge deploy -e production` must exit 0.

**Command**:
```bash
forge deploy -e production 2>&1 | tee "$EVIDENCE_DIR/forge_deploy.txt"
# Capture exit code
```

**Expected Output**: Success message; no validation errors.

**On Failure** (exit non-zero):
- Manifest or code error prevents deployment
- Check output for error details
- Fix code/manifest and re-run gate

**Why**: Proves code is deployable to production environment.

---

### PHASE 5: Forge Install --upgrade (Installation Validation)

**Requirement**: `forge install --upgrade -s $FIRSTTRY_FORGE_SITE -e production` must exit 0.

**Prerequisites**:
- `FIRSTTRY_FORGE_SITE` environment variable must be set
- Site must have Forge app auto-installation enabled (usually default)
- User must have site admin permissions on that site

**Command**:
```bash
forge install --upgrade -s "$FIRSTTRY_FORGE_SITE" -e production 2>&1 | tee "$EVIDENCE_DIR/forge_install.txt"
# Capture exit code
```

**Expected Output**: Success message; app installed/upgraded on target site.

**On Failure** (exit non-zero):
- Site URL invalid or unreachable
- User lacks permissions on site
- Manifest validation error
- Forge version incompatibility
- Check output for specific error
- Fix and re-run gate

**Why**: Proves code will actually install on a real Jira Cloud site.

**CRITICAL**: This phase MUST succeed. You may NOT remove or replace this phase with "schema validation" or other shortcuts. Exit code 0 is non-negotiable.

---

### PHASE 6: Documentation Validation

**Requirement**: All 8 required marketplace trust docs must exist and contain required sections.

**Docs Validated**:
1. `docs/SCOPES_JUSTIFICATION.md`
2. `docs/DATA_HANDLING.md`
3. `docs/SUPPORT.md`
4. `docs/RELEASE_GATE_RUNBOOK.md` (this document)
5. `docs/ADMIN_GUIDE.md`
6. `docs/INCIDENT_RESPONSE.md`
7. `docs/MARKETPLACE_SUBMISSION_EVIDENCE_INDEX.md`
8. `SECURITY.md` (or `docs/SECURITY.md`)

**Content Validation** (samples):
- DATA_HANDLING.md: Contains headings "Data Accessed", "Data Stored", "Storage Location", "Data Retention", "Data Deletion", "Data Egress"
- SCOPES_JUSTIFICATION.md: Lists each scope with justification
- SUPPORT.md: Contains support email and response expectation
- ADMIN_GUIDE.md: Install/uninstall instructions, troubleshooting

**Output**: `docs_validation_report.txt` with pass/fail for each doc.

**On Failure**: Create missing docs or add missing sections; re-run gate.

---

### PHASE 7: Final Summary & FINAL_SUBMISSION_PROOF.md

**Requirement**: Generate FINAL_SUBMISSION_PROOF.md summarizing all phases.

**FINAL_SUBMISSION_PROOF.md** includes:
- Test date/time
- Repository: branch, HEAD SHA, origin/main SHA
- Forge version
- Whoami result (authenticated user/site)
- Lint result (pass/fail)
- Deploy result (pass/fail)
- Install result (pass/fail)
- Docs validation result (all 8 present/pass)
- Evidence directory path
- Checksum manifest (SHA256 of all artifacts)
- Conclusion: "MARKETPLACE-READY" if all phases pass, "FAILED" otherwise

**Exit Code Decision**:
- If ALL phases passed: **exit 0** (marketplace-ready)
- If ANY phase failed: **exit non-zero** (not ready; fix and re-run)

---

## Evidence Directory Structure

**Location**: `/tmp/forge_marketplace_gate_YYYYMMDD_HHMMSS/`

**Contents** (if all phases pass):

```
/tmp/forge_marketplace_gate_20260110_HHMMSS/
├── git_repo_state.txt              # branch, HEAD, origin/main
├── forge_whoami.txt                # Authenticated user/site proof
├── forge_whoami_exit.txt           # Exit code (0 = success)
├── forge_version.txt               # Forge CLI version
├── forge_version_exit.txt          # Exit code
├── manifest_lint.txt               # Lint output
├── manifest_lint_exit.txt          # Exit code (0 = pass)
├── forge_deploy.txt                # Deploy output
├── forge_deploy_exit.txt           # Exit code (0 = pass)
├── forge_install.txt               # Install output
├── forge_install_exit.txt          # Exit code (0 = pass)
├── forge_install_help.txt          # `forge install --help` (for audit)
├── docs_validation_report.txt      # Doc completeness report
├── FINAL_SUBMISSION_PROOF.md       # Summary + decision
└── CHECKSUMS.sha256                # SHA256 hashes (integrity proof)
```

---

## Failure Modes & Remediation

### PHASE 0 Fails (Dirty Tree)

**Symptom**: `git status --porcelain=v1` shows uncommitted changes.

**Fix**:
```bash
# Option 1: Commit changes
git add -A
git commit -m "chore: prepare for marketplace gate"

# Option 2: Stash if uncommitted work is temporary
git stash

# Then re-run:
./audit/marketplace_submission/run_marketplace_gate.sh
```

---

### PHASE 1 Fails (Branch/SHA Mismatch)

**Symptom**: HEAD does not match origin/main (or error creating evidence dir).

**Fix**:
```bash
# Ensure you're on the release branch
git checkout main
git reset --hard origin/main

# Then re-run:
./audit/marketplace_submission/run_marketplace_gate.sh
```

---

### PHASE 2 Fails (Whoami Exit Non-Zero)

**Symptom**: `forge whoami` exits non-zero (not authenticated).

**Fix**:
```bash
# Authenticate
forge login

# Follow prompts:
#   - Choose org
#   - Choose site
#   - Approve in browser

# Then re-run:
./audit/marketplace_submission/run_marketplace_gate.sh
```

---

### PHASE 3 Fails (Lint Error)

**Symptom**: `forge lint` exits non-zero with manifest errors.

**Fix**:
```bash
# See what's wrong
cd /workspaces/Firsttry/atlassian/forge-app
forge lint

# Common issues:
# - Function key > 23 chars → Rename in manifest.yml
# - Missing handler → Fix handler path
# - Invalid YAML → Check syntax

# After fix:
git add manifest.yml
git commit -m "fix(manifest): address lint error"
cd ../..
./atlassian/forge-app/audit/marketplace_submission/run_marketplace_gate.sh
```

---

### PHASE 4 Fails (Deploy Exit Non-Zero)

**Symptom**: `forge deploy` exits non-zero with deployment error.

**Fix**:
```bash
# See what's wrong
cd /workspaces/Firsttry/atlassian/forge-app
forge deploy -e production

# Common issues:
# - TypeScript compile error → Check src/ syntax
# - Missing dependency → Run npm install
# - Manifest error → Run forge lint first

# After fix:
git add -A
git commit -m "fix: resolve deployment issue"
cd ../..
./atlassian/forge-app/audit/marketplace_submission/run_marketplace_gate.sh
```

---

### PHASE 5 Fails (Install Exit Non-Zero)

**Symptom**: `forge install --upgrade` exits non-zero with install error.

**Fix**:
```bash
# See what's wrong
export FIRSTTRY_FORGE_SITE="https://mycompany.atlassian.net"
cd /workspaces/Firsttry/atlassian/forge-app
forge install --upgrade -s "$FIRSTTRY_FORGE_SITE" -e production

# Common issues:
# - Site URL invalid → Check FIRSTTRY_FORGE_SITE
# - User lacks permissions → Verify site admin role
# - Forge version mismatch → Update Forge CLI
# - Manifest error → Run forge lint

# After fix:
git add -A
git commit -m "fix: resolve install issue"
cd ../..
./atlassian/forge-app/audit/marketplace_submission/run_marketplace_gate.sh
```

---

### PHASE 6 Fails (Missing Documentation)

**Symptom**: One or more required docs missing or content incomplete.

**Fix**:
```bash
# Create missing doc(s)
touch /workspaces/Firsttry/atlassian/forge-app/docs/DATA_HANDLING.md
# Edit with required content (see C1 rules in PHASE C of user request)

# After adding/fixing:
cd /workspaces/Firsttry
git add atlassian/forge-app/docs/
git commit -m "docs: add marketplace trust documentation"
./atlassian/forge-app/audit/marketplace_submission/run_marketplace_gate.sh
```

---

## Marketplace Submission Workflow

Once gate passes (`exit 0`):

1. **Collect Evidence**:
   - Copy evidence directory: `/tmp/forge_marketplace_gate_YYYYMMDD_HHMMSS/`
   - Include FINAL_SUBMISSION_PROOF.md

2. **Prepare Submission Package**:
   - All 8 marketplace trust docs (from `docs/`)
   - Evidence directory (with CHECKSUMS.sha256)
   - SUBMISSION_NOTES.txt (reference this runbook and gate results)

3. **Submit to Atlassian Marketplace**:
   - Upload via Marketplace publisher portal
   - Reference RELEASE_GATE_RUNBOOK.md in submission notes
   - Attach FINAL_SUBMISSION_PROOF.md as proof

4. **Marketplace Reviewer Audit**:
   - Reviewer downloads evidence directory
   - Verifies `sha256sum -c CHECKSUMS.sha256`
   - Confirms all 8 docs present and valid
   - Grants marketplace approval

---

## Related Documentation

- [MARKETPLACE_SUBMISSION_EVIDENCE_INDEX.md](MARKETPLACE_SUBMISSION_EVIDENCE_INDEX.md) — Index of all evidence
- [ADMIN_GUIDE.md](ADMIN_GUIDE.md) — Installation + troubleshooting for customers
- [DATA_HANDLING.md](DATA_HANDLING.md) — Data privacy + retention
- [SECURITY.md](trust/generated/security_overview_mirror.md) — Security model (realistic, no false claims)
- [SUPPORT.md](SUPPORT.md) — Support channels + response time
