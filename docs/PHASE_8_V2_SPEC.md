# PHASE 8 v2: GOVERNANCE METRICS SPECIFICATION

**Version:** 8.0  
**Status:** FINAL  
**Date:** 2025-12-20  

---

## 1. Objective

Implement formally defined governance metrics computed from Phase-6 snapshots and Phase-7 drift events.

**Core Principles:**
- Every metric output explicitly includes: numerator, denominator, scope, time window, completeness, confidence
- If required inputs are missing → metric is NOT_AVAILABLE (never coerced to zero or estimated)
- All metrics are deterministic: same inputs → same outputs → same canonical hash
- No recommendations, causality, or combined scores
- All metrics are READ-ONLY (computed from stored snapshots, never modify Jira)

---

## 2. Invariants (Hard Rules)

### 2.1 Metric Output Requirements

Every metric record MUST include:

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `metric_key` | string | YES | Stable identifier (M1, M2, M3, M4, M5) |
| `title` | string | YES | Human-readable metric name |
| `numerator` | number \| null | YES | Explicit count in numerator |
| `denominator` | number \| null | YES | Explicit count in denominator |
| `value` | number \| null | YES | Computed ratio (numerator / denominator) or null if NOT_AVAILABLE |
| `availability` | enum | YES | AVAILABLE \| NOT_AVAILABLE |
| `not_available_reason` | enum | CONDITIONAL | Reason if NOT_AVAILABLE |
| `confidence_score` | number | YES | 0.0 to 1.0 (deterministic formula) |
| `confidence_label` | enum | YES | HIGH \| MEDIUM \| LOW \| NONE |
| `completeness_percentage` | number | YES | 0-100 (% of required data present) |
| `dependencies` | string[] | YES | Required datasets (e.g., "fields_metadata", "usage_logs") |
| `disclosures` | string[] | YES | Explicit statements about metric (no interpretation) |
| `bounded` | boolean | YES | Whether value is bounded (e.g., 0-1 for ratios, false for churn density) |

### 2.2 NOT_AVAILABLE Rules

- `NOT_AVAILABLE ≠ 0` — they are semantically different
- A metric is NOT_AVAILABLE when any **critical dataset is missing**, not when the value is zero
- Example: M1 can be AVAILABLE with value=0 if all required fields are being used
- Example: M1 is NOT_AVAILABLE if usage logs are not available
- No estimation, interpolation, or heuristic inference allowed

### 2.3 Prohibited Content

The following terms NEVER appear in metrics:

- ❌ "recommend"
- ❌ "fix"
- ❌ "root cause"
- ❌ "impact"
- ❌ "improve"
- ❌ Combined score / health score / aggregate score
- ❌ Causality claims ("X causes Y")
- ❌ Recommendations ("consider doing X")

---

## 3. Metrics Run Data Model

### 3.1 MetricsRun (Immutable Record)

```typescript
interface MetricsRun {
  tenant_id: string;              // Tenant isolation
  cloud_id: string;               // Jira Cloud instance ID
  metrics_run_id: string;         // UUID (immutable reference)
  time_window: {
    from: string;                 // ISO-8601
    to: string;                   // ISO-8601
  };
  computed_at: string;            // ISO-8601 (when computed)
  status: 'success' | 'partial' | 'failed';
  completeness_percentage: number; // Overall run completeness (0-100)
  missing_inputs: string[];       // Explicit list of missing datasets
  schema_version: string;         // "8.0"
  metrics: MetricRecord[];        // Array of 5 metric records
  canonical_hash: string;         // SHA-256 of canonical JSON
  hash_algorithm: string;         // "sha256"
}
```

### 3.2 MetricRecord

