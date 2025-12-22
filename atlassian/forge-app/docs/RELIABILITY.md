# FirstTry Reliability & Operations Guide

## SLI Definitions

FirstTry tracks 6 Service Level Indicators (SLIs) to measure reliability:

### 1. snapshot_success_rate
- **Definition**: Percentage of snapshot creation operations that complete successfully
- **Calculation**: `successful_snapshots / total_snapshots` (over 24h window)
- **Target**: 99.5%
- **What fails?**: TenantContextError (auth), StorageError (infrastructure), ApiError (Jira down)
- **What counts as success?**: Operation recorded with outcome=SUCCESS
- **Resolution**: Check AUTHZ or DEPENDENCY errors in recent metric events

### 2. export_success_rate
- **Definition**: Percentage of export operations that complete (return full output)
- **Calculation**: `successful_exports / total_exports` (over 24h window)
- **Target**: 99.5%
- **What fails?**: ExportBlockedError (output rejected), StorageError (can't save), ApiError (network)
- **What counts as success?**: Operation recorded with outcome=SUCCESS
- **Resolution**: Verify output validityStatus and check missingData fields

### 3. truth_determinism_rate
- **Definition**: Percentage of output records where recomputed truth matches stored truth
- **Calculation**: `deterministic_outputs / total_verified_outputs` (random sampling or all)
- **Target**: 100.0%
- **What fails?**: If recomputed validityStatus != stored validityStatus (indicates rule change)
- **What counts as success?**: Verification shows all fields match exactly
- **Resolution**: If <100%, investigate rule changes or cached data inconsistencies
- **Critical**: Any mismatch is recorded as INVARIANT error class

### 4. drift_detection_rate
- **Definition**: Percentage of drift detections that are validated as genuine data changes
- **Calculation**: `confirmed_drifts / all_drift_detections` (over 7-day window)
- **Target**: 100.0%
- **What fails?**: False positive drift alerts (detected drift that didn't happen)
- **What counts as success?**: Human review confirms drift was real
- **Resolution**: If <100%, investigate snapshot creation frequency or data staleness

### 5. degraded_export_rate
- **Definition**: Percentage of exports that are returned but marked as DEGRADED (incomplete)
- **Calculation**: `degraded_exports / total_exports` (over 24h window)
- **Target**: <0.5%
- **What triggers DEGRADED?**: validityStatus is VALID but has warnings or missing non-critical data
- **Resolution**: Investigate if snapshots are incomplete or data source has retention issues
- **Note**: DEGRADED is not a failure (output is usable), but indicates data quality issues

### 6. false_green_rate
- **Definition**: Percentage of exports marked VALID that are actually false positives
- **Calculation**: `false_positives / total_marked_valid` (measured via audit review)
- **Target**: 0.0% (invariant)
- **What fails?**: Output marked VALID but should have been INVALID (critical)
- **What counts as success?**: All VALID outputs are genuinely complete and accurate
- **Resolution**: If >0.0%, system fails immediately (halt exports) and escalate to engineering
- **Critical**: This is the most important SLI; any violation is a P1

## Health Summary Interpretation

The health endpoint returns:

```json
{
  "status": "HEALTHY | DEGRADED | UNHEALTHY | UNKNOWN",
  "notes": ["explanation text"],
  "lastSnapshotAtISO": "2024-01-15T14:23:45Z or null",
  "lastExportAtISO": "2024-01-15T14:25:00Z or null",
  "lastErrorAtISO": "2024-01-15T14:20:30Z or null",
  "recentSuccessRate": 0.985 or null,
  "recentDegradedExportRate": 0.002 or null,
  "driftStatusSummary": "NO_DRIFT | DRIFT_DETECTED | UNKNOWN",
  "hasCompleteData": true or false,
  "missingDataExplanation": "text explaining why data is incomplete"
}
```

### Status Meanings

| Status | Meaning | Action |
|--------|---------|--------|
| **HEALTHY** | All SLIs above target, recent operations succeeding, data complete | None; system working as expected |
| **DEGRADED** | One or more SLIs below target (e.g., success rate 95%), but not critical | Investigate metric events for error patterns |
| **UNHEALTHY** | Critical SLI violation (e.g., success rate <80% or false_green_rate >0.0%) | Page on-call engineer immediately |
| **UNKNOWN** | Insufficient data to determine health (e.g., <10 operations in window) | Create more snapshots/exports to populate metrics; not a failure |

### When Health is UNKNOWN

**This is NOT a bug.** FirstTry explicitly prefers UNKNOWN to guessing:

1. **Insufficient recent events**: If <5 metric events in the 24h window, cannot compute accurate rates
2. **New tenant**: First time using FirstTry; need baseline data
3. **No operations**: Haven't created snapshots or exports yet
4. **Data retention**: Older than 90 days (retention policy limit)

**Action**: Create snapshots and exports to populate metrics. Health will transition to HEALTHY/DEGRADED/UNHEALTHY once enough data exists.

## Understanding OperationOutcome

All metric events record an outcome:

| Outcome | Meaning | Example |
|---------|---------|---------|
| **SUCCESS** | Operation completed as expected | Snapshot created, export succeeded |
| **FAIL** | Operation attempted but failed | ApiError, StorageError, missing permissions |
| **BLOCKED** | Operation rejected before execution | ExportBlockedError (output not VALID) |
| **DEGRADED** | Operation succeeded but with warnings | Export returned but has missingData |
| **EXPIRED** | Operation succeeded but output is stale | Snapshot >7 days old used for export |

## Understanding ErrorClass

Every failure records an error class:

| Class | Cause | Resolution |
|-------|-------|-----------|
| **AUTHZ** | TenantContextError; authentication/authorization failed | Verify Jira permissions, check tenant isolation |
| **VALIDATION** | ExportBlockedError; output rejected by rules | Verify snapshot has required data, check rule version |
| **DEPENDENCY** | ApiError; external service unavailable | Check Jira Cloud status, verify network connectivity |
| **STORAGE** | StorageError; cannot read/write to app storage | Contact Atlassian support, check storage quota |
| **INVARIANT** | AssertionError, determinism failure; internal consistency error | Page engineering immediately; indicates data corruption |
| **UNKNOWN** | Unclassified error; doesn't fit above categories | Include full error stack in support ticket |

## Determinism Verification

FirstTry periodically verifies that output truth is **deterministic**:

1. **Process**:
   - Select output record (random sampling or all)
   - Recompute OutputTruthMetadata using same inputs
   - Compare: validityStatus, confidenceLevel, missingData, warnings, reasons, driftStatus

2. **Expected Behavior**:
   - Recomputed == Stored (perfect match)
   - Metric event recorded with outcome=SUCCESS

3. **Failure Behavior**:
   - Recomputed != Stored (mismatch in any field)
   - Metric event recorded with outcome=FAIL and errorClass=INVARIANT
   - System logs difference details (e.g., "validityStatus: VALID != INVALID")
   - Engineering is alerted

4. **Why This Matters**:
   - Snapshot rules are immutable (no changing rules retroactively)
   - If truth changes, something is wrong (cache corruption, rule regression)
   - Determinism is non-negotiable for audit compliance

## Degraded vs Expired Outputs

### DEGRADED
- **Definition**: Output is VALID but has warnings or missing non-critical data
- **Example**: Snapshot missing 2 out of 20 configuration sections, but core sections present
- **Validity**: Output is STILL usable; data quality is reduced
- **Recording**: outcome=DEGRADED, not outcome=BLOCKED or outcome=FAIL

### EXPIRED
- **Definition**: Output is valid but older than recommended freshness window (>7 days)
- **Example**: Using snapshot from last week for export (no new snapshots available)
- **Validity**: Output data may be stale; decisions based on it may be outdated
- **Recording**: outcome=EXPIRED, validityStatus=VALID but age flagged

### Difference from BLOCKED
- **BLOCKED**: ExportBlockedError raised; output NOT returned (invalid data)
- **DEGRADED**: Output returned with warnings; data is usable but incomplete
- **EXPIRED**: Output returned; data is valid but age may be a concern

## Operational Runbook

### Issue: Exports are failing (high error rate)

1. **Get correlation ID** from error message
2. **Check health endpoint**: `GET /-/firstry/health`
   - Is status UNHEALTHY or DEGRADED?
   - Is success_rate below 95%?
3. **Examine recent error classes**:
   - If errorClass=VALIDATION: verify snapshot has required data
   - If errorClass=AUTHZ: verify Jira permissions
   - If errorClass=DEPENDENCY: check Jira Cloud status page
   - If errorClass=STORAGE: verify storage quota
   - If errorClass=INVARIANT: escalate immediately
4. **Create test snapshot** and retry export
5. **If still failing**: contact support with correlation IDs and health dump

### Issue: Drift detection shows UNKNOWN

1. **Verify snapshot history**:
   - Need at least 2 snapshots to detect drift
   - Snapshots must be >1 hour apart

2. **Check timestamps**:
   - Is lastSnapshotAtISO recent?
   - Have you created a new snapshot since last check?

3. **Resolution**: Create a new snapshot, wait 1+ hour, create another, then export
   - After 2 snapshots, drift_status will change from UNKNOWN to NO_DRIFT or DRIFT_DETECTED

### Issue: Health shows UNKNOWN status

1. **Check hasCompleteData**: false means insufficient metrics
2. **Read missingDataExplanation**: explains what data is missing
3. **Create more operations**:
   - Create a snapshot
   - Create an export
   - Wait a few minutes for metrics to aggregate
   - Refresh health endpoint
4. **Expected transition**: UNKNOWN → HEALTHY or UNHEALTHY (based on actual SLIs)

### Issue: Determinism verification failed (false_green_rate > 0)

**This is a CRITICAL issue. Do NOT export any data.**

1. **Immediately halt all exports** (manual or automated)
2. **Collect evidence**:
   - Which snapshots failed determinism check?
   - What were the differences (validityStatus mismatch)?
   - When did this start occurring?
3. **Escalate to engineering** with:
   - Correlation IDs of failed verifications
   - Affected snapshot IDs
   - Timeline of when issue appeared
4. **Incident response**:
   - Engineering will investigate rule changes
   - May require rollback or snapshot reconstruction
   - Communication to affected tenants

## Metrics Aggregation (SLI Computation)

SLI rates are computed from metric event stream:

```
snapshot_success_rate = COUNT(outcome=SUCCESS AND opName LIKE "snapshot%") 
                       / COUNT(opName LIKE "snapshot%")
                       over [24-hour window]

export_success_rate   = COUNT(outcome=SUCCESS AND opName LIKE "export%")
                       / COUNT(opName LIKE "export%")
                       over [24-hour window]

truth_determinism_rate = COUNT(outcome=SUCCESS AND opName="determinism_verification")
                        / COUNT(opName="determinism_verification")
                        over [24-hour window]
...
```

- **Window**: Default 24 hours; customizable via health endpoint query params
- **Aggregation**: Per-tenant (all rates are tenant-scoped)
- **Freshness**: Updated in near-real-time as metric events arrive
- **Retention**: Metric events retained for 90 days (per P1.2 retention policy)

## Correlation IDs for Tracing

Every operation generates a unique correlation ID (format: 32-char hex, no timestamps):

1. **Generated at operation start**
2. **Propagated through entire request chain**
3. **Included in error responses** (format: "req-XXXXXXXX" for user display)
4. **Stored in metric event** for tracing
5. **Useful for**: "I got error with ID X, can you help?"

**Example**:
```json
{
  "status": 400,
  "error": "ExportBlockedError: Output is INVALID",
  "correlationId": "a1b2c3d4e5f6g7h8...",
  "safeMessage": "Output validation failed due to incomplete snapshot data"
}
```

## Audit Compliance Notes

- **Determinism**: Every truth computation is deterministic (no surprises)
- **Audit trail**: Correlation IDs enable full request tracing
- **Error classification**: All errors categorized for root cause analysis
- **No PII**: Metrics use tenant tokens, never raw IDs or user data
- **Retention**: 90-day retention for metric events and correlation traces
- **Immutable rules**: Output truth cannot change retroactively (determinism verification)

## Contact Engineering

For issues related to:
- truth_determinism_rate < 100%
- false_green_rate > 0%
- Any INVARIANT class errors
- Unexplained SLI degradation

**Email**: [ENGINEERING_EMAIL_TO_BE_SET]
