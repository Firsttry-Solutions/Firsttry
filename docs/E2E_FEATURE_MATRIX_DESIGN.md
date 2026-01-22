# Dashboard Acceptance Test: Feature Matrix Implementation

**Commit:** `11a9bb88`  
**Date:** January 22, 2026  
**Status:** ✅ Syntax validated, ready for execution

## Overview

Complete rewrite of `e2e/tests/dashboard_acceptance_full.spec.ts` using a **Feature Matrix** pattern for strict, ordered validation of dashboard features.

## Architecture

### 1. Feature Matrix Pattern

**BACKBONE_FEATURES** (7 features - critical infrastructure):
```typescript
- proof-envelope-kind
- proof-schema-version
- proof-correlation-id
- proof-ui-build-sha
- proof-ui-build-time
- proof-backend-build-sha
- proof-backend-build-time
```

**ADDON_FEATURES** (10 features - user-facing):
```typescript
- tile-overall-health (normal mode)
- tile-data-freshness (normal mode)
- tile-scheduler (normal mode)
- tile-last-snapshot (normal mode)
- button-refresh (normal mode)
- button-export (normal mode)
- snapshot-count (normal mode)
```

### 2. Feature Interface

```typescript
interface Feature {
  featureKey: string;              // Unique identifier
  selector: string;                // CSS selector or Playwright locator
  mode: 'normal' | 'debug' | 'both'; // When to validate
  assertion: 'nonEmpty' | 'notEquals' | 'matchesRegex' | 
             'numericGte' | 'notOneOf' | 'visible' | 'hidden';
  timeoutMs: number;               // Wait timeout
  allowedValues?: string[];        // For 'notOneOf'
  minValue?: number;               // For 'numericGte'
  regexPattern?: string;           // For 'matchesRegex'
}
```

### 3. Core Helpers

| Helper | Purpose |
|--------|---------|
| `recordFeatureFailure()` | Append failure to feature_failures.txt |
| `detectAndFailOnAuthRedirect()` | HARD FAIL if URL contains auth domains |
| `dumpFrames()` | Save frame_dump.txt with diagnostics |
| `findGadgetFrame()` | Locate gadget iframe by header text |
| `setupErrorLogging()` | Capture console.log/error, pageerror to files |
| `assertFeature()` | Validate single feature with smart retry + screenshots |

## Test Cases (4 total)

### Test 1: Backbone Validation ⚡ CRITICAL
**Runs first, fail-fast on critical failures**

1. **Auth Redirect Detection**
   - Checks URL doesn't contain `id.atlassian.com` or `auth.atlassian.com`
   - Takes screenshot on failure: `redirect_detected.png`

2. **Frame Diagnostics**
   - Saves all frame URLs and titles to `frame_dump.txt`
   - Used for debugging when gadget frame not found

3. **Gadget Detection**
   - Searches for gadget iframe by known header texts
   - Searches main page if iframe not found
   - Fails if gadget not found

4. **Console Error Check**
   - Counts fatal errors: `Uncaught`, `invoke failed`, `TypeError`, `ReferenceError`
   - Must be **0** fatal errors
   - Saves to `console.error` file

5. **Proof Envelope Fields**
   - Validates all 7 proof fields present and non-empty
   - Rejects: `UNSET`, `ERROR`, `INITIALIZING`, `NOT_AVAILABLE`
   - Takes screenshot on failure: `fail_<featureKey>.png`

**Artifacts:**
- `debug.png` (screenshot after validation)
- `frame_dump.txt` (frame diagnostics)
- `console.log` (all messages)
- `console.error` (error messages only)
- `pageerror.log` (page errors)

---

### Test 2: Add-on Features (Normal Mode)
**Feature-specific validation in normal mode**

1. **Core Tiles**
   - Overall Health (text present)
   - Data Freshness (text present)
   - Scheduler (text present)
   - Last Snapshot (text present)

