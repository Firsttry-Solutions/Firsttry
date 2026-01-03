# FirstTry Heartbeat Trust Dashboard

## Overview

The **Heartbeat Trust Dashboard** is a read-only Jira dashboard gadget that displays operational proof of FirstTry's activities.

**Scope:** Trust and transparency only.
- No Jira writes
- No configuration changes
- No policy enforcement
- No recommendations
- No external network calls
- No admin actions

## Purpose

The gadget builds user trust through transparency, including transparency about what is unknown or unavailable.

It proves that FirstTry is running and checking—nothing more, nothing less.

## Two-Layer Timing Model

The gadget discloses **both** timing layers for complete transparency:

**Layer 1: Platform Trigger (Forge Limitation)**
- Fires every **5 minutes** (Forge `scheduledTrigger` interval: `fiveMinute`)
- Recorded as `lastTriggerAt` and `triggerCount`
- This is the fastest Forge scheduling allows

**Layer 2: Meaningful Check Cadence (FirstTry Policy)**
- Runs every **15 minutes** (enforced by storage-based gate in scheduler)
- Recorded as `lastCadenceCheckAt` and `runCount`
- Staleness is computed from this cadence (30-minute threshold), not platform pings

**Why two layers?**
- Forge scheduling requires precise 5-minute invocations
- Trust requires declared "check cadence" for operator understanding
- Displaying both prevents misleading claims

## Data Source

All metrics come from **Forge Storage**, keyed per tenant:

```
firsttry:heartbeat:<cloudId>
```

Data is updated by scheduled check handlers as they execute.

## Metric Definitions

### Status

**Source:** `heartbeat.status`

**Values:**
- `RUNNING` — Last meaningful cadence check succeeded
- `INITIALIZING` — No heartbeat record yet
- `DEGRADED` — Last meaningful cadence check failed
- `DEGRADED (STALE)` — No meaningful check in 30 minutes (cadence-based)

**Staleness Rule (Cadence-Based):** If no meaningful check has occurred within **30 minutes** (2 × 15-minute cadence), status is displayed as `DEGRADED (STALE)` regardless of stored status. This counts only meaningful cadence checks, not platform trigger pings every 5 minutes.

### Last Successful Run

**Source:** `heartbeat.lastSuccessAt`

**Display:** ISO 8601 timestamp formatted to browser's local timezone (or UTC if unavailable)

**Meaning:** When the most recent meaningful cadence check completed successfully.

**Unknown if:** No meaningful cadence check has succeeded yet.

### Last Platform Trigger Ping

**Source:** `heartbeat.lastTriggerAt`

**Display:** ISO 8601 timestamp formatted to browser's local timezone (or UTC if unavailable)

**Meaning:** When the Forge platform scheduler last invoked the trigger (every 5 minutes). This is not necessarily when a meaningful check ran.

**Unknown if:** No trigger invocation has occurred yet.

### Last Meaningful Check

**Source:** `heartbeat.lastCadenceCheckAt` (or `lastCheckAt` for backward compatibility)

**Display:** ISO 8601 timestamp formatted to browser's local timezone (or UTC if unavailable)

**Meaning:** When the most recent meaningful cadence check executed (successful or not). This is every 15 minutes, not every 5-minute trigger.

**Unknown if:** No meaningful check has executed yet.

### Mode

**Fixed value:** `Scheduled monitoring (read-only)`

This gadget only observes; it does not enforce or write.

### Platform Pings Observed

**Source:** `heartbeat.triggerCount`

**Display:** `<value> (best-effort counter)` or UNKNOWN

**Meaning:** How many times the Forge platform trigger has pinged (every 5 minutes).

**Limitations:** Due to Forge Storage eventual consistency, this counter is approximate. Do not treat as a precise audit log.

**Unknown if:** No trigger invocation has occurred yet.

### Meaningful Checks Completed

**Source:** `heartbeat.runCount`

**Display:** `<value> (best-effort counter)` or UNKNOWN

**Meaning:** How many times the meaningful cadence check has executed (every 15 minutes).

**Limitations:** Due to Forge Storage eventual consistency, this counter is approximate. Do not treat as a precise audit log.

**Unknown if:** No meaningful check has executed yet.

### Snapshot Count