```typescript
interface MetricRecord {
  metric_key: MetricKey;
  title: string;
  numerator: number | null;
  denominator: number | null;
  value: number | null;
  availability: 'AVAILABLE' | 'NOT_AVAILABLE';
  not_available_reason?: NotAvailableReason;
  confidence_score: number;       // 0.0 to 1.0
  confidence_label: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  completeness_percentage: number;
  dependencies: string[];
  disclosures: string[];
  bounded: boolean;
  deterministic_order?: any[];    // Contributing objects (for drill-down)
}
```

---

## 4. Formal Metric Definitions

### M1: Required Fields Never Used

**Metric Key:** `M1_UNUSED_REQUIRED_FIELDS`

**Title:** Required Fields Never Used

**Dependencies:** `fields_metadata`, `usage_logs`

**Formula:**
```
numerator = count(required fields with zero observed usage in time window)
denominator = count(required fields active in scope)
value = numerator / denominator

If usage_logs missing:
  availability = NOT_AVAILABLE
  not_available_reason = MISSING_USAGE_DATA
```

**Computation:**
1. Extract all required fields from Phase-6 snapshot
2. Aggregate field usage across all projects from usage logs
3. Count required fields with zero usage
4. Divide by total required fields

**Confidence Scoring:**
- Base: 100% if usage_logs available, 80% if partial
- Missing critical dataset: -20% penalty
- Label: HIGH if base ≥ 85%, MEDIUM if ≥ 65%, LOW if ≥ 40%, else NONE

**Bounded:** YES (value in [0, 1])

**Disclosures:**
- Does not infer usage from other sources
- Counts usage events, not fields' importance
- Empty required field set results in value=N/A (0/0 is undefined)

---

### M2: Inconsistent Field Usage Across Projects

**Metric Key:** `M2_INCONSISTENT_FIELD_USAGE`

**Title:** Inconsistent Field Usage Across Projects

**Dependencies:** `fields_metadata`, `project_usage_logs`

**Formula:**
```
For each active field:
  usage_by_project = [0 or 1 for each project]
  mean = MEAN(usage_by_project)
  variance = VARIANCE(usage_by_project)
  
  if mean != 0 and mean != 1:
    variance_ratio = variance / (mean * (1 - mean))
  else:
    variance_ratio = 0  // All projects use or none use = no inconsistency

  if variance_ratio > 0.35:
    field is INCONSISTENT

numerator = count(inconsistent fields)
denominator = count(all active fields)
value = numerator / denominator

If project_usage_logs missing:
  availability = NOT_AVAILABLE
  not_available_reason = MISSING_PROJECT_USAGE_DATA
```

**Computation:**
1. For each active field, collect per-project usage (0 or 1)
2. Calculate variance as proportion of mean
3. Apply threshold (0.35)
4. Count inconsistent fields

**Confidence Scoring:**
- Base: 100% if project_usage_logs available, 80% if partial
- Missing critical dataset: -20% penalty

**Bounded:** YES (value in [0, 1])

**Disclosures:**
- Threshold (0.35) is fixed, not configurable
- Does not infer root causes of inconsistency
- Does not prescribe standardization
- Presence/absence (binary) per project, not usage magnitude

---

### M3: Automation Execution Gap

**Metric Key:** `M3_AUTOMATION_EXECUTION_GAP`

**Title:** Automation Rules Present but Never Executed

**Dependencies:** `automation_rules`, `execution_logs`

**Formula:**
```
numerator = count(enabled automation rules with zero executions in time window)
denominator = count(enabled automation rules)
value = numerator / denominator

If execution_logs missing:
  availability = NOT_AVAILABLE
  not_available_reason = MISSING_EXECUTION_LOGS
```

**Computation:**
1. Extract enabled automation rules from snapshot
2. Aggregate executions across all projects
3. Count rules with zero executions
4. Divide by total enabled rules

**Confidence Scoring:**
- Base: 100% if execution_logs available, 80% if partial
- Missing critical dataset: -20% penalty

**Bounded:** YES (value in [0, 1])

