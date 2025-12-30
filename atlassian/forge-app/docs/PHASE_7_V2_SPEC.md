# Phase 7 v2: Drift Detection Specification

**Version:** 1.0  
**Date:** 2025-12-20  
**Status:** Production-Ready  
**Lock:** Phase-6 snapshot schemas are locked; Phase-7 adapts to Phase-6

---

## 1. Overview

Phase 7 v2 implements **drift detection** by computing observed changes between consecutive Phase-6 snapshots. Drift events record **what changed**, not **why**, **scope**, or **suggestions**.

### Core Principle
> Drift detection is **observation-only**. It answers: "What changed between snapshot A and snapshot B?" It does NOT answer causality, quality, risk, or suggestions.

### Forbidden Language
The following terms are **prohibited** in Phase-7 code, UI, documentation, and exports:

    - "impact", "hygiene", "improve", "fix", "recommend", "should", "sudden drop", "root cause", "prevent"

Any violation triggers a build failure via static analysis test.

---

## 2. Data Model

### DriftEvent Entity

```typescript
interface DriftEvent {
  // Identification (tenant-isolated)
  tenant_id: string;
  cloud_id: string;
  drift_event_id: string; // UUID

  // Snapshot linking
  from_snapshot_id: string; // Older snapshot
  to_snapshot_id: string;   // Newer snapshot

  // Time window
  time_window: {
    from_captured_at: string; // ISO 8601
    to_captured_at: string;
  };

  // What changed
  object_type: ObjectType; // field | workflow | automation_rule | project | scope
  object_id: string;
  change_type: ChangeType; // added | removed | modified

  // Classification
  classification: Classification; // STRUCTURAL | CONFIG_CHANGE | DATA_VISIBILITY_CHANGE | UNKNOWN

  // State deltas
  before_state: CanonicalSubset | null;
  after_state: CanonicalSubset | null;
  change_patch?: Array({op, path, from?, value?});

  // Actor/source (unknown by default, never guessed)
  actor: 'user' | 'automation' | 'app' | 'unknown';
  source: 'ui' | 'api' | 'app' | 'unknown';
  actor_confidence: 'high' | 'medium' | 'low' | 'none';

  // Completeness (0-100)
  completeness_percentage: number;

  // Missing data scope
  missing_data_reference?: {
    dataset_keys: string[];
    reason_codes: string[];
  };

  // Density tracking
  repeat_count: number;

  // Schema & integrity
  schema_version: string; // "7.0"
  canonical_hash: string; // SHA256
  hash_algorithm: 'sha256';
  created_at: string; // ISO 8601
}
```

### Storage Key Isolation

All drift event keys are prefixed by `tenant_id` and `cloud_id`:

```
phase7:drift:{tenant_id}:{cloud_id}:{drift_event_id}
phase7:drift_index:{tenant_id}:{cloud_id}:{snapshot_id}
```

**Critical:** Drift from tenant A is never readable by tenant B. All storage queries must filter by tenant_id.

---

## 3. Drift Detection Algorithm

### 3.1 Computation Pipeline

**Input:** Snapshot A (older), Snapshot B (newer)

**Steps:**

1. **Validate:** Both snapshots present; not identical (same canonical_hash)
2. **Extract:** Canonical subsets per object_type from payload
3. **Diff:** For each key in union(A_keys, B_keys):
   - Only in B → `added`
   - Only in A → `removed`
   - In both, different → `modified`
4. **Classify:** Map (object_type, change_type, missing_data) → Classification
5. **Sort:** Deterministically by (object_type, object_id, change_type, classification)
6. **Hash:** Canonical JSON representation
7. **Output:** DriftEvent[]

**No Jira API calls during computation.** All data comes from stored snapshots.

### 3.2 Canonical Object Extraction

Extractors are deterministic and stable:

#### Field
```typescript
{
  id: string;           // Stable identifier
  name: string;
  type: string;         // string, number, date, etc.
  custom: boolean;
  searchable: boolean;
}
```

#### Workflow
```typescript
{
  name: string;         // Stable identifier (workflow name)
  scope: string;        // 'global' | 'project' | 'unknown'
  is_default?: boolean;
  status_count: number; // Count of statuses
}
```

#### Automation Rule
```typescript
{
  id: string;           // Stable identifier
  name: string;
  enabled: boolean;
  trigger_type: string; // issue_created, issue_updated, etc.
}
```

#### Project
```typescript
{
  key: string;          // Stable identifier (project key)
  name: string;
  type: string;         // software, service_desk, business, unknown
}
```

### 3.3 Classification Mapping (Deterministic)

