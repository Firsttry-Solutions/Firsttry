# FirstTry Governance - Atlassian Dual-Layer Specification

**Version:** 0.1.0 (PHASE 0)  
**Status:** Scaffold & Spec Only  
**Last Updated:** 2025-12-19  

---

## A) Purpose / Non-Goals

### Purpose

The **Atlassian Dual-Layer** integration enables FirstTry to:
1. Ingest structured governance events from FirstTry Agent (Layer 1: FirstTry)
2. Create actionable governance records in Jira Cloud (Layer 2: Atlassian)
3. Provide unified governance visibility and alerting
4. Enable issue lifecycle integration (link, comment, resolve)

### Non-Goals

- **Not** a real-time dashboard replacement (reports are historical + predictive)
- **Not** for ad-hoc SQL queries (use FirstTry Agent for exploratory analysis)
- **Not** for cross-workspace correlation (single Jira Cloud site per instance)
- **Not** for third-party CRM/ticketing integration (scope: Jira only)
- **Not** for GraphQL exposure (REST API only, Forge constraints)

---

## B) No-Synthetic-Data Rule (HARD BAN)

**ABSOLUTE RULE:** The Atlassian integration MUST NEVER generate, estimate, or log synthetic events.

### Enforcement

1. **Event Ingestion:**
   - Every event in storage MUST have a `_ingest_timestamp` and `_ingest_source` (FirstTry Agent token)
   - Synthetic events are forbidden (no test data, no mocked runs in production storage)

2. **Reporting:**
   - All metrics MUST declare:
     - Coverage window (start_ts, end_ts)
     - Data completeness matrix (% of events expected vs received)
     - Missing inputs (if required events are absent, DISABLE the metric)
     - Confidence level (100% = complete data; <100% = labeled as estimate)
   - Forecasts and estimates MUST be labeled with assumptions and confidence intervals

3. **Alerting:**
   - Alert rules MUST NOT fire on absent data
   - Only fire on explicit anomalies in received data

4. **Testing:**
   - Unit/integration tests use separate dev storage namespace
   - Production storage is never touched by test data
   - Evidence packs verify zero synthetic contamination

### Verification

See audit_artifacts/atlassian_dual_layer/phase_N_evidence.md for each phase:
- List of storage namespaces used
- Synthetic data verification: PASS/FAIL

---

## C) Definitions

### Coverage Window

**Definition:** The time range for which complete event data is available.

```
Coverage Window = [earliest_event_ts, latest_event_ts]
```

- **Preliminary Mode:** Coverage window < 1 week (insufficient historical data)
  - Metrics: Disabled or marked "insufficient data"
  - Alerts: Disabled or high-threshold only
  - UI: Shows "warming up" notice

- **Normal Mode:** Coverage window >= 1 week
  - Metrics: Full enabled
  - Alerts: Normal threshold
  - UI: Normal display

### Data Completeness Matrix

**Definition:** Percentage of expected events received, tracked per event type.

```
Completeness = (events_received / events_expected) * 100%
```

**Required Matrix:**

| Event Type | Expected Period | Completeness % | Notes |
|-----------|-----------------|----------------|-------|
| `run.started` | Per configured schedule | ? | Set by scheduler |
| `run.completed` | Per run.started | ? | 1:1 expected (minus crashes) |
| `rule.executed` | Per enabled rule | ? | Depends on config |
| `alert.triggered` | Per anomaly detected | ? | Depends on data quality |

- **If completeness < 95%** for any event type: Mark metrics as "incomplete" in reports
- **If completeness < 80%** for critical events: DISABLE metrics, raise admin alert

### Preliminary vs Normal Mode

| Aspect | Preliminary (< 1 week) | Normal (>= 1 week) |
|--------|------------------------|-------------------|
| Coverage | Insufficient | Complete |
| Metrics | Disabled / marked "warming up" | Enabled full |
| Alerts | High threshold only | Normal threshold |
| UI Label | "Data warming up" | Normal |
| Forecast | Disabled | Enabled with confidence |

---

## D) EventV1 Schema (Strict Allow-List; Forbidden Fields) - PHASE 1 Finalized

### Allowed Fields (ONLY these - strict allow-list)