**Disclosures:**
- Does not infer execution from other signals
- Counts only rules explicitly enabled
- Zero executions may indicate rule configuration issues or normal non-use

---

### M4: Configuration Churn Density

**Metric Key:** `M4_CONFIGURATION_CHURN_DENSITY`

**Title:** Configuration Change Events Per Tracked Object

**Dependencies:** `tracked_objects`, `drift_events`

**Formula:**
```
numerator = count(drift events in time window)
denominator = count(distinct tracked objects)
           = count(fields) + count(workflows) + count(automation_rules) + count(projects) + count(scopes)
value = numerator / denominator

If drift_events missing:
  availability = NOT_AVAILABLE
  not_available_reason = MISSING_DRIFT_DATA
```

**Computation:**
1. Count distinct tracked objects in snapshot
2. Count drift events in time window (from Phase-7)
3. Divide events by objects

**Confidence Scoring:**
- Base: 100% if drift_events available, 80% if partial
- Missing critical dataset: -20% penalty

**Bounded:** NO (value can exceed 1.0, unbounded)

**Disclosures:**
- Measures churn density, not individual object churn
- One object can have multiple changes (value > 1.0 possible)
- Does not identify which objects are changing

---

### M5: Visibility Gap Over Time

**Metric Key:** `M5_VISIBILITY_GAP_OVER_TIME`

**Title:** Datasets Missing Due to Permission or API Errors

**Dependencies:** `snapshot_missing_data`, `expected_datasets`

**Formula:**
```
numerator = count(datasets missing during snapshot capture)
denominator = count(expected datasets)
value = numerator / denominator

ALWAYS AVAILABLE (even if no missing data recorded)
```

**Computation:**
1. Extract missing_data field from snapshot
2. Count missing datasets
3. Divide by expected dataset count (5: fields, projects, workflows, automation_rules, scopes)

**Confidence Scoring:**
- Base: always 100% (snapshot existence = data availability)
- Missing critical dataset: 0 (this metric tracks missing data)

**Bounded:** YES (value in [0, 1])

**Disclosures:**
- Always available if snapshot exists
- Does not infer reasons for missing data
- Reason codes provided by Phase-6 snapshot layer

---

## 5. Confidence Scoring (Deterministic)

### 5.1 Formula

```
base_completeness = completeness_percentage / 100
penalty = 0.2 per missing critical dataset
confidence_score = max(0, base_completeness - penalty)

No smoothing. No heuristics. No weighting.
```

### 5.2 Critical Datasets by Metric

| Metric | Critical Datasets |
|--------|------------------|
| M1 | usage_logs |
| M2 | project_usage_logs |
| M3 | execution_logs |
| M4 | drift_events |
| M5 | (always available) |

### 5.3 Confidence Labels

| Score Range | Label | Meaning |
|-------------|-------|---------|
| ≥ 0.85 | HIGH | High confidence (all critical data present) |
| ≥ 0.65 | MEDIUM | Medium confidence (one dataset missing) |
| ≥ 0.40 | LOW | Low confidence (multiple datasets missing) |
| < 0.40 | NONE | No confidence (too much data missing) |

---

## 6. Canonical Hashing (Deterministic)

### 6.1 Hash Computation

1. Create canonical JSON:
   - Sort all object keys alphabetically
   - Sort all arrays deterministically (by metric key, then by value)
   - Null values as JSON null
2. Compute SHA-256 hash of canonical JSON
3. Store as `canonical_hash` in MetricsRun

### 6.2 Verification

- Verify hash: `SHA-256(canonical_json(metricsRun))` equals stored `canonical_hash`
- If hash mismatch → data integrity violation (reject or flag)
- Hash guarantees: deterministic reproducibility, immutability detection

---

## 7. Data Completeness Rules

### 7.1 Overall Run Completeness

```
available_metric_count = count(metrics with availability = AVAILABLE)
completeness_percentage = (available_metric_count / 5) * 100
```