| Object Type | Change Type | Classification |
|---|---|---|
| field, project, scope | added | STRUCTURAL |
| field, project, scope | removed | STRUCTURAL |
| field, project, scope | modified | STRUCTURAL |
| workflow, automation_rule | added | CONFIG_CHANGE |
| workflow, automation_rule | removed | CONFIG_CHANGE |
| workflow, automation_rule | modified | CONFIG_CHANGE |
| (any) | added/removed/modified with missing_data scope | DATA_VISIBILITY_CHANGE |
| (ambiguous) | any | UNKNOWN |

### 3.4 Completeness Percentage

    completeness =
      100  if (before_state AND after_state) AND no missing_data scope
       85  if missing_data_reference exists but doesn't block visibility
       50  if before_state XOR after_state (one available, one not)
       25  if multiple missing_data dependencies
        0  if payload incomplete

### 3.5 Stable Ordering (Deterministic Sort)

Drift events are sorted by (in order):

1. `object_type` (alphabetically: automation_rule, field, project, scope, workflow)
2. `object_id` (alphabetically)
3. `change_type` (added, modified, removed alphabetically)
4. `classification` (CONFIG_CHANGE, DATA_VISIBILITY_CHANGE, STRUCTURAL, UNKNOWN alphabetically)

This ordering is **identical** in:
- Admin UI pagination
- JSON export
- Storage queries

### 3.6 Canonical Hashing

Each DriftEvent is hashed canonically:

```typescript
const canonical = {
  tenant_id, cloud_id, from_snapshot_id, to_snapshot_id,
  object_type, object_id, change_type, classification,
  before_state, after_state, actor, source
};
const hash = SHA256(JSON.stringify(canonical));
```

**Important:** The hash covers only the drift facts, not metadata like `drift_event_id` or `created_at`.

### 3.7 Scope Changes (Visibility via missing_data)

When `missing_data` differs between snapshots for a dataset:

- **Dataset became visible** (was missing, now present) → SCOPE added, DATA_VISIBILITY_CHANGE
- **Dataset became invisible** (was present, now missing) → SCOPE removed, DATA_VISIBILITY_CHANGE

---

## 4. Actor/Source Population (Never Guessed)

**Default:** Both `actor` and `source` default to `unknown` with `actor_confidence = 'none'`.

**Rule:** Only set actor/source if the snapshot payload itself contains **verified evidence** of who made the change.

**NO inference from:**
- Metadata fields (last_modified_by)
- Timing (when snapshot was captured)
- Pattern analysis
- Heuristics

**If unsure → unknown.**

---

## 5. Storage & Pagination

### 5.1 Storage Requirements

- Tenant isolation: All keys prefixed by tenant_id
- Indexing: By time_window (from_captured_at, to_captured_at)
- Pagination: Cursor or page+limit support
- Retention: Follow Phase-6 retention policies (TTL after 90+ days)

### 5.2 Pagination Contract

**List endpoint:**
```
listDriftEvents(tenantId, cloudId, filters, page, limit)
  → { items: DriftEvent[], has_more: boolean, page, limit, total_count? }
```

**Properties:**
- Items sorted deterministically (by to_captured_at desc, then tie-breaker)
- `has_more = true` if more items exist beyond current page
- `page` starts at 0
- `limit` typically 20 (UI), 100 (export)
- Stable: same query across time → same results

---

## 6. UI Requirements

### 6.1 Drift History Section (Admin Page)

**Placement:** New tab or section in Phase-6 admin page

**Table columns:**
- `time_window` (display as to_captured_at, e.g., "2025-12-20 10:00 UTC")
- `object_type` (field, workflow, automation_rule, project, scope)
- `object_id` (e.g., "PROJ", "field-123", "Default Workflow")
- `change_type` (added, removed, modified)
- `classification` (STRUCTURAL, CONFIG_CHANGE, DATA_VISIBILITY_CHANGE, UNKNOWN)
- `actor/source` (e.g., "unknown/unknown")
- `completeness%` (e.g., "100%", "50%")

**Pagination:** 20 events per page, with Prev/Next navigation

**Filters (optional):**
- Date range (from_date, to_date)
- Object type dropdown
- Classification dropdown
- Change type checkbox group

**Sorting:** Fixed - most recent first (to_captured_at desc)

### 6.2 Drift Detail Modal/Page (On Click)

**Content:**
- `object_type`, `object_id`, `change_type`, `classification`
- `before_state` (if available) - formatted as JSON code block
- `after_state` (if available) - formatted as JSON code block
- `change_patch` (if available) - list of operations with path/from/value
- `missing_data_reference` (if applicable) - list of affected datasets + reason codes
- **Explicit disclaimer:** "Observed change only. No cause inferred."
- Actor/source with confidence
- Completeness percentage with explanation

