# Structural Dist Gates & Production Proof

## Overview

All build gates are **deterministic**, **structural** (not substring-based), and fail-closed on regressions.

## Gates

### GATE_REQUIRED_FILES
**Purpose:** Prevent critical infrastructure files from silently disappearing (e.g., trace_helpers.ts)

**Run:**
```bash
cd atlassian/forge-app && bash tools/verify_required_files_present.sh .
```

**Expected Output:**
```
[GATE_REQUIRED_FILES] Checking required files...
  ✓ trace_helpers.ts
  ✓ trace_types.ts
  ✓ ui_identity.ts
  ✓ legacy_flow_detector.ts
  ✓ verify_dist_invoke_allowlist.sh
  ✓ verify_dist_identity_labels.sh
[GATE_REQUIRED_FILES] Found: 6, Missing: 0
[GATE_REQUIRED_FILES] PASS
```

### GATE_INVOKE_ALLOWLIST
**Purpose:** Verify UI only invokes `ft_getDashboardState_v1` and has legacy flow validators compiled

**Structure:** 
- ✓ `ft_getDashboardState_v1` must be present
- ✓ `validateNonLegacyFlow` or `FATAL_UI_LEGACY_RESOLVER` must be compiled
- ✗ No legacy resolver names (`ping`, `ensureFirstSnapshot`, `getBuildInfo`, `getSnapshotDebug`) in invoke calls

**Run:**
```bash
cd atlassian/forge-app && bash tools/verify_dist_invoke_allowlist.sh .
```

**Expected Output:**
```
[GATE_INVOKE_ALLOWLIST] Scanning: app.f1c06fb.js
[GATE_INVOKE_ALLOWLIST]   ✓ ft_getDashboardState_v1 present
[GATE_INVOKE_ALLOWLIST]   ✓ Legacy flow validators present
[GATE_INVOKE_ALLOWLIST] PASS
```

### GATE_IDENTITY_LABELS
**Purpose:** Enforce UI_GIT_SHA and UI_BUNDLE_HASH are distinct and present

**Structure:**
- Bundle hash extracted from filename: `app.<HASH>.js`
- Git SHA extracted from dist content (7 hex chars, != bundle hash)
- Proof patterns (`UI_BOOT_PROOF`, `UI_ENTRY_RUNTIME_PROOF`, `UI_IDENTITY`) must exist

**Run:**
```bash
cd atlassian/forge-app && bash tools/verify_dist_identity_labels.sh .
```

**Expected Output:**
```
[GATE_IDENTITY_LABELS] Checking: app.f1c06fb.js
[GATE_IDENTITY_LABELS]   ✓ Identity proof patterns present
[GATE_IDENTITY_LABELS] PASS
  bundle_hash=f1c06fb (from filename)
  git_sha=86bdc7b (from dist content)
```

## Full Build Pipeline

**Run all gates automatically:**
```bash
cd atlassian/forge-app && npm run build:gadget
```

Gates execute in this order:
1. `verify:bridge-installed` (existing)
2. `verify:required-files` (NEW)
3. Build gadget UI
4. `verify:ui:no-fatal-dist` (existing)
5. `verify:ui:no-top-level-throw` (existing)
6. `verify:ui:no-legacy-states` (existing)
7. `verify:dist:invoke-allowlist` (NEW)
8. `verify:dist:identity-labels` (NEW)

## Production Proof Script

After deployment, verify served bundle matches expected structure:

**Run:**
```bash
bash tools/prove_prod_served_bundle.sh \
  --bundle-url "https://[prod-url]/app.f1c06fb.js" \
  --iframe-url "https://[prod-url]/iframe"
```

**Output:**
```
[PROD_PROOF] ============================================================
[PROD_PROOF] PRODUCTION SERVED BUNDLE VERIFICATION
[PROD_PROOF] ============================================================
[PROD_PROOF] Bundle URL: https://...
[PROD_PROOF] Iframe URL: https://...

[PROD_PROOF] Downloading served bundle...
[PROD_PROOF] ✓ Downloaded XXXXX bytes

[PROD_PROOF] TEST 1: Identity markers present
[PROD_PROOF]   ✓ UI_GIT_SHA found: 86bdc7b
[PROD_PROOF]   ✓ UI_GIT_TIME found: 2026-01-...

[PROD_PROOF] TEST 2: Invoke allowlist (ft_getDashboardState_v1 only)
[PROD_PROOF]   ✓ ft_getDashboardState_v1 found
[PROD_PROOF]   ✓ No legacy resolvers in invoke calls

[PROD_PROOF] TEST 3: CSP header verification
[PROD_PROOF]   ✓ CSP header present
[PROD_PROOF]     content-security-policy: ...
[PROD_PROOF]   ✓ style-src 'unsafe-inline' found

[PROD_PROOF] ============================================================
[PROD_PROOF] PASS: Served bundle matches expected structure
[PROD_PROOF] ============================================================
```

## Why These Gates?

### Anti-Regression
Each gate checks a **structural invariant** that would break if:
- Legacy resolvers were accidentally re-enabled
- Build identity markers were lost
- Critical infrastructure files were deleted
- Identity distinction check was removed

### No False Positives
Gates check **call sites and presence**, not random substrings:
- `GATE_INVOKE_ALLOWLIST`: Only checks `invoke("RESOLVER")` patterns
- `GATE_IDENTITY_LABELS`: Extracts from filename + content structure
- `GATE_REQUIRED_FILES`: File existence check (binary)

### Deterministic & Auditable
- All gates produce stable output with clear PASS/FAIL markers
- Gate output format allows CI/CD integration
- Production proof script captures the exact deployed artifact

## Files Changed

### New Gate Scripts
- `tools/verify_dist_invoke_allowlist.sh`
- `tools/verify_dist_identity_labels.sh`
- `tools/verify_required_files_present.sh`
- `tools/prove_prod_served_bundle.sh`

### Config Changes
- `package.json` (added scripts, wired gates into build)

### No Source Changes Required
Gates validate existing code without modifications.
