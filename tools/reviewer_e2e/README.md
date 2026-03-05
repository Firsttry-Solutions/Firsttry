# Reviewer End-to-End Simulation System

## Overview

This directory contains fail-closed tooling for simulating Atlassian Marketplace reviewer workflows, including:

1. **Documentation Overclaim Auditing** - Scans all documentation for unverifiable claims
2. **Jira Dashboard Testing with Authentication** - Tests gadget rendering inside real Jira dashboards
3. **End-to-End Evidence Collection** - Deploys, runs tunnel, captures videos/traces/screenshots
4. **Evidence Bundle Generation** - Creates timestamped, checksummed evidence packages

## Prerequisites

All commands must be available on PATH:
- `node` (v20+)
- `npm`
- `npx`
- `forge` (Atlassian Forge CLI)
- `git`
- `sha256sum` or `shasum`

You must be authenticated with Forge:
```bash
forge whoami
```

Required environment variables:
```bash
export JIRA_BASE_URL="https://your-company.atlassian.net"
export JIRA_DASHBOARD_URL="https://your-company.atlassian.net/jira/dashboards/10001"
```

## Scripts

### 0. create_storage_state.sh

**NEW**: Creates authenticated Jira session for Playwright tests.

**Usage:**
```bash
cd /workspaces/Firsttry
export JIRA_BASE_URL="https://your-company.atlassian.net"
bash tools/reviewer_e2e/create_storage_state.sh
```

**Workflow:**
1. Opens headed Chromium browser
2. Navigates to your Jira instance
3. Waits for you to log in manually (3 minute timeout)
4. Detects successful login via DOM selectors
5. Saves authenticated session to `storageState.json`

**Output:**
- `atlassian/forge-app/tests/playwright/.auth/storageState.json`

**Run this ONCE** before first E2E test, or whenever Jira session expires.

### 1. doc_overclaim_audit.sh

Scans all Markdown documentation for overclaims and unverifiable statements.

**Usage:**
```bash
bash tools/reviewer_e2e/doc_overclaim_audit.sh <EVIDENCE_DIR>
```

**Checks for:**
- Certification overclaims (SOC 2, ISO 27001, HIPAA, etc.)
- Absolute guarantees (100%, guaranteed, zero risk, etc.)
- Data handling absolutes (no data collected, stores nothing, etc.)
- Unverified external validations

**Outputs:**
- `EVIDENCE_DIR/docs_overclaim/scan_targets.txt` - All files scanned
- `EVIDENCE_DIR/docs_overclaim/findings.txt` - Violations found (file:line:context)
- `EVIDENCE_DIR/docs_overclaim/verdict.txt` - PASS or FAIL

**Allowlist:**
Create `tools/reviewer_e2e/OVERCLAIM_ALLOWLIST.txt` with regex patterns to ignore (one per line).

### 2. run_reviewer_e2e_strict.sh

Orchestrates the full end-to-end reviewer simulation with Jira dashboard testing.

**Prerequisites:**
- `JIRA_BASE_URL` environment variable set
- `JIRA_DASHBOARD_URL` environment variable set  
- `storageState.json` created (run `create_storage_state.sh` first)

**Usage:**
```bash
cd /workspaces/Firsttry
export JIRA_BASE_URL="https://your-company.atlassian.net"
export JIRA_DASHBOARD_URL="https://your-company.atlassian.net/jira/dashboards/10001"
bash tools/reviewer_e2e/run_reviewer_e2e_strict.sh

# Allow dirty working tree (not recommended):
ALLOW_DIRTY=1 bash tools/reviewer_e2e/run_reviewer_e2e_strict.sh
```

**Phases:**
1. **Documentation Overclaim Audit** - Fails if any overclaims detected
2. **Deploy to Development** - `forge deploy -e development`
3. **Start Forge Tunnel** - Captures tunnel URL for gadget backend
4. **Capture Forge Logs** - Tails logs during test execution
5. **Playwright E2E Test** - Navigates to real Jira dashboard, verifies gadget renders
6. **Copy Test Artifacts** - Includes videos, traces, screenshots in evidence
7. **Write Final Verdict** - PASS/FAIL with evidence paths
8. **Create Evidence Bundle** - Tar + checksums (validated >1MB)

