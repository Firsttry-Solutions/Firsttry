# Phase 9.5-E: Auto-Repair Disclosure Log - Specification

**Version:** 1.0  
**Status:** COMPLETE  
**Tests:** 30/30 passing  
**Last Updated:** 2025-12-20  

---

## 1. Executive Summary

Phase 9.5-E implements an immutable, hash-verified event log that discloses when FirstTry self-recovers from transient issues. This is **informational disclosure only** — it shows what happened, not why, and never modifies Jira configuration or suggests changes.

**Key Principles:**
- ✅ Transparent: Discloses all recovery events
- ✅ Immutable: Hash-verified data integrity
- ✅ Read-only: Zero mutations to any system
- ✅ Informational: Facts only, no interpretation
- ✅ Deterministic: Same input → same output

---

## 2. Requirements

### 2.1 Data Model

#### RepairType (7 mechanisms)
FirstTry's automatic recovery actions:
- `retry` — Retry the operation after transient delay
- `pagination_adjust` — Modify pagination window to work around API limits
- `fallback_endpoint` — Switch to alternative endpoint
- `partial_degrade` — Return best-effort data subset
- `connection_reset` — Reset network connection, retry
- `cache_invalidate` — Clear cached response, fetch fresh
- `timeout_extend` — Increase timeout window, retry

#### RepairTriggerReason (8 symptoms observed)
What FirstTry detected before self-recovery:
- `timeout` — Operation exceeded time limit
- `rate_limit` — Rate limit headers detected (429, 503 with Retry-After)
- `service_unavailable` — Service returned 5xx error or unavailable signal
- `partial_failure` — Some data succeeded, some failed
- `connection_error` — Network/socket error detected
- `malformed_response` — Response format unexpected or corrupt
- `quota_exceeded` — Quota or resource limit exceeded
- `unknown` — Transient issue detected but type unclear

#### RepairOutcome (3 results)
Result after repair attempt:
- `success` — Operation succeeded after repair
- `partial` — Repair improved situation but not fully successful
- `failed` — Repair attempt did not resolve issue

### 2.2 AutoRepairEvent Schema

```typescript
interface AutoRepairEvent {
  // Identification
  event_id: string;           // Unique event ID (UUID)
  tenant_id: string;          // Tenant identifier for isolation
  
  // Timing
  timestamp: string;          // ISO 8601 UTC format
  
  // Classification
  repair_type: RepairType;        // What FirstTry did
  trigger_reason: RepairTriggerReason;  // What FirstTry observed
  outcome: RepairOutcome;         // How it worked out
  
  // Context
  affected_operation: string;     // snapshot_capture, field_analysis, etc.
  attempt_number: number;         // Which retry attempt (1, 2, 3...)
  linked_snapshot_run_id: string | null;  // Related snapshot run
  
  // Metrics
  repair_duration_ms: number;     // Time spent on repair
  details: {
    repair_duration_ms: number;
    success_after_repair: boolean;
    original_error?: string;      // Optional: error message before repair
  };
  
  // Versioning
  schema_version: string;     // "1.0" for compatibility tracking
}
```

### 2.3 AutoRepairLog Schema

```typescript
interface AutoRepairLog {
  // Summary metrics
  total_events: number;
  
  // Outcome distribution
  events_by_outcome: {
    success: number;
    partial: number;
    failed: number;
  };
  
  // Repair type distribution
  repair_type_breakdown: {
    retry: number;
    pagination_adjust: number;
    fallback_endpoint: number;
    partial_degrade: number;
    connection_reset: number;
    cache_invalidate: number;
    timeout_extend: number;
  };
  
  // Trigger reason distribution
  trigger_reason_breakdown: {
    timeout: number;
    rate_limit: number;
    service_unavailable: number;
    partial_failure: number;
    connection_error: number;
    malformed_response: number;
    quota_exceeded: number;
    unknown: number;
  };
  
  // Statistics
  success_rate: number;         // Percentage (0-100)
  time_period_start: string;    // ISO 8601 UTC
  time_period_end: string;      // ISO 8601 UTC
  
  // Integrity
  canonical_hash: string;       // SHA-256 (sorted keys)
  events: AutoRepairEvent[];    // All events in period
}
```

---

## 3. Core Functions

### 3.1 createAutoRepairEvent()

**Purpose:** Create a single repair event

**Signature:**
```typescript
createAutoRepairEvent(params: {
  tenant_id: string;
  repair_type: RepairType;
  trigger_reason: RepairTriggerReason;
  outcome: RepairOutcome;
  affected_operation: string;
  repair_duration_ms: number;
  success_after_repair: boolean;
  attempt_number?: number;
  linked_snapshot_run_id?: string;
  original_error?: string;
}): AutoRepairEvent
```

**Behavior:**
- Generates unique event_id (UUID v4)
- Captures current timestamp (ISO 8601 UTC)
- Stores all parameters in immutable object
- No side effects, no API calls
- Returns event ready for logging