**Source:** `heartbeat.snapshotCount`

**Display:** Numeric count

**Meaning:** How many snapshot artifacts have been created and persisted.

**Limitations:** Snapshots are implemented in Phase 6. If snapshots are not yet created, this shows `0`. If unknown, shows `UNKNOWN`.

**Unknown if:** Snapshot feature has not been invoked.

### Days Since First Successful Run

**Source:** `heartbeat.firstSuccessAt`

**Calculation:** `floor((now - firstSuccessAt) / 86400000)` with units "days"

**Display:** `<N> days`

**Meaning:** Duration since FirstTry first successfully completed a scheduled check after installation.

**Note:** This is NOT an "uptime" claim. It is a measure of how long the system has been observable.

**Unknown if:** No successful check has occurred yet.

### Cadence Interval

**Source:** Stored in heartbeat record as constant

**Value:** `15 minutes`

**Used for:** Staleness computation and cadence gate logic.

**Note:** Platform trigger fires every 5 minutes (Forge limitation), but meaningful checks run every 15 minutes (FirstTry cadence gate).

### Staleness Threshold

**Computed:** 2 × 15 minutes = 30 minutes (cadence-based)

**Used for:** Determining when to override status with `DEGRADED (STALE)`.

**Rule:** If no meaningful check within 30 minutes, status becomes `DEGRADED (STALE)`.

### Version

**Source:** `package.json` version field

**Display:** `0.1.0`

**Unknown if:** Version file or environment variable is not available.

### Environment

**Source:** `FIRSTTRY_ENV` environment variable

**Display:** Value of env var, or `UNKNOWN` if not declared

**Note:** This is **not** derived from manifest or context. It must be explicitly set in the Forge app runtime configuration.

**Unknown if:** Env var is not configured.

## Data Availability Disclosure

The gadget displays a **Data Availability** section that lists all fields that are `UNKNOWN` with their reason codes:

### Reason Codes

- **`STORAGE_EMPTY`** – No heartbeat record exists (never recorded)
- **`NOT_YET_OBSERVED`** – Event has not occurred since installation
- **`NOT_DECLARED`** – Required environment variable or file is missing
- **`NOT_AVAILABLE_IN_CONTEXT`** – Forge context does not provide the required identifier (e.g., cloudId)
- **`NOT_IMPLEMENTED_IN_CODEBASE`** – Feature does not exist in the codebase

## Error Handling

**Last Error**

**Source:** `heartbeat.lastError`

**Display:** Error message (if present)

**Limitations:**
- Truncated to 300 characters
- Single-line only (newlines removed)
- Secrets, tokens, and common patterns redacted
- Does NOT include stack traces

## Trust Boundaries (Always Visible)

The gadget unconditionally displays:

```
✓ Read-only operation
✓ No Jira writes
✓ No configuration changes
✓ No policy enforcement
✓ No recommendations
✓ No external network calls / no data egress
✓ No admin actions required
```

These are not computed—they are architectural facts.

## Timing & Timezone Rules

### Storage

All timestamps in Forge Storage are stored as UTC ISO 8601 strings (e.g., `2025-01-03T14:30:45.123Z`).

### Display

The gadget UI formats timestamps as follows:

1. **If browser timezone is available** (via `Intl.DateTimeFormat`): Format to browser's local time with timezone name.
2. **Otherwise:** Display UTC with explicit label `UTC`.

Example:
- Browser local: `Jan 3, 2025, 09:30:45 AM PST`
- UTC fallback: `2025-01-03T14:30:45.123Z UTC`

Never label a timestamp "local" unless the browser timezone was actually used.

## Counter Semantics (Best-Effort)

Due to Forge Storage **eventual consistency**, counters are **approximate**:

- No atomic writes
- No compare-and-set
- No multi-item transactions
- Concurrent updates may cause temporary inconsistency

**Consequence:** The `runCount` and `snapshotCount` fields are "best-effort." They converge to the true value, but may lag during high concurrency.

**Disclosure:** All counters display `(best-effort counter)` label to flag this.

**Not a Compliance Tool:** This dashboard is a transparency dashboard, not an audit log. Do not rely on precise counter values for compliance or SLA tracking.

## Staleness Detection (Cadence-Based)