```typescript
interface EventV1 {
  // Schema
  schema_version: "event.v1";     // Locked to "event.v1"
  
  // Identity
  event_id: string;               // UUID v4, globally unique
  
  // Timing (ISO 8601)
  timestamp: string;              // ISO 8601 format (e.g., 2025-12-19T08:45:30.123Z)
  
  // Scope
  org_key: string;                // Organization key (non-empty)
  repo_key: string;               // Repository key (non-empty)
  
  // Execution Context
  profile: "fast" | "strict" | "ci"; // Execution profile
  gates: string[];                // Array of gate names (all non-empty strings)
  
  // Metrics
  duration_ms: number;            // Integer >= 0 (milliseconds)
  status: "success" | "fail";     // Execution status
  cache_hit: boolean;             // Whether cache was hit
  retry_count: number;            // Integer >= 0 (number of retries)
}
```

### Forbidden Fields (HARD BAN - Reject if Present)

**Core Forbidden:**
- `log` - No raw logs
- `stdout` - No stdout capture
- `stderr` - No stderr capture
- `payload` - No free-form payloads (use schema fields)
- `secrets` - No credentials
- `token` - No tokens

**Synthetic Data Prevention:**
- `synthetic_flag` - No marking synthetic data
- `mock_data` - No test data in production
- `estimation_confidence` - Use completeness matrix instead
- `forecast_value` - Use reports with assumptions

**Reserved:**
- Any field starting with `__` (reserved for internal use)

### Unknown Fields Policy

**STRICT ALLOW-LIST:** Any field NOT in the allowed list is rejected as unknown.

Example rejections:
```json
{
  "schema_version": "event.v1",
  "event_id": "...",
  // ...
  "extra_field": "value"  // ❌ REJECTED (unknown field)
}
```

### Validation Rules

