# PHASE 9.5-C SPECIFICATION: SNAPSHOT RELIABILITY SLA

**Version:** 1.0  
**Status:** Complete  
**Date:** 2024  
**Key Invariant:** FirstTry reliability is measured by FirstTry's OWN snapshot execution, NOT by Jira's capability.

---

## OVERVIEW

Phase 9.5-C measures **FirstTry's own reliability** in capturing governance evidence. It answers:
- Can FirstTry execute snapshots consistently?
- When did the last successful snapshot occur?
- Are consecutive failures occurring?
- Are rate limits affecting snapshot quality?

**Critical:** This measures FirstTry's snapshot capability, NOT Jira's reliability.

---

## CORE CONCEPTS

### Snapshot Run States

| Status | Definition | Implication |
|--------|-----------|------------|
| `scheduled` | Job queued, not yet executed | Snapshot pending |
| `successful` | All required data captured | Full governance evidence |
| `partial` | Some data captured (e.g., rate-limited) | Degraded service |
| `failed` | Snapshot execution failed | No evidence captured |

### Reliability Windows

FirstTry computes reliability for rolling windows:
- **7-day:** Recent snapshot quality
- **30-day:** Monthly reliability trend
- **90-day:** Long-term reliability baseline

### Alert Conditions (FirstTry-Only)

#### Condition 1: No Successful Run Since N Days
```
Alert triggered when: (now - last_successful_run) > no_successful_run_threshold_days
Default threshold: 3 days
```

#### Condition 2: Consecutive Failed Runs
```
Alert triggered when: consecutive_failures_count >= consecutive_failures_threshold
Default threshold: 5 consecutive failures
```

---

## RELIABILITY METRICS

### Window Reliability Metrics

For each 7/30/90-day window:

```typescript
{
  window_days: 7 | 30 | 90,
  window_start: ISO 8601 UTC,
  window_end: ISO 8601 UTC,
  
  // Counts
  total_scheduled: number,      // All runs in window
  successful_runs: number,      // status === 'successful'
  partial_runs: number,         // status === 'partial'
  failed_runs: number,          // status === 'failed'
  
  // Rates (percentages)
  success_rate: number,         // (successful / total) * 100
  success_or_partial_rate: number,  // (successful + partial) / total * 100
  
  // Execution metrics
  mean_duration_ms: number,     // Average wall-clock time
  rate_limit_incidents: number  // Count of rate-limit hits
}
```

### Snapshot Reliability Status

Complete reliability snapshot:

```typescript
{
  tenant_id: string,
  computed_at: ISO 8601 UTC,
  
  // Last run information
  last_scheduled_run_at: ISO 8601 | 'NEVER',
  last_completed_run_at: ISO 8601 | 'NEVER',
  last_run_status: SnapshotRunStatus | 'NEVER',
  last_run_days_ago: number | null,
  
  // Three windows of reliability
  metrics_7_day: WindowReliabilityMetrics,
  metrics_30_day: WindowReliabilityMetrics,
  metrics_90_day: WindowReliabilityMetrics,
  
  // Alert-relevant metrics
  no_successful_run_days: number,     // Days since last successful
  consecutive_failures: number,       // Count at end of run history
  
  canonical_hash: SHA-256,
  schema_version: '1.0'
}
```

---

## ALERT SYSTEM

### Alert Decision Flow

```
Reliability Status
       ↓
Detect Alert Conditions
       ↓
Enforce FirstTry-Only Rule
       ↓
Check Previous Notification State
       ↓
Decide: Send? (with reasoning)
       ↓
Route to Admin/Email
       ↓
Track in History
```

### Alert Conditions (NOT Thresholds)

**CRITICAL RULE:** Alert conditions are FACTUAL, not interpreted.
- No "good/bad" labels
- No "SLA met/missed" judgment
- Only report facts: "3 days since successful run", "5 consecutive failures"

Example condition:
```typescript
{
  name: 'no_successful_run_since_X_days',
  is_triggered: true,
  details: {
    threshold_days: 3,
    actual_days: 8  // Fact only, no judgment
  }
}
```

### Notification Suppression Rules

1. **Acknowledgment Suppression:** Once admin acknowledges alert, stop notifying
   - Auto-clear after N days (default: 7) if still triggered
   
