# Atlassian Marketplace Readiness Audit System

**Version:** 2.14.0  
**Purpose:** Fail-closed, zero-egress audit system for Atlassian Marketplace submission readiness

---

## Overview

This audit system validates that the repository is ready for Atlassian Marketplace submission with hostile scrutiny from a new vendor perspective. It runs 17 comprehensive validation phases and produces a `PASS` or `FAIL` verdict.

**Exit Codes:**
- `0` = PASS (marketplace ready)
- `1` = FAIL (blocks submission)

---

## Quick Start

### Local Execution

```bash
# Run marketplace readiness audit (STOP ON FIRST FAIL mode - default)
bash tools/marketplace/readiness/run_marketplace_readiness_audit.sh

# View results
LATEST_EVIDENCE=$(ls -td /tmp/ft_marketplace_readiness_* | head -1)
cat "$LATEST_EVIDENCE/FINAL_VERDICT.txt"
cat "$LATEST_EVIDENCE/MARKETPLACE_READINESS_REPORT.md"
```

### FULL Run Mode (Collect All Failures)

By default, the audit stops on the first failure for fast feedback. To collect ALL failures across all phases:

```bash
# Run in FULL mode - continues through all phases, collects all failures
FULL=1 bash tools/marketplace/readiness/run_marketplace_readiness_audit.sh

# View collected failures
LATEST_EVIDENCE=$(ls -td /tmp/ft_marketplace_readiness_* | head -1)
cat "$LATEST_EVIDENCE/FAILURES.txt"
cat "$LATEST_EVIDENCE/MARKETPLACE_READINESS_REPORT.md"
```

**FULL Mode Benefits:**
- Collects all failures in one run (saves time)
- Generates `FAILURES.txt` with all issues found
- Still exits with code 1 if any failures detected
- Useful for comprehensive remediation planning

**Mode Comparison:**
- **Default (FULL=0)**: Strict, fail-fast. Stops immediately on first failure. Best for CI/CD.
- **FULL=1**: Comprehensive. Runs all 17 phases, collects every failure. Best for initial audit or complete gap analysis.

### CI Execution

The audit runs automatically in CI via `.github/workflows/marketplace-readiness.yml`:
- Triggered on push to `main` or `release/*` branches
- Triggered on pull requests to `main`
- Triggered manually via workflow_dispatch

---

## 17 Audit Phases

### Phase 01: Repository Integrity
- Validates git repository status
- Checks working tree cleanliness (unless `ALLOW_DIRTY=1`)
- Verifies required directories: `atlassian/forge-app`
- Checks `package-lock.json` presence

### Phase 02: Manifest and Modules
- Locates and validates `manifest.yml`
- Checks YAML structure (no tabs)
- Validates app ID, modules, permissions

### Phase 03: Scopes and Justification
- Extracts scopes from manifest
- Validates `MARKETPLACE_SCOPE_JUSTIFICATION.md` (>=1200 bytes)
- Checks scope coverage and write scope mitigations

### Phase 04: Security Boundaries / Zero Egress
- Scans for external URLs in production code
- Checks HTTP client usage
- Validates `requestJira` calls (no POST/PUT/PATCH/DELETE)
- Enforces zero-egress policy

### Phase 05: Storage and Data Flow
- Scans for Forge storage API usage
- Validates `MARKETPLACE_DATA_FLOW.md` (>=1500 bytes)
- Checks consistency between code and docs

### Phase 06: Uninstall and Data Deletion
- Validates `MARKETPLACE_DATA_RETENTION_DELETION.md` (>=1200 bytes)
- Checks uninstall procedures
- Verifies customer deletion request procedures

### Phase 07: Logging and PII
- Fails if `console.log` found in production code
- Checks for risky logging patterns (request bodies, auth headers)

### Phase 08: Runtime Safety / Disallowed APIs
- Checks for disallowed APIs: `child_process`, `eval`, `vm`, `fs` write, `net`/`tls`/`dgram`
- Validates `process.env` usage

