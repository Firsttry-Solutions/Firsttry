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

## D) EventV1 Schema (Strict Allow-List; Forbidden Fields)

### Allowed Fields (ONLY these)

```typescript
interface EventV1 {
  // Identity
  event_id: string;               // UUID v4, unique globally
  event_type: string;             // "run.started" | "run.completed" | "rule.executed" | "alert.triggered"
  
  // Timing (ISO 8601)
  event_timestamp: string;        // When event occurred (FirstTry Agent time)
  _ingest_timestamp: string;      // When received by Forge app (UTC)
  
  // Source
  agent_id: string;               // FirstTry Agent identifier
  _ingest_source: string;         // Token name used for authentication
  
  // Correlation
  run_id?: string;                // Parent run, if applicable
  rule_id?: string;               // Parent rule, if applicable
  
  // Data (type-specific)
  payload: Record<string, unknown>; // Event-specific data (see below)
  
  // Metadata
  version: 1;                     // Schema version (locked to 1 for Phase 0+)
  tags?: string[];                // Optional tags for filtering
}
```

### Forbidden Fields (HARD ERRORS on ingest if present)

- `synthetic_flag` (no marking synthetic data; ban it outright)
- `mock_data` (no test data in production storage)
- `estimation_confidence` (use completeness matrix instead)
- `forecast_value` (use reports with labeled assumptions)
- Any field starting with `__` (reserved for internal use)

### Event Type Payloads

#### `run.started`

```json
{
  "event_type": "run.started",
  "payload": {
    "run_name": "string",
    "schedule_key": "string",
    "start_reason": "manual" | "scheduled" | "webhook",
    "initial_rule_count": number
  }
}
```

#### `run.completed`

```json
{
  "event_type": "run.completed",
  "payload": {
    "run_name": "string",
    "completion_status": "success" | "partial" | "failed",
    "rules_executed": number,
    "alerts_triggered": number,
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

## Version History

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| 0.1.0 | 2025-12-19 | PHASE 0 | Scaffold & spec only. No implementation. |

---

## Next Steps (Phase 1+)

- Implement event ingestion endpoint
- Implement storage and run-ledger logic
- Implement scheduler integration
- Implement reporting engine
- Implement alerting rules
- Add issue creation/linking capabilities

See `audit_artifacts/atlassian_dual_layer/phase_1_evidence.md` (when available).
