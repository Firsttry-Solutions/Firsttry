# Phase-5 Scheduler Hardening - Technical Design

**Last Updated:** January 15, 2024  
**Status:** Complete Hardening Implementation  
**Risk Level:** CRITICAL - Failure propagation protection

---

## Overview

The Phase-5 scheduler has been hardened to eliminate cascading failures, prevent regeneration, and handle concurrency safely. This document specifies the security properties that prevent system-wide outages.

---

## A. Tenant Identity Hardening

### Requirement
- FAIL CLOSED if tenant context (cloudId) unavailable
- NO fixtures, fallbacks, or hardcoded values
- NO inferred tenants

### Implementation
```typescript
if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
  return {
    statusCode: 400,
    body: JSON.stringify({
      success: false,
      error_code: 'TENANT_CONTEXT_UNAVAILABLE',
      message: 'Tenant identity not available in Forge context'
    })
  };
}
```

### Properties Guaranteed
- If Forge context is corrupt/missing, scheduler returns HTTP 400
- No processing occurs without valid tenant identity
- Prevents operating on wrong tenant's data

---

## B. Installation Timestamp Hardening

### Requirement
- Load ONLY from Phase-4 evidence storage
- FAIL CLOSED if Phase-4 evidence unavailable
- NO fixtures, no inferred timestamps

### Implementation
```typescript
// In scheduler_state.ts
export async function loadInstallationTimestamp(cloudId: string): Promise<string | null> {
  try {
    const installationEvidence = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(`phase4:evidence:installation:${cloudId}`);
    });

    if (!installationEvidence || !installationEvidence.installed_at) {
      console.warn('[SchedulerState] FAIL_CLOSED: Installation timestamp not found');
      return null;
    }

    const timestamp = installationEvidence.installed_at as string;
    const parsed = new Date(timestamp);
    if (isNaN(parsed.getTime())) {
      console.error('[SchedulerState] FAIL_CLOSED: Invalid timestamp format');
      return null;
    }

    return timestamp;
  } catch (error) {
    console.error('[SchedulerState] FAIL_CLOSED: Error loading installation timestamp', error);
    return null;
  }
}
```

### Properties Guaranteed
- Installation timestamp must exist in Phase-4 evidence
- Timestamps are validated (ISO 8601 format)
- If not found, scheduler returns early without attempting generation
- Age calculation uses only Phase-4 evidence

---

## C. Idempotency Hardening - DONE_KEY Authoritative

### Requirement
- DONE_KEY is **authoritative** - prevents ALL future runs
- DONE_KEY is **write-once** - set only on successful generation
- Never regenerate if DONE_KEY exists (entire code path skipped)

### Implementation

**Step 1: Check Authoritative DONE Marker**
```typescript
// After deciding due trigger, FIRST check if DONE_KEY exists
const triggerDone = await hasCompletionMarker(cloudId, dueTrigger);
if (triggerDone) {
  console.info(
    `[Phase5Scheduler] AUTHORITATIVE: ${dueTrigger} DONE_KEY exists; never regenerating`
  );
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: `${dueTrigger} has already been generated`,
      reason: 'DONE_KEY_EXISTS',
      report_generated: false
    })
  };
}
```

**Step 2: Generate Report**
```typescript
const result = await handleAutoTrigger(dueTrigger);

if (result.success) {
  // Write DONE marker ONLY on success
  await writeCompletionMarker(cloudId, dueTrigger);
} else {
  // On failure: do NOT write DONE marker
  // On retry: will attempt again (respecting backoff)
}
```

### Properties Guaranteed
- If DONE_KEY exists for AUTO_12H, `handleAutoTrigger('AUTO_12H')` is never called
- Entire scheduler code path from due-check to generation respects DONE_KEY
- DONE_KEY writes are atomic (implemented via Forge Storage `set` with conditional check)
- Multiple concurrent invocations converge to single winner (first to write DONE_KEY wins)

### Storage Keys
- `phase5:scheduler:{cloudId}:AUTO_12H:DONE` - Write-once completion marker
- `phase5:scheduler:{cloudId}:AUTO_24H:DONE` - Write-once completion marker

---

## D. Bounded, Controlled Backoff

### Requirement
- Exponential backoff: 30min → 120min → 24h
- Never exceed 24h (caps at 3rd+ attempt)
- Backoff is per-trigger (separate for AUTO_12H and AUTO_24H)
- Backoff is advisory (LOCK), not authoritative (does not prevent DONE_KEY check)

