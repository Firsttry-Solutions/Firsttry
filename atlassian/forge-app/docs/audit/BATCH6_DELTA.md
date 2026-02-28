# Batch 6 Delta Report: Phase 05 Audit Analysis

## Evidence Directory
`/tmp/ft_clean_batch6_20260228T082618Z`

## Executive Summary

**Status:** Analysis complete. **No process.env-derived storage keys found.**

The Phase 05 audit script's error message is misleading. Fixes documented; audit script correction recommended.

## Baseline Metrics

| Metric | Before (Baseline) |
|--------|-------------------|
| process.env matches in src/ | 36 |
| process.env in storage keys | **0** (verified) |
| Phase 05 HIGH flags | 381 |

## Analysis Results

### Finding 1: Zero Process.env in Storage Keys

**Verification Method:** Manual inspection of all 36 process.env instances in src/

**Usage Categories:**
1. **Environment detection** (12 instances):
   - `process.env.FORGE_ENV` - Environment name (production/development)
   - `process.env.NODE_ENV` - Node environment
   - `process.env.FORGE_ENVIRONMENT` - Forge environment

2. **Build metadata** (8 instances):  
   - `process.env.FT_BUILD_SHA` - Build commit hash
   - `process.env.FT_BUILD_TIME_UTC` - Build timestamp
   - `process.env.FORGE_APP_VERSION` - App version

3. **Debug/diagnostic flags** (6 instances):
   - `process.env.FT_DEBUG_INVARIANTS` - Debug mode flag
   - `process.env.FT_FIXED_UTC` - Deterministic clock override
   - `process.env.FT_DIAG_TOKEN` - Diagnostic token

4. **File paths (test/CLI only)** (6 instances):
   - `process.env.FT_EXPORT_SCHEMA_PATH` - Test schema path
   - `process.env.FT_MANIFEST_PATH` - Test manifest path
   - `process.env.FT_SRC_ROOT` - Test source root

5. **Documentation (storageKey.ts comments)** (4 instances):
   - Examples showing what NOT to do (anti-patterns)

**NONE are used in storage key construction.**

### Finding 2: Phase 05 HIGH Flags Are NOT ProcessEnv Related

**Audit Script Issue (tools/audit/v3_1/lib/forge_specific.sh:122):**
```bash
phase_flag "05" "HIGH" "Storage key uses process.env at ${fp}:${ln}" "$summary_txt"
```

**Triggered By:**
- `unknown_dynamic` key type (scanner can't trace key through helper functions)
- `static_no_tenant_binding` (literal global keys)
- `dynamic_no_tenant_binding` (template strings without tenant vars)

**NOT triggered by actual process.env usage.**

### Finding 3: Real Issue Classification

From PHASE_05_storage_key_audit.json analysis:

| Key Type | Count | Example |
|----------|-------|---------|
| unknown_dynamic | ~190 | `await storage.get(buildKey(...))` |
| static_no_tenant_binding | ~191 | `await storage.get('ft:snapshot:last:v1')` |
| Total HIGH flags | 381 | — |

**Root Cause:** Static analysis cannot:
1. Trace keys built by helper functions (even if deterministic)
2. Verify tenant isolation for global singleton keys (even if Forge auto-isolates)

## Top 10 Flagged Files (Verified No Process.Env)

| File | Flags | Process.Env Used? |
|------|-------|-------------------|
| src/access-review/phase3Workflow.ts | 18 | ❌ No |
| src/milestone1/storage.ts | 16 | ❌ No |
| src/phase6/snapshot_storage.ts | 15 | ❌ No |
| src/jobs/v565/snapshotScheduleKickoff.ts | 12 | ❌ No |
| src/storage_index.ts | 11 | ❌ No |
| src/storage.ts | 11 | ❌ No |
| src/gadget-resolver.ts | 11 | ❌ No |
| src/scheduled/scheduler_state.ts | 10 | ❌ No |
| src/run_ledgers.ts | 10 | ❌ No |
| src/resolvers/getOperationalState.ts | 10 | ❌ No |

**All use deterministic helper functions or literal keys. None use process.env.**

## Delta: Before vs After

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| process.env in src/ | 36 | 36 | 0 (none in storage keys) |
| Phase 05 HIGH flags | 381 | 381 | 0 (audit script issue) |
| Files analyzed | 10 | 10 | ✅ Verified clean |

**Batch 6 reduces Phase 05 HIGH flags by: 0**

## Why Zero Reduction?

**Statement:** Batch 6 analysis reveals that **the Phase 05 audit problem is NOT process.env usage** (which doesn't exist in storage keys) but rather:

1. **False messaging:** Audit script says "uses process.env" when it means "cannotverify tenant binding"
2. **Static analysis limitation:** Scanner can't trace deterministic helper functions
3. **Forge auto-isolation:** Many flagged keys are global singletons that Forge tenant-isolates automatically

## Correct Remediation Path

### Immediate (2 minutes)
**Fix audit script message:**
```bash
# Line 122 in tools/audit/v3_1/lib/forge_specific.sh
# BEFORE:
phase_flag "05" "HIGH" "Storage key uses process.env at ${fp}:${ln}" "$summary_txt"

# AFTER:
phase_flag "05" "HIGH" "Storage key type ${key_type} at ${fp}:${ln} - cannot verify tenant binding statically" "$summary_txt"
```

### Short-term (2-4 hours)
**Create allowlist for known-safe patterns:**
```
tools/audit/v3_1/allowlists/storage_key_safe_patterns.txt
```
**Document:**
- Helper functions that provide tenant binding
- Global singleton keys (Forge auto-isolates)
- Test-only keys

### Long-term (50+ hours - architectural sprint)
**Refactor storage layer:**
- Thread tenantKey explicitly through all functions
- Replace helper functions with inline makeStorageKey()
- Migrate to centralized storage facade

## Files Changed This Batch

| File | Lines | Purpose |
|------|-------|---------|
| docs/audit/BATCH6_TARGET_FILES.txt | 10 | Top 10 flagged files list |
| docs/audit/BATCH6_CRITICAL_FINDING.md | 150 | Analysis findings |
| docs/audit/BATCH6_DELTA.md | 180 | This file |

**No source code changes** - analysis revealed problem is audit script messaging, not code.

## Recommendations

1. **Merge Batch 6** with evidence documentation
2. **Fix audit script** message in Batch 7
3. **Create allowlist** for safe storage patterns
4. **Update Batch 5 remaining work** to reflect accurate problem

## Evidence Artifacts

**Location:** `/tmp/ft_clean_batch6_20260228T082618Z/`

**Key Files:**
- `00_before/rg_process_env_src.txt` - All 36 process.env instances (none in storage)
- `00_before/rg_process_env_src.count` - Count: 36
- `00_before/flags05_high.count` - Count: 381
- `00_before/.flags_05_before` - Full flag list
- `00_before/PHASE_05_summary_before.txt` - Audit output
- `00_before/audit_before_keylines.txt` - Key audit lines (382 lines)

**Verification:**
```bash
# No process.env in storage key construction:
cd /workspaces/Firsttry/atlassian/forge-app
rg "storage\.(get|set|delete)\([^)]*process\.env" src/
# Result: No matches
```

---

*Generated: 2026-02-28T08:26:18Z*  
*Status: Analysis Complete - No Code Changes Required*  
*Recommendation: Fix Audit Script Message*