**Back link:** Return to drift list (preserving filters/page)

---

## 7. Export

### 7.1 JSON Export Endpoint

```
GET /api/phase7/export?from_date=...&to_date=...&object_type=...&page=...&limit=...
```

**Response:**
```json
{
  "format_version": "1.0",
  "schema_version": "7.0",
  "export_timestamp": "2025-12-20T10:00:00Z",
  "filters_used": {
    "from_date": "2025-12-15T00:00:00Z",
    "to_date": "2025-12-20T23:59:59Z"
  },
  "pagination": {
    "page": 0,
    "limit": 100,
    "total_count": 250,
    "has_more": true
  },
  "metadata": {
    "summary": "Exported 100 drift events",
    "note": "Observed changes only. No cause, impact, or recommendations inferred.",
    "missing_data_disclosure": "Drift detection depends on snapshot visibility. If a dataset was missing in either snapshot, related drift events may be incomplete."
  },
  "events": [
    {
      "tenant_id": "...",
      "drift_event_id": "...",
      "object_type": "field",
      "object_id": "field-123",
      "change_type": "added",
      "classification": "STRUCTURAL",
      "before_state": null,
      "after_state": {...},
      "completeness_percentage": 100,
      ...
    },
    ...
  ]
}
```

**Chunking:** 100 events per response; client loops through pages

**Ordering:** Identical to UI (most recent first, deterministic tie-breaker)

---

## 8. Completeness & Missing Data

### 8.1 Completeness Calculation

Completeness reflects data availability for drift observation:

- **100%:** Both before and after states available; no missing_data scope
- **85%:** Partial visibility (one dataset missing) but doesn't block drift observation
- **50%:** One of before/after unavailable
- **25%:** Multiple missing_data dependencies
- **0%:** Payload incomplete

### 8.2 Missing Data Reference

When a drift event's visibility is affected by missing_data:

```typescript
missing_data_reference: {
  dataset_keys: ["automation_rules"],        // Dataset that was missing
  reason_codes: ["PERMISSION_DENIED"]        // Why it was missing
}
```

**In UI:** Display as "⚠️ Visibility impacted by missing data (automation_rules: PERMISSION_DENIED)"

---

## 9. Determinism Guarantees

### 9.1 Properties

- **Idempotent:** Same snapshot pair → identical drift list (by hash)
- **Reproducible:** Drift computation is pure function of snapshot payloads
- **Stable:** Same drift events across time (no temporal drift)
- **Ordered:** Deterministic sort order maintained across pages/exports

### 9.2 Testing

- Determinism test: Run computeDrift twice, verify identical hashes
- Identity test: computeDrift(A, A) → 0 events
- Stability test: Sort same list 3x, verify identical order
- At scale: 10k events, determinism holds

---

## 10. Constraints & Compliance

### 10.1 Phase-6 Lock

- **Snapshots are immutable:** Phase-7 reads Phase-6 snapshots, never modifies
- **Schema not extended:** Phase-6 snapshot_model.ts unchanged
- **Retention reused:** Drift events follow Phase-6 retention (90+ days TTL)
- **No backdating:** Drift cannot be created for snapshots older than retention window

### 10.2 READ-ONLY Jira

- **No API calls:** Drift computation uses only provided snapshots
- **Verification:** Test asserts no Jira client passed to computeDrift
- **Edge case:** If snapshot payload is sparse/incomplete, drift is marked as DATA_VISIBILITY_CHANGE

### 10.3 Tenant Isolation

- **Storage keys:** `phase7:drift:{tenant_id}:{cloud_id}:*`
- **Queries:** All filtering by tenant_id
- **Test:** Tenant A cannot list tenant B drift events
- **Export:** Export filtered by request.context.tenantId

---

## 11. Exit Criteria (Phase 7 v2 Complete)

✅ Drift events reconstructable (before/after or patch exists)  
✅ Unknown actor/source explicit and default  
✅ Drift hashing deterministic and verified  
✅ UI drift list + detail view with pagination  
✅ JSON export chunked and deterministic  
✅ Forbidden language tests pass (build failure if violated)  
✅ No Jira API calls in drift compute  
✅ Phase-6 snapshots unchanged  
✅ Tenant isolation enforced  
✅ 90%+ test coverage (determinism, classification, isolation, scale)

---

## Appendix: References

- Phase 6 v2 Snapshot Model: `src/phase6/snapshot_model.ts`
- Phase 6 v2 Canonicalization: `src/phase6/canonicalization.ts`
- Phase 6 v2 Constants: `src/phase6/constants.ts`
- Phase 7 v2 Implementation: `src/phase7/`
- Phase 7 v2 Tests: `tests/phase7/`