### Phase 09: Dependencies Security
- Runs `npm ci` and `npm audit`
- Fails on HIGH/CRITICAL vulnerabilities
- Lists production dependencies

### Phase 10: Build and Tests
- Executes `npm run build`
- Checks for build warnings (with allowlist support)
- Runs `npm test` or `npm run test:ci`

### Phase 11: CI Integrity
- Validates `.github/workflows/marketplace-readiness.yml` exists
- Checks for risky CI settings (continue-on-error, skip patterns)
- Verifies workflow includes build/test

### Phase 12: Documentation and Listing Artifacts
- Validates all 9+ required marketplace docs (400-1500 bytes each)
- Checks Privacy Policy sections
- Validates Support SLA with response times
- Verifies Requirements Matrix

### Phase 13: Versioning and Changelog
- Validates version consistency between `package.json` and `CHANGELOG.md`
- Ensures no TBD/TODO in latest changelog entry

### Phase 14: License and EULA
- Validates `LICENSE` file exists (>=200 bytes)
- Checks consistency with `package.json` license field
- Ensures Terms of Service acts as EULA

### Phase 15: Feature Claims / No Overreach
- Scans for banned claims (SOC2, ISO certified, guaranteed, 100% secure)
- Fails if unprovable claims found
- Validates conservative language usage

### Phase 16: Assets (Screenshots/Pricing)
- Validates `docs/marketplace/screenshots` exists with >=3 images (>30KB each)
- Validates `docs/marketplace/pricing.json` structure

### Phase 17: Reviewer Simulation Checklist
- Validates consistency across all marketplace docs
- Checks description length (>50 chars)
- Verifies uninstall procedures documented

---

## Policies Enforced

### Fail-Closed
- Any failure blocks marketplace submission
- Exit code 1 on any phase failure
- No partial passes accepted

### Zero-Egress
- No external HTTP calls allowed
- No third-party API integrations
- All processing within Forge

### Read-Only Jira Default
- No POST/PUT/PATCH/DELETE to Jira APIs (unless explicitly required and justified)
- Write scopes must be documented and mitigated

### Security Hardening
- No `console.log` in production
- No disallowed APIs (`child_process`, `eval`, etc.)
- No HIGH/CRITICAL npm vulnerabilities

---

## Evidence Directory

Every audit run creates a timestamped evidence directory:

```
/tmp/ft_marketplace_readiness_YYYYMMDDTHHMMSSZon/
├── FINAL_VERDICT.txt
├── MARKETPLACE_READINESS_REPORT.md
├── PHASE_01_repo_integrity/
│   ├── git_status.txt
│   ├── tree_structure.txt
│   └── ...
├── PHASE_02_manifest/
├── PHASE_03_scopes/
├── ...
└── PHASE_17_reviewer/
```

**Evidence Files:**
- `FINAL_VERDICT.txt` - PASS or FAIL with reason
- `MARKETPLACE_READINESS_REPORT.md` - Full audit report
- `PHASE_XX_*/` - Per-phase evidence directories

---

## Configuration

### Environment Variables

- `ALLOW_DIRTY=1` - Allow uncommitted changes (local development only)
- `CI=true` - CI mode (strict checks)

### Allowlist Files

- `ALLOWLIST_URL_PATHS.txt` - Allowed URL patterns (documentation only)
- `ALLOWLIST_BUILD_WARNINGS.txt` - Acceptable build warnings
- `BANNED_CLAIMS.txt` - Prohibited marketing claims

---

## Required Documentation

All documentation must exist in `docs/marketplace/`:

| Document | Min Size | Purpose |
|----------|----------|---------|
| MARKETPLACE_PRIVACY_POLICY.md | 400 bytes | Privacy policy |
| MARKETPLACE_TERMS_OF_SERVICE.md | 400 bytes | Terms and EULA |
| MARKETPLACE_SUPPORT_SLA.md | 400 bytes | Support SLA |
| MARKETPLACE_DATA_FLOW.md | 1500 bytes | Data flow documentation |
| MARKETPLACE_SCOPE_JUSTIFICATION.md | 1200 bytes | Scope justifications |
| MARKETPLACE_DATA_RETENTION_DELETION.md | 1200 bytes | Data retention policy |
| MARKETPLACE_SUBPROCESSORS.md | 400 bytes | Subprocessor list |
| MARKETPLACE_SECURITY_CONTACT.md | 400 bytes | Security contact info |
| MARKETPLACE_INCIDENT_RESPONSE.md | 400 bytes | Incident response plan |
| MARKETPLACE_RESPONSIBLE_DISCLOSURE.md | 400 bytes | Disclosure policy |
| MARKETPLACE_REVIEWER_FAQ.md | 400 bytes | Reviewer FAQ |
| MARKETPLACE_REQUIREMENTS_MATRIX.md | 400 bytes | Requirements matrix |
| pricing.json | 50 bytes | Pricing model |
| screenshots/ | 3+ images | Screenshots (>30KB each) |

---

## Troubleshooting

### Audit Fails on Phase XX

1. Check evidence directory: `/tmp/ft_marketplace_readiness_[timestamp]/PHASE_XX/`
2. Review phase-specific logs and error messages
3. Fix identified issues
4. Re-run audit

### Console.log Errors (Phase 07)

Remove all `console.log` statements from production code:
```bash
# Find console.log instances
grep -rn "console\.log" atlassian/forge-app/src/
```

### npm Audit Failures (Phase 09)

Update vulnerable dependencies:
```bash
cd atlassian/forge-app
npm audit fix
npm audit  # Verify no HIGH/CRITICAL remain
```

### Build Warnings (Phase 10)

Either:
1. Fix the warnings, or
2. Add acceptable warnings to `ALLOWLIST_BUILD_WARNINGS.txt`

### Missing Documentation (Phase 12)

Create missing documents:
```bash
# All templates exist in docs/marketplace/
# Ensure minimum size requirements met
```

---

## Capture Marketplace Screenshots (Phase 16)

Phase 16 requires **3 real screenshots** of the running Forge app (`>=30 KB` each, valid PNG signatures). This section is the complete runbook.

### Step 1 — Install Forge CLI (if missing)

```bash
# Check if installed
forge --version || echo "NOT INSTALLED"

# Install if missing
npm install -g @forge/cli

# Verify
forge --version
```

### Step 2 — Start Forge Tunnel

```bash
cd atlassian/forge-app
forge tunnel
```

The tunnel will print a URL like:

```
Tunnel URL: https://abc123xyz.tunnel.dev.atlassian.io
```

**Keep this terminal open.** The tunnel must stay running while you capture.

### Step 3 — Export the Exact Tunnel URL

Copy the **exact** URL printed by `forge tunnel` — no angle brackets, no placeholders:

```bash
# ✓ CORRECT — use the real URL printed by forge tunnel
export FORGE_TUNNEL_URL='https://abc123xyz.tunnel.dev.atlassian.io'

# ✗ WRONG — these will be rejected by the capture script
export FORGE_TUNNEL_URL='https://<tunnel-host>'         # rejected: contains '<'
export FORGE_TUNNEL_URL='https://your-tunnel-id.atlassian.io'  # rejected: template
```

### Step 4 — Run Screenshot Capture

In a **new terminal** (keep the tunnel terminal open):

```bash
cd /workspaces/Firsttry
bash tools/marketplace/readiness/capture_marketplace_screenshots.sh
```

The script will:
1. Validate the tunnel URL (rejects placeholders and malformed URLs)
2. Run `npm ci` in `atlassian/forge-app`
3. Install Playwright Chromium (unless `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`)
4. Navigate the app and save 3 screenshots to `docs/marketplace/screenshots/`
5. Validate PNG signature + size of each file

Successful output ends with:
```
[OK] All 3 marketplace screenshots captured and validated.
```

### Quick Iteration Verify (Development / Dirty Working Tree)

During active development, use `ALLOW_DIRTY=1 FULL=1` to run all 17 phases without blocking on uncommitted changes:

```bash
ALLOW_DIRTY=1 FULL=1 bash tools/marketplace/readiness/run_marketplace_readiness_audit.sh || true
LATEST="$(ls -dt /tmp/ft_marketplace_readiness_* | head -1)"
cat "$LATEST/FAILURES.txt"
```