**Outputs:**
- Evidence directory: `/tmp/ft_reviewer_e2e_YYYYMMDDTHHMMSSZ/`
- Tarball: `/tmp/ft_reviewer_e2e_YYYYMMDDTHHMMSSZ.tar.gz`
- Checksum: `/tmp/ft_reviewer_e2e_YYYYMMDDTHHMMSSZ.tar.gz.sha256`

**Environment Variables:**
- `ALLOW_DIRTY=1` - Skip git working tree clean check
- `SKIP_DEPLOY=1` - Skip forge deploy (use existing deployment)
- `TUNNEL_TIMEOUT=120` - Seconds to wait for tunnel URL (default: 120)

### 3. verify_reviewer_e2e_bundle.sh

Verifies the integrity and completeness of an evidence bundle.

**Usage:**
```bash
bash tools/reviewer_e2e/verify_reviewer_e2e_bundle.sh <bundle.tar.gz> <bundle.tar.gz.sha256>
```

**Verifies:**
- Checksum matches
- Required files exist (FINAL_VERDICT.txt, screenshots, logs, etc.)
- FINAL_VERDICT.txt contains PASS
- Documentation overclaim verdict is PASS
- All 5 screenshots exist and are >= 30 KB
- Console and page error logs are empty
- Tunnel URL was captured

**Exit Codes:**
- `0` - Verification passed
- `1` - Verification failed (with detailed error message)

## Playwright Test Suite

### Configuration: `atlassian/forge-app/playwright.reviewer.config.ts`

Reviewer-specific Playwright configuration:
- Browser: Chromium only
- Viewport: 1440x900 (fixed)
- Retries: 0 (deterministic failures)
- Timeout: 120s per test (dashboard navigation + gadget loading)
- Traces: Always on
- Video: Always on
- Authentication: Uses `storageState.json` (Jira session cookies)
- Base URL: `JIRA_BASE_URL` from environment

### Test: `atlassian/forge-app/tests/playwright/reviewer_dashboard_e2e.spec.ts`

**HARD PROOF Test Flow:**
1. Navigate to `JIRA_DASHBOARD_URL` with authenticated session
2. Wait for dashboard UI to load (detect dashboard heading/layout)
3. Find gadget iframe (Forge apps render in iframes)
4. Switch to iframe context
5. Verify gadget UI root element exists (data-testid or body content)
6. Capture 5 high-quality screenshots (MUST be >= 30 KB each)
7. Copy screenshots to `docs/marketplace/screenshots/` for marketplace submission
8. Collect console logs and errors
9. **FAIL immediately** on any console errors or page errors
10. Write summary JSON with all metrics

**Screenshots Captured:**
- `reviewer_01_dashboard.png` - Jira dashboard loaded
- `reviewer_02_gadget_visible.png` - Gadget visible in dashboard
- `reviewer_03_gadget_scrolled.png` - Gadget interaction/scroll
- `reviewer_04_about_or_panel.png` - About/info panel (if available)
- `reviewer_05_final.png` - Final state

All screenshots are validated:
- PNG format (magic bytes checked)
- Size >= 30 KB (real browser screenshots, not error pages)
- Copied to marketplace documentation directory

## NPM Scripts

```bash
# From atlassian/forge-app directory:
npm run reviewer:e2e
```

## Evidence Bundle Structure

```
ft_reviewer_e2e_20260304T123456Z/
├── FINAL_VERDICT.txt                    # Overall PASS/FAIL
├── PACKHASH.sha256                      # Checksum of all evidence files
├── docs_overclaim/
│   ├── scan_targets.txt
│   ├── findings.txt
│   └── verdict.txt
├── 01_deploy/
│   └── deploy.log
├── 02_tunnel/
│   ├── tunnel.log
│   └── tunnel_url.txt
├── 03_forge_logs/
│   └── forge_logs.txt
└── 04_playwright/
    ├── console.log                      # All console messages
    ├── console_errors.log               # Console errors only (MUST be empty)
    ├── page_errors.log                  # Page errors only (MUST be empty)
    ├── playwright.log                   # Test execution log
    ├── summary.json                     # Test metrics
    ├── screenshots/
    │   ├── reviewer_01_dashboard.png    # >= 30 KB
    │   ├── reviewer_02_gadget_visible.png
    │   ├── reviewer_03_gadget_scrolled.png
    │   ├── reviewer_04_about_or_panel.png
    │   └── reviewer_05_final.png
    └── test-results/                    # Playwright test artifacts
        ├── *.webm                       # Video recordings
        └── *.zip                        # Trace files
```

