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

## Success Criteria Summary

| Test | Criteria |
|------|----------|
| STATE-ONLY (no state) | Exit 1, ~10-30s, AUTH_STATE_REQUIRED in evidence |
| STATE-FIRST (MFA/bot) | Exit 1, ~10-25s, [FAIL-FAST] marker, authMode=state-first |
| INTERACTIVE (MFA/bot) | Exit 1, ~5-25s, [FAIL-FAST] marker, authMode=interactive |
| STATE REUSE | Exit 0, <15s, no failure evidence |

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