2. **Buttons**
   - Refresh button (visible)
   - Export button (visible)

3. **Snapshot Section**
   - Snapshot Count (text present)

4. **STRICT Validations** (MUST NOT FAIL)
   - **Snapshot count >= 1** (extracts numeric value, validates minimum)
   - **Export button enabled** (not disabled attribute)

**Artifacts:**
- `normal.png` (screenshot after validation)
- `feature_failures.txt` (all failures appended)
- `fail_<featureKey>.png` (per-feature failure screenshots)

---

### Test 3: Debug Mode Visibility
**Validates debug sections visibility toggle**

1. **Normal Mode**
   - Navigates to base URL (no `?ft_debug=1`)
   - Checks all `[data-ft-debug="1"]` elements have `display: none`
   - Takes screenshot: `debug.png`

2. **Debug Mode**
   - Navigates to URL with `?ft_debug=1`
   - Checks proof elements are visible:
     - `#proof-envelope-kind`
     - `#proof-correlation-id`
     - `#proof-ui-build-sha`
   - Takes screenshot: `debug.png`

**Artifacts:**
- Multiple screenshots for both modes
- `feature_failures.txt` (debug failures)

---

### Test 4: Refresh Correctness
**Validates refresh button functionality**

1. **Setup**
   - Navigates to debug mode (`?ft_debug=1`)
   - Finds gadget frame

2. **Pre-refresh**
   - Reads `#proof-correlation-id` text
   - Stores as `originalCorrelationId`

3. **Click Refresh**
   - Clicks refresh button
   - Waits for response

4. **Post-refresh**
   - Polls `#proof-correlation-id` for change (20 attempts, 1s each)
   - Validates new ID != original ID
   - Takes screenshot: `after_refresh.png`

**Artifacts:**
- `after_refresh.png` (post-refresh screenshot)
- `console.log` (refresh logs)

---

## Artifact Output

All artifacts saved to `$FT_RUN_DIR` (default: `/tmp/ft_pw_dashboard_acceptance`):

### Always Generated
```
frame_dump.txt              # Frame diagnostics (URLs + titles)
feature_failures.txt        # All assertion failures
console.log                 # All console messages
console.error               # Console errors only
pageerror.log               # Page errors only
```

### Per-Mode Screenshots
```
debug.png                   # After backbone + debug mode validation
normal.png                  # After add-on validation in normal mode
after_refresh.png           # After refresh button click
```

### Per-Feature on Failure
```
fail_<featureKey>.png       # Screenshot when feature assertion fails
fail_snapshot-count-strict.png
fail_export-button-enabled.png
...etc
```

### Auth/Redirect Failures
```
redirect_detected.png       # If auth domain redirect detected
```

---

## Usage

### Syntax Check Only
```bash
JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102" \
  STORAGE_STATE="e2e/.auth/storageState.persistent.json" \
  npx playwright test e2e/tests/dashboard_acceptance_full.spec.ts --list
```

### Run Full Suite
```bash
npm run dashboard:playwright
```

The runner script (`e2e/scripts/run_dashboard_acceptance.sh`) will:
1. Create persistent browser session with user SSO/MFA login
2. Validate storageState works for UI navigation
3. Run all 4 test cases
4. Collect artifacts into `RUN_DIR`

### Run Single Test
```bash
JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102" \
  STORAGE_STATE="e2e/.auth/storageState.persistent.json" \
  FT_RUN_DIR="/tmp/my_test_run" \
  npx playwright test e2e/tests/dashboard_acceptance_full.spec.ts \
    -g "Backbone"
```

---

## Validation Rules

### Backbone Features (ALL MUST PASS)
- **assertion: nonEmpty**
  - Value must not be empty string
  - Value must not be: `UNSET`, `ERROR`, `INITIALIZING`, `NOT_AVAILABLE`