> **Note:** `ALLOW_DIRTY=1` is for local iteration only. For final submission, commit all changes and run **without** `ALLOW_DIRTY`:
> ```bash
> bash tools/marketplace/readiness/run_marketplace_readiness_audit.sh
> ```

### Step 5 — Run Final Audit

```bash
cd /workspaces/Firsttry
bash tools/marketplace/readiness/run_marketplace_readiness_audit.sh
LATEST="$(ls -dt /tmp/ft_marketplace_readiness_* | head -1)"
cat "$LATEST/FINAL_VERDICT.txt"
test -f "$LATEST/FAILURES.txt" && cat "$LATEST/FAILURES.txt" || echo "(no failures)"
```

`FINAL_VERDICT.txt` must read `PASS` with no `FAILURES.txt` for marketplace submission.

---

## Helper Functions (00_common.sh)

Common library for all phases:

- `die(msg)` - Fail audit with message
- `ok(msg)` - Success message
- `info(msg)` - Informational message
- `warn(msg)` - Warning message
- `require_file(path, min_bytes)` - Validate file exists with minimum size
- `require_dir(path)` - Validate directory exists
- `sha256_file(path)` - Compute file hash
- `redact_secrets(text)` - Sanitize sensitive data
- `write_section(report, title)` - Format report sections
- `command_exists(cmd)` - Check if command is available
- `count_matches(pattern, file)` - Count regex matches in file

---

## CI Integration

### GitHub Actions Workflow

File: `.github/workflows/marketplace-readiness.yml`

**Triggers:**
- Push to `main` or `release/*` branches
- Pull requests to `main`
- Manual workflow dispatch

**Jobs:**
1. Checkout repository
2. Setup Node.js
3. Install dependencies (`npm ci`)
4. Run marketplace readiness audit
5. Display verdict and report summary
6. Upload evidence artifacts
7. Check audit result (exit 0 only if PASS)

**Artifacts:**
- Evidence directory uploaded for 30 days
- Accessible from Actions tab

---

## Development Workflow

### Before Committing

```bash
# 1. Ensure code compiles
npm run build

# 2. Run tests
npm test

# 3. Check for console.log
grep -rn "console\.log" src/

# 4. Update dependencies
npm audit fix

# 5. Run marketplace audit (local)
bash tools/marketplace/readiness/run_marketplace_readiness_audit.sh
```

### Before Marketplace Submission

```bash
# 1. Verify all documentation complete
ls -lh docs/marketplace/

# 2. Replace placeholder screenshots with real ones
open docs/marketplace/screenshots/

# 3. Update pricing.json with actual pricing
vi docs/marketplace/pricing.json

# 4. Run full audit (strict mode)
ALLOW_DIRTY=0 bash tools/marketplace/readiness/run_marketplace_readiness_audit.sh

# 5. Verify PASS
cat /tmp/ft_marketplace_readiness_*/FINAL_VERDICT.txt
```

---

## Maintenance

### Updating Audit System

1. Modify phase scripts in `tools/marketplace/readiness/lib/`
2. Update `00_common.sh` if adding helper functions
3. Update this README if adding new phases
4. Test locally before committing
5. Verify CI workflow still passes

### Adding New Phases

1. Create `XX_check_description.sh` in `lib/`
2. Source `00_common.sh`
3. Implement validation logic with `die()` on failure
4. Write results to `$EVIDENCE_DIR/PHASE_XX_name/`
5. Add phase to `PHASES` array in `run_marketplace_readiness_audit.sh`
6. Update this README

---

## Support

**Questions:** support@firsttry.run  
**Security:** security.contact@firsttry.run  
**Documentation:** docs/marketplace/

---

## Version History

- **1.0** (2024-01-01) - Initial implementation
  - 17-phase validation system
  - Comprehensive documentation templates
  - CI integration
  - Fail-closed enforcement

---

**This audit system ensures Atlassian Marketplace submission readiness with confidence.**
