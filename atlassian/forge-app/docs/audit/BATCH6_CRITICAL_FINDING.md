# BATCH 6 CRITICAL FINDING: Phase 05 Audit Message Misleading

## Evidence Directory
`/tmp/ft_clean_batch6_20260228T082618Z`

## CRITICAL FINDING

**The Phase 05 audit script produces MISLEADING error messages.**

### What the Audit Says:
- 381 HIGH flags with message: "Storage key uses process.env"

### Reality:
- **ZERO storage keys actually use process.env**
- The 36 process.env matches in src/ are for:
  - Environment detection (FORGE_ENV, NODE_ENV) 
  - Build metadata (FT_BUILD_SHA, FT_BUILD_TIME_UTC)
  - Debug flags (FT_DEBUG_INVARIANTS, FT_FIXED_UTC)
  - **NONE are in storage key construction**

### Root Cause

In `tools/audit/v3_1/lib/forge_specific.sh` line 122:
```bash
phase_flag "05" "HIGH" "Storage key uses process.env at ${fp}:${ln}" "$summary_txt"
```

This message is triggered by `is_flag=1` which is set for:
- `unknown_dynamic` key types (line 81)
- `dynamic_no_tenant_binding` (line 75)
- `static_no_tenant_binding` (line 65)

**The message "uses process.env" is FALSE for >99% of these flags.**

### Actual Problem

The 381 HIGH flags are for storage operations where:
1. **Key is dynamically computed** (unknown_dynamic) - scanner can't trace tenant binding
2. **Key includes literal strings** but no tenant context (static_no_tenant_binding)

These are **NOT process.env issues**.

## Correct Remediation Approach

### Option A: Fix the Audit Script (Recommended)
Change line 122 to accurate message:
```bash
phase_flag "05" "HIGH" "Storage key type ${key_type} cannot verify tenant binding at ${fp}:${ln}" "$summary_txt"
```

### Option B: Massive Refactoring (50+ hours)
To eliminate unknown_dynamic flags, would need to:
1. Thread tenantKey through 100+ functions
2. Convert all helper-function-based keys to inline makeStorageKey()
3. Refactor 50+ files with storage operations

**This is NOT a "process.env removal" task - it's architectural refactoring.**

## Metrics (Baseline)

| Metric | Count | Source |
|--------|-------|--------|
| process.env in src/ | 36 | rg_process_env_src.txt |
| process.env in storage keys | **0** | Manual verification |
| Phase 05 HIGH flags | 381 | .flags_05_before |
| unknown_dynamic keys | ~190 | PHASE_05_storage_key_audit.json |
| static_no_tenant_binding | ~191 | PHASE_05_storage_key_audit.json |

## Files with Highest Flag Counts

From audit analysis (file:flag_count):
1. src/access-review/phase3Workflow.ts: 18 flags
2. src/milestone1/storage.ts: 16 flags  
3. src/phase6/snapshot_storage.ts: 15 flags
4. src/jobs/v565/snapshotScheduleKickoff.ts: 12 flags
5. src/storage_index.ts: 11 flags
6. src/storage.ts: 11 flags
7. src/gadget-resolver.ts: 11 flags
8. src/scheduled/scheduler_state.ts: 10 flags
9. src/run_ledgers.ts: 10 flags
10. src/resolvers/getOperationalState.ts: 10 flags

**Verification: NONE of these files use process.env in storage keys.**

## Recommended Action

1. **Fix audit script message** (2 minutes, accurate reporting)
2. **Create allowlist** for known-safe dynamic keys (2 hours, pragmatic)
3. **Defer refactoring** to dedicated architectural sprint (50+ hours)

## Batch 6 Status

**Cannot proceed as specified** because:
- User request: "Replace process.env-derived storage keys"
- Reality: Zero process.env-derived storage keys exist
- Actual issue: Dynamic key construction (different problem)

**Recommendation:** Update Batch 5 remaining work document with accurate problem statement, fix audit script message, create targeted fixes for specific high-value files.

---

*Generated: 2026-02-28T08:26:18Z*
*Evidence: /tmp/ft_clean_batch6_20260228T082618Z*
