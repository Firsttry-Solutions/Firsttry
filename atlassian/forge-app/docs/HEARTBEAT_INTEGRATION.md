# Heartbeat Integration Guide

## Overview

The **Heartbeat Recorder** (`src/ops/heartbeat_recorder.ts`) tracks operational metrics that are displayed in the trust dashboard gadget.

This guide explains how to integrate heartbeat recording into existing scheduled handlers.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Scheduled Triggers (manifest.yml)                      │
│  - phase5-auto-scheduler (5 min = platform trigger)     │
│  - phase6-daily-snapshot (daily)                        │
│  - phase6-weekly-snapshot (weekly)                      │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ├─→ Handler executes check/snapshot
                   │
                   ├─→ recordPlatformPing() [ALWAYS, every 5 min]
                   │   recordHeartbeatCheck() [CONDITIONAL, when cadence due]
                   │   recordSnapshot()
                   │
                   └─→ Updates Forge Storage: firsttry:heartbeat:<cloudId>
                   
┌────────────────────────────────────────────────────────────┐
│  Cadence Gate (src/ops/cadence_gate.ts)                   │
│  isCadenceDue(cloudId): Deterministic 15-min gate         │
│  - Checks if 15 minutes elapsed since lastCadenceCheckAt   │
│  - Returns true/false to gate meaningful check execution   │
└────────────────────────────────────────────────────────────┘
                   │
                   └─→ Forge Storage                         
┌──────────────────────────────────────────────────────────┐
│  firsttry:heartbeat:<cloudId> = HeartbeatRecord         │
│  With: lastTriggerAt (5-min pings)                      │
│        lastCadenceCheckAt (15-min cadence)              │
└──────────────────┬───────────────────────────────────────┘
                   │
                   └─→ Gadget reads and displays
```

## Integration Points

### Phase 5 Scheduler

**File:** `src/scheduled/phase5_scheduler.ts`

**Current flow:**
1. Trigger fires (every 5 minutes)
2. Record platform ping
3. Check if meaningful check is due (15-minute cadence gate)
4. If due: `handleAutoTrigger()` is called
5. Record heartbeat check result

**Required changes:**
1. Import heartbeat recorder and cadence gate
2. Call `recordPlatformPing()` ALWAYS (every 5 min)
3. Call `isCadenceDue()` to check if meaningful check should run
4. If due: Call handler and then `recordHeartbeatCheck()`
5. If not due: Skip handler, skip `recordHeartbeatCheck()`

**Example:**

```typescript
import { recordHeartbeatCheck, recordPlatformPing } from '../ops/heartbeat_recorder';
import { isCadenceDue } from '../ops/cadence_gate';

