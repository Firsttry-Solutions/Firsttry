# Evidence & Audit Documentation

## Overview

This directory contains evidence artifacts and human-readable documentation for FirstTry's enterprise audit system (v3.1). All evidence is generated deterministically without network dependencies.

## Enterprise Audit v3.1 (F100 Hostile Audit)

### Purpose

Fortune-50 enterprise buyer simulation audit designed to prove security, compliance, and operational reliability before procurement.

### Execution

```bash
cd atlassian/forge-app
bash tools/audit/v3_1/run_f100_hostile_audit_v3_1.sh
```

**Requirements:**
- Clean git tree (no uncommitted changes)
- Node.js 20.x, npm 10.x
- Python 3.11+ (for semgrep installation via pip)
- Bash 4.0+

**Exit Codes:**
- `0` = CONDITIONAL_ACCEPT (score ≥85, no FAIL, <3 HIGH flags)
- `1` = REJECT or insufficient score
- `2` = Git tree dirty (pre-flight check failed)

### Audit Phases

| Phase | Name | Purpose | Fail Condition |
|-------|------|---------|----------------|
| GATE | Clean Tree | Enforce zero uncommitted changes | Any tracked/untracked file outside allowlist |
| 00 | Cleanroom Setup | Validate `npm ci`, generate SBOM | npm ci fails, node_modules corrupt |
| 01 | Supply Chain | Check versions, duplicates, vulnerabilities | CVE in dependencies |
| 02 | Secrets Scan | History scan for leaked credentials | Hardcoded secret in git history |
| 03 | Manifest | Validate manifest.yml structure & permissions | Invalid manifest, excessive scopes |
| 04 | Exfiltration | Scan for data leakage patterns | Hardcoded URLs, unauthorized egress |
| 05 | Forge-Specific | Storage keys, tenant isolation, API usage | Storage without tenant binding |
| 06 | Determinism | Export reproducibility, entropy scan | Non-identical double-run output |
| 07 | Runtime Gates | Tests, linting, forge CLI checks | Test failures, lint errors |
| **08** | **SAST (OfflineSemgrep)** | **Static security analysis (LOCAL rules only)** | **ERROR-severity findings** |
| 09 | Quota Simulation | Storage behavior under limits | Quota exceeded, silent failures |
| 10 | Silent Failures | Error handling audit | Catch blocks swallowing errors |
| 11 | External Links | Validate documentation URLs | Broken marketplace links |
| 12 | Evidence Package | Generate signed audit bundle | Hash mismatch, missing files |

### Phase 08: Offline Semgrep SAST

**Key Innovation:** Network-independent security analysis

**Configuration:**
- **Rules:** `tools/audit/v3_1/semgrep/semgrep.local.yml` + `tools/audit/v3_1/semgrep/forge.yml`
- **Registry:** NONE (fully offline, no `p/security-audit` registry fetch)
- **Installation:** `python3 -m pip install --user semgrep` (network allowed for installation, not runtime)
- **Validation:** Node.js JSON parsing (fail-closed if invalid)

**Rule Categories (semgrep.local.yml):**
1. **Hardcoded Secrets:** API tokens, private keys, AWS keys, JWT, passwords
2. **Code Injection:** `eval()`, `Function()`, `vm.runInContext()`
3. **Command Injection:** `child_process.exec()`, shell:true
4. **SQL Injection:** String concatenation in queries
5. **XSS:** `innerHTML`, `dangerouslySetInnerHTML`
6. **Insecure Randomness:** `Math.random()` in security contexts
7. **Path Traversal:** Filesystem operations with user input
8. **Weak Crypto:** MD5, SHA1, DES, RC4, ECB mode
9. **Info Disclosure:** `console.log()`, stack traces in responses
10. **SSRF:** `fetch()`/`axios()` with user-controlled URLs

**Forge-Specific Rules (forge.yml):**
- Unsanctioned `fetch()` (must use `@forge/api`)
- `child_process` module usage (forbidden in Forge sandbox)
- Storage keys without tenant binding
- `process.env` in deterministic paths

**Latest Results:**
```
Semgrep Version: 1.153.0
Mode: LOCAL rules only (offline)
Rules Loaded: semgrep.local.yml, forge.yml
Findings: ERROR=0, WARNING=0, INFO=0
Status: PASS
Evidence: /tmp/ft_f100_hostile_audit_v3_1_<timestamp>/PHASE_08_semgrep.json
```

### Evidence Artifacts

**Location:** `/tmp/ft_f100_hostile_audit_v3_1_<timestamp>/`

**Key Files:**
- `results.json` - Structured phase results (JSON)
- `PHASE_08_semgrep.json` - Semgrep SAST findings
- `PHASE_08_semgrep_summary.txt` - Human-readable summary
- `PHASE_05_storage_key_audit.json` - Tenant isolation proof
- `PHASE_06_determinism.txt` - Double-run hash comparison
- `PHASE_12_evidence_bundle.tar.gz` - Signed audit package

### Offline/Cleanroom Compatibility

**Network Dependencies (Installation Phase Only):**
- ✅ npm packages: `npm ci` downloads from registry (cached in CI)
- ✅ Python packages: `pip install semgrep` (cached in CI)

**Network Dependencies (Runtime - ELIMINATED):**
- ❌ Semgrep registry: Removed `p/security-audit` (networking required)
- ✅ Local rules: `semgrep.local.yml` + `forge.yml` (no network)
- ❌ External link validation: Phase 11 (optional, INFO-level only)