| Field | Type | Constraint | Example |
|-------|------|-----------|---------|
| schema_version | string | Must be exactly "event.v1" | "event.v1" |
| event_id | string | Valid UUID v4 | "a1b2c3d4-e5f6-4789-a1b2-c3d4e5f6a1b2" |
| timestamp | string | ISO 8601 format | "2025-12-19T08:45:30.123Z" |
| org_key | string | Non-empty, trimmed | "myorg" |
| repo_key | string | Non-empty, trimmed | "myrepo" |
| profile | string | One of: fast, strict, ci | "strict" |
| gates | array | Array of non-empty strings | ["lint", "test"] |
| duration_ms | number | Integer >= 0 | 1500 |
| status | string | One of: success, fail | "success" |
| cache_hit | boolean | Boolean value | true |
| retry_count | number | Integer >= 0 | 0 |
    "duration_ms": number
  }
}
```

#### `rule.executed`

```json
{
  "event_type": "rule.executed",
  "payload": {
    "rule_name": "string",
    "rule_id": "string",
    "execution_status": "matched" | "no_match" | "error",
    "match_count": number
  }
}
```

#### `alert.triggered`

```json
{
  "event_type": "alert.triggered",
  "payload": {
    "alert_name": "string",
    "severity": "low" | "medium" | "high" | "critical",
    "description": "string",
    "affected_items": number
  }
}
```

### Ingest Validation

**Every ingest MUST:**
1. Validate schema (allowed fields only)
2. Reject forbidden fields (hard error)
3. Validate event_type (allow-list above)
4. Record `_ingest_timestamp` (server time, not client time)
5. Log auth token name (for audit trail, redacted in output)

---

## E) Storage Key Namespaces (Draft List; Expanded in Later Phases)

### Namespace Hierarchy

```
firstry:dual-layer:{env}:{resource_type}:{shard}
```

Where:
- `{env}` = `dev` | `prod`
- `{resource_type}` = `event` | `config` | `run-ledger` | `alert` | `rule` | `report`
- `{shard}` = Tenant/workspace ID or time-based shard (e.g., `yyyymmdd`)

### Phase 0 Reserved Namespaces

| Key Pattern | Purpose | Sharding | Retention |
|-------------|---------|----------|-----------|
| `firstry:dual-layer:config:app` | App-level config (ingest token, thresholds) | None | Indefinite |
| `firstry:dual-layer:config:project:{project_id}` | Per-project config | By project | Indefinite |

### Phase 1+ Reserved (Not Implemented Yet)

| Key Pattern | Purpose | Sharding | Retention |
|-------------|---------|----------|-----------|
| `firstry:dual-layer:event:{YYYYMMDD}:{shard}` | Daily event cache | By day + hash shard | 90 days |
| `firstry:dual-layer:run-ledger:{YYYYMMDD}` | Run execution ledger (idempotency) | By day | 30 days |
| `firstry:dual-layer:alert:{YYYYMMDD}:{shard}` | Alert records | By day + hash | 365 days |
| `firstry:dual-layer:report:{report_id}` | Generated reports (cache) | By report | 7 days |

### Phase 1 (Implemented) - Event Ingestion

| Key Pattern | Purpose | Sharding | Retention |
|-------------|---------|----------|-----------|
| `seen/{org_key}/{repo_key}/{event_id}` | Idempotency marker (event already processed) | By org/repo/event | 90 days (TTL) |
| `raw/{org_key}/{yyyy-mm-dd}/{shard_id}` | Raw event array (up to 200 events per shard) | By date, auto-rollover at 200 | 90 days (TTL) |
| `rawshard/{org_key}/{yyyy-mm-dd}/current` | Current shard ID counter | By date | 90 days (TTL) |
| `rawshard/{org_key}/{yyyy-mm-dd}/{shard_id}/count` | Event count in shard | By shard | 90 days (TTL) |
| `ingest/{org}/first_event_at` | ISO timestamp of first event | By org | Indefinite |
| `ingest/{org}/last_event_at` | ISO timestamp of last event | By org | Indefinite |
| `debug:last_ingest:{org_key}:{repo_key}` | Debug marker (latest ingestion) | By org/repo | 7 days |

### Phase 2 (Implemented) - Aggregation & Retention

| Key Pattern | Purpose | Sharding | Retention |
|-------------|---------|----------|-----------|
| `agg/org/daily/{org}/{yyyy-mm-dd}` | Daily aggregate for org (all repos) | By date | 90 days |
| `agg/daily/{org}/{repo}/{yyyy-mm-dd}` | Daily aggregate for specific repo | By date | 90 days |
| `agg/org/weekly/{org}/{yyyy-WW}` | Weekly aggregate for org (summed from daily) | By ISO week | 90 days |
| `agg/weekly/{org}/{repo}/{yyyy-WW}` | Weekly aggregate for repo | By ISO week | 90 days |
| `coverage/{org}/distinct_days_with_data` | Count of days with events | By org | Indefinite |
| `coverage/{org}/distinct_days_list` | Sorted list of dates with events (bounded to 365) | By org | Indefinite |
| `coverage/{org}/notes` | Coverage metadata and disclosures | By org | Indefinite |
| `index/raw/{org}/{yyyy-mm-dd}` | Index: list of raw shard keys for day | By date | 90 days |
| `index/agg/daily/{org}/{yyyy-mm-dd}` | Index: list of daily aggregate keys for day | By date | 90 days |
| `index/agg/weekly/{org}/{yyyy-WW}` | Index: list of weekly aggregate keys for week | By week | 90 days |
| `index/meta/{org}` | Index metadata (last compaction, cleanup timestamp) | By org | Indefinite |

### Bounded Storage Guarantee

**RULE:** No namespace stores an unbounded list.

- Events: Sharded by date; retention window 90 days
- Run ledgers: Sharded by date; retention window 30 days
- Alerts: Sharded by date; retention window 365 days
- Reports: Time-to-live 7 days

Retention cleanup job runs daily at 00:00 UTC.

---

## F) Scheduler Job List and Run-Ledger Semantics (Draft List)

### Phase 0 (No Scheduling Yet)

No scheduled jobs are active. All configuration is prepared but dormant.

### Phase 1+ Scheduler Jobs (Reserved)

| Job Key | Trigger | Frequency | Purpose |
|---------|---------|-----------|---------|
| `firstry:dual-layer:ingest-poll` | Scheduled | Every 5 min | Poll FirstTry Agent for new events |
| `firstry:dual-layer:run-executor` | Scheduled | Per-config | Execute configured runs (e.g., hourly) |
| `firstry:dual-layer:alert-check` | Scheduled | Every 1 min | Evaluate alert thresholds |
| `firstry:dual-layer:retention-cleanup` | Scheduled | Daily @ 00:00 UTC | Purge expired storage records |
| `firstry:dual-layer:report-generate` | Scheduled | Daily @ 06:00 UTC | Generate daily governance reports |

### Run-Ledger Semantics (Idempotency)

**Definition:** The run ledger prevents duplicate executions of the same logical run.

```typescript
interface RunLedgerEntry {
  run_id: string;                    // Unique run identifier
  run_key: string;                   // Deterministic key (hash of config + timestamp)
  execution_status: "pending" | "success" | "failed";
  execution_timestamp: string;       // When execution started
  idempotency_token: string;         // Token for retries
  attempt_count: number;             // Number of retry attempts
}
```

**Guarantee:** If run_key + execution_timestamp already exist in ledger, SKIP execution (idempotent).

---

## G) Reporting Contract

### Required Report Header Fields

```typescript
interface ReportHeader {
  report_id: string;                 // UUID
  report_type: string;               // "daily_governance" | "alert_summary" | "rule_performance"
  generated_at: string;              // ISO 8601, server UTC
  coverage_window: {
    start_ts: string;                // ISO 8601
    end_ts: string;                  // ISO 8601
    mode: "preliminary" | "normal";   // See Section C
  };
  
