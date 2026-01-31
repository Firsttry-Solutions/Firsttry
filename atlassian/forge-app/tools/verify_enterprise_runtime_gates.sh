#!/bin/bash
# Enterprise Dashboard Runtime Population Verification
# Proves that dashboard elements are populated at runtime, not just present in code/bundle
# Fail-closed: Any gate failure stops execution immediately

set -euo pipefail

# Initialization
RUN_DIR="${RUN_DIR:-/tmp/ft_verify_enterprise_runtime_$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$RUN_DIR"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT/atlassian/forge-app"

echo "=== ENTERPRISE DASHBOARD RUNTIME VERIFICATION ==="
echo "RUN_DIR: $RUN_DIR"
echo "Repo: $REPO_ROOT"
echo ""

# ============================================================================
# STEP 0: FAIL-CLOSED GATE — REPO CLEAN
# ============================================================================
echo "STEP 0: Repository clean gate..."
if git status --porcelain | grep -E '^\s*[MADRCU]'; then
  echo "FAIL: Repository has uncommitted changes"
  git status
  exit 1
fi
echo "✓ PASS: Repository clean"
echo ""

# ============================================================================
# STEP 1: BUNDLE GATE — Confirm markers exist in shipped artifact
# ============================================================================
echo "STEP 1: Bundle gate (marker presence)..."
BUNDLE="./src/gadget-ui/dist/app.$(git rev-parse HEAD | cut -c1-40).js"

if [ ! -f "$BUNDLE" ]; then
  # Fallback: find the actual bundle
  BUNDLE=$(find ./src/gadget-ui/dist -name "app.*.js" -type f | head -1)
  if [ -z "$BUNDLE" ]; then
    echo "FAIL: Bundle not found. Run 'npm run build' first."
    exit 1
  fi
fi

echo "Bundle: $BUNDLE"
ls -lh "$BUNDLE" > "$RUN_DIR/10_bundle_info.txt"

# Required markers that prove correlation and envelope logic shipped
MARKERS=(
  "UI_CORRELATION_ID_SET"
  "UI_DASH_RAW_ENVELOPE"
  "UI_INVOKE_OK"
)

MISSING_MARKERS=()
for marker in "${MARKERS[@]}"; do
  if ! grep -q "$marker" "$BUNDLE"; then
    MISSING_MARKERS+=("$marker")
  fi
done

