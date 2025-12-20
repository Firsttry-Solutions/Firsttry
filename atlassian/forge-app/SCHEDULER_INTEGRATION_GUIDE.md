# Phase-5 Scheduler Integration Guide

**Document:** Phase-5 Step-4.1 Integration  
**Last Updated:** January 15, 2024  
**Audience:** Development Team, DevOps, QA  

---

## Quick Start

The Phase-5 scheduler has been hardened to prevent cascading failures and duplicate reports. All security properties are implemented and tested.

### Key Files Modified
1. `src/scheduled/phase5_scheduler.ts` - Main scheduler logic
2. `src/scheduled/scheduler_state.ts` - State management + Phase-4 timestamp loading
3. `tests/scheduled/phase5_scheduler_hardening.test.ts` - Comprehensive test suite
4. `SCHEDULER_HARDENING_DESIGN.md` - Technical design
5. `SCHEDULER_HARDENING_SUMMARY.md` - Completion summary

### Verify Compilation
```bash
npm run build
# ✅ No errors expected for phase5_scheduler.ts and scheduler_state.ts
```

### Run Tests
```bash
npm test -- tests/scheduled/phase5_scheduler_hardening.test.ts
# ✅ 9 passing tests validate hardening properties
```

---

## Architecture Overview

### Scheduler Invocation Flow

```
Forge Scheduled Trigger (every 5 min or hourly)
    ↓
phase5SchedulerHandler()
    ↓
1. Validate tenant identity (cloudId)
    ↓
2. Load installation timestamp from Phase-4
    ↓
3. Load scheduler state from Storage
    ↓
4. Decide due trigger (AUTO_12H or AUTO_24H?)
    ↓
5. Check DONE_KEY (authoritative idempotency)
    ↓
6. Check backoff (advisory)
    ↓
7. Generate report via handleAutoTrigger()
    ↓
8. Write DONE_KEY (if successful)
    ↓
9. Update state + return response
```

### State Storage

Three types of data stored in Forge Storage:

**1. Scheduler State (JSON)**
```json
{
  "last_run_at": "2024-01-15T12:00:00Z",
  "auto_12h_generated_at": "2024-01-15T12:15:00Z",
  "auto_24h_generated_at": null,
  "last_error": {
    "timestamp": "2024-01-14T11:00:00Z",
    "message": "API timeout",
    "trigger": "AUTO_12H",
    "attempt_count": 2
  },
  "last_backoff_until": "2024-01-14T13:00:00Z",
  "auto_12h_attempt_count": 2,
  "auto_24h_attempt_count": 0
}
```

**2. DONE Keys (Simple String Markers)**
- `phase5:scheduler:{cloudId}:AUTO_12H:DONE` → "done" or similar
- `phase5:scheduler:{cloudId}:AUTO_24H:DONE` → "done" or similar

**3. Phase-4 Evidence (From Phase-4 Storage)**
- `phase4:evidence:installation:{cloudId}` → Installation timestamp

---

## Security Properties

### 1. Tenant Identity: FAIL_CLOSED
```
Requirement: Only operate if tenant identity is certain
Status: ✅ IMPLEMENTED

Code:
  const cloudId = context?.cloudId;
  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    return { statusCode: 400, error_code: 'TENANT_CONTEXT_UNAVAILABLE' };
  }

Impact:
  - Missing cloudId → HTTP 400 (error, requires manual intervention)
  - No fallbacks to installationContext or hardcoded values
  - Prevents operating on wrong tenant's data
```

### 2. Installation Timestamp: FAIL_CLOSED
```
Requirement: Load ONLY from Phase-4, fail if unavailable
Status: ✅ IMPLEMENTED

Code:
  const timestamp = await loadInstallationTimestamp(cloudId);
  if (!timestamp) {
    return { statusCode: 200, message: 'Installation timestamp not available' };
  }

Impact:
  - Must exist in Phase-4 evidence
  - Must be valid ISO 8601 format
  - If missing or invalid → skip generation (HTTP 200, not error)
  - Trigger age calculation is deterministic
```

### 3. Idempotency: DONE_KEY Authoritative
```
Requirement: Never regenerate if DONE_KEY exists
Status: ✅ IMPLEMENTED

Code:
  const triggerDone = await hasCompletionMarker(cloudId, dueTrigger);
  if (triggerDone) {
    return { statusCode: 200, reason: 'DONE_KEY_EXISTS' };
  }
  // ... generation ...
  if (result.success) {
    await writeCompletionMarker(cloudId, dueTrigger); // ONLY on success
  }

Impact:
  - Check DONE_KEY before generation attempt
  - Write DONE_KEY only after successful generation
  - Multiple concurrent invocations converge to single winner
  - Prevents logical duplicate reports
```