  // Data Completeness
  completeness: {
    run_started: number;             // % complete (0-100)
    run_completed: number;
    rule_executed: number;
    alert_triggered: number;
  };
  
  // Missing Inputs (if any)
  missing_inputs: string[];          // ["run.completed missing 5 entries"]
  
  // Forecast Disclaimers
  forecasts_enabled: boolean;        // false if incomplete data
  forecast_assumptions: string[];    // ["assumes linear growth", "excludes weekends"]
  forecast_confidence: number;       // 0-100, disable metrics if < 70%
  
  // Metric Status
  metrics_status: Record<string, "enabled" | "disabled" | "degraded">;
}
```

### Metric Disabling Rules

**DISABLE a metric if:**
- Completeness < 95% for required event type
- Coverage window in preliminary mode (< 1 week)
- Forecast confidence < 70%

**Disabled metrics MUST:**
- Still appear in report
- Be marked with status "disabled"
- Include reason: e.g., "Disabled: coverage window < 1 week"

### Completeness + Missing Inputs Disclosure

**Every report MUST declare:**

1. **Completeness Matrix** (% received vs expected)
2. **Missing Inputs** (list of data gaps)
3. **Impact** (which metrics are affected)

Example:

```
Report: Daily Governance (2025-12-19)
Coverage: 2025-12-18 00:00 UTC → 2025-12-19 00:00 UTC (24h, Normal mode)

Completeness:
  run.started:     95% (95 events received, 100 expected)
  run.completed:   92% (92 events received, 100 expected)
  rule.executed:   100% (1000 events received)
  alert.triggered: 85% (17 events received, 20 expected)

Missing Inputs:
  - 8 run.completed events missing (runs likely crashed)
  - 3 alert.triggered events missing (reason unknown)

Impact:
  Metrics Affected: All metrics enabled (completeness > 95%)
  Alerts Affected: Alert summary metrics marked "degraded"
  Forecasts: Enabled with confidence 82% (discount for missing runs)
```

### Forecast Gating Rules

**Forecasts are DISABLED if:**
- Completeness < 95%
- Coverage window < 1 week
- Forecast confidence < 70%

**Forecasts MUST include:**
- Confidence interval (e.g., "±10% with 85% confidence")
- Explicit assumptions (e.g., "linear growth assumed")
- Data sources (which events used)

---

## H) Security Model

### Ingest Token Authentication

**Header Name:** `X-FirstTry-Ingest-Token`

**Token Requirements:**
- Format: Opaque hex string (no structure disclosed)
- Generation: Stored as SHA256 hash only (plaintext never stored)
- Rotation: Supported (old tokens invalidated on config change)
- Scope: Single Jira Cloud site (multi-tenant later if needed)

**Validation Flow:**

```
1. Client sends event POST /api/events
   Header: X-FirstTry-Ingest-Token: <token_value>
   
2. Server:
   a. Hash token: hash = SHA256(<token_value>)
   b. Lookup config: config = storage.get("firstry:dual-layer:config:app")
   c. Compare: if hash != config.ingest_token_hash → REJECT (401)
   d. Log attempt: log(auth_status, timestamp, agent_id, redacted_token_hint)
   e. Redact token in logs: only log first 4 chars + "*"
   
3. Response:
   200 OK (event ingested) or 401 Unauthorized
```

### Secret Handling

**Secrets to Never Log:**
- `FIRSTRY_INGEST_TOKEN`
- `X-FirstTry-Ingest-Token` header value
- FirstTry Agent API keys

**Redaction Utility (must be used):**

```typescript
function redactSecret(secret: string, prefix_chars: number = 4): string {
  if (secret.length <= prefix_chars) return "****";
  return secret.substring(0, prefix_chars) + "****";
}