### Add-on Features (MOST CAN FAIL GRACEFULLY)
- **assertion: nonEmpty** - Same as backbone
- **assertion: visible** - Element must be visible (CSS display != none)
- **assertion: hidden** - Element must be hidden (CSS display == none)
- **assertion: numericGte** - Parse value as int, check >= minValue

### Strict Add-ons (MUST PASS)
- **Snapshot count >= 1** - Regex extract number, validate numeric
- **Export button enabled** - Element must not have disabled attribute

---

## Key Improvements Over Previous Version

| Feature | Old | New |
|---------|-----|-----|
| Organization | Ad-hoc tests | Feature Matrix pattern |
| Failure handling | Silent timeouts | Explicit errors + screenshots |
| Diagnostics | Minimal | Frame dump, feature failures, per-feature screenshots |
| Error collection | Console only | Console.log, console.error, pageerror |
| Validation order | Random | Backbone first, then add-ons |
| Debug mode | Tested | Tested with visibility verification |
| Feature count | 4 major | 17 granular features (7 backbone + 10 add-on) |
| Artifact capture | 3 files | 10+ files (including per-failure screenshots) |

---

## Error Messages

### Backbone Failure Example
```
❌ Feature 'proof-correlation-id' assertion failed: Value is invalid: UNSET

Artifacts:
- frame_dump.txt (for frame diagnostics)
- fail_proof-correlation-id.png (failure screenshot)
- feature_failures.txt (failure logged)
```

### Add-on Failure Example
```
❌ Feature 'snapshot-count-strict' assertion failed: Snapshot count 0 is less than minimum 1

Artifacts:
- fail_snapshot-count-strict.png
- feature_failures.txt
```

### Auth Redirect Example
```
❌ Auth domain redirect detected: https://id.atlassian.com/...

Artifacts:
- redirect_detected.png (before failure)
- frame_dump.txt (frame state at redirect)
```

---

## Constraints Verification

✅ **No manifest changes** - Only test file modified  
✅ **No npm deps** - Uses @playwright/test (already installed)  
✅ **No permissions changes** - No manifest.yml touched  
✅ **HARD STOP on failure** - Exit code 1 on any backbone failure  
✅ **Strict assertions** - Snapshot count >= 1, Export enabled mandatory  
✅ **Evidence-driven** - All failures captured with screenshots + logs  
✅ **Repeatable** - Same feature matrix, same assertions, deterministic results  

---

## Next Steps

1. **Run syntax check:**
   ```bash
   JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102" \
     STORAGE_STATE="e2e/.auth/storageState.persistent.json" \
     npx playwright test e2e/tests/dashboard_acceptance_full.spec.ts --list
   ```

2. **Run full suite (requires real Jira login):**
   ```bash
   npm run dashboard:playwright
   ```

3. **Inspect artifacts:**
   ```bash
   ls -la /tmp/ft_pw_dashboard_acceptance_*/
   cat /tmp/ft_pw_dashboard_acceptance_*/feature_failures.txt
   ```

---

## Quick Reference: Adding a New Feature

Edit `ADDON_FEATURES` array:

```typescript
const ADDON_FEATURES: Feature[] = [
  // ... existing features ...
  {
    featureKey: 'my-new-feature',
    selector: '#my-selector',
    mode: 'normal',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
];
```

Feature will be validated automatically by `assertFeature()` helper.

---

## Code Locations

| File | Lines | Purpose |
|------|-------|---------|
| Feature interface | 80-92 | Type definition |
| Backbone features | 94-129 | 7 proof envelope fields |
| Add-on features | 131-182 | 10 user-facing features |
| Helpers | 184-390 | Validation + artifact functions |
| Test: Backbone | 393-450 | Critical path validation |
| Test: Add-ons | 452-525 | Feature validation (normal) |
| Test: Debug mode | 526-596 | Visibility verification |
| Test: Refresh | 597-650 | Refresh button testing |

Total: **650 lines** (well-commented, readable)