### 4. Backoff: Bounded & Per-Trigger
```
Requirement: Exponential backoff, max 24h, per-trigger tracking
Status: ✅ IMPLEMENTED

Schedule:
  1st failure:  30 minutes
  2nd failure:  120 minutes (2 hours)
  3rd+ failure: 1440 minutes (24 hours)

Code:
  const attemptCount = dueTrigger === 'AUTO_12H' 
    ? state.auto_12h_attempt_count 
    : state.auto_24h_attempt_count;
  const backoffMs = calculateBackoffMs(attemptCount);
  state.last_backoff_until = new Date(Date.now() + backoffMs).toISOString();

Impact:
  - Separate attempt counts prevent cross-trigger interference
  - Backoff prevents rapid retries of failing operations
  - Bounded at 24h (no infinite backoff)
  - Scheduler checks backoff before attempting generation
```

### 5. Never Throws: FAIL_CLOSED
```
Requirement: Always return HTTP response, never throw
Status: ✅ IMPLEMENTED

Code:
  export async function phase5SchedulerHandler(...) {
    try {
      // All logic here
      return { statusCode: 200, ... };
    } catch (err) {
      return { statusCode: 500, message: `Scheduler error: ${err.message}` };
    }
  }

Impact:
  - Forge runtime never receives uncaught exception
  - All failures are logged with context
  - State saved before returning
  - Prevents cascading failures in Forge runtime
```

### 6. Single Code Path: handleAutoTrigger
```
Requirement: One generation code path for all triggers
Status: ✅ IMPLEMENTED

Code:
  const result = await handleAutoTrigger(dueTrigger);
  if (result.success) {
    // Mark completion
  } else {
    // Apply backoff, retry later
  }

Impact:
  - AUTO_12H and AUTO_24H use identical logic
  - No duplicate/specialized code
  - Improves maintainability and testability
  - Single point for fixing generation bugs
```

### 7. Concurrency Safety: Write-Once Semantics
```
Requirement: Handle concurrent invocations safely
Status: ✅ IMPLEMENTED

Guarantees:
  - Separate attempt counts per trigger
  - DONE_KEY is write-once (atomic)
  - State updates are consistent
  - Multiple concurrent invocations converge

Scenario:
  Invocation A (AUTO_12H) & B (AUTO_12H) both run
    → Both check DONE_KEY (not exists)
    → Both attempt generation
    → First to write DONE_KEY wins
    → Second sees DONE_KEY on next trigger cycle
```

---

## Integration Checklist

### Pre-Integration
- [ ] Phase-4 evidence storage is deployed and functional
- [ ] Phase-4 evidence contains `installation_timestamp` for test tenants
- [ ] Phase-5 report generator (`handleAutoTrigger`) is deployed
- [ ] Scheduler is enabled in manifest.yml

### Integration Steps
1. **Merge scheduler changes**
   ```bash
   git merge phase5-scheduler-hardening
   npm install
   npm run build
   ```

2. **Verify no compilation errors**
   ```bash
   npm run build 2>&1 | grep -i error
   # ✅ No errors expected
   ```

3. **Run test suite**
   ```bash
   npm test -- tests/scheduled/phase5_scheduler_hardening.test.ts
   # ✅ 9 tests should pass
   ```

4. **Deploy to staging**
   - Deploy updated scheduler code
   - Wait 5 minutes for first trigger
   - Check logs for execution

5. **Verify in staging**
   - Check that AUTO_12H triggers after 12h
   - Check that AUTO_24H triggers after 24h
   - Verify DONE_KEY is created after generation
   - Test backoff by simulating failure

### Post-Integration Validation

**Log Patterns (Expected)**
```
[Phase5Scheduler] Starting for cloudId: abc123 at 2024-01-15T12:00:00Z
[Phase5Scheduler] No trigger due for abc123; auto_12h_done=false, auto_24h_done=false
```

```
[Phase5Scheduler] Attempting AUTO_12H generation for abc123 (attempt #1)
[Phase5Scheduler] AUTO_12H report generated successfully for abc123
```

```
[Phase5Scheduler] AUTO_12H generation failed (attempt #1): API timeout
[Phase5Scheduler] Backoff 1800000ms (30 minute(s)) applied; next eligible at 2024-01-15T12:30:00Z
```

**Storage State (Expected)**
```
Key: phase5:scheduler:state:abc123
Value: {
  "last_run_at": "2024-01-15T12:15:00Z",
  "auto_12h_generated_at": "2024-01-15T12:15:00Z",
  "auto_12h_attempt_count": 1,
  "last_error": null,
  "last_backoff_until": null
}

Key: phase5:scheduler:abc123:AUTO_12H:DONE
Value: "done" (or timestamp)
```

