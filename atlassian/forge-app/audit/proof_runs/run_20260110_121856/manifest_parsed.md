# Manifest Parsed Analysis

**Generated from**: atlassian/forge-app/manifest.yml (snapshot: manifest_snapshot.yml)

## Scopes Table

| Scope | Type | Line | Purpose | Risk |
|-------|------|------|---------|------|
| `read:jira-work` | Read | 83 | Read Jira work (issues, projects, boards) | ✅ Read-only |
| `storage:app` | Read/Write | 82 | App-level storage (entity storage) | ℹ️ App-local data only |

**Summary**: 
- ✅ NO write:jira scopes present
- ✅ NO manage:jira scopes present
- ✅ NO write:servicedesk scopes present
- Total scopes: 2 (1 read, 1 app-local storage)

## Modules Table

| Module Type | Key | Handler | Line | Risk Assessment |
|-------------|-----|---------|------|-----------------|
| **jira:dashboardGadget** | governance-dashboard-gadget | status-resolver-fn | 18-23 | ✅ Read-only UI |
| **function** | phase5-scheduler-fn | scheduled/phase5_scheduler.run | 28 | ⏱️ Scheduled |
| **function** | phase6-daily-snap-fn | scheduled/snapshot_daily.handle | 29 | ⏱️ Scheduled |
| **function** | phase6-weekly-snap-fn | scheduled/snapshot_weekly.handle | 30 | ⏱️ Scheduled |
| **function** | token-refresh-job-fn | scheduled/token_refresh_scheduler.handle | 31 | ⏱️ Token ops |
| **function** | config-vis-sched-fn | scheduled/config_visibility_scheduler.run | 32 | ⏱️ Scheduled |
| **function** | perf-signals-sched-fn | scheduled/perf_signals_scheduler.run | 33 | ⏱️ Scheduled |
| **function** | phase4-scheduler-fn | scheduled/phase4_scheduler.runDaily | 34 | ⏱️ Scheduled |
| **function** | status-resolver-fn | resolvers/governance_status.get | 35 | ✅ Resolver |
| **scheduledTrigger** | phase5-auto-scheduler | phase5-scheduler-fn | 52-53 | ⏱️ Every 5 min |
| **scheduledTrigger** | phase6-daily-snapshot | phase6-daily-snap-fn | 55-56 | ⏱️ Daily |
| **scheduledTrigger** | phase6-weekly-snapshot | phase6-weekly-snap-fn | 58-59 | ⏱️ Weekly |
| **scheduledTrigger** | token-refresh-job | token-refresh-job-fn | 61-62 | ⏱️ Hourly |
| **scheduledTrigger** | config-visibility-scheduler | config-vis-sched-fn | 64-65 | ⏱️ Daily |
| **scheduledTrigger** | perf-signals-scheduler | perf-signals-sched-fn | 67-68 | ⏱️ Daily |
| **scheduledTrigger** | phase4-timeline-scheduler | phase4-scheduler-fn | 70-71 | ⏱️ Daily |

**Summary**:
- Total function keys: 8
- Total scheduled triggers: 7 (all pointing to functions)
- Module types: 1 dashboard gadget + 8 functions + 7 scheduled triggers
- Key length compliance: ✅ All ≤ 23 chars

## Resources Table

| Key | Path | Type | Line |
|-----|------|------|------|
| govGadget2140 | src/gadget-ui/dist | UI Bundle | 88 |

## Egress Declaration

**Manifest declares**: NO `egress` section present  
**Implication**: NONE. The app does not have explicit egress URLs declared.

**Status**: Must verify code scans for implicit egress (fetch, HTTP calls) in PHASE 2.3.

## Storage Declaration

**Manifest declares**:
- `storage:app` scope (line 82) → app-level storage

**Implication**: 
- Entity storage queries allowed
- No egress to external databases declared
- Data stays in Atlassian infrastructure

---

## Fact Extraction Summary

| Fact | Value | Confidence |
|------|-------|-----------|
| App uses write:jira? | ❌ NO | HIGH |
| App uses manage:jira? | ❌ NO | HIGH |
| App declares egress URLs? | ❌ NO | HIGH |
| App has scheduled tasks? | ✅ YES (7 triggers) | HIGH |
| App requires auth tokens? | ✅ YES (token-refresh) | HIGH |
| App stores data? | ✅ YES (storage:app) | HIGH |

