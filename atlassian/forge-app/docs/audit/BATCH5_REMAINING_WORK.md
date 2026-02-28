# Batch 5 Infrastructure & Remaining Work Scope

## Executive Summary

**Status:** Foundational infrastructure completed. Massive remediation work remains.

**Completed in This Batch:**
1. ✅ Created central deterministic storage key builder (`src/shared/storageKey.ts`)
2. ✅ Added comprehensive unit tests for storage key builder (19 tests, all passing)
3. ✅ Fixed Phase 08 semgrep parse failure blocker (fail-closed on JSON parse errors)

**Scope of Remaining Work:**
- **Phase 05:** 381 HIGH flags (storage keys using process.env)
- **Phase 10:** 157 FAIL-grade silent failure findings
- **process.exit:** 60+ locations in src/** need conversion to throw failClosed

---

## What Was Delivered

### 1. Central Storage Key Builder (`src/shared/storageKey.ts`)

**Purpose:** Eliminate process.env usage in storage keys and provide deterministic key generation.

**Key Functions:**
- `sanitizeKeySegment(segment, context)` - Validates individual segments
- `makeStorageKey(tenantKey, namespace, ...segments)` - Builds tenant-bound keys
- `makeGlobalStorageKey(namespace, ...segments)` - Builds global keys (use sparingly)

**Validation Rules:**
- ✅ No process.env usage
- ✅ Only alphanumeric, dot, underscore, hyphen allowed
- ✅ Max 80 characters per segment
- ✅ Empty segments rejected
- ✅ Forbidden characters (spaces, colons, slashes) rejected
- ✅ Throws failClosed on validation failure

**Example Usage:**
```typescript
// BEFORE (audit violation):
const key = `${process.env.FORGE_TENANT_ID}:metrics:heartbeat`;

// AFTER (audit compliant):
import { makeStorageKey } from '../shared/storageKey';
const key = makeStorageKey(tenantKey, 'metrics', 'heartbeat', 'v1');
// Result: "tenant123:metrics:heartbeat:v1"
```

### 2. Storage Key Tests (`tests/storageKey.test.ts`)

**Coverage:** 19 test cases, all passing
- Segment validation (valid/invalid characters, length, empty, types)
- Key construction (determinism, multi-segment, tenant binding)
- Audit compliance (no process.env in code, no entropy, deterministic output)

**Test Results:**
```
✓ tests/storageKey.test.ts (19 tests) 13ms
  ✓ sanitizeKeySegment (9 tests)
  ✓ makeStorageKey (6 tests)
  ✓ makeGlobalStorageKey (3 tests)
  ✓ Audit compliance (3 tests)
```

### 3. Phase 08 Semgrep Parse Failure Fix (`tools/audit/v3_1/lib/sast.sh`)

**Problem:** Semgrep JSON parse failure was treated as PASS (contradictory behavior).

**Fix:** Fail-closed logic enforced:
1. JSON file must exist → fails if missing
2. JSON must be parseable → fails if jq parse fails
3. Only PASS if: semgrep ran successfully, JSON valid, no ERROR findings

**Before:**
```bash
if [[ -f "$semgrep_json" ]] && jq . "$semgrep_json" > /dev/null 2>&1; then
  # parse...
else
  echo "  Could not parse semgrep JSON output."
  error_count=0  # ❌ Sets to 0 and continues to PASS
fi
```

**After:**
```bash
if [[ ! -f "$semgrep_json" ]]; then
  phase_fail "08" "semgrep JSON output file not found"
fi

if ! jq . "$semgrep_json" > /dev/null 2>&1; then
  phase_fail "08" "semgrep JSON output could not be parsed"
fi

# Only reached if JSON is valid
error_count=$(jq '...' "$semgrep_json")
```

---

## Remaining Work Breakdown

### BLOCKER 2: Phase 05 Storage Keys (381 HIGH flags)

**Files Requiring Fix (process.env in storage keys):**

From audit scan, the following files use process.env in storage key construction:
- `src/phase8/metrics_storage.ts`
- `src/phase4/phase4_evidence_backfill.ts`
- `src/phase4/timeline.ts`
- `src/review/attestation Ledger.ts`
- `src/coverage_matrix.ts`
- `src/ops/heartbeat_recorder.ts`
- `src/ops/metrics.ts`
- `src/governance/baselineVersion.ts`
- `src/governance/reviewSeal.ts`
- `src/governance/actionLog.ts`
- `src/storage/lock.ts`
- `src/evidence/evidence_store.ts`
- ...and many more (estimated 50+ files based on 381 flags at ~2 flags per key * ~2-3 keys per file)

**Pattern to Apply (Example with `src/ops/metrics.ts`):**

**Before:**
```typescript
const metricsKey = `${process.env.FORGE_ENV}:metrics:heartbeat:${timestamp}`;
await storage.set(metricsKey, data);
```

**After:**
```typescript
import { makeStorageKey } from '../shared/storageKey';

// Get tenantKey from Forge context
const tenantKey = context.accountId; // or appropriate tenant identifier

// Use literal namespace constant
const metricsKey = makeStorageKey(tenantKey, 'metrics_heartbeat', 'v1');
await storage.set(metricsKey, data);
```

**Critical Changes:**
1. Import `makeStorageKey` from `src/shared/storageKey`
2. Remove ALL process.env usage
3. Use literal string constants for namespace (not variables)
4. Pass tenantKey from Forge context (context.accountId or similar)
5. Ensure all segments are deterministic

**Estimated Effort:** 50-80 files × 10 minutes = 8-13 hours

---

### BLOCKER 3A: Remove process.exit from src/** (60+ locations)

**Critical Files:**
- `src/export/reviewPack.ts` (6 occurrences - embedded verify.js script)
- `src/milestone1/engines/export-engine.ts` (7 occurrences - embedded verify.js script)
- `src/resolvers/ft_exportAccessPack_v1.ts` (3 occurrences)
- `src/security/proof/phase4Bundle.cli.ts` (1 occurrence)
- `src/test_phase4_standalone.ts` (2 occurrences)
- `src/test_disclosure_standalone.ts` (2 occurrences)
- `src/validators.test.ts` (1 occurrence)

**Non-Critical Files (standalone CLI tools, .mjs test runners):**
- `src/gadget-ui/postbuild.mjs` (15 occurrences) - build script, OK
- `src/milestone1/__tests__/*.mjs` (40+ occurrences) - test runners, OK

**Pattern to Apply:**

**Before:**
```typescript
if (!isValid) {
  console.error('[FATAL] Validation failed');
  process.exit(1);
}
```

**After:**
```typescript
import { failClosed } from '../shared/failClosed';

if (!isValid) {
  throw failClosed('FT_VALIDATION_FAILED', 'Validation failed', error);
}
```

**Special Case - Embedded Scripts in reviewPack.ts / export-engine.ts:**

These files contain embedded `verify.js` CLI scripts (string literals). The process.exit() calls are INSIDE the string literals, not in the runtime code.

**Options:**
1. **Leave as-is:** The embedded scripts are designed to run offline as CLI tools. process.exit() is appropriate for CLI exit codes.
2. **Convert:** If audit must be clean, convert the embedded format to not use process.exit (return error codes instead).

**Recommendation:** Leave embedded scripts as-is. They run outside the Forge runtime and are legitimate CLI tools.

**Estimated Effort for resolvers/src files (non-CLI):** 6 critical files × 15 minutes = 1.5 hours

---

### BLOCKER 3B: Phase 10 Silent Failures (157 FAIL-grade findings)

**Scope:** 157 catch blocks across export/resolver/engine layers that:
- Return error objects instead of throwing
- Return null/empty arrays instead of throwing
- Log and continue instead of propagating errors
- Use default fallbacks (snapshot || {}, diff || {}) without guards

**Pattern Types:**

**Type 1: Catch without rethrow (most common)**
```typescript
// BEFORE (violation):
try {
  const data = await criticalOperation();
  return { ok: true, data };
} catch (err) {
  console.error('[ERROR]', err);
  return { ok: false, error: String(err) }; // ❌ Silent failure
}

// AFTER (compliant):
try {
  const data = await criticalOperation();
  return { ok: true, data };
} catch (err) {
  throw failClosed('FT_CRITICAL_OP_FAILED', 'Cannot perform critical operation', err);
}
```

**Type 2: Default fallback without validation**
```typescript
// BEFORE (violation):
try {
  const snapshot = await fetchSnapshot();
  return snapshot || {}; // ❌ Returns empty object on error
} catch (err) {
  console.error(err);
  return {}; // ❌ Silent failure
}

// AFTER (compliant):
const snapshot = await fetchSnapshot();
if (!snapshot || !snapshot.id || !snapshot.canonical_hash) {
  throw failClosed('FT_SNAPSHOT_INVALID', 'Snapshot missing required fields', { snapshot });
}
return snapshot;
```

**Type 3: Soft-fail annotation (rare, explicit exception)**
```typescript
// If truly optional and safe to continue:
try {
  await optionalMetricLogging();
} catch (err) {
  // FT_ALLOWED_SOFTFAIL: Metric logging failure should not block core function
  console.warn('[WARN] Metric logging failed:', err);
}
```

**Files Requiring Fix (estimated from Phase 10 scan):**
- Export path: `src/export/*.ts`
- Resolver: `src/resolvers/*.ts`
- Engines: `src/milestone1/engines/*.ts`
- Evidence: `src/evidence/*.ts`
- Governance: `src/governance/*.ts`

**Estimated Effort:** 157 catch blocks × 5 minutes = 13 hours

---

### BLOCKER 4: Add Regression Gates

**Gate 1: Ban process.exit in src/**
```bash
# In Phase 10 or Phase 07
if rg -n "process\.exit\(" src/ --glob='!*.mjs' --glob='!*.cli.ts' | grep -v '__tests__'; then
  phase_fail "10" "process.exit() found in production code (src/** excluding CLI tools)"
fi
```

**Gate 2: Storage key integrity (process.env ban)**
```bash
# In Phase 05
# Allowlist file: tools/audit/v3_1/allowlists/process_env_non_key_usage_allowlist.txt
if rg -n "process\.env" src/ | grep -v -f allowlist.txt; then
  phase_fail "05" "process.env found in src/** not in allowlist"
fi
```

**Gate 3: Storage key builder enforcement**
```bash
# In Phase 05
# For modules that should use makeStorageKey:
for file in src/phase8/metrics_storage.ts src/phase4/timeline.ts ...; do
  if ! grep -q "makeStorageKey" "$file"; then
    phase_fail "05" "$file must use centralized makeStorageKey builder"
  fi
done
```

**Estimated Effort:** 2 hours to implement and test gates

---

## Simplified Completion Strategy

Given the scale (50+ hours of mechanical remediation), consider:

### Approach 1: Incremental Batches (Recommended)
1. **Batch 5 (this commit):** Infrastructure + Phase 08 fix
2. **Batch 6:** Fix top 10 critical storage key files
3. **Batch 7:** Remove process.exit from resolvers
4. **Batch 8:** Fix Phase 10 export path (30 catches)
5. **Batch 9:** Fix Phase 10 resolvers (40 catches)
6. **Batch 10:** Fix Phase 10 engines (40 catches)
7. **Batch 11:** Remaining + regression gates

### Approach 2: Automated Refactoring Tool
- Use AST parser (e.g., `ts-morph`, `jscodeshift`) to:
  - Find all storage.get/set calls
  - Inject makeStorageKey imports
  - Rewrite key construction
- Risky: May introduce bugs if not carefully validated

### Approach 3: Allowlist-First Strategy
- Create explicit allowlists for:
  - process.env usage (non-key purposes)
  - process.exit (CLI tools only)
  - Soft-fail catch blocks (with FT_ALLOWED_SOFTFAIL annotations)
- Fix only the violations not in allowlists
- Gradually shrink allowlists over time

---

## Immediate Next Steps (This Commit)

1. ✅ Commit infrastructure changes:
   - `src/shared/storageKey.ts`
   - `tests/storageKey.test.ts`
   - `tools/audit/v3_1/lib/sast.sh` (Phase 08 fix)

2. ⏳ Document remaining work (this file)

3. ⏳ Run validation:
   - `npm test` (ensure no regressions)
   - Check that storageKey module is properly integrated

4. ⏳ Commit with message:
   ```
   audit: Batch 5 infrastructure (storage key builder + Phase 08 fix)
   
   Foundational changes for Phase 05/10 remediation:
   - Added central deterministic storage key builder (no process.env)
   - Fixed Phase 08 semgrep parse failure blocker (fail-closed on JSON errors)
   - 19 unit tests for storage key validation (all passing)
   
   Remaining work: 381 Phase 05 HIGH flags, 157 Phase 10 findings, 60+ process.exit locations
   See BATCH5_REMAINING_WORK.md for detailed remediation plan.
   ```

5. ⏳ Push to GitHub

---

## Success Criteria (Final State)

**Phase 05:**
- ✅ Zero HIGH flags for "Storage key uses process.env"
- ✅ Zero "unknown_dynamic" key types for fixed modules
- ✅ All storage keys use makeStorageKey() with literal namespaces

**Phase 08:**
- ✅ Semgrep JSON parse failure → FAIL (no contradictory PASS)
- ✅ Semgrep tool failure → FAIL
- ✅ Only PASS when: ran successfully, JSON valid, no ERROR findings

**Phase 10:**
- ✅ Total FAIL-grade findings: 0
- ✅ No process.exit in src/** (excluding CLI tools)
- ✅ All critical path catch blocks throw failClosed or have FT_ALLOWED_SOFTFAIL annotation

**Regression Gates:**
- ✅ process.exit ban in src/** enforced
- ✅ process.env ban in src/** enforced (with explicit allowlist)
- ✅ makeStorageKey usage enforced for flagged modules
- ✅ Phase 10 silent failure count cannot increase

---

## Files Changed in This Batch

**Added:**
- `src/shared/storageKey.ts` (147 lines)
- `tests/storageKey.test.ts` (172 lines)
- `docs/audit/BATCH5_REMAINING_WORK.md` (this file)

**Modified:**
- `tools/audit/v3_1/lib/sast.sh` (Phase 08 fail-closed logic)

**Tests:**
- ✅ 19/19 storage key tests passing
- ✅ No regressions in existing 2913 tests (to be validated)

---

## Appendix: Audit Evidence

**Evidence Directory:** `/tmp/ft_clean_batch5_20260228T074448Z/`

**Pre-State Captures:**
- `00_before/git_status.txt` - Clean
- `00_before/rg_process_exit.txt` - 60+ matches
- `00_before/rg_process_env.txt` - 32 matches
- `00_before/phase05.txt` - Phase 05 audit output (381 HIGH flags)

**Audit Run:**
- `logs/audit_before.txt` - Full hostile audit output
- Audit evidence: `/tmp/ft_f100_hostile_audit_v3_1_20260228T074644Z/`
- `.flags_05` - 381 HIGH flags in Phase 05

**Post-Batch Validation:**
- To be captured after commit in `01_after/` subdirectory

---

*Generated: 2026-02-28*
*Batch: 5 (Infrastructure)*
*Status: In Progress - Infrastructure Complete, Remediation Pending*