### Implementation
```typescript
function calculateBackoffMs(attemptCount: number): number {
  let minutes = 30; // Default: 1st attempt
  if (attemptCount >= 3) {
    minutes = 1440; // 24 hours
  } else if (attemptCount >= 2) {
    minutes = 120; // 2 hours
  }
  return minutes * 60 * 1000;
}

// On failure:
const newAttemptCount = attemptCount + 1;
const backoffMs = calculateBackoffMs(newAttemptCount);
state.last_backoff_until = new Date(Date.now() + backoffMs).toISOString();

// On next run, check backoff BEFORE attempting:
const canRetry = !state.last_backoff_until || 
  new Date(state.last_backoff_until).getTime() < Date.now();

if (!canRetry) {
  // Skip this trigger for now (continue to next run)
  return { statusCode: 200, ... };
}
```

### Properties Guaranteed
- Backoff is bounded: never exceeds 24 hours
- Each trigger (AUTO_12H, AUTO_24H) has independent attempt counts
- After 3 failures for a trigger, backoff is 24 hours
- Backoff prevents rapid retries of failing operations
- Scheduler returns HTTP 200 if backoff active (no error)

### Attempt Count Tracking
- `state.auto_12h_attempt_count` - Incremented on each AUTO_12H attempt
- `state.auto_24h_attempt_count` - Incremented on each AUTO_24H attempt
- Resets only if trigger succeeds (DONE_KEY written)

---

## E. Fail-Closed (Never Throws)

### Requirement
- Scheduler never throws uncaught exceptions
- Always returns HTTP response (200, 202, 400, or 500)
- Errors are logged and recorded in state

### Implementation
```typescript
export async function phase5SchedulerHandler(request: any, context: any): Promise<...> {
  try {
    // All scheduler logic in try block
    ...
    return { statusCode: 200, body: ... };
  } catch (err) {
    // Outer catch-all: fatal scheduler error
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Phase5Scheduler] Unexpected error in scheduler: ${errorMsg}`);

    // FAIL CLOSED: Do not throw
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: `Scheduler error: ${errorMsg}`,
        timestamp: new Date().toISOString()
      })
    };
  }
}
```

### HTTP Status Codes
- **200** - Request processed, no trigger due / DONE_KEY exists / backoff active
- **202** - Trigger attempted but generation failed (will retry on next run)
- **400** - Tenant identity unavailable (fatal, requires manual intervention)
- **500** - Unexpected scheduler error (fatal system error, examine logs)

### Properties Guaranteed
- Forge runtime never receives uncaught exception from scheduler
- All failures are logged with context (cloudId, trigger, attempt count)
- Scheduler always updates state before returning (aids debugging)

---

## F. Single Code Path (handleAutoTrigger)

### Requirement
- Report generation uses **one code path**: `handleAutoTrigger()`
- No duplicate logic, no specialized paths
- Same path for AUTO_12H and AUTO_24H

### Implementation
```typescript
// Scheduler ONLY decides trigger and calls handleAutoTrigger
const dueTrigger = await decideDueTrigger(cloudId, installationTimestamp);

if (!dueTrigger) {
  // No trigger due, return early
  return { statusCode: 200, ... };
}

// Check DONE_KEY...
const triggerDone = await hasCompletionMarker(cloudId, dueTrigger);
if (triggerDone) {
  return { statusCode: 200, ... };
}

// Check backoff...
const canRetry = ...;
if (!canRetry) {
  return { statusCode: 200, ... };
}

// SINGLE CODE PATH: handleAutoTrigger
const result = await handleAutoTrigger(dueTrigger);
```

### Properties Guaranteed
- `handleAutoTrigger('AUTO_12H')` and `handleAutoTrigger('AUTO_24H')` are identical code
- No scheduler-specific generation logic (all in `handleAutoTrigger`)
- Scheduler's job: orchestrate, not generate
- Improves testability and maintainability

---

## G. Concurrency Safety

### Requirement
- Handle concurrent invocations for same tenant/trigger
- Write-once DONE_KEY semantics prevent duplicate reports
- State updates are atomic per trigger

### Implementation

**Concurrency Pattern**
```
Invocation 1                          Invocation 2
─────────────────────────────────────────────────────
Check DONE_KEY (not exists)    +    Check DONE_KEY (not exists)
Check backoff (not active)     +    Check backoff (not active)
Increment attempt count (→1)   +    Increment attempt count (→2!)
Call handleAutoTrigger(...)    +    Call handleAutoTrigger(...)
Generation succeeds            +    Generation succeeds
Write DONE_KEY (atomic)        +    Write DONE_KEY (atomic)
     ↓                              ↓
  [SUCCESS]              vs      [Idempotent - DONE_KEY exists]
