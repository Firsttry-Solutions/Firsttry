# Phase 6 Acceptance Tests: State-First Mode + Fail-Fast Bot-Guard Detection

**Objective:** Verify that the auth.setup.ts now implements:
1. State-first mode (default): Skip interactive login if valid cached state exists
2. State-only mode: Fail immediately if no valid state
3. Interactive mode: Proceed with login attempt
4. Fail-fast window: Detect bot-guard/MFA within 25s (default), don't wait 120s

## Test Environment Setup

Before running tests:
```bash
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export JIRA_EMAIL="<test-email>" 
export JIRA_PASSWORD="<test-password>"
export OUT_DIR="/tmp/auth-test-artifacts"
mkdir -p "$OUT_DIR"
```

---

## TEST 1: State-Only Mode Fails Fast When No Valid State

**Objective:** When `FT_AUTH_MODE=state-only` and no cached state exists, exit immediately with `AUTH_STATE_REQUIRED` (not waiting 120s)

**Precondition:**
- Remove cached state: `rm -f tests/playwright/.auth/state.json`
- OR first run with `FT_AUTH_MODE=interactive` to get state, then delete it

**Test Steps:**
```bash
# Run with state-only mode, no state available
export FT_AUTH_MODE="state-only"
export FT_AUTH_INTERACTIVE_MAX_SECONDS="25"
export OUT_DIR="/tmp/auth-test-1"
mkdir -p "$OUT_DIR"

# Remove state to simulate scenario
rm -f tests/playwright/.auth/state.json

# Run auth setup
timeout 35s npx playwright test tests/playwright/auth.setup.ts:setup || true

# Check results
export EXIT_CODE=$?
echo "Exit code: $EXIT_CODE"
```

**Expected Results:**
1. **Exit Code:** 1 (failure, not 124/timeout)
2. **Execution Time:** < 30 seconds (not 120s timeout)
3. **Evidence File:** `$OUT_DIR/auth-failure-reason.json` exists
4. **Evidence Content:**
   ```json
   {
     "reasonCode": "AUTH_STATE_REQUIRED",
     "observations": { ... },
     "authMode": "state-only",
     "stateReuseAttempted": true,  // or false if state didn't exist
     "stateReuseSucceeded": false
   }
   ```

---

## TEST 2: State-First Fails Fast on MFA/Bot-Guard (No 120s Wait)

**Objective:** When `FT_AUTH_MODE=state-first` (default) and state reuse fails, detect MFA/bot-guard within 25s fail-fast window instead of waiting 120s

**Precondition:**
- Use a Jira instance that shows bot-guard/CAPTCHA on login (or manually trigger MFA)
- Delete cached state: `rm -f tests/playwright/.auth/state.json`

**Test Steps:**
```bash
export FT_AUTH_MODE="state-first"  # or omit to use default
export FT_AUTH_INTERACTIVE_MAX_SECONDS="25"
export OUT_DIR="/tmp/auth-test-2"
mkdir -p "$OUT_DIR"

# Ensure no state
rm -f tests/playwright/.auth/state.json

# Run auth setup (should fail when CAPTCHA/MFA detected, within 25s)
timeout 35s npx playwright test tests/playwright/auth.setup.ts:setup || true

export EXIT_CODE=$?
echo "Exit code: $EXIT_CODE"
```

**Expected Results:**
1. **Exit Code:** 1 (failure, not 124/timeout)
2. **Execution Time:** 10-25 seconds (NOT 120s timeout)
3. **Evidence File:** `$OUT_DIR/auth-failure-reason.json` exists
4. **Evidence Content:**
   ```json
   {
     "reasonCode": "MFA_REQUIRED",  // or other detected variant
     "observations": { ... },
     "authMode": "state-first",
     "stateReuseAttempted": true,
     "stateReuseSucceeded": false
   }
   ```
5. **Log Marker:** `[FAIL-FAST] MFA challenge detected early (will not wait 120s)`

---