2. **Renotification Interval:** Only renotify at intervals (default: 24 hours)
   - If conditions still failing, wait interval before resending
   - Prevents alert fatigue

3. **FirstTry-Only Enforcement:**
   - Only send alerts for FirstTry snapshot execution failures
   - NOT for: Jira permission issues, rate limits (unless affecting runs), configuration problems

### Notification Channels

- **Admin UI:** In-app notifications (real-time)
- **Email:** Optional async notification (configurable)
- **Both:** Admin UI + Email

---

## CRITICAL ENFORCEMENT RULES

### Rule 1: FirstTry-Only Alerts
```
VIOLATION IF:
- Alert includes Jira permission failures
- Alert is triggered by Jira rate limiting (only if causing snapshot failure)
- Alert references non-FirstTry metrics

ALLOWED:
- FirstTry snapshot execution failures
- Consecutive FirstTry failures
- No successful FirstTry snapshot for N days
```

### Rule 2: No Threshold Interpretation
```
VIOLATION IF:
- Status includes "health_status" field
- Status labels reliability as "good", "bad", "warning"
- Conditions have score/grade/interpretation

ALLOWED:
- Factual metrics: success_rate=85, consecutive_failures=3
- Threshold comparisons: (85 > 90)? No interpretation.
- Alert conditions state facts only
```

### Rule 3: No Fabrication
```
VIOLATION IF:
- Alert generated without actual failed snapshot runs
- Conditions triggered without evidence in snapshot_runs
- Notifications created for non-FirstTry issues

ALLOWED:
- Only derived from snapshot_runs table
- Only based on actual execution outcomes
- Deterministic computation (same input → same alert)
```

---

## USE CASES

### Use Case 1: Healthy Snapshots
```
7 daily successful snapshots → No alert
7-day success_rate: 100%
consecutive_failures: 0
Alert decision: DO NOT NOTIFY
```

### Use Case 2: Degradation
```
1 successful run 4 days ago
3 consecutive failures today
7-day success_rate: 20%
Alert decision: NOTIFY (no successful in >3 days)
Reason: "No successful snapshot since 4 days"
```

### Use Case 3: Rate Limiting Impact
```
3 consecutive partial runs (rate-limited)
1 successful run 2 days ago
success_or_partial_rate: 75%
Alert decision: DO NOT NOTIFY (success within threshold)
Note: Rate limits tracked but not alert-worthy alone
```

### Use Case 4: Cascading Failure
```
10 consecutive failures (permission error in Jira)
No successful run in 10 days
consecutive_failures: 10
Alert decision: NOTIFY (both conditions triggered)
Reason: "5+ consecutive failures, no success in 10 days"
```

### Use Case 5: Recovery
```
3 consecutive failures (resolved)
1 successful run 1 hour ago
consecutive_failures: 0
no_successful_run_days: 0
Alert decision: DO NOT NOTIFY (no active conditions)
Note: Admin may acknowledge previous alert
```

---

## DATA MODEL

### SnapshotRun

Each scheduled/executed snapshot:

```typescript
{
  run_id: string,              // Unique
  tenant_id: string,           // Tenant context
  scheduled_at: ISO 8601 UTC,  // When job was scheduled
  started_at: ISO 8601 UTC,    // When execution began
  completed_at: ISO 8601 UTC,  // When execution ended
  status: SnapshotRunStatus,   // scheduled|successful|partial|failed
  duration_ms: number,         // Wall-clock time
  rate_limit_hit: boolean,     // Did Jira rate limiting occur?
  error_code?: string,         // Error identifier
  error_message?: string       // Human-readable
}
```

### ReliabilityNotification

Alert sent to admin:

```typescript
{
  notification_id: string,     // Unique
  tenant_id: string,
  created_at: ISO 8601 UTC,
  alert_conditions: ReliabilityAlertCondition[],  // Only triggered
  reliability_status_snapshot: SnapshotReliabilityStatus,  // At alert time
  notification_channel: 'admin_ui' | 'email',
  sent_at: ISO 8601 UTC | null,
  acknowledged_at: ISO 8601 UTC | null
}
```

---

## TESTING STRATEGY

### Test Categories

1. **Window Metrics (6 tests)**
   - 7/30/90-day computation
   - Empty windows
   - Rate limit tracking
   - Mean duration calculation