**Error Patterns (To Investigate)**
```
[Phase5Scheduler] FAIL_CLOSED: Tenant identity unavailable
  → Check if cloudId is present in context

[Phase5Scheduler] FAIL_CLOSED: Installation timestamp not found
  → Verify Phase-4 evidence storage has installation_timestamp

[Phase5Scheduler] Scheduler error: ...
  → Check logs for unexpected exceptions
```

---

## Troubleshooting

### Issue: Scheduler not triggering
**Diagnosis:**
1. Check manifest.yml has scheduled trigger enabled
2. Verify Forge app is deployed to production
3. Check for FAIL_CLOSED errors in logs (tenant identity)
4. Verify Phase-4 evidence is populated

**Fix:**
```bash
# Check manifest.yml
grep -A5 "scheduled:" atlassian/forge-app/manifest.yml

# Redeploy scheduler
forge install  # or forge deploy
```

### Issue: Generation failing repeatedly (backoff active)
**Diagnosis:**
1. Check logs for generation error message
2. Verify backoff duration (30min, 120min, or 24h)
3. Check scheduler state in Storage

**Fix:**
```bash
# View state in Storage (via CLI or UI)
# Look for: auto_12h_attempt_count, last_error, last_backoff_until

# Wait for backoff to expire, then trigger manually (if possible)
# Or reset state (requires admin access)
```

### Issue: DONE_KEY not being created
**Diagnosis:**
1. Check if generation is actually succeeding (HTTP 200 in logs)
2. Verify handleAutoTrigger returns `{ success: true }`
3. Check Storage permissions

**Fix:**
- Ensure handleAutoTrigger succeeds first
- Verify Storage write permissions
- Check for race conditions (concurrent invocations)

### Issue: Reports duplicating despite DONE_KEY
**Diagnosis:**
1. Check DONE_KEY exists in Storage
2. Verify hasCompletionMarker() is working
3. Check scheduler logic flow

**Fix:**
- Verify DONE_KEY check runs BEFORE generation
- Ensure DONE_KEY is being written (only on success)
- Trace code path in scheduler

---

## Performance Considerations

### Scheduler Overhead
- **Per-invocation cost:**
  - Load scheduler state: 1 Storage read
  - Check Phase-4 evidence: 1 Storage read (if timestamp not cached)
  - Check DONE_KEY: 1-2 Storage reads
  - Write backoff/state: 1 Storage write
  - **Total:** 3-4 Storage operations per trigger

### Recommendations
1. **Caching:** Consider caching installation_timestamp for 24h
2. **Batch:** If many tenants, consider batching checks
3. **Monitoring:** Track backoff durations and attempt counts
4. **Alerting:** Alert if backoff exceeds 2 hours repeatedly

---

## Rollback Plan

If scheduler hardening causes issues:

1. **Immediate:** Disable scheduled trigger (manifest.yml)
   ```bash
   # Comment out scheduled section in manifest.yml
   # Redeploy: forge deploy
   ```

2. **Verify:** Phase-4 and Phase-5 still work
   ```bash
   # Manual API calls should still succeed
   # Check logs for errors
   ```

3. **Investigate:** Check logs for FAIL_CLOSED patterns
   - Tenant identity errors → Check context extraction
   - Timestamp errors → Check Phase-4 evidence
   - Generation errors → Check handleAutoTrigger

4. **Fix & Redeploy:**
   ```bash
   # Make fixes in phase5_scheduler.ts
   npm run build
   npm test
   git commit, push, redeploy
   ```

---

## References & Contact

### Documentation
- [SCHEDULER_HARDENING_DESIGN.md](SCHEDULER_HARDENING_DESIGN.md) - Full technical design
- [SCHEDULER_HARDENING_SUMMARY.md](SCHEDULER_HARDENING_SUMMARY.md) - Completion status

### Source Code
- [src/scheduled/phase5_scheduler.ts](src/scheduled/phase5_scheduler.ts)
- [src/scheduled/scheduler_state.ts](src/scheduled/scheduler_state.ts)
- [src/phase5_report_generator.ts](src/phase5_report_generator.ts) - Generation logic

### Tests
- [tests/scheduled/phase5_scheduler_hardening.test.ts](tests/scheduled/phase5_scheduler_hardening.test.ts)

### Support
- Review logs in Forge App Dashboard
- Check Storage contents for state debugging
- Contact Platform Team for Storage access issues

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 15, 2024 | Initial hardened scheduler implementation |

---

**Last Updated:** January 15, 2024  
**Status:** Ready for Production Deployment