// Usage:
logger.info(`Auth attempt with token: ${redactSecret(token_value)}`);
// Output: "Auth attempt with token: abc1****"
```

**Tests for Secret Handling:**
- Verify no full token value appears in logs
- Verify no plaintext token in storage
- Verify token is hashed before comparison
- Verify failed auth attempts are logged (for audit)

### "No Egress Except Atlassian APIs" Posture

**RULE:** The Forge app MUST NEVER make outbound HTTP requests except to:

1. **Atlassian Forge APIs** (provided by @forge/api)
2. **Atlassian Jira Cloud REST API** (only via @forge/api allowed scope)
3. **FirstTry Agent Ingest** (only for receiving POST events, never polling FirstTry external APIs)

**Forbidden:**
- Calls to arbitrary external services (no Slack, no Teams, no third-party SaaS)
- DNS lookups to external hosts
- Egress on non-standard ports

**Verification:**
- Code review: Check all outbound calls use `@forge/api`
- Manifest validation: No custom API connectors defined
- Network policy: Forge runtime enforces egress restrictions

---

## Storage Access Examples (Conceptual, Phase 0)

```typescript
// Config retrieval (example, not yet implemented)
const config = await storage.get("firstry:dual-layer:config:app");
// { ingest_token_hash: "...", mode: "normal", ... }

// Event ingestion (example, Phase 1+)
const event: EventV1 = { ... };
await storage.set(
  `firstry:dual-layer:event:${dateStr}:${shard}`,
  events,
  { ttl: 7776000 } // 90 days in seconds
);

// Run ledger check (example, Phase 1+, for idempotency)
const ledgerKey = `firstry:dual-layer:run-ledger:${dateStr}`;
const ledger = await storage.get(ledgerKey) || [];
if (ledger.find(e => e.run_key === runKey)) {
  console.log("Skipping duplicate run");
  return;
}
```

---

## Deployment Model

### Development

```bash
forge login
forge install -e development --site <dev-site-url>
```

### Production

```bash
# Manual deployment via Atlassian Marketplace or private app console
# See: https://developer.atlassian.com/cloud/jira/platform/app-installation/
```

### Configuration

After installation, set app secrets in Forge UI:
- `FIRSTRY_INGEST_TOKEN`: Token for FirstTry Agent authentication
- `FIRSTRY_STORAGE_ENV`: "dev" or "prod"

---

## I) EventV1 Ingestion Endpoint (PHASE 1)

### Endpoint Contract

**URL:** `POST /webhook/ingest` (Forge webtrigger)

**Authentication:**
- Header: `X-FT-INGEST-TOKEN` (required)
- Value: Secret token stored in `FIRSTRY_INGEST_TOKEN` environment variable
- If missing or invalid: **401 Unauthorized**

**Request Body:**
- Content-Type: `application/json`
- Schema: EventV1 (see Section D)
- All required fields must be present
- Unknown fields rejected (strict allow-list)
- Forbidden fields rejected (hard ban)

**Response Codes:**

| Code | Reason | Body |
|------|--------|------|
| 200 | Event accepted (new or duplicate) | `{status: "accepted"\|"duplicate", event_id, shard_id, ...}` |
| 400 | Validation error | `{error: "INVALID_FIELDS"\|"VALIDATION_FAILED"\|"INVALID_JSON", message, fields}` |
| 401 | Authentication failed | `{error: "UNAUTHORIZED", message}` |
| 500 | Internal error | `{error: "INTERNAL_ERROR", message}` |

### Request Example

```bash
curl -X POST https://your-site.atlassian.net/webhook/ingest \
  -H "X-FT-INGEST-TOKEN: your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_version": "event.v1",
    "event_id": "a1b2c3d4-e5f6-4789-a1b2-c3d4e5f6a1b2",
    "timestamp": "2025-12-19T08:45:30.123Z",
    "org_key": "myorg",
    "repo_key": "myrepo",
    "profile": "strict",
    "gates": ["lint", "test"],
    "duration_ms": 1500,
    "status": "success",
    "cache_hit": true,
    "retry_count": 0
  }'
```

### Response Examples

**Success (New Event):**
```json
{
  "status": "accepted",
  "event_id": "a1b2c3d4-e5f6-4789-a1b2-c3d4e5f6a1b2",
  "shard_id": "0",
  "storage_key": "raw/myorg/2025-12-19/0",
  "message": "Event ingested successfully"
}
```

**Success (Duplicate - Idempotent):**
```json
{
  "status": "duplicate",
  "event_id": "a1b2c3d4-e5f6-4789-a1b2-c3d4e5f6a1b2",
  "message": "Event already processed (idempotent)"
}
```

**Validation Error:**
```json
{
  "error": "VALIDATION_FAILED",
  "message": "Event validation failed",
  "fields": {
    "event_id": "Invalid event_id: must be UUID v4",
    "unknown_field": "Unknown field (not in allow-list)"
  }
}
```

### Idempotency Guarantee

- **Key:** `seen/{org_key}/{repo_key}/{event_id}`
- **Behavior:** If event_id already exists, returns 200 with status "duplicate"
- **Storage:** Marker stored with 90-day TTL (7,776,000 seconds)
- **Guarantee:** Event processed at-most-once; duplicate submissions return same response

### Storage Details (Bounded & Sharded)

#### Idempotency Marker
```
Key: seen/{org_key}/{repo_key}/{event_id}
Value: true (TTL: 90 days)
```

#### Raw Event Storage (Sharded)
```
Key: raw/{org_key}/{yyyy-mm-dd}/{shard_id}
Value: Array of events (TTL: 90 days)
Sharding: Max 200 events per shard; automatic rollover to next shard
```

#### Shard Metadata
```
Key: rawshard/{org_key}/{yyyy-mm-dd}/current
Value: Current shard_id (string)