if [ ${#MISSING_MARKERS[@]} -gt 0 ]; then
  echo "FAIL: Missing markers in bundle: ${MISSING_MARKERS[*]}"
  exit 1
fi

echo "✓ PASS: All required markers present in bundle"
echo "  - UI_CORRELATION_ID_SET"
echo "  - UI_DASH_RAW_ENVELOPE"
echo "  - UI_INVOKE_OK"
echo ""

# ============================================================================
# STEP 2: DEVTOOLS MANUAL GATE INSTRUCTIONS
# ============================================================================
echo "STEP 2: Creating DevTools manual gate instructions..."
cat > "$RUN_DIR/20_DEVTOOLS_RUNTIME_GATES.txt" << 'DEVTOOLS_EOF'
# ENTERPRISE DASHBOARD RUNTIME VERIFICATION — Manual DevTools Gates

## Purpose
Verify that the dashboard UI is ACTUALLY POPULATED at runtime with real values.
These are manual tests performed via browser DevTools console in staging.

## Prerequisites
- App deployed to staging (v2.33.0+)
- Access to staging Jira instance
- Browser DevTools console open (F12)

---

## GATE 1: Correlation ID Population

**Expected Result**: Correlation ID is a UUID-like string, NOT a placeholder

**Console Command**:
```javascript
console.log("GATE_1_CORRELATION_ID", {
  correlationId: window.__FT_CORRELATION_ID,
  type: typeof window.__FT_CORRELATION_ID,
  length: window.__FT_CORRELATION_ID?.length,
  isPlaceholder: window.__FT_CORRELATION_ID?.includes("UNSET") || 
                 window.__FT_CORRELATION_ID?.includes("NOT_AVAILABLE") ||
                 window.__FT_CORRELATION_ID?.includes("NOT_DECLARED"),
  isPopulated: window.__FT_CORRELATION_ID && 
               window.__FT_CORRELATION_ID.length > 5 &&
               !window.__FT_CORRELATION_ID.includes("UNSET") &&
               !window.__FT_CORRELATION_ID.includes("NOT_AVAILABLE") &&
               !window.__FT_CORRELATION_ID.includes("NOT_DECLARED")
});
```

**PASS Criteria**:
- ✓ isPopulated === true
- ✓ length > 5
- ✓ Does NOT contain: UNSET, NOT_AVAILABLE, NOT_DECLARED

**FAIL Criteria**:
- ✗ isPlaceholder === true
- ✗ correlationId is undefined or null
- ✗ correlationId shows any placeholder text

---

## GATE 2: Build SHA Population

**Expected Result**: Build SHA shows actual commit hash (40 hex chars), NOT NOT_AVAILABLE

**Console Command**:
```javascript
const buildShaElement = document.querySelector('[data-proof-field="build-sha"]') ||
                        document.querySelector('code[data-field="build-sha"]') ||
                        Array.from(document.querySelectorAll('code')).find(el => 
                          el.textContent.match(/^[0-9a-f]{40}$/)
                        );

console.log("GATE_2_BUILD_SHA", {
  elementFound: !!buildShaElement,
  textContent: buildShaElement?.textContent,
  isValidSha: buildShaElement?.textContent?.match(/^[0-9a-f]{40}$/),
  isNotAvailable: buildShaElement?.textContent?.includes("NOT_AVAILABLE"),
  isNotDeclared: buildShaElement?.textContent?.includes("NOT_DECLARED"),
  isPopulated: buildShaElement?.textContent?.match(/^[0-9a-f]{40}$/) !== null
});
```

**PASS Criteria**:
- ✓ isPopulated === true
- ✓ textContent matches ^[0-9a-f]{40}$
- ✓ NOT "NOT_AVAILABLE"
- ✓ NOT "NOT_DECLARED_IN_SNAPSHOT"

**FAIL Criteria**:
- ✗ textContent === "NOT_AVAILABLE"
- ✗ textContent === "NOT_DECLARED_IN_SNAPSHOT"
- ✗ elementFound === false

---

## GATE 3: Build Time Population

**Expected Result**: Build Time shows ISO format timestamp, NOT NOT_AVAILABLE

**Console Command**:
```javascript
const buildTimeElement = document.querySelector('[data-proof-field="build-time"]') ||
                         document.querySelector('code[data-field="build-time"]') ||
                         Array.from(document.querySelectorAll('code')).find(el => 
                           el.textContent.match(/^\d{4}-\d{2}-\d{2}T/)
                         );

console.log("GATE_3_BUILD_TIME", {
  elementFound: !!buildTimeElement,
  textContent: buildTimeElement?.textContent,
  isIsoFormat: buildTimeElement?.textContent?.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?$/),
  isNotAvailable: buildTimeElement?.textContent?.includes("NOT_AVAILABLE"),
  isNotDeclared: buildTimeElement?.textContent?.includes("NOT_DECLARED"),
  isPopulated: buildTimeElement?.textContent?.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?$/) !== null
});
```

**PASS Criteria**:
- ✓ isPopulated === true
- ✓ textContent matches ISO 8601 format
- ✓ NOT "NOT_AVAILABLE"
- ✓ NOT "NOT_DECLARED_IN_SNAPSHOT"

**FAIL Criteria**:
- ✗ textContent === "NOT_AVAILABLE"
- ✗ textContent === "NOT_DECLARED_IN_SNAPSHOT"
- ✗ isIsoFormat === false

---

## GATE 4: Metadata Sections Populated (Coverage, Integrity, Compliance, Provenance)

**Expected Result**: Metadata sections visible with declarations, NOT placeholder strings

**Console Command**:
```javascript
const metadataSection = document.querySelector('.l0-dashboard-metadata-section') ||
                        document.querySelector('[data-section="metadata"]') ||
                        document.querySelector('h2[class*="metadata"]')?.parentElement;

const metadata = {
  sectionFound: !!metadataSection,
  html: metadataSection?.innerHTML?.substring(0, 200),
  hasCoverage: metadataSection?.textContent?.includes("Coverage"),
  hasIntegrity: metadataSection?.textContent?.includes("Integrity"),
  hasProvenance: metadataSection?.textContent?.includes("Provenance"),
  hasCompliance: metadataSection?.textContent?.includes("Compliance"),
  hasExport: metadataSection?.textContent?.includes("Export"),
  hasNotDeclared: metadataSection?.textContent?.includes("NOT_DECLARED_IN_SNAPSHOT"),
  declarationsPresent: [
    metadataSection?.textContent?.includes("Coverage"),
    metadataSection?.textContent?.includes("Integrity"),
    metadataSection?.textContent?.includes("Provenance"),
    metadataSection?.textContent?.includes("Compliance"),
  ].filter(Boolean).length
};

console.log("GATE_4_METADATA_SECTIONS", metadata);
```

**PASS Criteria**:
- ✓ sectionFound === true
- ✓ declarationsPresent >= 3 (at least 3 metadata sections)
- ✓ hasNotDeclared === false

**FAIL Criteria**:
- ✗ sectionFound === false
- ✗ hasNotDeclared === true (means NOT_DECLARED_IN_SNAPSHOT is showing)
- ✗ declarationsPresent < 2

---

## GATE 5: Snapshot ID Populated

**Expected Result**: Snapshot ID shown as UUID, NOT null/undefined/NOT_AVAILABLE

**Console Command**:
```javascript
const snapshotIdElements = Array.from(document.querySelectorAll('code')).filter(el =>
  el.textContent?.includes("-") && 
  el.textContent?.length > 20 &&
  el.textContent?.match(/^[0-9a-f\-]+$/)
);

console.log("GATE_5_SNAPSHOT_ID", {
  snapshotIdFound: snapshotIdElements.length > 0,
  firstSnapshotId: snapshotIdElements[0]?.textContent,
  isNotAvailable: snapshotIdElements[0]?.textContent?.includes("NOT_AVAILABLE"),
  isNotDeclared: snapshotIdElements[0]?.textContent?.includes("NOT_DECLARED"),
  isPopulated: snapshotIdElements.length > 0 && 
               snapshotIdElements[0]?.textContent?.length > 20 &&
               !snapshotIdElements[0]?.textContent?.includes("NOT_AVAILABLE") &&
               !snapshotIdElements[0]?.textContent?.includes("NOT_DECLARED")
});
```

**PASS Criteria**:
- ✓ snapshotIdFound === true
- ✓ isPopulated === true
- ✓ firstSnapshotId length > 20

**FAIL Criteria**:
- ✗ snapshotIdFound === false
- ✗ textContent === "NOT_AVAILABLE"
- ✗ textContent === "NOT_DECLARED"

---

## GATE 6: Export Readiness Visible in UI

**Expected Result**: Export section shows readiness status and formats in UI (not console-only)

**Console Command**:
```javascript
const exportSection = Array.from(document.querySelectorAll('*')).find(el =>
  el.textContent?.includes("Export") && 
  (el.classList?.toString()?.includes("export") || el.textContent?.includes("readiness"))
);

const exportText = exportSection?.textContent || "";

console.log("GATE_6_EXPORT_READINESS", {
  exportSectionFound: !!exportSection,
  exportText: exportText.substring(0, 150),
  hasReadiness: exportText.includes("ready") || exportText.includes("Ready"),
  hasFormat: exportText.includes("json") || exportText.includes("csv") || exportText.includes("pdf"),
  hasNotAvailable: exportText.includes("NOT_AVAILABLE") || exportText.includes("unavailable"),
  isConsoleOnly: !exportSection && window.__FT_EXPORT_DATA !== undefined,
  isPopulated: !!exportSection && exportText.length > 20
});
```

**PASS Criteria**:
- ✓ exportSectionFound === true
- ✓ isPopulated === true
- ✓ NOT showing in console-only mode (isConsoleOnly === false)

**FAIL Criteria**:
- ✗ isConsoleOnly === true (means it's only in console, not in UI)
- ✗ exportSectionFound === false
- ✗ hasNotAvailable === true

---

## GATE 7: Console Markers Prove Backend Invocation

**Expected Result**: Console shows [UI_INVOKE_OK] and [UI_CORRELATION_ID_SET] indicating successful backend call

**Console Command**:
```javascript
// Look at console history - copy-paste all console.log statements you see:
// Expected patterns:
// "[UI_INVOKE_OK] { resolver: 'ft_getDashboardState_v1', ... }"
// "[UI_CORRELATION_ID_SET] { correlationId: 'correlation_...' }"
// "[UI_DASH_RAW_ENVELOPE] { ... }"

// Or, try to trigger fresh logs:
console.log("Checking window.__FT_DASHBOARD_STATE_PROOF");
window.__FT_DASHBOARD_STATE_PROOF = {
  resolverCalled: !!window.__FT_DASHBOARD_STATE,
  correlationIdSet: !!window.__FT_CORRELATION_ID,
  envelopeReceived: !!document.querySelector('[data-field="snapshot-id"]'),
  ts: new Date().toISOString()
};
console.log("GATE_7_CONSOLE_MARKERS", window.__FT_DASHBOARD_STATE_PROOF);
```

**PASS Criteria**:
- ✓ [UI_INVOKE_OK] appears in console history
- ✓ [UI_CORRELATION_ID_SET] appears in console history
- ✓ [UI_DASH_RAW_ENVELOPE] appears in console history

**FAIL Criteria**:
- ✗ None of the markers appear in console
- ✗ Console shows "INVOKE_FAILED" or "ERROR"

---

## Summary of All Gates

Run these 7 gates in browser DevTools. For each PASS gate, copy the console output to a text file.
Then generate matrix:

- Gate 1 (CorrelationId): PASS if isPopulated === true
- Gate 2 (BuildSha): PASS if isPopulated === true and matches ^[0-9a-f]{40}$
- Gate 3 (BuildTime): PASS if isPopulated === true and matches ISO format
- Gate 4 (Metadata): PASS if declarationsPresent >= 3 and hasNotDeclared === false
- Gate 5 (SnapshotId): PASS if isPopulated === true
- Gate 6 (Export): PASS if exportSectionFound === true
- Gate 7 (Console): PASS if all markers appear in console

All 7 gates must PASS for runtime readiness verification.

DEVTOOLS_EOF

cat "$RUN_DIR/20_DEVTOOLS_RUNTIME_GATES.txt"
echo ""
echo "✓ DevTools gate instructions saved to: $RUN_DIR/20_DEVTOOLS_RUNTIME_GATES.txt"
echo ""

# ============================================================================
# STEP 3: FORGE LOGS MANUAL GATE INSTRUCTIONS
# ============================================================================
echo "STEP 3: Creating Forge logs manual gate instructions..."
cat > "$RUN_DIR/30_FORGE_LOGS_GATES.txt" << 'FORGELOGS_EOF'
# ENTERPRISE DASHBOARD RUNTIME VERIFICATION — Forge Logs Gates

## Purpose
Verify that the backend resolver (ft_getDashboardState_v1) is returning POPULATED values in logs.

## Prerequisites
- App deployed to staging
- Access to forge logs command
- forge CLI installed and authenticated

---

## GATE 1: Capture Recent Logs

**Command**:
```bash
forge logs --environment staging --tail 300 > /tmp/forge_logs_raw.txt
```

Save the output. This captures the last 300 log lines from staging.

---

## GATE 2: Search for Resolver Invocation Proof

**Command**:
```bash
grep -i "ft_getDashboardState_v1" /tmp/forge_logs_raw.txt | head -20
```

**PASS Criteria**:
- ✓ At least 1 line mentioning ft_getDashboardState_v1
- ✓ Shows resolver was called by UI

**FAIL Criteria**:
- ✗ Zero matches (resolver never called)

---

## GATE 3: Search for NOT_DECLARED_IN_SNAPSHOT (Failure Indicator)

**Command**:
```bash
grep -i "NOT_DECLARED_IN_SNAPSHOT" /tmp/forge_logs_raw.txt
```

**PASS Criteria**:
- ✓ Zero matches (snapshot IS populated, not showing placeholder)

**FAIL Criteria**:
- ✗ Multiple matches = snapshot returned with placeholder text instead of real values

---

## GATE 4: Search for Error Patterns

**Command**:
```bash
grep -E "ERROR|FAILED|INVALID|CRASH" /tmp/forge_logs_raw.txt | grep -v "^#" | head -20
```

**PASS Criteria**:
- ✓ Zero matches OR matches are unrelated to ft_getDashboardState_v1

**FAIL Criteria**:
- ✗ Lines mentioning ft_getDashboardState_v1 AND ERROR/FAILED

---

## GATE 5: Search for Success Response Pattern

**Command**:
```bash
grep -E "status.*AVAILABLE|snapshotId.*[0-9a-f-]{20,}" /tmp/forge_logs_raw.txt | head -10
```

**PASS Criteria**:
- ✓ At least 1 match showing status: "AVAILABLE" with a snapshotId

**FAIL Criteria**:
- ✗ Zero matches
- ✗ Only shows "NO_SNAPSHOT" or "INVALID_SNAPSHOT"

---

## GATE 6: Check Metadata in Logs

**Command**:
```bash
rg "coverage|integrity|provenance|compliance|export" /tmp/forge_logs_raw.txt | head -20
```

**PASS Criteria**:
- ✓ At least 2 metadata fields found in logs

**FAIL Criteria**:
- ✗ Zero matches
- ✗ Only shows "NOT_DECLARED"

---

## Summary of All Forge Logs Gates

If all these commands pass, the backend is properly populating the resolver response:

- Gate 1: Logs captured
- Gate 2: Resolver called (≥1 match)
- Gate 3: No NOT_DECLARED_IN_SNAPSHOT (0 matches)
- Gate 4: No errors related to resolver (0 matches)
- Gate 5: Success responses present (≥1 match with AVAILABLE status)
- Gate 6: Metadata fields in logs (≥2 matches)

All 6 gates must PASS for backend runtime readiness.

FORGELOGS_EOF

cat "$RUN_DIR/30_FORGE_LOGS_GATES.txt"
echo ""
echo "✓ Forge logs gate instructions saved to: $RUN_DIR/30_FORGE_LOGS_GATES.txt"
echo ""

# ============================================================================
# STEP 4: NODE SCRIPT GATE — Bundle Presence Verification
# ============================================================================
echo "STEP 4: Node script gate (deterministic verification)..."
cat > "$RUN_DIR/40_node_gate_check.js" << 'NODECHECK_EOF'
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Find bundle
const distDir = path.join(process.cwd(), 'src/gadget-ui/dist');
const bundleFile = fs.readdirSync(distDir).find(f => f.match(/^app\.[0-9a-f]+\.js$/));

if (!bundleFile) {
  console.error("FAIL: Bundle not found in dist/");
  process.exit(1);
}

const bundlePath = path.join(distDir, bundleFile);
const bundleContent = fs.readFileSync(bundlePath, 'utf-8');

console.log(`Bundle: ${bundleFile}`);
console.log(`Size: ${(bundleContent.length / 1024).toFixed(1)} KB`);
console.log("");

// Verify critical markers
const markers = {
  'UI_CORRELATION_ID_SET': bundleContent.includes('UI_CORRELATION_ID_SET'),
  'UI_DASH_RAW_ENVELOPE': bundleContent.includes('UI_DASH_RAW_ENVELOPE'),
  'UI_INVOKE_OK': bundleContent.includes('UI_INVOKE_OK'),
  'ft_getDashboardState_v1': bundleContent.includes('ft_getDashboardState_v1'),
  'Build SHA': bundleContent.includes('Build SHA'),
  'Build Time': bundleContent.includes('Build Time'),
  'Snapshot Metadata': bundleContent.includes('Snapshot Metadata'),
  'Coverage': bundleContent.includes('Coverage'),
  'Integrity': bundleContent.includes('Integrity'),
  'Compliance': bundleContent.includes('Compliance'),
  'Provenance': bundleContent.includes('Provenance'),
  'Export': bundleContent.includes('Export'),
};

let allPassed = true;
const results = {};

for (const [marker, present] of Object.entries(markers)) {
  const status = present ? '✓' : '✗';
  console.log(`${status} ${marker}`);
  results[marker] = present;
  if (!present) allPassed = false;
}

console.log("");
if (allPassed) {
  console.log("✓ PASS: All markers present in bundle");
} else {
  console.log("✗ FAIL: Some markers missing from bundle");
  process.exit(1);
}

// Output JSON for matrix
console.log("");
console.log(JSON.stringify({
  gate: "bundle_markers",
  status: allPassed ? "PASS" : "FAIL",
  bundleFile: bundleFile,
  markers: results,
  timestamp: new Date().toISOString()
}, null, 2));

NODECHECK_EOF

cd "$REPO_ROOT/atlassian/forge-app"
node "$RUN_DIR/40_node_gate_check.js" | tee "$RUN_DIR/40_bundle_check.txt"
echo ""

# ============================================================================
# STEP 5: MATRIX GENERATION
# ============================================================================
echo "STEP 5: Generating PASS/FAIL matrix..."

cat > "$RUN_DIR/99_RUNTIME_MATRIX.md" << 'MATRIX_EOF'
# ENTERPRISE DASHBOARD RUNTIME POPULATION VERIFICATION

## Overview
**Verification Date**: INCOMPLETE (requires manual DevTools + Forge logs)
**Git Commit**: Verified via repo clean gate
**Branch**: fix/ui-correlation-buffer

---

## Verification Gates (Fail-Closed)

| Gate | Type | Status | Evidence | Instructions |
|------|------|--------|----------|--------------|
| **0** | Repo Clean | ✅ PASS | 00_git_status.txt | Auto-checked: no uncommitted changes |
| **1** | Bundle Markers | ✅ PASS | 40_bundle_check.txt | Auto-checked: UI_CORRELATION_ID_SET, UI_DASH_RAW_ENVELOPE, UI_INVOKE_OK present |
| **2A** | DevTools: CorrelationId Populated | ⏳ MANUAL | 20_DEVTOOLS_RUNTIME_GATES.txt | Run Gate 1 snippet in browser console |
| **2B** | DevTools: Build SHA Populated | ⏳ MANUAL | 20_DEVTOOLS_RUNTIME_GATES.txt | Run Gate 2 snippet in browser console |
| **2C** | DevTools: Build Time Populated | ⏳ MANUAL | 20_DEVTOOLS_RUNTIME_GATES.txt | Run Gate 3 snippet in browser console |
| **2D** | DevTools: Metadata Sections | ⏳ MANUAL | 20_DEVTOOLS_RUNTIME_GATES.txt | Run Gate 4 snippet in browser console |
| **2E** | DevTools: Snapshot ID Populated | ⏳ MANUAL | 20_DEVTOOLS_RUNTIME_GATES.txt | Run Gate 5 snippet in browser console |
| **2F** | DevTools: Export Readiness UI | ⏳ MANUAL | 20_DEVTOOLS_RUNTIME_GATES.txt | Run Gate 6 snippet in browser console |
| **2G** | DevTools: Console Markers | ⏳ MANUAL | 20_DEVTOOLS_RUNTIME_GATES.txt | Run Gate 7 snippet in browser console |
| **3A** | Forge Logs: Resolver Called | ⏳ MANUAL | 30_FORGE_LOGS_GATES.txt | Run: `forge logs --environment staging --tail 300` |
| **3B** | Forge Logs: No Placeholders | ⏳ MANUAL | 30_FORGE_LOGS_GATES.txt | Search: grep NOT_DECLARED_IN_SNAPSHOT (should be 0) |
| **3C** | Forge Logs: No Errors | ⏳ MANUAL | 30_FORGE_LOGS_GATES.txt | Search for ERROR patterns (should be 0) |
| **3D** | Forge Logs: Success Responses | ⏳ MANUAL | 30_FORGE_LOGS_GATES.txt | Search for status: AVAILABLE (should be ≥1) |
| **3E** | Forge Logs: Metadata Present | ⏳ MANUAL | 30_FORGE_LOGS_GATES.txt | Search for metadata fields (should be ≥2) |

---

## Automated Checks (Already Passed)

✅ **Repository Clean**: No uncommitted changes  
✅ **Bundle Markers**: All critical markers present in shipped code:
- ✓ UI_CORRELATION_ID_SET
- ✓ UI_DASH_RAW_ENVELOPE
- ✓ UI_INVOKE_OK
- ✓ ft_getDashboardState_v1
- ✓ Build SHA
- ✓ Build Time
- ✓ Snapshot Metadata
- ✓ Coverage, Integrity, Compliance, Provenance, Export

---

## Manual Gates Required (Instructions Provided)

### DevTools Gates (Run in browser console on staging)
7 gates provided in `20_DEVTOOLS_RUNTIME_GATES.txt`:
1. Correlation ID is populated (not UNSET/NOT_AVAILABLE)
2. Build SHA shows actual commit hash
3. Build Time shows ISO timestamp
4. Metadata sections visible (≥3 declared)
5. Snapshot ID populated
6. Export readiness visible in UI (not console-only)
7. Console markers confirm backend invocation

### Forge Logs Gates (Run on deployed environment)
5 gates provided in `30_FORGE_LOGS_GATES.txt`:
1. Recent logs captured
2. Resolver called (≥1 match)
3. No placeholders (0 NOT_DECLARED matches)
4. No resolver errors (0 related ERROR matches)
5. Success responses present (≥1 AVAILABLE status)
6. Metadata fields in logs (≥2 matches)

---

## How to Complete Verification

### For DevTools Gates:
1. Open staging gadget in browser
2. Press F12 to open DevTools
3. Go to Console tab
4. Copy-paste each code snippet from `20_DEVTOOLS_RUNTIME_GATES.txt`
5. Verify output matches PASS criteria
6. Save results to evidence files

### For Forge Logs Gates:
1. Open terminal
2. Run: `forge logs --environment staging --tail 300 > /tmp/forge_logs_staging.txt`
3. Run each grep command from `30_FORGE_LOGS_GATES.txt`
4. Verify counts match expectations
5. Save results to evidence files

### Generate Final Matrix:
Once all manual gates complete, run:
```bash
cat > /tmp/RUNTIME_FINAL_MATRIX.md << 'FINAL'
[All gates status - DevTools 2A-2G PASS/FAIL, Forge 3A-3E PASS/FAIL]

**Overall Result**: PASS if all 15 gates pass, FAIL if any gate fails

**Runtime Readiness**: PASS if
- All automated gates PASS (repo clean, bundle markers)
- All DevTools gates PASS (7/7 population checks)
- All Forge logs gates PASS (5/5 backend verification)
FINAL
```

---

## Evidence Files Index

| File | Purpose | Status |
|------|---------|--------|
| 00_git_status.txt | Repository clean gate | ✅ PASS |
| 10_bundle_info.txt | Bundle file location and size | ✅ PASS |
| 20_DEVTOOLS_RUNTIME_GATES.txt | DevTools console snippets (manual) | ⏳ PENDING |
| 30_FORGE_LOGS_GATES.txt | Forge logs commands (manual) | ⏳ PENDING |
| 40_bundle_check.txt | Node script bundle marker verification | ✅ PASS |
| 40_node_gate_check.js | Deterministic bundle verification script | ✅ PROVIDED |
| 99_RUNTIME_MATRIX.md | This file - overall matrix | ⏳ INCOMPLETE |

---

## Key Concepts

**Difference from Static Verification**:
- Static verification proved strings exist in code/bundle (WHAT)
- Runtime verification proves values are POPULATED at execution (HOW MUCH)
- Manual gates (DevTools) prove UI renders populated values (VISIBLE)
- Logs gates prove backend returned populated values (CONFIRMED)

**Fail-Closed Behavior**:
- Script stops immediately if repo is not clean
- Script stops if bundle markers missing
- Each manual gate MUST PASS (no "warning" states)
- Placeholder text (NOT_AVAILABLE, NOT_DECLARED) = FAIL

---

## Conclusion Status: ⏳ PENDING MANUAL VERIFICATION

**Automated checks PASSED** (2/2):
- ✅ Repo clean
- ✅ Bundle markers present

**Manual gates required** (12 remaining):
- 7 DevTools gates (staging UI verification)
- 5 Forge logs gates (backend verification)

**Overall result**: Will be PASS only if ALL 12 manual gates complete and PASS.

---

**Generated**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**RUN_DIR**: /tmp/ft_verify_enterprise_runtime_*
**Next Step**: Follow instructions in 20_DEVTOOLS_RUNTIME_GATES.txt and 30_FORGE_LOGS_GATES.txt

MATRIX_EOF

cat "$RUN_DIR/99_RUNTIME_MATRIX.md"
echo ""

# ============================================================================
# FINAL OUTPUT
# ============================================================================
echo ""
echo "==================================================================="
echo "VERIFICATION COMPLETE (Automated Steps)"
echo "==================================================================="
echo ""
echo "✅ AUTOMATED GATES PASSED:"
echo "  - Repository clean"
echo "  - Bundle markers verified"
echo ""
echo "⏳ MANUAL GATES REQUIRED:"
echo "  - 7 DevTools gates (browser console on staging)"
echo "  - 5 Forge logs gates (forge CLI on production logs)"
echo ""
echo "EVIDENCE BUNDLE: $RUN_DIR"
echo ""
echo "Files:"
ls -1 "$RUN_DIR" | sed 's/^/  /'
echo ""
echo "NEXT STEPS:"
echo "1. Read: $RUN_DIR/20_DEVTOOLS_RUNTIME_GATES.txt"
echo "2. Read: $RUN_DIR/30_FORGE_LOGS_GATES.txt"
echo "3. Execute manual gates in staging"
echo "4. Record results and generate final matrix"
echo ""
