# PHASE 6 v2: SNAPSHOT EVIDENCE LEDGER SPECIFICATION

**Version:** 1.0.0  
**Status:** Stage 1 Technical Specification  
**Date:** 2024-01-15  
**Audience:** Developers, API Consumers  

---

## 1. Data Model Reference

### 1.1 SnapshotRun Interface

Execution record created for each scheduled run.

```typescript
interface SnapshotRun {
  // Identification
  tenant_id: string;              // Multi-tenant identifier
  cloud_id: string;               // Jira Cloud instance ID
  run_id: string;                 // UUID (unique within tenant)

  // Scheduling
  scheduled_for: string;          // ISO 8601 datetime (scheduled time)
  snapshot_type: 'daily' | 'weekly';

  // Timing
  started_at: string;             // ISO 8601 (execution start)
  finished_at: string;            // ISO 8601 (execution end)

  // Outcome
  status: 'success' | 'partial' | 'failed';
  error_code: ErrorCode;          // See enum below
  error_detail?: string;          // Human-readable error message

  // Execution metrics
  api_calls_made: number;         // Count of Jira API calls
  rate_limit_hits_count: number;  // How many 429 responses

  // Output
  produced_snapshot_id?: string;  // UUID (only if status !== 'failed')
  schema_version: string;         // "1.0.0"

  // Canonicalization
  produced_canonical_hash?: string; // SHA256 of snapshot payload
  hash_algorithm: 'sha256';

  // Observability
  clock_source: 'system' | 'jira' | 'unknown';
  duration_ms: number;            // Execution time in milliseconds
}
```

### 1.2 Snapshot Interface

Immutable evidence record. Never modified after creation.

```typescript
interface Snapshot {
  // Identification
  tenant_id: string;              // Multi-tenant identifier
  cloud_id: string;               // Jira Cloud instance ID
  snapshot_id: string;            // UUID (unique within tenant)

  // Metadata
  captured_at: string;            // ISO 8601 (capture timestamp)
  snapshot_type: 'daily' | 'weekly';
  schema_version: string;         // "1.0.0"

  // Canonicalization
  canonical_hash: string;         // SHA256 (64-char hex)
  hash_algorithm: 'sha256';
  clock_source: 'system' | 'jira' | 'unknown';

  // Scope information
  scope: {
    projects_included: string[];  // Project keys/IDs (can be ["ALL"])
    projects_excluded: string[];  // Excluded projects
  };

  // Input provenance
  input_provenance: InputProvenance; // See below

  // Missing data disclosure
  missing_data: MissingDataItem[]; // See below

  // Payload (structure depends on snapshot_type)
  payload: Record<string, any>;   // JSON object with datasets
}
```

### 1.3 InputProvenance Interface

Metadata about what was queried and available.

```typescript
interface InputProvenance {
  endpoints_queried: string[];    // API endpoints called
  available_scopes: string[];     // Jira scopes available to app
  filters_applied: string[];      // Any filters used (e.g., "active projects")
  sampling?: {
    strategy: 'none' | 'random' | 'stratified';
    sample_size?: number;
  };
}
```

### 1.4 MissingDataItem Interface

Explicit disclosure of unavailable data.

```typescript
interface MissingDataItem {
  dataset_name: string;           // Name of dataset (e.g., "field_metadata")
  coverage_status: CoverageStatus; // AVAILABLE | PARTIAL | MISSING
  reason_code: MissingDataReasonCode; // Enum (see below)
  reason_detail: string;          // Human-readable explanation
  last_attempt_at?: string;       // ISO 8601 (when we last tried)
  retry_count: number;            // How many times retried
}
```

### 1.5 RetentionPolicy Interface

Tenant-specific cleanup rules.

```typescript
interface RetentionPolicy {
  // Identification
  tenant_id: string;              // Multi-tenant identifier

  // Deletion limits
  max_days: number;               // Delete older than N days
  max_records_daily: number;      // Keep max N daily snapshots
  max_records_weekly: number;     // Keep max N weekly snapshots
  deletion_strategy: 'FIFO';      // First-in-first-out

  // Uninstall behavior
  uninstall_behavior: 'purge_immediate' | 'retain_for_days' | 'admin_confirmed_purge';
  uninstall_retain_days?: number; // Days to keep after uninstall (v2)

  // Metadata
  created_at: string;             // ISO 8601
  updated_at: string;             // ISO 8601
}
```

---

## 2. Enumerations

### 2.1 ErrorCode Enum

Categorizes run outcome.