Key: rawshard/{org_key}/{yyyy-mm-dd}/{shard_id}/count
Value: Number of events in shard (int)
```

#### Sharding Algorithm
1. Query `rawshard/{org}/{date}/current` → get shard_id
2. Query `rawshard/{org}/{date}/{shard_id}/count` → get count
3. If count >= 200:
   - Increment shard_id (e.g., "0" → "1")
   - Store new shard_id in current key
   - Use new shard for incoming event
4. Append event to `raw/{org}/{date}/{shard_id}` array
5. Increment count in `rawshard/{org}/{date}/{shard_id}/count`

#### Bounded Storage Guarantee

- **Max events per shard:** 200 (prevents unbounded array growth)
- **Max shards per day:** Unlimited (automatic rollover)
- **Retention window:** 90 days (TTL enforced by Forge storage)
- **No cleanup jobs needed:** TTL-based expiration handles retention

---

## F) Phase 2: Aggregation & Retention (IMPLEMENTED)

### Daily Aggregation (recompute_daily)

**Purpose:** Compute deterministic daily aggregates from raw shards.

**Inputs:**
- All raw shard keys for date (from Storage Index Ledger)
- Raw events in each shard

**Outputs (DailyAggregate):**
```typescript
{
  org: string,
  date: string,  // yyyy-mm-dd
  total_events: number,
  total_duration_ms: number,
  success_count: number,
  fail_count: number,
  cache_hit_count?: number,
  cache_miss_count?: number,
  retry_total: number,
  by_repo: [{ repo, total_events, success_count, fail_count, total_duration_ms }, ...],
  by_gate: [{ gate, count }, ...],
  by_profile: [{ profile, count }, ...],
  incomplete_inputs: {
    raw_shards_missing: boolean,
    raw_shards_count: number,
    raw_events_counted: number
  },
  notes: string[]
}
```

**Storage Keys Written:**
- `agg/org/daily/{org}/{yyyy-mm-dd}` (canonicalized)
- `agg/daily/{org}/{repo}/{yyyy-mm-dd}` (per-repo rollup)
- Index entry in `index/agg/daily/{org}/{yyyy-mm-dd}`

**Missing Day Handling:**
- If no raw shards for day: return aggregate with total_events=0, incomplete_inputs.raw_shards_missing=true
- Never crash; still write aggregate (enables deterministic reporting)

**Determinism:**
- All object keys sorted lexicographically
- Arrays of objects sorted by key field (repo, gate, profile)
- Same input always produces identical SHA256 hash

### Weekly Aggregation (recompute_week)

**Purpose:** Sum daily aggregates for a week (do NOT re-read raw shards).

**Inputs:**
- Daily aggregates for all 7 days in ISO week (yyyy-WW format)

**Outputs (WeeklyAggregate):**
- Same schema as DailyAggregate, but:
  - `week: string` (yyyy-WW instead of date)
  - `days_expected: number`, `days_present: number`, `missing_days: [yyyy-mm-dd...]`
  - Sums all fields from daily aggregates

**Storage Keys Written:**
- `agg/org/weekly/{org}/{yyyy-WW}` (canonicalized)
- `agg/weekly/{org}/{repo}/{yyyy-WW}` (per-repo rollup)
- Index entry in `index/agg/weekly/{org}/{yyyy-WW}`

**Missing Day Handling:**
- If aggregates missing for any day: mark in `missing_days` array
- Set `incomplete_inputs.raw_shards_missing = true` if any missing days
- Still write weekly aggregate (supports downstream reporting)

### Coverage Primitives

**Tracked:**
- `coverage/{org}/distinct_days_with_data` (count of days with aggregates)
- `coverage/{org}/distinct_days_list` (sorted list of yyyy-mm-dd, bounded to 365)
- `coverage/{org}/notes` (disclosure notes)

**Computed from:**
- Scanning daily aggregate keys in storage
- Safe enumeration without prefix list (uses index)

**Deferred to Phase 6+:**
- `install_at` (requires deployment event data)
- `coverage_start` / `coverage_end` (requires reporting logic)

### Storage Index Ledger (CRITICAL for Safe Deletion)

**Design Principle:**
Forge storage may not support "list by prefix" reliably. Instead, we maintain an explicit index.

**Index Structure (minimal, append-only with bounded lists):**

```
index/raw/{org}/{yyyy-mm-dd}
  → sorted, deduplicated list of raw shard keys touched that day
  → max ~1000 keys; pagination if exceeded (not implemented in Phase 2)