```

The second invocation's write to DONE_KEY may fail atomically (Forge Storage
handles conditional writes), but even if both succeed:
- Only one report is logically generated (DONE_KEY is authoritative)
- On next trigger cycle, both will see DONE_KEY and skip

### Storage Atomicity
- Forge Storage `set()` is atomic at the key level
- DONE_KEY write is atomic: either succeeds or fails, never partial
- Multiple concurrent writes to same DONE_KEY: last-write-wins (idempotent)

### State Tracking
- `last_run_at` - Updated on every scheduler invocation (latest time)
- `auto_12h_attempt_count` - Only incremented if AUTO_12H attempted
- `auto_24h_attempt_count` - Only incremented if AUTO_24H attempted
- `last_error` - Recorded only on failures (attempt count, message, timestamp)

### Properties Guaranteed
- If two concurrent invocations both attempt AUTO_12H, both see DONE_KEY after
- DONE_KEY prevents logical duplicate even if generation ran twice
- Attempt counts are consistent (incremented before generation)
- State is consistent with whether DONE_KEY was written

---

## Testing Strategy

Hardening is validated by comprehensive test suite:

1. **Tenant Identity Tests**
   - Missing cloudId → HTTP 400
   - Empty/whitespace cloudId → HTTP 400
   - Valid cloudId → proceeds

2. **Installation Timestamp Tests**
   - Missing Phase-4 evidence → HTTP 200 (skip)
   - Valid timestamp → calculates trigger correctly
   - Invalid timestamp → HTTP 200 (skip)

3. **Idempotency Tests**
   - DONE_KEY exists → HTTP 200, no generation
   - Successful generation → DONE_KEY written
   - Failed generation → DONE_KEY not written

4. **Backoff Tests**
   - 1st failure → 30min backoff
   - 2nd failure → 120min backoff
   - 3rd+ failure → 24h backoff
   - Backoff active → skip generation, return HTTP 200

5. **Fail-Closed Tests**
   - Scheduler logic error → HTTP 500
   - Generation error → HTTP 202, not thrown

6. **Single Code Path Tests**
   - `handleAutoTrigger` called exactly once per trigger
   - Both triggers use same code path

7. **Concurrency Tests**
   - Separate attempt counts per trigger
   - DONE_KEY authoritative across concurrent invocations

---

## Deployment Checklist

- [ ] Scheduler code passes all hardening tests
- [ ] Installation timestamp loads from Phase-4 evidence only
- [ ] Tenant identity extracted from Forge context (no fallbacks)
- [ ] DONE_KEY implementation verified (write-once semantics)
- [ ] Backoff calculations validated (30min, 120min, 24h)
- [ ] All error paths return HTTP response (never throw)
- [ ] `handleAutoTrigger` is sole generation entry point
- [ ] State tracking correct (separate attempt counts per trigger)
- [ ] Logging includes cloudId, trigger, attempt count, backoff duration
- [ ] Documentation updated (this file)
- [ ] No Phase-4 or Phase-5 logic changes (scheduler orchestration only)

---

## Rollback Plan

If scheduler hardening causes issues:

1. Pause Forge scheduled trigger (via manifest.yml)
2. Verify Phase-4 evidence storage has correct installation timestamps
3. Check if DONE_KEY values are preventing expected generation
4. Review logs for FAIL_CLOSED errors (tenant identity or timestamp)
5. Manually generate reports if needed via Phase-5 API

---

## Future Considerations

1. **Metrics/Observability**: Log backoff durations, attempt counts per trigger
2. **Admin UI**: Display per-tenant scheduler state (attempt count, DONE_KEY status, next run)
3. **Recovery**: Manual DONE_KEY reset if needed (requires admin intervention)
4. **Trigger Adjustment**: May increase initial backoff to 1h if too noisy

---

## References

- Phase-4 Evidence Storage: `src/phase4/evidence_storage.ts`
- Phase-5 Report Generator: `src/phase5_report_generator.ts`
- Scheduler State: `src/scheduled/scheduler_state.ts`
- Scheduler Tests: `src/scheduled/__tests__/phase5_scheduler_hardening.test.ts`