```typescript
enum ErrorCode {
  NONE = 'NONE',                        // Fully successful
  RATE_LIMIT = 'RATE_LIMIT',            // Hit API rate limits
  PERMISSION_REVOKED = 'PERMISSION_REVOKED', // Lost scope
  API_ERROR = 'API_ERROR',              // Transient API failure
  TIMEOUT = 'TIMEOUT',                  // Execution exceeded time
  PARTIAL_CAPTURE = 'PARTIAL_CAPTURE',  // Some data available
  UNKNOWN = 'UNKNOWN',                  // Unclassified error
}
```

### 2.2 CoverageStatus Enum

Dataset availability status.

```typescript
enum CoverageStatus {
  AVAILABLE = 'AVAILABLE',    // Data fully captured
  PARTIAL = 'PARTIAL',        // Some data available
  MISSING = 'MISSING',        // No data captured
}
```

### 2.3 MissingDataReasonCode Enum

Why data is missing.

```typescript
enum MissingDataReasonCode {
  PERMISSION_DENIED = 'permission_denied',        // No scope/permission
  NOT_CONFIGURED = 'not_configured',              // Feature not enabled
  API_UNAVAILABLE = 'api_unavailable',            // API error
  EMPTY = 'empty',                                // Feature has no data
  RATE_LIMITED = 'rate_limited',                  // API rate limit hit
  UNKNOWN = 'unknown',                            // Unknown reason
}
```

### 2.4 SnapshotType Type

Snapshot frequency.

```typescript
type SnapshotType = 'daily' | 'weekly';
```

### 2.5 ClockSource Type

Timestamp authority.

```typescript
type ClockSource = 'system' | 'jira' | 'unknown';
```

---

## 3. Storage Keys and Prefixes

All keys in Forge requestStorage follow this pattern:

### 3.1 Key Patterns

| Entity | Key Pattern | Example |
|--------|-------------|---------|
| SnapshotRun | `phase6:snapshot_run:{tenant_id}:{run_id}` | `phase6:snapshot_run:tenant1:abc-123-def` |
| Snapshot | `phase6:snapshot:{tenant_id}:{snapshot_id}` | `phase6:snapshot:tenant1:xyz-456-uvw` |
| RetentionPolicy | `phase6:retention_policy:{tenant_id}` | `phase6:retention_policy:tenant1` |
| SnapshotIndex | `phase6:snapshot_index:{tenant_id}:{type}:{page}` | `phase6:snapshot_index:tenant1:daily:0` |

### 3.2 TTL Settings

| Entity | TTL | Reason |
|--------|-----|--------|
| SnapshotRun | 90 days | Matches retention policy |
| Snapshot | 90 days | Matches retention policy |
| RetentionPolicy | None | Never auto-delete |
| SnapshotIndex | 90 days | Matches snapshots |

---

## 4. Daily Snapshot Payload Structure

Schema for `snapshot_type: 'daily'`

```typescript
interface DailySnapshotPayload {
  project_inventory: {
    id: string;
    name: string;
    key: string;
    type: string;  // "team" | "business" | "service_desk"
  }[];

  field_metadata: {
    id: string;
    name: string;
    type: string;  // Custom field type
    isCustom: boolean;
    searchable: boolean;
  }[];

  workflow_inventory: {
    id: string;
    name: string;
  }[];

  automation_inventory: {
    id: string;
    name: string;
  }[];
}
```

---

## 5. Weekly Snapshot Payload Structure

Schema for `snapshot_type: 'weekly'`

Includes all daily data PLUS:

```typescript
interface WeeklySnapshotPayload extends DailySnapshotPayload {
  workflow_structures: {
    id: string;
    name: string;
    statuses: {
      id: string;
      name: string;
    }[];
    transitions: {
      id: string;
      from: string;
      to: string;
      name: string;
    }[];
  }[];

  field_requirements: {
    id: string;
    name: string;
    required: boolean;
    globalScope: boolean;
  }[];

  automation_definitions: {
    id: string;
    name: string;
    condition: object;     // Full condition JSON
    action: object;        // Full action JSON
    enabled: boolean;
  }[];
}
```

---

## 6. API Reference

### 6.1 SnapshotRunStorage Class

```typescript
class SnapshotRunStorage {
  constructor(tenantId: string, cloudId: string);

  // Create new run record
  async createRun(run: SnapshotRun): Promise<SnapshotRun>;

  // Get run by ID
  async getRunById(runId: string): Promise<SnapshotRun | null>;

  // List runs with filters
  async listRuns(
    filters?: SnapshotRunFilters,
    page?: number,
    pageSize?: number
  ): Promise<SnapshotPageResult<SnapshotRun>>;
}
```

### 6.2 SnapshotStorage Class

