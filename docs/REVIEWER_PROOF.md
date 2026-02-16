# Reviewer Gate Proof Semantics (v3.2.7)

## Overview

FirstTry uses split reviewer gates to distinguish between **runtime browser proof** (CI-verified) and **dev-friendly validation** (may fallback to static).

### Key Principle
**Only CI gate execution with real Playwright browser runtime counts as proof for reviewer approval.**

---

## Gate Types

### 1. Reviewer Gate (CI Strict)
**Script**: `ship_reviewer_gate_ci.sh`  
**Environment**: GitHub Actions / CI system  
**Browser Requirement**: MANDATORY (fail-closed, no fallback)  
**Use Case**: Automated reviewer approval workflow

**Success markers**:
- `[FT_PROOF_REVIEWER_GATE_CI_PASS]` - all 10 gates passed, UI runtime executed
- `[FT_PROOF_UI_RUNTIME_PASS]` - Playwright browser launched and tests passed

**Failure markers**:
- `[FT_PROOF_UI_RUNTIME_FAIL_REQUIRED]` - browser launch or tests failed (exit 1)

**Evidence**: `/tmp/ft_reviewer_gate_ci_<UTC>/`  
- `00_meta.txt` - runtime environment info
- `10_gate_log.txt` - full gate output
- `80_playwright_line_report.txt` - test results
- `90_result.txt` - summary

---

### 2. Reviewer Gate (Dev Friendly)
**Script**: `ship_reviewer_gate_dev.sh`  
**Environment**: Local development machine  
**Browser Requirement**: ATTEMPTED (fallback allowed to static)  
**Use Case**: Local pre-commit validation, dev convenience

**Success markers**:
- `[FT_PROOF_REVIEWER_GATE_DEV_PASS]` - all 10 gates passed
  - Includes `[FT_PROOF_UI_RUNTIME_PASS]` if browser executed
  - Includes `[FT_PROOF_UI_RUNTIME_NOT_APPLICABLE_DEV_ENV]` if static verification used
- **IMPORTANT**: Dev markers do NOT count as reviewer proof (local only)

**Fallback behavior**:
- If Playwright runtime fails (missing browser, missing GTK libs, etc.):
  - Attempts static verification (checks for test files, markers, config)
  - If static checks pass: continues gate (dev gate may "pass")
  - If static checks fail: exits 1 (gate fails)
  - Emits `[FT_PROOF_UI_RUNTIME_NOT_APPLICABLE_DEV_ENV]` to indicate fallback

**Evidence**: `/tmp/ft_reviewer_gate_dev_<UTC>/`

---

### 3. Deprecated Gate
**Script**: `ship_reviewer_gate.sh` (v3.2.6 and earlier)  
**Status**: DEPRECATED as of v3.2.7  
**Action**: Will print deprecation warning and exit 1

Use `ship_reviewer_gate_ci.sh` or `ship_reviewer_gate_dev.sh` instead.

---

## How to Use

### For CI (GitHub Actions)
Triggered automatically on push/pull_request:
```bash
bash scripts/proof/ship_reviewer_gate_ci.sh
```
Runs on `ubuntu-latest` with full display server (xvfb) and system deps installed.

**Result**: 
- ✅ Pass: `[FT_PROOF_REVIEWER_GATE_CI_PASS]` - Reviewer can approve
- ❌ Fail: `[FT_PROOF_UI_RUNTIME_FAIL_REQUIRED]` - Reviewer cannot approve

---

### For Local Dev
```bash
bash scripts/proof/ship_reviewer_gate_dev.sh
```

**Result if runtime works**:
- ✅ Pass: `[FT_PROOF_REVIEWER_GATE_DEV_PASS]` + `[FT_PROOF_UI_RUNTIME_PASS]`

**Result if runtime unavailable but static passes**:
- ⚠️ Pass (dev only): `[FT_PROOF_REVIEWER_GATE_DEV_PASS]` + `[FT_PROOF_UI_RUNTIME_NOT_APPLICABLE_DEV_ENV]`
- Note: This does NOT satisfy reviewer approval requirements

**Result if both runtime and static fail**:
- ❌ Fail: Gate exits 1

---

## Runtime Proof Details

### What Makes Runtime Proof
**Script**: `run_pw_reviewer_minimal_runtime.sh`

The script verifies:
1. ✅ npm/npx available
2. ✅ node_modules installed (`npm ci`)
3. ✅ Playwright CLI present
4. ✅ Chromium browser installed with system dependencies (`--with-deps`)
5. ✅ Playwright tests execute in real browser (`playwright test`)
6. ✅ All 3 reviewer_minimal tests pass

**Markers emitted**:
- `[FT_PROOF_PW_RUNTIME_EXECUTING]` - browser launch starting
- `[FT_PROOF_PW_RUNTIME_EXECUTED]` - browser launched
- `[FT_PROOF_PW_RUNTIME_PASS]` - all tests passed
- `[FT_PROOF_PW_RUNTIME_FAIL]` - fail (browser launch or tests failed)

---

## Test Suite

### Playwright Minimal Suite
**File**: `tests/playwright/reviewer_minimal.spec.ts`

**Tests**:
1. **Dashboard loads** - verifies `data-testid="ft-dashboard-root"`
2. **Access reviews tab** - verifies `data-testid="ft-tab-access-reviews"`
3. **Export button** - verifies `data-testid="ft-export-review-pack"` and `ft-export-success`

**Config**: `playwright.reviewer.config.ts`  
**Browser**: Chromium (headless)  
**Timeout**: 30s per test, 120s total  

No Jira authentication required. Tests run against local built bundle.

---

## CI Artifact Access

GitHub Actions workflow produces evidence artifacts (30-day retention):
- **Name**: `reviewer_gate_ci_evidence`
- **Location**: Actions → Workflow → Artifact download

**Contents**:
- Gate logs (full output)
- Playwright report (if HTML report generated)
- Test results (if JUnit XML generated)
- Meta info (node, playwright versions)

---

## Environment Notes

### Development Machine
- May not have system dependencies for Chromium
- Static fallback keeps local validation working
- Dev-mode "pass" does NOT count for reviewer approval
- Commit/push to trigger CI gate for real proof

### CI System (GitHub Actions)
- `ubuntu-latest` includes most system dependencies
- Workflow installs Playwright deps: `playwright install chromium --with-deps`
- Full virtual display available (xvfb)
- Browser execution is guaranteed (fail-closed if unavailable)

---

## No Compliance Claims

This proof mechanism verifies:
- ✅ Reviewer minimal test suite exists
- ✅ UI bundle loads with expected markers
- ✅ Basic tab and export controls render
- ✅ Test execution in real browser

This does NOT verify:
- ❌ Full Jira dashboard functionality
- ❌ Real access review results
- ❌ Production readiness
- ❌ Security or compliance

Our goal: **boringly reliable** proof that UI code works + tests execute.

---

## Questions?

See `docs/CONTACTS.md` for support information.
