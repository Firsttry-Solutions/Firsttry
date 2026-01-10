# Scheduler Consolidation Plan - Forge Trigger Limit Compliance

## Objective
Reduce scheduledTrigger module count from 7 to 4 (≤5 limit) to meet Forge platform constraints, while preserving all job cadences and behaviors.

---

## CURRENT STATE: 7 Scheduled Triggers

| # | Key | Interval | Handler | Function |
|---|-----|----------|---------|----------|
| 1 | `phase5-auto-scheduler` | **fiveMinute** | `phase5_scheduler.run` | Phase 5 metric detection (fast cadence) |
| 2 | `phase6-daily-snapshot` | **day** | `snapshot_daily.handle` | Daily evidence collection |
| 3 | `phase6-weekly-snapshot` | **week** | `snapshot_weekly.handle` | Weekly evidence collection |
| 4 | `token-refresh-job` | **hour** | `token_refresh_scheduler.handle` | OAuth token refresh |
| 5 | `config-visibility-scheduler` | **day** | `config_visibility_scheduler.run` | Daily config complexity metrics |
| 6 | `perf-signals-scheduler` | **day** | `perf_signals_scheduler.run` | Daily performance signals |
| 7 | `phase4-timeline-scheduler` | **day** | `phase4_scheduler.runDaily` | Daily Phase 4 timeline updates |

---

## TARGET STATE: 4 Scheduled Triggers (≤5 Limit)

| # | Key | Interval | Handler | Function |
|---|-----|----------|---------|----------|
| 1 | `phase5-auto-scheduler` | **fiveMinute** | `phase5_scheduler.run` | Phase 5 metric detection (UNCHANGED) |
| 2 | `token-refresh-job` | **hour** | `token_refresh_scheduler.handle` | OAuth token refresh (UNCHANGED) |
| 3 | `phase6-weekly-snapshot` | **week** | `snapshot_weekly.handle` | Weekly evidence collection (UNCHANGED) |
| 4 | `daily-dispatcher` | **day** | `scheduler_daily_dispatcher.runDailyDispatch` | **NEW**: Daily job aggregator |

### Daily Dispatcher Execution Order
The `daily-dispatcher` trigger will invoke all daily jobs in sequence (fail-tolerant):
1. `snapshot_daily.handle` → Daily evidence
2. `config_visibility_scheduler.run` → Daily config metrics
3. `perf_signals_scheduler.run` → Daily perf signals
4. `phase4_scheduler.runDaily` → Daily timeline updates

If any job fails, dispatcher logs the failure, continues with remaining jobs, then throws a summary error (ensuring visibility of failures while not blocking other jobs).

---

## Cadence Preservation Statement

**No cadence loss. All frequencies remain identical:**
- ✓ Phase 5: fiveMinute (unchanged)
- ✓ Token refresh: hour (unchanged)
- ✓ Weekly snapshot: week (unchanged)
- ✓ **Daily jobs: ALL REMAIN DAILY** (now consolidated under one trigger `daily-dispatcher`)

**Behavioral Guarantees:**
- Each daily job runs exactly once per day (via `daily-dispatcher`)
- Jobs run in deterministic order
- Failures in one job do not prevent others from running
- Execution logs clearly mark start/end and per-job success/failure

---

## Implementation Files

| File | Type | Purpose |
|------|------|---------|
| `manifest.yml` | Modified | Add `daily-dispatcher-fn` function, replace 4 daily triggers with 1 dispatcher trigger |
| `src/scheduled/scheduler_daily_dispatcher.ts` | **NEW** | Dispatcher that calls 4 daily job handlers in sequence |
| This document | **NEW** | Consolidation plan and audit trail |

---

## Validation Checklist

Before commit:
- [ ] `forge lint` passes (no errors)
- [ ] `npm test` passes (all 1243 tests)
- [ ] `npm run reviewer:gate` passes with GATE_PASS token
- [ ] `forge deploy -e production` succeeds (no manifest validation errors)
- [ ] Freeze lock verification passes (if generator exists)

---

## Rollback Instructions

If consolidation fails validation:
1. Revert `manifest.yml` to original (7 triggers)
2. Delete `src/scheduled/scheduler_daily_dispatcher.ts`
3. Restore original state: `git checkout -- .`

---

## Sign-off

**Plan Author:** Copilot Patch Agent  
**Approval Date:** 2026-01-10  
**Status:** Ready for implementation → STEP 2