### 7.2 Missing Inputs Tracking

`missing_inputs` array lists all datasets not available during computation:

Example:
```json
"missing_inputs": [
  "usage_logs",
  "execution_logs"
]
```

---

## 8. Storage & Isolation

### 8.1 Tenant Isolation

- Storage key pattern: `metrics:runs:{tenantId}:{cloudId}:{metricsRunId}`
- Metrics run belongs to exactly one tenant (immutable)
- Index pattern: `metrics:index:{tenantId}:{cloudId}`

### 8.2 Pagination

- Deterministic order: computed_at DESC (most recent first)
- Stable sort by metrics_run_id if timestamps equal
- Default limit: 20 per page
- Max limit: 100 per page

---

## 9. Exports & Reporting

### 9.1 JSON Export

Export includes:
- Complete MetricsRun (with canonical_hash)
- Formal definitions (static)
- Confidence scoring formula (static)
- Prohibited terms list
- Export timestamp

### 9.2 Report Format

Human-readable markdown report includes:
- Metrics summary (value, numerator, denominator, confidence)
- Definitions (formula, interpretation)
- Disclosures
- Missing inputs
- Canonical hash (for integrity verification)

---

## 10. Testing & Verification

### 10.1 Positive Tests

- Compute each metric with complete data → verify value, confidence, completeness
- Store metrics run → retrieve → verify canonical hash matches
- List metrics runs → verify pagination and deterministic order

### 10.2 Negative Tests

- Compute M1 without usage_logs → verify NOT_AVAILABLE
- Compute M2 without project_usage_logs → verify NOT_AVAILABLE
- Compute M3 without execution_logs → verify NOT_AVAILABLE
- Compute M4 without drift_events → verify NOT_AVAILABLE
- Compute M5 without snapshot → verify NOT_AVAILABLE

### 10.3 Determinism Tests

- Same inputs, different execution times → same outputs, same canonical hash
- Verify no Jira API calls during computation (READ-ONLY)
- Verify confidence scoring reproducible

### 10.4 Scale Tests

- Test with 1000 projects, 10,000 fields, 5,000 automation rules
- Verify storage and pagination still performant
- Verify deterministic ordering holds at scale

---

## 11. Phase Boundaries

| Phase | Responsibility |
|-------|-----------------|
| Phase-6 | Capture snapshots (evidence memory) |
| Phase-7 | Detect and record drift (observed change ledger) |
| **Phase-8** | **Compute metrics from snapshots + drift** |
| Phase-9+ | Interpret metrics, recommend actions (evaluative) |

Phase-8 is **purely computational** and **truth-safe** — it measures, not interprets.

---

## 12. Exit Criteria

Phase-8 v2 is complete when:

- ✅ All 5 metrics formally defined and implemented
- ✅ NOT_AVAILABLE used correctly (never coerced to zero)
- ✅ Every metric exposes confidence + disclosures
- ✅ No combined score exists
- ✅ Deterministic hashing verified (canonical_hash matches)
- ✅ Scale test passes (1000 projects)
- ✅ No Jira API calls during computation
- ✅ No prohibited terms found in codebase
- ✅ Tests pass (positive, negative, determinism, scale)
- ✅ Documentation complete and accurate

---

## Appendix A: Prohibited Terms Enforcement

The following must be caught in tests:

- ❌ "recommend" or "recommendation"
- ❌ "fix"  
- ❌ "root cause"
- ❌ "impact"
- ❌ "improve" or "improvement"
- ❌ Any combined/aggregate/health score

Test: grep codebase for prohibited terms → must return empty.

---

## Appendix B: Determinism Checklist

- ✅ Canonical JSON: keys sorted, arrays deterministic
- ✅ Confidence score: formula without randomness
- ✅ Hashing: SHA-256 (no salting, no nonce)
- ✅ Ordering: by time_window, then by ID
- ✅ Reproducibility: same inputs → same outputs at any time