```typescript
class SnapshotStorage {
  constructor(tenantId: string, cloudId: string);

  // Create new snapshot (immutable)
  async createSnapshot(snapshot: Snapshot): Promise<Snapshot>;

  // Get snapshot by ID
  async getSnapshotById(snapshotId: string): Promise<Snapshot | null>;

  // List snapshots with filters
  async listSnapshots(
    filters?: SnapshotFilters,
    page?: number,
    pageSize?: number
  ): Promise<SnapshotPageResult<Snapshot>>;

  // Delete snapshot (for retention)
  async deleteSnapshot(snapshotId: string): Promise<boolean>;
}
```

### 6.3 RetentionPolicyStorage Class

```typescript
class RetentionPolicyStorage {
  constructor(tenantId: string);

  // Create or update policy
  async setPolicy(policy: RetentionPolicy): Promise<RetentionPolicy>;

  // Get policy (or default)
  async getPolicy(): Promise<RetentionPolicy>;
}
```

### 6.4 RetentionEnforcer Class

```typescript
class RetentionEnforcer {
  constructor(tenantId: string, cloudId: string);

  // Enforce retention limits for snapshot type
  async enforceRetention(
    snapshotType: 'daily' | 'weekly'
  ): Promise<{
    deleted_count: number;
    reason: string;
  }>;
}
```

### 6.5 SnapshotCapturer Class

```typescript
class SnapshotCapturer {
  constructor(
    tenantId: string,
    cloudId: string,
    snapshotType: SnapshotType
  );

  // Capture snapshot and return run + snapshot (if successful)
  async capture(): Promise<{
    run: SnapshotRun;
    snapshot?: Snapshot;
  }>;
}
```

### 6.6 Canonicalization Functions

```typescript
// Convert object to canonical JSON form
function canonicalJSON(obj: any): string;

// Compute SHA256 hash of canonical JSON
function computeCanonicalHash(obj: any): string;

// Verify hash matches object
function verifyCanonicalHash(obj: any, expectedHash: string): boolean;

// Test determinism (for testing)
function testDeterminism(obj: any): {
  hash1: string;
  hash2: string;
  isDeterministic: boolean;
};
```

---

## 7. Scheduled Handlers

### 7.1 Daily Snapshot Handler

**Trigger:** `phase6:daily`  
**Payload:** `{ tenantId: string, cloudId: string }`  
**Frequency:** Daily (via Forge scheduledTrigger)  

Process:
1. Check idempotency key (date-based)
2. If already ran today → skip
3. Capture snapshot
4. Store SnapshotRun + Snapshot
5. Enforce retention (delete old snapshots)
6. Log completion

### 7.2 Weekly Snapshot Handler

**Trigger:** `phase6:weekly`  
**Payload:** `{ tenantId: string, cloudId: string }`  
**Frequency:** Weekly (via Forge scheduledTrigger)  

Process:
1. Check idempotency key (week-based)
2. If already ran this week → skip
3. Capture snapshot
4. Store SnapshotRun + Snapshot
5. Enforce retention (delete old snapshots)
6. Log completion

---

## 8. Filter Types

### 8.1 SnapshotRunFilters

```typescript
interface SnapshotRunFilters {
  snapshot_type?: 'daily' | 'weekly';
  status?: 'success' | 'partial' | 'failed';
  error_code?: ErrorCode;
  date_from?: string;  // ISO 8601
  date_to?: string;    // ISO 8601
}
```

### 8.2 SnapshotFilters

```typescript
interface SnapshotFilters {
  snapshot_type?: 'daily' | 'weekly';
  captured_from?: string;  // ISO 8601
  captured_to?: string;    // ISO 8601
}
```

---

## 9. Page Result Type

```typescript
interface SnapshotPageResult<T> {
  items: T[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}
```

---

## 10. Constants

### 10.1 Default Retention Policy

```typescript
const DEFAULT_RETENTION_POLICY = {
  max_days: 90,
  max_records_daily: 90,
  max_records_weekly: 52,
  deletion_strategy: 'FIFO',
  uninstall_behavior: 'retain_for_days',
  uninstall_retain_days: 90,
};
```

### 10.2 Timeout Limits

```typescript
const TIMEOUT_LIMITS = {
  daily: 2 * 60 * 1000,    // 2 minutes
  weekly: 5 * 60 * 1000,   // 5 minutes
};

const API_CALL_TIMEOUT = 10 * 1000; // 10 seconds per call
```

### 10.3 Backoff Durations

```typescript
const BACKOFF_DURATIONS = {
  first: 30 * 60 * 1000,    // 30 minutes
  second: 120 * 60 * 1000,  // 120 minutes
  third: 24 * 60 * 60 * 1000, // 24 hours
};
```