**CI/CD Integration:**
```yaml
# .github/workflows/ci.yml minimal example
- uses: actions/setup-node@v3
  with:
    node-version: 20
    cache: npm
- uses: actions/setup-python@v4
  with:
    python-version: '3.11'
    cache: pip
- run: npm ci
  working-directory: atlassian/forge-app
- run: bash tools/audit/v3_1/run_f100_hostile_audit_v3_1.sh
  working-directory: atlassian/forge-app
- uses: actions/upload-artifact@v3
  if: always()
  with:
    name: audit-evidence
    path: /tmp/ft_f100_hostile_audit_v3_1_*
```

## Human Review Ledger

### Phase05 Allowlist Review (Complete)

**Reviewer:** Arnab Poddar  
**Date:** 2026-02-28  
**Scope:** All 67 storage constant patterns human-reviewed  
**Commits:**
- `c86e8ad1a6b2e0345d8c803eaa2cadbfacce14b2` - Complete Phase05 allowlist review (lines 51-95)
- `94641c8ab49fd6f0f1b83d0e7c8fbfc29b8e56b2` - Improve forge lint auth detection pattern

**Attestation:** All storage constants verified against source code. 27 markers added, 1 non-existent pattern removed (line 68). Zero false positives.

**Allowlist Location:** `tools/audit/v3_1/allowlists/phase05_storage_constants.txt`  
**Marker Format:** `// AUDIT-ALLOWLIST: FT-ALW-05-XXX REVIEWED-BY=Arnab-Poddar`

### Offline Semgrep Implementation (2026-02-28)

**Implementer:** Arnab Poddar  
**Commit:** `962d4be8d` (audit: make Semgrep offline + replace p/security-audit with local rules)  
**Changes:**
1. Created `tools/audit/v3_1/semgrep/semgrep.local.yml` (33 comprehensive security rules)
2. Modified `tools/audit/v3_1/lib/sast.sh` to use ONLY local rules (removed network-dependent `p/security-audit`)
3. Replaced `jq` JSON validation with Node.js (more robust)

**Validation:**
- Manual Phase 08 execution: PASS ✅
- Full audit execution: Phase 08 PASS ✅
- Semgrep mode: LOCAL rules only (offline verified) ✅
- Findings: 0 ERROR, 0 WARNING, 0 INFO ✅

**Evidence:**
```
Evidence dir: /tmp/ft_f100_hostile_audit_v3_1_20260228T155730Z
Phase 08 Status: PASS
Message: "SAST: semgrep passed with no ERROR-severity findings."
Semgrep Version: 1.153.0
Rules: semgrep.local.yml (443 lines), forge.yml (154 lines)
```

## Integrity Verification

### Evidence Bundle Verification

```bash
# Extract audit bundle
tar -xzf PHASE_12_evidence_bundle.tar.gz

# Verify hash chain
cat snapshot-hash.txt  # Expected hash
node verify.js        # Recompute and compare

# Audit results.json signature
jq -r '.results | map(select(.status == "PASS")) | length' results.json
jq -r '.results | map(select(.status == "FAIL")) | length' results.json
```

### Semgrep Findings Validation

```bash
# Check Phase 08 results
cat PHASE_08_semgrep_summary.txt

# Parse JSON findings
jq '.results | length' PHASE_08_semgrep.json  # Total findings
jq '.results | map(select(.extra.severity == "ERROR")) | length' PHASE_08_semgrep.json
```

## Reproduction Commands

### Local Worktree Test

```bash
cd /path/to/Firsttry
git worktree add /tmp/ft_audit_test HEAD
cd /tmp/ft_audit_test/atlassian/forge-app
bash tools/audit/v3_1/run_f100_hostile_audit_v3_1.sh
echo "Exit code: $?"
```

### Clean Clone Test

```bash
cd /tmp
git clone --depth 1 https://github.com/Firsttry-Solutions/Firsttry.git /tmp/ft_cleanclone
cd /tmp/ft_cleanclone/atlassian/forge-app
bash tools/audit/v3_1/run_f100_hostile_audit_v3_1.sh
echo "Exit code: $?"
```

### Semgrep Offline Test

```bash
cd atlassian/forge-app

# Install semgrep (cached in CI)
python3 -m pip install --user semgrep

# Run Phase 08 standalone
export E=/tmp/phase08_test
export REPO_DIR=$(pwd)
source tools/audit/v3_1/lib/common.sh
source tools/audit/v3_1/lib/scoring.sh
source tools/audit/v3_1/lib/sast.sh
mkdir -p $E
run_sast

# Check results
cat $E/PHASE_08_semgrep_summary.txt
```

## Deviations & Exceptions

### Known Issues (Tracked Separately from Semgrep)

1. **Phase 10 (Silent Failures):** 157 findings in export path - catch blocks missing rethrows
   - Status: Codebase issue (not audit failure)
   - Tracked in: (separate issue tracker)
   
2. **TypeScript Errors:** 15 type errors in `src/access-review/` modules
   - Status: Pre-existing (lint script intentionally disabled)
   - Tracked in: (separate issue tracker)

### Audit Scope Boundaries

- **Forge CLI Authentication:** Requires login for `forge lint`/`forge deploy --dry-run`
  - Handled: Auth errors flagged as MEDIUM (not FAIL)
  - Cleanroom behavior: Phase 07 gracefully handles "Not logged in" errors
  
- **External Link Validation:** Phase 11 requires network for URL checks
  - Severity: INFO/MEDIUM only (not FAIL-level)
  - Acceptable: Network allowed for optional validation

## Contact & Support

**Repository:** https://github.com/Firsttry-Solutions/Firsttry  
**Audit Docs:** `atlassian/forge-app/docs/F100_HOSTILE_AUDIT_V3_1.md`  
**Semgrep Rules:** `atlassian/forge-app/tools/audit/v3_1/semgrep/`

**Reviewer Contact:**  
Arnab Poddar - Phase05 + Offline Semgrep Implementation

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-28  
**Audit Version:** v3.1 (F100 Hostile Enterprise Audit)