## TEST 3: Interactive Mode Respects Fail-Fast Window

**Objective:** When `FT_AUTH_MODE=interactive` and MFA/bot-guard detected, exit within fail-fast window (not 120s)

**Precondition:**
- Use instance that shows bot-guard on login
- Delete cached state: `rm -f tests/playwright/.auth/state.json`
- Set JIRA_EMAIL and JIRA_PASSWORD to trigger login attempt

**Test Steps:**
```bash
export FT_AUTH_MODE="interactive"
export FT_AUTH_INTERACTIVE_MAX_SECONDS="25"
export OUT_DIR="/tmp/auth-test-3"
mkdir -p "$OUT_DIR"
export JIRA_EMAIL="<test-email>"
export JIRA_PASSWORD="<test-password>"

rm -f tests/playwright/.auth/state.json

timeout 35s npx playwright test tests/playwright/auth.setup.ts:setup || true
export EXIT_CODE=$?
echo "Exit code: $EXIT_CODE"
```

**Expected Results:**
1. **Exit Code:** 1 (failure on MFA/CAPTCHA detection)
2. **Execution Time:** 5-25 seconds (detected within fail-fast window)
3. **Evidence File:** `$OUT_DIR/auth-failure-reason.json` exists
4. **Evidence Content Has:**
   ```json
   {
     "authMode": "interactive",
     "stateReuseAttempted": false,  // or true if state existed
     "stateReuseSucceeded": false
   }
   ```

---

## TEST 4: State Reuse Success Path (No Evidence File)

**Objective:** Verify that state-first mode successfully skips interactive login when state is valid

**Precondition:**
- Have valid cached state: `tests/playwright/.auth/state.json`
- Credentials still valid in Jira instance

**Test Steps:**
```bash
export FT_AUTH_MODE="state-first"  # or omit (default)
export OUT_DIR="/tmp/auth-test-4"
mkdir -p "$OUT_DIR"

# Ensure we have state (run interactive mode once first if needed)
if [ ! -f tests/playwright/.auth/state.json ]; then
  export FT_AUTH_MODE="interactive"
  export JIRA_EMAIL="<test-email>"
  export JIRA_PASSWORD="<test-password>"
  npx playwright test tests/playwright/auth.setup.ts:setup
  unset JIRA_EMAIL JIRA_PASSWORD
  export FT_AUTH_MODE="state-first"
fi

# Now run with state-first, should reuse state
timeout 35s npx playwright test tests/playwright/auth.setup.ts:setup
export EXIT_CODE=$?
```

**Expected Results:**
1. **Exit Code:** 0 (success)
2. **Execution Time:** < 15 seconds (reuse is fast)
3. **Evidence File:** None created (`$OUT_DIR/auth-failure-reason.json` should NOT exist)
4. **Log Marker:** `[AUTH] ✓ AUTH_STATE_REUSED_OK - stored credentials are still valid`

---

## Comprehensive Test Script

Run all tests at once:

```bash
#!/bin/bash
set -e

BASE_OUT="/tmp/auth-phase6-tests"
mkdir -p "$BASE_OUT"

echo "===== Phase 6 Acceptance Tests ====="
echo ""

# TEST 1: State-Only without state
echo "TEST 1: State-Only Mode (no state)"
export FT_AUTH_MODE="state-only"
export OUT_DIR="$BASE_OUT/test1"
mkdir -p "$OUT_DIR"
rm -f tests/playwright/.auth/state.json
timeout 35s npx playwright test tests/playwright/auth.setup.ts:setup 2>&1 | tee "$BASE_OUT/test1.log" || true
if grep -q "AUTH_STATE_REQUIRED" "$OUT_DIR/auth-failure-reason.json" 2>/dev/null; then
  echo "✓ TEST 1 PASSED"
else
  echo "✗ TEST 1 FAILED"
fi
echo ""

# TEST 2: State-First with MFA  
echo "TEST 2: State-First Mode (MFA/Bot-Guard Detection)"
export FT_AUTH_MODE="state-first"
export OUT_DIR="$BASE_OUT/test2"
mkdir -p "$OUT_DIR"
rm -f tests/playwright/.auth/state.json
timeout 35s npx playwright test tests/playwright/auth.setup.ts:setup 2>&1 | tee "$BASE_OUT/test2.log" || true
if grep -q "FAIL-FAST" "$BASE_OUT/test2.log" 2>/dev/null; then
  echo "✓ TEST 2 PASSED (fail-fast detected)"
else
  echo "✗ TEST 2 FAILED (no fail-fast)"
fi
echo ""

# TEST 3: State reuse success
echo "TEST 3: State Reuse Success"
export FT_AUTH_MODE="state-first"
export OUT_DIR="$BASE_OUT/test3"
mkdir -p "$OUT_DIR"
# Assume state exists from previous runs or setup
if [ -f tests/playwright/.auth/state.json ]; then
  timeout 35s npx playwright test tests/playwright/auth.setup.ts:setup 2>&1 | tee "$BASE_OUT/test3.log" || true
  if grep -q "AUTH_STATE_REUSED_OK" "$BASE_OUT/test3.log" 2>/dev/null; then
    echo "✓ TEST 3 PASSED (state reuse successful)"
  else
    echo "✗ TEST 3 FAILED (state reuse not successful)"
  fi
else
  echo "◉ TEST 3 SKIPPED (no cached state)"
fi

echo ""
echo "===== Test Run Complete ====="
ls -la "$BASE_OUT"/*-reason.json 2>/dev/null || echo "No failure evidence files (expected for reuse success)"
```

---

## TEST 5: No networkidle Hang + CAPTCHA Detection (Regression Test for Phase 6 Fix)

**Objective:** Verify that the fix removing `waitForLoadState('networkidle')` resolves the hang on pages with reCAPTCHA. The bounded 500ms settle plus explicit CAPTCHA frame detection should exit fail-fast window within ~10s, NOT timeout at 120s.

**Scenario:** This test reproduces the reported issue:
- Atlassian ID login page with reCAPTCHA frame causes networkidle to hang indefinitely
- Before fix: timeout after 120s with AUTH_SETUP_TIMEOUT
- After fix: detect CAPTCHA early (~5-10s) with CAPTCHA_OR_BOT_GUARD reason code

**Precondition:**
- No cached state: `rm -f tests/playwright/.auth/state.json`
- Instance has reCAPTCHA or bot-guard protection on Atlassian ID login
- Set bounded fail-fast window: `FT_AUTH_INTERACTIVE_MAX_SECONDS=10`

**Test Steps:**
```bash
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export FT_AUTH_MODE="state-first"
export FT_AUTH_INTERACTIVE_MAX_SECONDS=10
export FT_PLAYWRIGHT_TIMEOUT_SECONDS=180
unset FT_PLAYWRIGHT_MODE  # Use headless by default

# Remove cached state to force interactive path
rm -f tests/playwright/.auth/state.json

# Run the dashboard auth test (runner creates OUT_DIR automatically)
cd /workspaces/Firsttry/atlassian/forge-app
bash scripts/proof/run_dashboard_playwright.sh
echo "EXIT=$?"

# Retrieve runner-created OUT_DIR
OUT_DIR=$(ls -1dt /tmp/pw_dash_diag_* | head -1)
echo "OUT_DIR=$OUT_DIR"

# Examine evidence
ls -la "$OUT_DIR" | sed -n '1,220p'
cat "$OUT_DIR/auth-failure-reason.json" | sed -n '1,260p'
```

**Expected Results:**
1. **Exit Code:** 1 (failure due to bot-guard/MFA/SSO detection, NOT 0 or timeout)
2. **Execution Time:** Typically 5-30 seconds; MUST be << 120 seconds (strict assertion: fail-fast detection must not allow 120s timeout to fire)
3. **Reason Code in Evidence:** MUST be ONE OF:
   - `CAPTCHA_OR_BOT_GUARD` (recaptcha.net or google.com frame detected)
   - `SSO_REQUIRED` (SSO buttons present, no email/password inputs)
   - `MFA_REQUIRED` (MFA challenge detected after email entered)
   
   **MUST NOT be:** `AUTH_SETUP_TIMEOUT` (this would indicate networkidle hang not fixed, or outer timeout fired)