### 10.4 Daily Snapshot Datasets

```typescript
const DAILY_SNAPSHOT_DATASETS = [
  'project_inventory',
  'field_metadata',
  'workflow_inventory',
  'automation_inventory',
];
```

### 10.5 Weekly Snapshot Datasets

```typescript
const WEEKLY_SNAPSHOT_DATASETS = [
  'project_inventory',
  'field_metadata',
  'workflow_inventory',
  'automation_inventory',
  'workflow_structures',
  'field_requirements',
  'automation_definitions',
];
```

---

## 11. Error Handling

### 11.1 Jira API Error Responses

| Status | ErrorCode | Description |
|--------|-----------|-------------|
| 200 | NONE | Success |
| 429 | RATE_LIMIT | Rate limited (retry with backoff) |
| 401/403 | PERMISSION_REVOKED | Lost authentication/permission |
| 5xx | API_ERROR | Server error (transient) |
| Timeout | TIMEOUT | Request exceeded time limit |
| Other | UNKNOWN | Unclassified error |

### 11.2 Error Recovery

On failure:
1. Record `error_code` and `error_detail`
2. Set `status` to 'partial' or 'failed'
3. Populate `missing_data[]` with reason codes
4. Implement backoff retry (30m → 2h → 24h)
5. Never throw exception from handler (log and continue)

---

## 12. Determinism Guarantee

### 12.1 Canonical JSON Properties

For identical Jira state to produce identical snapshot hash:

1. **Keys sorted alphabetically** (enforced)
2. **No whitespace** (minified)
3. **Strings JSON-escaped** (UTF-8)
4. **No floating-point precision issues** (store as-is)
5. **Array order matters** (order-preserving)

### 12.2 Hash Verification

```typescript
// Verify payload matches expected hash
const payload = snapshot.payload;
const isValid = verifyCanonicalHash(payload, snapshot.canonical_hash);
```

---

## 13. Tenant Isolation

### 13.1 Isolation Properties

- All storage keys include `tenant_id`
- Constructor requires `tenant_id`
- All CRUD operations validate tenant match
- No cross-tenant access possible

### 13.2 Example

```typescript
// Tenant1 can't access Tenant2's snapshots
const storage1 = new SnapshotStorage('tenant1', 'cloud1');
const storage2 = new SnapshotStorage('tenant2', 'cloud1');

// Even if UUIDs were identical:
const snap1 = await storage1.getSnapshotById('snapshot-123');
const snap2 = await storage2.getSnapshotById('snapshot-123');
// snap1 and snap2 point to DIFFERENT records (different tenant_id in key)
```

---

## 14. Manifest Configuration

Add to `manifest.yml`:

```yaml
scheduledTrigger:
  - key: phase6:daily
    weight: 10
    interval: "0 2 * * *"  # 02:00 UTC daily

  - key: phase6:weekly
    weight: 10
    interval: "0 2 ? * MON"  # 02:00 UTC every Monday
```

---

## Appendix A: Examples

### A.1 Creating a Daily Snapshot

```typescript
const capturer = new SnapshotCapturer('tenant1', 'cloud1', 'daily');
const { run, snapshot } = await capturer.capture();

if (snapshot) {
  const storage = new SnapshotStorage('tenant1', 'cloud1');
  await storage.createSnapshot(snapshot);
  console.log(`Snapshot created: ${snapshot.snapshot_id}`);
  console.log(`Hash: ${snapshot.canonical_hash}`);
}
```

### A.2 Querying Snapshots

```typescript
const storage = new SnapshotStorage('tenant1', 'cloud1');
const result = await storage.listSnapshots(
  { snapshot_type: 'daily' },
  0,  // page 0
  20  // 20 per page
);

console.log(`Found ${result.total_count} daily snapshots`);
result.items.forEach(snap => {
  console.log(`${snap.snapshot_id} captured at ${snap.captured_at}`);
});
```

### A.3 Verifying Snapshot Hash

```typescript
const snapshot = await storage.getSnapshotById('snapshot-123');
const isValid = verifyCanonicalHash(snapshot.payload, snapshot.canonical_hash);

if (isValid) {
  console.log('Snapshot integrity verified');
} else {
  console.error('Snapshot tampering detected!');
}
```

---

## Appendix B: Migration from Phase 5

Phase 6 v2 is independent of Phase 5. No data migration needed.

**Phase 5:** Evidence disclosure (static/manual)  
**Phase 6 v2:** Evidence ledger (automatic/scheduled)

Both can coexist without conflict.

---

**Document Version:** 1.0.0  
**Last Updated:** 2024-01-15  
**Status:** Technical Reference