async function run(request: any): Promise<SchedulerResult> {
  const { cloudId } = request.payload;
  
  // ALWAYS record the platform ping (every 5 min)
  await recordPlatformPing(cloudId);
  
  // Check if meaningful check is due (every 15 min)
  const cadenceDue = await isCadenceDue(cloudId);
  
  if (!cadenceDue) {
    // Skip meaningful check this cycle
    return {
      success: true,
      message: 'Platform ping recorded; meaningful check not due yet',
      cloudId,
      ping_only: true,
      timestamp: new Date().toISOString(),
    };
  }
  
  // Meaningful check is due; run it
  try {
    const result = await handleAutoTrigger(cloudId);
    
    // Record success
    await recordHeartbeatCheck(cloudId, {
      success: true,
    });
    
    return {
      success: true,
      message: 'Report generated',
      cloudId,
      report_generated: true,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    // Record failure
    await recordHeartbeatCheck(cloudId, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return {
      success: false,
      message: 'Check failed',
      cloudId,
      timestamp: new Date().toISOString(),
    };
  }
}
```

### Snapshot Handlers (Daily/Weekly)

**Files:**
- `src/scheduled/snapshot_daily.ts`
- `src/scheduled/snapshot_weekly.ts`

**Current flow:**
1. Daily/weekly trigger fires
2. Snapshot is captured and persisted
3. Handler completes

**Required changes:**
1. Import heartbeat recorder
2. After snapshot is persisted, call `recordSnapshot()`

**Example:**

```typescript
import { recordSnapshot } from '../ops/heartbeat_recorder';

scheduled.on('phase6:daily', async (request) => {
  const { tenantId, cloudId } = request.payload;
  
  // ... existing snapshot logic ...
  
  // After snapshot is successfully persisted:
  await recordSnapshot(cloudId);
  
  // ... rest of handler ...
});
```

## API Reference

### `recordPlatformPing(cloudId: string): Promise<void>`

Records a platform trigger ping (called by scheduler every 5 minutes).

**Parameters:**

- `cloudId` (string): Tenant identifier from Forge context

**Behavior:**

1. Loads existing heartbeat record (or creates empty one)
2. Updates `lastTriggerAt` = now
3. Increments `triggerCount`
4. Sets `cadenceIntervalMinutes` = 15
5. Updates `updatedAt` = now
6. Persists to Forge Storage

**Error Handling:**

- Errors are logged but never thrown
- Platform ping failures do not disrupt the main app

**Note:** This is called EVERY 5-minute trigger, independent of whether the meaningful check is due.

**Example:**

```typescript
import { recordPlatformPing } from '../ops/heartbeat_recorder';

// At the start of the scheduler handler:
await recordPlatformPing(cloudId);
```

### `recordHeartbeatCheck(cloudId: string, result: CheckResult): Promise<void>`

Records a meaningful check execution (called when cadence due, approximately every 15 minutes).

**Parameters:**

- `cloudId` (string): Tenant identifier from Forge context
- `result` (CheckResult):
  - `success` (boolean): Whether the check succeeded
  - `error?` (string): Error message if check failed (optional)
  - `snapshotCount?` (number): Number of snapshots if snapshots were created (optional)

**Behavior:**

1. Loads existing heartbeat record (or creates empty one)
2. Updates `lastCheckAt` = now (for backward compat)
3. Updates `lastCadenceCheckAt` = now (primary timing field)
4. Increments `runCount`
5. If success:
   - Sets `status` = "RUNNING"
   - Sets `lastSuccessAt` = now
   - Sets `firstSuccessAt` = now (only if not already set)
   - Clears `lastError`
6. If failure:
   - Sets `status` = "DEGRADED"
   - Sets `lastError` = sanitized error message
7. Updates `updatedAt` = now
8. Persists to Forge Storage

**Error Handling:**

- Errors are logged but never thrown
- Heartbeat failures do not disrupt the main app

**Example:**

```typescript
await recordHeartbeatCheck(cloudId, {
  success: true,
});

// With error:
await recordHeartbeatCheck(cloudId, {
  success: false,
  error: 'Failed to query Jira API: timeout',
});

// With snapshot count:
await recordHeartbeatCheck(cloudId, {
  success: true,
  snapshotCount: 42,
});
```

### `recordSnapshot(cloudId: string): Promise<void>`

Records a snapshot artifact creation.

**Parameters:**

- `cloudId` (string): Tenant identifier

**Behavior:**

1. Loads existing heartbeat record (or creates empty one)
2. Increments `snapshotCount`
3. Updates `updatedAt` = now
4. Persists to Forge Storage

**Error Handling:**

- Errors are logged but never thrown

**Example:**

```typescript
// After snapshot is persisted:
await recordSnapshot(cloudId);
```

### `getHeartbeat(cloudId: string): Promise<HeartbeatRecord | null>`

Reads the current heartbeat record (read-only).

**Parameters:**

- `cloudId` (string): Tenant identifier

**Returns:**

- Heartbeat record if it exists, or null

**Used by:**

- Dashboard gadget
- Admin pages
- Any component that displays operational metrics

**Example:**

```typescript
const hb = await getHeartbeat(cloudId);
if (hb) {
  console.log(`Checks completed: ${hb.runCount}`);
  console.log(`Last successful run: ${hb.lastSuccessAt}`);
}
```

## Heartbeat Record Shape

```typescript
interface HeartbeatRecord {
  status: 'RUNNING' | 'INITIALIZING' | 'DEGRADED';
  lastSuccessAt?: string;         // UTC ISO 8601
  lastCheckAt?: string;           // UTC ISO 8601 (legacy, for compat)
  lastTriggerAt?: string;         // UTC ISO 8601 (platform ping timestamp)
  lastCadenceCheckAt?: string;    // UTC ISO 8601 (meaningful check timestamp)
  firstSuccessAt?: string;        // UTC ISO 8601
  runCount?: number;              // Meaningful checks completed
  triggerCount?: number;          // Platform pings observed
  snapshotCount?: number;
  cadenceIntervalMinutes?: number; // Fixed: 15
  lastError?: string;             // Max 300 chars, sanitized
  updatedAt?: string;             // UTC ISO 8601
}
```

**Rules:**

- All timestamps are UTC ISO 8601 strings
- Missing fields are omitted (not null)
- `lastError` is truncated to 300 chars, single-line, secrets redacted
- Counters are optional and omitted until first use
- **Platform vs. Cadence timing:**
  - `lastTriggerAt` / `triggerCount` = 5-minute Forge platform trigger pings (always recorded)
  - `lastCadenceCheckAt` / `runCount` = 15-minute meaningful checks (recorded when cadence due)
  - Staleness is computed from `lastCadenceCheckAt` only (with 30-minute threshold)

## Error Sanitization

The `recordHeartbeatCheck()` function sanitizes error messages:

1. Removes newlines
2. Redacts common secret patterns (20+ char strings, token/key/secret/password words)
3. Truncates to 300 characters

**Example:**

```
Input:  "Failed to authenticate with token abc123def456ghijklmnop: timeout after 5s"
Output: "Failed to authenticate with [REDACTED]: timeout after 5s"
```

This prevents accidental exposure of secrets in error logs.

## Storage Guarantees

Forge Storage provides:

- **Tenant isolation:** Each installation is scoped to its `cloudId`
- **Per-installation scope:** Storage is not shared across tenants
- **Best-effort counters:** Concurrent updates may cause temporary inconsistency
- **Eventual consistency:** Converges to correct value over time

**Implication:** The heartbeat gadget displays "best-effort" counters. They are approximate and lag during high concurrency.

## Timezone Handling

**Storage:**

All timestamps are stored as UTC ISO 8601 strings:

```
2025-01-03T14:30:45.123Z
```

**Display:**

The gadget UI formats timestamps as follows:

1. If browser timezone is available (Intl.DateTimeFormat): Format to local time with timezone
2. Otherwise: Display UTC with explicit "UTC" label

**Never** label a timestamp "local" unless the browser timezone was actually used.

## Monitoring & Debugging

### View Current Heartbeat

You can read the heartbeat record programmatically:

```typescript
import { getHeartbeat } from '../ops/heartbeat_recorder';

const hb = await getHeartbeat(cloudId);
console.log(JSON.stringify(hb, null, 2));
```

### Expected Metrics

After the app runs for a while, you should see:

```json
{
  "status": "RUNNING",
  "lastSuccessAt": "2025-01-03T14:30:45.123Z",
  "lastCheckAt": "2025-01-03T14:30:45.123Z",
  "lastTriggerAt": "2025-01-03T14:35:45.123Z",
  "lastCadenceCheckAt": "2025-01-03T14:30:45.123Z",
  "firstSuccessAt": "2025-01-03T10:00:00.000Z",
  "runCount": 18,
  "triggerCount": 54,
  "snapshotCount": 3,
  "cadenceIntervalMinutes": 15,
  "updatedAt": "2025-01-03T14:35:45.123Z"
}
```

**Interpretation:**

- `triggerCount: 54` = ~54 platform pings (5-min interval over ~4.5 hours)
- `runCount: 18` = ~18 meaningful checks (15-min cadence over same period; 54 / 3 ≈ 18)
- `lastTriggerAt` is more recent than `lastCadenceCheckAt` (expected; triggers happen every 5 min, checks every 15 min)
- `lastCadenceCheckAt` and `lastCheckAt` should be the same or very close

### Debugging Stale Status

If the gadget shows `DEGRADED (STALE)`:

1. Check the manifest trigger interval (currently 5 minutes = platform trigger)
2. Check cadence interval: 15 minutes (FirstTry meaningful check cadence)
3. Calculate staleness threshold: 2 × 15 = 30 minutes
4. Check `lastCadenceCheckAt`: If `now - lastCadenceCheckAt > 30 minutes`, staleness triggers
5. **Note:** `lastTriggerAt` (platform pings) updates every 5 minutes; staleness uses only `lastCadenceCheckAt`
6. Verify the scheduled trigger is executing (check logs)
7. Verify the cadence gate is allowing checks every ~15 minutes
8. Check for Forge API errors that might prevent handler execution

## Testing

### Unit Test Example

```typescript
import { recordHeartbeatCheck, getHeartbeat } from '../ops/heartbeat_recorder';

test('records successful check', async () => {
  const cloudId = 'test-tenant-123';
  
  await recordHeartbeatCheck(cloudId, { success: true });
  const hb = await getHeartbeat(cloudId);
  
  expect(hb?.status).toBe('RUNNING');
  expect(hb?.runCount).toBeGreaterThan(0);
  expect(hb?.lastSuccessAt).toBeDefined();
});

test('records failed check', async () => {
  const cloudId = 'test-tenant-456';
  
  await recordHeartbeatCheck(cloudId, {
    success: false,
    error: 'Timeout',
  });
  const hb = await getHeartbeat(cloudId);
  
  expect(hb?.status).toBe('DEGRADED');
  expect(hb?.lastError).toContain('Timeout');
});
```

## Performance Considerations

### Storage Writes

- One write per scheduled check (currently ~12/hour = 288/day for 5-min interval)
- One write per snapshot creation (currently 2/day)
- **Total:** ~290 writes/day per tenant

Forge Storage can handle this without issues.

### Gadget Reads

- One read per gadget load
- Lazy-loaded on first view
- No polling

No performance concerns.

## Conclusion

The heartbeat recorder is a lightweight, read-only transparency layer that proves FirstTry is operating without adding administrative overhead or security risk.

Integrate it into your scheduled handlers by adding 2-3 lines of code per handler.