4. **Log Markers in Stderr:** Should appear:
   - `[AUTH] [FAIL-FAST]` marker indicating early detection
   - NOT: `waitForLoadState('networkidle')` or indefinite waits
5. **Evidence File Structure:** `$OUT_DIR/auth-failure-reason.json` must contain:
   ```json
   {
     "reasonCode": "CAPTCHA_OR_BOT_GUARD",  // or SSO_REQUIRED / MFA_REQUIRED
     "observations": {
       "frameHosts": ["www.recaptcha.net", ...],
       ...
     },
     "authMode": "state-first",
     "stateReuseAttempted": true,
     "stateReuseSucceeded": false
   }
   ```

**Deterministic Priority Note:**
In the fail-fast loop, checks are evaluated in strict priority order (not randomized):
1. **CAPTCHA/bot-guard detection** (checks `hasCaptchaSignals()` via frame hosts)
2. **SSO-only detection** (checks for SSO buttons WITHOUT email/password inputs)
3. **MFA detection** (checks for MFA challenge)

If multiple signals are present (e.g., SSO buttons AND MFA challenge), the first matching check wins and emits that reason code. For example, if both SSO-only and MFA are detectable, `SSO_REQUIRED` will be emitted (not `MFA_REQUIRED`), because SSO check comes first in the loop.

**Failure Criteria (Test FAILS if):**
- Exit code is not 1 (e.g., 0 success, 124 timeout, or 137 signal)
- Execution time > 120 seconds (indicates networkidle hang persists)
- `reasonCode` is `AUTH_SETUP_TIMEOUT` (outer timeout fired, fail-fast did not work)
- `reasonCode` is not one of the three allowed values above
- Evidence file not written to OUT_DIR
- No `[AUTH] [FAIL-FAST]` log marker in output

---

## TEST 6: PASS Path — State-Only with Valid Cached State (Enterprise SSO)

**Objective:** Verify the success case on SSO tenants: when `FT_AUTH_MODE=state-only` and a valid `state.json` exists, dashboard proof succeeds (exit 0, no auth errors).

**Why this test matters:** Enterprise SSO tenants cannot use interactive login in automation (bot-guard blocks headless). The only viable CI path is state-only reuse. This test validates that path works end-to-end.

**Precondition:**
- A valid `tests/playwright/.auth/state.json` must exist. To generate it:
  ```bash
  cd /workspaces/Firsttry/atlassian/forge-app
  bash scripts/proof/bootstrap_auth_state_headed.sh
  ```
  (Follow on-screen prompts to complete login in headed browser.)
- The generated state should be < 1 week old (token lifetime varies by Jira instance).

**Test Steps:**
```bash
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
export FT_AUTH_MODE="state-only"
export FT_PLAYWRIGHT_TIMEOUT_SECONDS=180
unset FT_PLAYWRIGHT_MODE

# Verify state exists
if [ ! -f tests/playwright/.auth/state.json ]; then
  echo "ERROR: No state.json found. Run bootstrap_auth_state_headed.sh first."
  exit 1
fi

echo "Running dashboard proof with cached state..."
cd /workspaces/Firsttry/atlassian/forge-app
bash scripts/proof/run_dashboard_playwright.sh
DASHBOARD_EXIT=$?
echo "EXIT=$DASHBOARD_EXIT"

# Retrieve test output
OUT_DIR=$(ls -1dt /tmp/pw_dash_diag_* 2>/dev/null | head -1)
echo "OUT_DIR=$OUT_DIR"

# Examine results
if [ -d "$OUT_DIR" ]; then
  ls -la "$OUT_DIR" | sed -n '1,50p'
  
  # On success, should NOT have auth-failure-reason.json
  if [ -f "$OUT_DIR/auth-failure-reason.json" ]; then
    echo "FAILURE: Unexpected auth-failure-reason.json found (expected success path)"
    cat "$OUT_DIR/auth-failure-reason.json"
    exit 1
  fi
fi
```