The staleness detection uses the **meaningful check cadence**, not the platform trigger interval:

- **Cadence interval:** 15 minutes (FirstTry policy, enforced by storage gate)
- **Staleness threshold:** 2 × 15 minutes = **30 minutes**
- **Rule:** If `(now - lastCadenceCheckAt) > 30 minutes`, display status as `DEGRADED (STALE)` regardless of stored status
- **What it measures:** Elapsed time since the last meaningful check ran, not platform trigger pings

**Important:** A 5-minute platform trigger ping does NOT reset staleness. Only meaningful cadence checks (every 15 minutes) affect staleness.

If a trigger ping occurs every 5 minutes but cadence checks stopped, the gadget will show `DEGRADED (STALE)` after 30 minutes of no cadence checks.

## Integration Points

### Phase 5 Scheduler

The `phase5_scheduler.run` handler should call:

```typescript
import { recordHeartbeatCheck } from '../ops/heartbeat_recorder';

// After check completes:
await recordHeartbeatCheck(cloudId, {
  success: checkPassed,
  error: checkPassed ? undefined : errorMessage,
});
```

### Snapshot Handlers (Daily/Weekly)

The snapshot handlers should call:

```typescript
import { recordSnapshot } from '../ops/heartbeat_recorder';

// After snapshot is persisted:
await recordSnapshot(cloudId);
```

## UI Behavior

The gadget is **static and read-only**:

- No buttons
- No inputs
- No interactive controls
- No links to other pages
- No feature expansion

The gadget displays only what is in Forge Storage and manifest metadata.

## What This Dashboard Does NOT Prove

- Compliance with any policy
- Absence of errors
- Continuous operation (only checks if checks are happening)
- Data accuracy
- Security
- Recommendations for action
- Authority to make changes

## Marketplace Listings

When submitting to Atlassian Marketplace, **screenshots must be captured manually** from a running instance.

The gadget has no hardcoded demo data or mock states. Do not fabricate screenshots.

## Implementation Notes

### Storage Keys

```
firsttry:heartbeat:<cloudId>  — Main heartbeat record (JSON)
```

Tenant isolation is via `<cloudId>` in the key. No per-installation scope needed unless cloudId is unavailable.

### Handlers

**Heartbeat Recorder:** `src/ops/heartbeat_recorder.ts`

Exports:
- `recordHeartbeatCheck(cloudId, result)` — Called on check completion
- `recordSnapshot(cloudId)` — Called on snapshot creation
- `getHeartbeat(cloudId)` — Read-only getter for gadget/admin pages

### Gadget UI

**Component:** `src/gadget-ui/heartbeat.tsx`

React component with:
- Timestamp formatting (browser timezone or UTC)
- Staleness computation
- Unknown field disclosure
- Trust boundaries section
- Data availability panel

### Manifest

Already declared in `manifest.yml`:

```yaml
jira:dashboardGadget:
  - key: governance-dashboard-gadget
    resource: governance-gadget-page

resources:
  - key: governance-gadget-page
    path: src/gadget-ui
```

## Limitations & Disclaimers

1. **No Atom:** This dashboard provides visibility, not enforcement.
2. **Eventual Consistency:** Counters lag during concurrent updates.
3. **Context Dependency:** Requires `cloudId` from Forge context.
4. **Environment Unknown:** `FIRSTTRY_ENV` must be declared—it is not derived.
5. **No Secrets:** Error messages are sanitized; stack traces never shown.
6. **Per-Check Only:** Metrics reflect **when checks ran**, not what they did.

## Maintenance

When scheduled trigger intervals change in `manifest.yml`, update the expected interval in the gadget:

```typescript
const expectedIntervalMinutes = 5; // Currently phase5-auto-scheduler: fiveMinute
```

## Review Checklist

- [x] No new Jira scopes
- [x] No new scheduled triggers
- [x] No new admin UI
- [x] No assumptions
- [x] All unknowns disclosed with reason codes
- [x] No claimed guarantees not proven
- [x] Read-only only
- [x] Heartbeat record is minimal and truthful
- [x] UI is static and cannot mislead
- [x] Error messages are sanitized
- [x] Timestamps are UTC in storage, localized in display
- [x] Counters marked as best-effort
- [x] Trust boundaries unconditionally displayed