2. **Reliability Status (8 tests)**
   - Empty history
   - Last run identification
   - Consecutive failure counting
   - Hash generation
   - Window metric computation

3. **Alert Conditions (5 tests)**
   - No-successful-run detection
   - Consecutive-failure detection
   - Threshold enforcement
   - Condition details
   - Multiple conditions

4. **FirstTry-Only Enforcement (3 tests)**
   - Accept valid metrics
   - Reject invalid metrics
   - Notification validation

5. **Notification Management (4 tests)**
   - Creation
   - Sent marking
   - Acknowledgment
   - Unique IDs

6. **No Threshold Interpretation (2 tests)**
   - No good/bad labels
   - Facts only in metrics

7. **Rate Limiting (2 tests)**
   - Incident tracking
   - Distinction from failures

8. **Real-World Scenarios (4 tests)**
   - Healthy schedule
   - Degraded service
   - Cascading failures
   - Recovery

**Total:** 34 tests, 100% pass rate

---

## DEPLOYMENT CHECKLIST

- [x] Snapshot reliability computation engine (snapshot_reliability.ts)
- [x] Auto-notification logic (auto_notification.ts)
- [x] Comprehensive test suite (34 tests)
- [x] FirstTry-only validation
- [x] Alert condition detection
- [x] Notification history management
- [x] Delivery channel routing
- [ ] Admin UI integration
- [ ] Email service integration
- [ ] Database schema for snapshot_runs
- [ ] Database schema for notifications
- [ ] Scheduler integration

---

## INTEGRATION POINTS

### 1. Snapshot Job
```
After each snapshot:
  → Record SnapshotRun with status/duration
  → Trigger reliability computation
```

### 2. Admin Dashboard
```
Display:
  - Last snapshot: (date) ago
  - 7/30/90-day reliability charts
  - Current alert conditions (if any)
  - Notification history
  - Acknowledgment controls
```

### 3. Alert Engine
```
Every N minutes:
  → Compute latest reliability status
  → Check alert conditions
  → Look up previous notification
  → Decide: notify?
  → Route and track
```

---

## CONFIGURATION

### Default Config

```typescript
{
  no_successful_run_days: 3,          // Alert if no success in 3+ days
  consecutive_failures_count: 5,      // Alert if 5+ consecutive failures
  notification_channel: 'admin_ui',   // Primary channel
  enable_auto_renotify: true,         // Resend if still failing
  renotify_interval_hours: 24,        // Max once per 24 hours
  acknowledgment_auto_clear_days: 7   // Auto-clear if fixed after 7 days
}
```

### Tenant-Specific Override

Admins can customize thresholds per tenant in UI.

---

## METRICS EXPOSURE

### Admin UI Dashboard

```
FirstTry Monitoring Status
═══════════════════════════════════════════

Last Snapshot: 12 hours ago
Status: Successful ✓

7-Day Reliability: 95.2%
  • Successful: 20 runs
  • Partial: 1 run
  • Failed: 0 runs

30-Day Reliability: 92.1%
  • Successful: 63 runs
  • Partial: 4 runs
  • Failed: 2 runs

90-Day Reliability: 88.7%
  • Successful: 195 runs
  • Partial: 15 runs
  • Failed: 10 runs

Rate Limit Incidents (7d): 1
Consecutive Failures: 0

⚠️  Alert Conditions: None
```

### Notification Example

```
Subject: FirstTry Snapshot Reliability Alert - Tenant ABC

Alert triggered: No successful snapshot for 4 days

Condition 1: no_successful_run_since_X_days
  - Threshold: 3 days
  - Actual: 4 days
  - Status: TRIGGERED

Condition 2: consecutive_failures_count
  - Threshold: 5 failures
  - Actual: 0 failures
  - Status: NOT TRIGGERED

Last snapshot attempt: 3 hours ago
Status: FAILED
Error: JIRA_AUTH_ERROR

Latest 7-day reliability: 40% (2/5 successful)

[Acknowledge Alert] [View Details]
```

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024 | Initial specification |

---

## RELATED DOCUMENTATION

- [Phase 9.5-A: Counterfactual Proof Ledger](./PHASE_9_5A_SPEC.md)
- [Phase 9.5-B: Historical Blind-Spot Map](./PHASE_9_5B_SPEC.md)
- Phase 9.5-C Delivery Summary (PHASE_9_5C_DELIVERY.md)