**Expected Results:**

1. **Exit Code:** 0 (success, proof completed)
2. **State Reuse:** Logs should include marker indicating state was reused:
   - `[AUTH] ✓ AUTH_STATE_REUSED_OK - stored credentials are still valid`
3. **No Auth Failure:**
   - `$OUT_DIR/auth-failure-reason.json` must NOT exist
   - If it exists, the state was invalid (likely expired)
4. **Dashboard Proof:**
   - Dashboard URL successfully fetched and parsed
   - Evidence file exists showing successful snapshot with meaningful data

**Failure Scenarios & Troubleshooting:**

| Symptom | Reason | Fix |
|---------|--------|-----|
| Exit 1, `AUTH_STATE_REQUIRED` | state.json missing | Run bootstrap_auth_state_headed.sh |
| Exit 1, `AUTH_STATE_REUSE_FAILED` (status != 200 in evidence) | State expired or invalid token | Re-bootstrap with fresh login |
| Exit 1, `MFA_REQUIRED` in evidence | State exists but bot-guard reappeared | Re-bootstrap; token may be stale |
| Exit 124 | Timeout > 180s | Check network connectivity or Jira instance health |
| Exit 0 but `auth-failure-reason.json` present | Contradictory success/failure | Manual inspection of evidence needed |

**Enterprise SSO Note:**
This test validates the recommended production flow for SSO tenants:
- **Local**: One-time headed bootstrap to generate state.json (don human completes MFA/SSO once)
- **CI**: Use state-only mode with base64-encoded state from GitHub secret
- **Advantage**: Unblocked by bot-guard; deterministic (no login automation fail points)

For CI automation, see `.github/workflows/pw_dashboard_state_only.yml` and `README_AUTH_STATE.md` for state injection via secrets.

---

## Success Criteria Summary

| Test | Criteria |
|------|----------|
| STATE-ONLY (no state) | Exit 1, ~10-30s, AUTH_STATE_REQUIRED in evidence |
| STATE-FIRST (MFA/bot) | Exit 1, ~10-25s, [FAIL-FAST] marker, authMode=state-first |
| INTERACTIVE (MFA/bot) | Exit 1, ~5-25s, [FAIL-FAST] marker, authMode=interactive |
| **STATE REUSE (PASS)** | **Exit 0, <15s, state reused, no failure evidence** |

---

## Hard Rules Validation

- ✅ **No new dependencies:** Uses existing Playwright, Node stdlib, no npm install
- ✅ **No secret leaks:** No JIRA_EMAIL/JIRA_PASSWORD in evidence JSON
- ✅ **No gate weakening:** Fail-closed on all paths (state-only, MFA, timeout)
- ✅ **Deterministic JSON:** No timestamps, stable key order in evidence
- ✅ **OUT_DIR isolation:** All evidence written to process.env.OUT_DIR only

---

## Phase 6 Implementation Complete

Evidence Contract Extended:
```typescript
interface AuthFailureEvidence {
  reasonCode: AuthFailureReasonCode;  // 'AUTH_STATE_REQUIRED', 'MFA_REQUIRED', etc.
  observations: AuthObservations;      // Detection artifacts (frame hosts, form elements)
  authMode: AuthMode;                 // 'state-first', 'state-only', 'interactive' (NEW)
  stateReuseAttempted: boolean;        // Did we try to reuse state? (NEW)
  stateReuseSucceeded: boolean;        // Did state reuse succeed? (NEW)
}
```

Environment Variables:
- `FT_AUTH_MODE` (default: 'state-first')
- `FT_AUTH_INTERACTIVE_MAX_SECONDS` (default: 25)