**Bundle Size:** Must be > 1 MB (videos + traces + screenshots = substantial evidence)

## Typical Workflow

### 1. First-time setup:
```bash
cd /workspaces/Firsttry/atlassian/forge-app
npm install  # Ensure Playwright is installed

# Set Jira environment variables (add to ~/.bashrc for persistence)
export JIRA_BASE_URL="https://your-company.atlassian.net"
export JIRA_DASHBOARD_URL="https://your-company.atlassian.net/jira/dashboards/10001"
```

### 2. Create authenticated Jira session (once, or when session expires):
```bash
cd /workspaces/Firsttry
bash tools/reviewer_e2e/create_storage_state.sh
# Browser opens → log in manually → session saved
```

### 3. Run full E2E simulation:
```bash
cd /workspaces/Firsttry
bash tools/reviewer_e2e/run_reviewer_e2e_strict.sh
```

### 4. Verify evidence bundle:
```bash
bash tools/reviewer_e2e/verify_reviewer_e2e_bundle.sh \
  /tmp/ft_reviewer_e2e_20260304T123456Z.tar.gz \
  /tmp/ft_reviewer_e2e_20260304T123456Z.tar.gz.sha256
```

### 5. Review evidence:
```bash
cd /tmp/ft_reviewer_e2e_20260304T123456Z
cat FINAL_VERDICT.txt
cat docs_overclaim/verdict.txt
cat 04_playwright/summary.json
open 04_playwright/screenshots/reviewer_01_dashboard.png
npx playwright show-trace 04_playwright/test-results/**/*.zip
```

## Troubleshooting

### Missing Jira environment variables:
```bash
export JIRA_BASE_URL="https://your-company.atlassian.net"
export JIRA_DASHBOARD_URL="https://your-company.atlassian.net/jira/dashboards/10001"
```

### storageState.json missing or expired:
```bash
# Re-authenticate (opens browser for manual login)
bash tools/reviewer_e2e/create_storage_state.sh
```

### forge tunnel not connecting:
- Ensure development environment exists: `forge environments list`
- Check authentication: `forge whoami`
- Increase timeout: `TUNNEL_TIMEOUT=300 bash tools/reviewer_e2e/run_reviewer_e2e_strict.sh`

### Gadget not rendering in Jira dashboard:
- Verify gadget is added to dashboard (open `JIRA_DASHBOARD_URL` in browser)
- Check Forge app is installed: `forge install --upgrade`
- Review iframe detection in test logs
- Check tunnel logs: `cat EVIDENCE_DIR/02_tunnel/tunnel.log`

### Playwright tests failing:
- Check console errors: `cat EVIDENCE_DIR/04_playwright/console_errors.log`
- Check page errors: `cat EVIDENCE_DIR/04_playwright/page_errors.log`
- View video: `EVIDENCE_DIR/04_playwright/test-results/**/*.webm`
- Open trace: `npx playwright show-trace EVIDENCE_DIR/04_playwright/test-results/**/*.zip`
- Run in headed mode: `HEADED=1 bash tools/reviewer_e2e/run_reviewer_e2e_strict.sh`

### Documentation overclaim failures:
- Review findings: `cat EVIDENCE_DIR/docs_overclaim/findings.txt`
- Add allowlist entry if false positive: `echo "pattern" >> tools/reviewer_e2e/OVERCLAIM_ALLOWLIST.txt`

## Fail-Closed Design

All checks are **fail-closed**:
- Missing prerequisites (JIRA_BASE_URL, storageState.json) → FAIL with explicit instructions
- Documentation overclaims → FAIL with file:line:context
- Forge tunnel failure → FAIL with timeout message
- Gadget not found in dashboard → FAIL with iframe diagnostic dump
- Gadget UI root not rendered → FAIL with content length check
- Console errors during test → FAIL with error log excerpt
- Page errors during test → FAIL with stack trace
- Screenshot validation failure → FAIL if any < 30 KB
- Bundle too small (< 1 MB) → FAIL (missing videos/traces)
- Any unexpected condition → FAIL (no silent skips)

## Determinism Guarantees

- Timestamped evidence directories (UTC)
- Reproducible checksums (stable file order)
- Fixed viewport/browser for consistent screenshots
- Zero retries for deterministic fail behavior
- All artifacts preserved for forensic analysis