index/agg/daily/{org}/{yyyy-mm-dd}
  → sorted, deduplicated list of daily aggregate keys for that day

index/agg/weekly/{org}/{yyyy-WW}
  → sorted, deduplicated list of weekly aggregate keys for that week

index/meta/{org}
  → metadata: last_cleanup_at, last_cleanup_cutoff, last_cleanup_deleted count
```

**Index Maintenance:**
- Every write (raw shard, aggregate) also records minimal entry in index
- Deduplication on write (use Set, sort, store array)
- No unbounded growth (bounds enforced per key)

### Retention Cleanup (retention_cleanup)

**Purpose:** Hard delete data older than 90 days (UTC).

**Cutoff Calculation:**
```
cutoff_date = now() - 90 days (UTC)
delete only keys where key_date < cutoff_date
```

**Keys to Delete (ONLY indexed keys):**
- Raw shards: `raw/...` listed in `index/raw/{org}/{yyyy-mm-dd}`
- Shard counts: `rawshard/.../count` (derived from shard keys)
- Daily aggregates: `agg/daily/.../...` listed in `index/agg/daily/...`
- Weekly aggregates: `agg/weekly/.../...` listed in `index/agg/weekly/...`
- Index buckets themselves (after successful key deletion)

**Keys NEVER Deleted (not in index):**
- Config keys: `index/meta/...`, `ingest/{org}/first_event_at`, etc.
- App markers: Any key outside data index
- Install markers: Not indexed; cannot be enumerated safely

**Deletion Report (RetentionResult):**
```typescript
{
  deleted_keys: string[],  // sorted list of deleted keys
  skipped_keys_reason: string,  // "Non-indexed keys cannot be enumerated safely"
  errors: [{ key, error }, ...],
  cutoff_date: string,
  deleted_count: number,
  error_count: number
}
```

**Safety Rules:**
- Never claim deletion of non-indexed keys
- Record errors for keys that fail deletion (don't silently skip)
- Update `index/meta/{org}` with cleanup metadata
- Update last_cleanup_at timestamp

**Truthfulness Rule:**
If you cannot delete a key because it's not indexed, explicitly record:
```
skipped_keys_reason: "Non-indexed keys cannot be enumerated safely; only indexed keys deleted"
```

---

---

## J) Phase 3: Scheduled Pipelines & Readiness Gating (IMPLEMENTED)

### Scheduled Jobs

**Daily Pipeline**
- **Schedule:** 1 AM UTC daily (`0 1 * * *` cron)
- **Handler:** `src/pipelines/daily_pipeline.ts::dailyPipelineHandler`
- **Purpose:** Recompute daily aggregates, backfill missing dates (max 7 days), perform retention cleanup
- **Best-Effort:** Errors logged, ledgers written regardless; continues to next org

**Weekly Pipeline**
- **Schedule:** Monday 2 AM UTC (`0 2 * * 1` cron)
- **Handler:** `src/pipelines/weekly_pipeline.ts::weeklyPipelineHandler`
- **Purpose:** Recompute weekly aggregates, evaluate first report readiness, write readiness status
- **Best-Effort:** Errors logged, ledgers written regardless; continues to next org

**Module Type:** `scheduled:trigger` (Forge v12+)

**Timezone:** UTC (all times in ISO 8601 format)

### Run Ledger Keys (Exact)

| Key | Type | Meaning |
|-----|------|---------|
| `runs/{org}/daily/last_attempt_at` | ISO timestamp | When daily pipeline last attempted execution |
| `runs/{org}/daily/last_success_at` | ISO timestamp or null | When daily pipeline last completed successfully |
| `runs/{org}/weekly/last_attempt_at` | ISO timestamp | When weekly pipeline last attempted execution |
| `runs/{org}/weekly/last_success_at` | ISO timestamp or null | When weekly pipeline last completed successfully |
| `runs/{org}/last_error` | String (max 300 chars) | Sanitized error from last failed run (no tokens, no newlines) |
| `index/orgs` | Sorted string[] | All orgs that have ingested events (deduplicated, sorted) |

**Ledger Semantics:**
- Attempt written at start of pipeline execution
- Success written at end of successful execution
- If pipeline fails, only attempt is recorded (no success); error is recorded in last_error
- Ledgers are non-blocking: write failures do not crash the pipeline

### Backfill Logic

**Constants:**
```typescript
const MAX_DAILY_BACKFILL_DAYS = 7;
```

**Rules:**
1. If `last_success_at` is null: Return dates from (today - 7 days) to today, inclusive
2. If `last_success_at` exists: Return dates from (last_success_at + 1 day) to today, max 7 days
3. All dates in UTC (yyyy-mm-dd format), sorted ascending
4. Empty list allowed: pipeline still runs, ledgers still written

**Example:**
- Today: 2025-12-19
- Last success: null
- Backfill result: [2025-12-13, 2025-12-14, ..., 2025-12-19]

**Example:**
- Today: 2025-12-19
- Last success: 2025-12-17
- Backfill result: [2025-12-18, 2025-12-19]

**Determinism:** Pure function, no external calls, no RNG; same input always produces same output.

### Readiness Gating (12-Hour First Report Window)

**Constants:**
```typescript
const REPORT_FIRST_DELAY_HOURS = 12;
const MIN_EVENTS_FOR_FIRST_REPORT = 10;
```

**Status Enum (5 Values):**
```typescript
enum ReadinessStatus {
  WAITING_FOR_DATA_WINDOW = "WAITING_FOR_DATA_WINDOW",
  READY_BY_TIME_WINDOW = "READY_BY_TIME_WINDOW",
  READY_BY_MIN_EVENTS = "READY_BY_MIN_EVENTS",
  READY_BY_MANUAL_OVERRIDE = "READY_BY_MANUAL_OVERRIDE",
  BLOCKED_MISSING_INSTALL_AT = "BLOCKED_MISSING_INSTALL_AT",
}
```

**Eligibility Rules (ANY true = eligible):**
1. `install_at` exists AND `(now - install_at) >= 12 hours` → `READY_BY_TIME_WINDOW`
2. `event_count >= 10` → `READY_BY_MIN_EVENTS`
3. `manual_override_flag == true` (Phase 6) → `READY_BY_MANUAL_OVERRIDE`
4. `install_at` missing AND events < 10 AND no override → `BLOCKED_MISSING_INSTALL_AT`
5. 12h not elapsed AND events < 10 AND no override → `WAITING_FOR_DATA_WINDOW`

**Storage Keys:**
| Key | Type | Meaning |
|-----|------|---------|
| `report/{org}/first_ready_status` | Enum value (string) | Which readiness condition was met |
| `report/{org}/first_ready_reason` | String | Human-readable explanation |
| `report/{org}/first_ready_checked_at` | ISO timestamp | When readiness was last evaluated |

**Note:** Phase 3 writes readiness status ONLY. No reports (CSV/JSON) are generated; that is Phase 4+.

### Org Discovery

**Mechanism:** On successful `ingest()` call, org is added to `index/orgs`

**Key:** `index/orgs` (sorted, deduplicated unique org list)

**Bound:** Max 10,000 orgs per instance

### Installation & Ledger Verification

After `forge deploy`, verify:
1. Scheduled triggers are recognized by Forge CLI: `forge validate`
2. Handlers export correct signatures (function name matches manifest)
3. Ledgers are readable via storage API (if debug surface available)

---

## Version History

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| 0.1.0 | 2025-12-19 | PHASE 0 | Scaffold & spec only. No implementation. |
| 0.2.0 | 2025-12-19 | PHASE 1 | Ingestion endpoint + storage + validation. |
| 0.3.0 | 2025-12-19 | PHASE 2 | Aggregation + retention + storage index ledger. |
| 0.4.0 | 2025-12-19 | PHASE 3 | Scheduled pipelines, run ledgers, readiness gating. |

---

## Next Steps (Phase 4+)

- Implement reporting engine (CSV, JSON API)
- Implement alerting rules (thresholds, anomalies)
- Implement issue creation/linking (Jira REST API)
- Implement forecasting (confidence intervals)

See `audit_artifacts/atlassian_dual_layer/phase_2_evidence.md` for Phase 2 evidence.
See `audit_artifacts/atlassian_dual_layer/phase_3_evidence.md` for Phase 3 verification & evidence.