**Example:**
```typescript
const event = createAutoRepairEvent({
  tenant_id: 'acme-corp',
  repair_type: 'retry',
  trigger_reason: 'timeout',
  outcome: 'success',
  affected_operation: 'snapshot_capture',
  repair_duration_ms: 250,
  success_after_repair: true,
  attempt_number: 1
});
```

### 3.2 buildAutoRepairLog()

**Purpose:** Aggregate events into disclosure log with statistics

**Signature:**
```typescript
buildAutoRepairLog(
  tenant_id: string,
  events: AutoRepairEvent[],
  timePeriod?: { start: string; end: string }
): AutoRepairLog
```

**Behavior:**
- Counts outcomes (success/partial/failed)
- Counts repair types used
- Counts trigger reasons observed
- Calculates success rate (successful ÷ total × 100)
- Computes canonical hash (SHA-256)
- Does NOT modify original events
- Deterministic (same input → same output)

**Example:**
```typescript
const log = buildAutoRepairLog('acme-corp', events);
console.log(`Success rate: ${log.success_rate}%`);
```

### 3.3 computeAutoRepairLogHash()

**Purpose:** Generate deterministic SHA-256 hash of log

**Signature:**
```typescript
computeAutoRepairLogHash(log: AutoRepairLog): string
```

**Algorithm:**
1. Create canonical JSON string with sorted keys
2. Include all metrics (events_by_outcome, repair_type_breakdown, etc.)
3. Compute SHA-256 hash of string
4. Return hex string

**Property:** Same input always produces same hash → detects tampering

### 3.4 verifyAutoRepairLogHash()

**Purpose:** Verify log data hasn't been modified

**Signature:**
```typescript
verifyAutoRepairLogHash(log: AutoRepairLog): boolean
```

**Behavior:**
- Recomputes hash from current log data
- Compares with stored canonical_hash
- Returns true if they match (data authentic)
- Returns false if they differ (data modified)

**Example:**
```typescript
if (verifyAutoRepairLogHash(log)) {
  console.log('Log data is authentic');
} else {
  console.log('Warning: Log data may have been modified');
}
```

### 3.5 renderAutoRepairTimelineHtml()

**Purpose:** Generate HTML timeline visualization

**Signature:**
```typescript
renderAutoRepairTimelineHtml(log: AutoRepairLog): string
```

**Output:**
- Grouped by date/time
- Color-coded outcomes (green=success, orange=partial, red=failed)
- Shows repair type, trigger reason, duration, attempt number
- Read-only, no interactive elements

### 3.6 renderAutoRepairTableHtml()

**Purpose:** Generate HTML table visualization

**Signature:**
```typescript
renderAutoRepairTableHtml(log: AutoRepairLog): string
```

**Output:**
- Sortable columns: timestamp, type, trigger, outcome, duration
- Complete event details
- Read-only display

### 3.7 exportAutoRepairLogJson()

**Purpose:** Export log as machine-readable JSON

**Signature:**
```typescript
exportAutoRepairLogJson(log: AutoRepairLog): Record<string, any>
```

**Contents:**
- All summary metrics
- All breakdown distributions
- All events with full details
- Canonical hash for integrity verification

### 3.8 generateAutoRepairReport()

**Purpose:** Generate human-readable markdown report

**Signature:**
```typescript
generateAutoRepairReport(log: AutoRepairLog): string
```

**Sections:**
1. Summary: "FirstTry successfully self-recovered from X issues"
2. Statistics: Table of metrics
3. Recovery Types Used: Breakdown by repair type
4. Trigger Reasons: Breakdown by trigger reason
5. Events (Recent First): Chronological event details
6. Note: Clarifies these are resilience mechanisms, not Jira changes

---

## 4. Admin UI Component

### 4.1 AutoRepairAdminPage

**Purpose:** React component for viewing recovery events in admin console

**Features:**
- Summary card with key metrics
- 3 tabs: Timeline, Details (table), Breakdown (charts)
- Color-coded outcomes
- Export buttons (JSON, markdown)
- Time period selector (optional)
- Read-only display

**No Action Buttons:** Users cannot:
- Dismiss events
- Modify outcomes
- Change Jira configuration
- Suggest repairs

**Visual Design:**
- Informational tone
- Atlassian Design System compliance
- Dark mode support
- WCAG 2.1 accessibility

### 4.2 AutoRepairCard

**Purpose:** Embedded card for dashboards

**Usage:**
```typescript
import { AutoRepairCard } from '../admin/auto_repair_page';

export function Dashboard() {
  return <AutoRepairCard tenantId="acme-corp" />;
}
```

---

## 5. Prohibited Patterns

### 5.1 Terminology

❌ NEVER use:
- "fix" — Use "repair", "recover", "self-recover"
- "recommend" — Just disclose facts
- "root cause" — Only disclose symptoms and actions
- "improve" — Only disclose what happened
- "impact" — Don't claim causality

✅ DO use:
- "self-recovered from"
- "detected" (for trigger reasons)
- "attempted" (for repair type)
- "resulted in" (for outcome)

### 5.2 Operations

❌ NEVER:
- Write to Jira API
- Create/modify issues
- Change workflows
- Update configurations
- Make suggestions
- Infer causality

✅ DO:
- Log events internally
- Display facts
- Export data
- Calculate metrics
- Verify integrity

---

## 6. Test Coverage

**30 total tests, organized in 14 test categories:**

| Category | Tests | Purpose |
|----------|-------|---------|
| TC-9.5-E-1: Event Creation | 3 | Create events, handle all types/reasons |
| TC-9.5-E-2: Outcome Tracking | 3 | Track success/partial/failed outcomes |
| TC-9.5-E-3: Log Building | 3 | Aggregate events, calculate statistics |
| TC-9.5-E-4: Hash Verification | 2 | Verify integrity, detect tampering |
| TC-9.5-E-5: No Jira Writes | 3 | Enforce zero mutations, read-only behavior |
| TC-9.5-E-6: Rendering | 2 | Generate timeline and table HTML |
| TC-9.5-E-7: Export | 2 | JSON and markdown export |
| TC-9.5-E-8: Timestamps | 2 | ISO 8601 format, time period tracking |
| TC-9.5-E-9: Edge Cases | 3 | Empty logs, missing optional fields |
| TC-9.5-E-10: Determinism | 2 | Same input → same output, hash consistency |
| TC-9.5-E-11: Duration Tracking | 2 | Millisecond precision, fast repairs |
| TC-9.5-E-12: Attempt Tracking | 1 | Track retry attempt numbers |
| TC-9.5-E-13: Prohibited Terms | 1 | Enforce terminology restrictions |
| TC-9.5-E-14: Integration | 1 | Multi-event realistic scenarios |

**Pass Rate:** 30/30 (100%)

---

## 7. Exit Criteria (All Met ✅)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Core module created | ✅ | `src/phase9_5e/auto_repair_log.ts` (696 L) |
| Admin UI created | ✅ | `src/admin/auto_repair_page.tsx` (438 L) |
| 30+ tests created | ✅ | 30/30 tests in `tests/phase9_5e/auto_repair_log.test.ts` |
| All tests passing | ✅ | 30/30 passing, 0 failures |
| No "fix" terminology | ✅ | TC-9.5-E-13 enforces (no prohibited terms found) |
| No Jira writes | ✅ | TC-9.5-E-5 enforces (all functions read-only) |
| Hash verification working | ✅ | TC-9.5-E-4 validates integrity |
| Outcome counting correct | ✅ | TC-9.5-E-2 and TC-9.5-E-3 verify |
| Read-only UI confirmed | ✅ | Admin UI component (no action buttons) |
| Documentation complete | ✅ | This spec + delivery guide + quick reference |
| Phase 9.5 combined (A-E) | ✅ | 129/129 tests passing across all phases |

---

## 8. Integration with Phases 9.5-A through 9.5-D

**Phase 9.5-A: Counterfactual Proof Ledger** (pre-existing)
- Captures decisions FirstTry would have made (hypothetical)
- Foundation for blind-spot detection

**Phase 9.5-B: Historical Blind-Spot Map** (16/16 tests)
- Identifies gaps in monitoring coverage
- Shows where FirstTry operated without observability

**Phase 9.5-C: Snapshot Reliability SLA** (54/54 tests)
- Tracks snapshot execution patterns
- Validates reliability metrics
- Auto-notification system for low-success-rate periods

**Phase 9.5-D: Audit Readiness Delta** (29/29 tests)
- Measures compliance with audit requirements
- Computes readiness percentage
- Generates audit reports

**Phase 9.5-E: Auto-Repair Disclosure Log** (30/30 tests) ← **YOU ARE HERE**
- Discloses self-recovery events
- Provides admin visibility into resilience
- Zero Jira modifications
- Immutable hash-verified records

**Combined Phase 9.5: 129/129 tests passing**

---

## 9. Deployment Checklist

- [x] All 30 tests passing
- [x] No TypeScript errors or warnings
- [x] No ESLint violations
- [x] Hash verification working
- [x] React components rendering
- [x] Export functions tested
- [x] Prohibited terms verified absent
- [x] Jira writes verified absent
- [x] Documentation complete
- [x] Quick reference created
- [x] Phase 9.5 integration verified

**Status: READY FOR PRODUCTION**

---

## 10. Quick Links

- **Implementation:** [auto_repair_log.ts](../src/phase9_5e/auto_repair_log.ts)
- **Admin UI:** [auto_repair_page.tsx](../src/admin/auto_repair_page.tsx)
- **Tests:** [auto_repair_log.test.ts](../tests/phase9_5e/auto_repair_log.test.ts)
- **Delivery Guide:** [PHASE_9_5E_DELIVERY.md](./PHASE_9_5E_DELIVERY.md)
- **Quick Reference:** [PHASE_9_5E_INDEX.md](./PHASE_9_5E_INDEX.md)

---

**End of Specification**
