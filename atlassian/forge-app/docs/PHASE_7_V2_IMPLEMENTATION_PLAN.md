# Phase 7 v2: Drift Detection — Implementation Plan

**Status:** Pre-implementation scope assessment  
**Date:** 2025-12-20  
**Scope:** Drift detection from Phase-6 snapshots (observed changes only)

---

## 1. Overview

Phase 7 v2 implements drift detection by computing observed changes between consecutive stored Phase-6 snapshots. All drift is deterministic, immutable, and tenant-isolated. Drift events record **what changed**, not **why** or **what to do**.

### Key Principles
- **READ-ONLY Jira:** Zero Jira API calls during drift computation
- **Snapshot-driven:** All drift computed from stored Phase-6 snapshots (snapshot(t-1) → snapshot(t))
- **Deterministic:** Same snapshot pair → identical drift list + identical hashes
- **Immutable:** Drift events never updated after creation
- **Tenant-isolated:** All drift for tenant A isolated from tenant B
- **Unknown-friendly:** Actor/source default to `unknown` when not evidenced
- **No judgment:** Forbidden to claim impact, quality, recommendations, or causes

### Forbidden Text (Anywhere in Code/Docs/UI/Export)

    - "impact", "hygiene", "improve", "fix", "recommend", "should", "sudden drop", "root cause", "prevent"

---

## 2. File Changes Required (11 files, within limit)

### New Files (9)

#### Core Phase 7 Module (`src/phase7/`)
1. **drift_model.ts** (150-200 lines)
   - `DriftEvent` interface
   - `ChangeType` enum: `added | removed | modified`
   - `Classification` enum: `STRUCTURAL | CONFIG_CHANGE | DATA_VISIBILITY_CHANGE | UNKNOWN`
   - `ObjectType` enum: `field | workflow | automation_rule | project | scope`
   - Completeness percentage formula
   - Canonical subset definitions per object_type

2. **drift_compute.ts** (300-400 lines)
   - `computeDrift(snapshotA, snapshotB): DriftEvent[]`
   - Canonical extractors:
     - `extractFields(payload): Map(id, FieldCanonical)`
     - `extractWorkflows(payload): Map(name, WorkflowCanonical)`
     - `extractAutomationRules(payload): Map(id, AutomationCanonical)`
   - Classification logic (deterministic mapping)
   - Actor/source population (zero guessing)
   - Completeness calculation
   - Stable ordering (deterministic sort by object_type, object_id, change_type, classification)

3. **drift_storage.ts** (200-250 lines)
   - `DriftEventStorage` class with methods:
     - `storeDriftEvent(tenantId, cloudId, event): Promise(void)`
     - `listDriftEvents(tenantId, cloudId, filters, page, limit): Promise({items, has_more})`
     - `getDriftEventById(tenantId, cloudId, eventId): Promise(DriftEvent | null)`
   - Pagination support (cursor or page+limit)
   - Indexes: by tenant_id, by time_window, by object_type

#### Export Handler (`src/exports/`)
4. **drift_export.ts** (200-250 lines)
   - `exportDriftJSON(tenantId, cloudId, filters, page, limit)`
   - Chunked export (100 events per chunk)
   - Deterministic ordering identical to UI
   - Includes: export_timestamp, schema_version, filters_used, missing_data_disclosure

#### UI Integration (`src/admin/`)
5. **drift_ui.ts** (150-200 lines)
   - `renderDriftHistorySection(tenantId, cloudId, page, filters)`
   - `renderDriftListTable(events)`
   - `renderDriftDetailModal(event)`
   - HTML templates with pagination controls

#### Modified Files (1)
6. **drift_storage.ts** — Storage operations for drift ledger
   - Write: New drift events captured during scheduled snapshot comparison
   - Read: Export handler retrieves drift ledger in time-window chunks
   - Export new drift functions if needed

#### Test Files (6)
8. **tests/phase7/drift_compute.test.ts** (300+ lines)
   - Determinism tests
   - Classification correctness
   - Canonical extraction
   - Stable ordering

9. **tests/phase7/drift_model.test.ts** (150+ lines)
   - Completeness formula validation
   - Hash generation verification

10. **tests/phase7/drift_isolation.test.ts** (200+ lines)
    - Tenant isolation
    - Actor/source never guessed
    - Unknown as default

11. **tests/phase7/drift_forbidden_language.test.ts** (100+ lines)
    - Static scan for forbidden strings
    - Build fail on violation

#### Documentation (2)
12. **docs/PHASE_7_V2_SPEC.md** (150-200 lines)
    - Complete specification
    - Data model
    - Algorithm descriptions
    - Classification mapping table
    - Completeness formula

13. **docs/PHASE_7_V2_TESTPLAN.md** (100-150 lines)
    - Test coverage map
    - Test cases per category
    - Success criteria

---

## 3. Data Model (drift_model.ts)

```typescript
interface DriftEvent {
  // Identification (tenant-isolated)
  tenant_id: string;
  cloud_id: string;
  drift_event_id: string; // UUID

  // Snapshot linking
  from_snapshot_id: string;
  to_snapshot_id: string;

  // Time window
  time_window: {
    from_captured_at: string; // ISO 8601
    to_captured_at: string;   // ISO 8601
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
  change_patch?: Array({op: string, path: string, from?: any, value?: any});

  // Actor/source (unknown by default)
  actor: 'user' | 'automation' | 'app' | 'unknown';
  source: 'ui' | 'api' | 'app' | 'unknown';
  actor_confidence: 'high' | 'medium' | 'low' | 'none';

  // Completeness
  completeness_percentage: number; // 0-100

  // Missing data scope
  missing_data_reference?: {
    dataset_keys: string[];
    reason_codes: string[];
  };

  // Density tracking
  repeat_count: number; // 1 for unique, >1 for consecutive repeats

  // Schema & hash
  schema_version: string; // "7.0"
  canonical_hash: string; // SHA256
  hash_algorithm: 'sha256';
}
```

---

## 4. Algorithm Outline

### A. Drift Computation Pipeline
1. **Input:** Snapshot A (older), Snapshot B (newer)
2. **Extract:** Canonical subsets per object_type
3. **Diff:** For each key in union(A_keys, B_keys):
   - Only in B → `added`
   - Only in A → `removed`
   - In both, different → `modified`
4. **Classify:** Map change_type + object_type + missing_data → classification
5. **Sort:** Deterministically by (object_type, object_id, change_type, classification)
6. **Hash:** Canonical JSON representation
7. **Output:** `DriftEvent[]`

### B. Canonical Object Extraction (Examples)

**Field:**
```typescript
{
  id: string;
  name: string;
  type: string;
  custom: boolean;
  searchable: boolean;
}
```

**Workflow:**
```typescript
{
  name: string;
  scope: 'global' | 'project';
  is_default: boolean;
  status_count: number;
}
```

**Automation Rule:**
```typescript
{
  id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
}
```

### C. Classification Mapping

| Condition | Classification |
|-----------|-----------------|
| added + (workflow OR automation_rule) | CONFIG_CHANGE |
| added + (field OR project OR scope) | STRUCTURAL |
| removed + (workflow OR automation_rule) | CONFIG_CHANGE |
| removed + (field OR project OR scope) | STRUCTURAL |
| modified + (workflow OR automation_rule) | CONFIG_CHANGE |
| modified + (field OR project OR scope) | STRUCTURAL |
| missing_data differs between snapshots for required dataset | DATA_VISIBILITY_CHANGE |
| cannot confidently classify | UNKNOWN |

### D. Completeness Percentage

    completeness = 
      - 100 if both before and after available and no missing_data effect
      - 85 if missing_data referenced but doesn't block visibility
      - 50 if before OR after unavailable
      - 25 if multiple missing_data dependencies
      - 0 if payload incomplete

---

## 5. Storage (drift_storage.ts)

Drift ledger is stored in tenant-scoped Forge Storage. No UI is provided for viewing drift history.

Drift events are stored automatically and accessible programmatically via Forge Storage.

---

## 7. Test Coverage

### Positive Tests
- ✅ Determinism: Same pair → identical drift list
- ✅ No drift on identical snapshots (A == A → 0 events)
- ✅ Field added → STRUCTURAL
- ✅ Workflow modified → CONFIG_CHANGE
- ✅ Missing dataset → DATA_VISIBILITY_CHANGE
- ✅ Pagination correctness (stable ordering, has_more flag)
- ✅ Tenant isolation (A cannot read B's drift)

### Negative Tests
- ❌ Actor guessed without evidence → fails
- ❌ Source guessed without evidence → fails
- ❌ Forbidden text in UI → build fails
- ❌ Jira API called during compute → fails

### Scale Tests
- 10k drift events paginated correctly
- Deterministic hashing at 10k scale
- Stable ordering across pages

---

## 8. Implementation Sequence

1. ✅ Create drift_model.ts (data structures)
2. ✅ Create drift_compute.ts (core algorithm)
3. ✅ Create drift_storage.ts (Forge storage wrapper)
4. ✅ Create drift_export.ts (programmatic export)
5. ✅ Create test files (6 test suites)
6. ✅ Create PHASE_7_V2_SPEC.md
7. ✅ Create PHASE_7_V2_TESTPLAN.md
8. ✅ Run forbidden language scan
9. ✅ Run all tests
12. ✅ Verify no Jira calls in drift path

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Snapshot payload shape varies | Define canonical extractors per object_type; mark unknown_key if unstable |
| Actor/source guessed accidentally | Test explicitly forbids guessing; default=unknown |
| Forbidden text sneaks in | Static scan + build failure |
| Drift hash not deterministic | Test with identical pairs; verify hash stability |
| Tenant isolation broken | Test that tenant A cannot list tenant B drift |
| Pagination unstable | Test 10k events with stable ordering guarantee |

---

## 10. Success Criteria

- ✅ Drift events fully reconstructable (before/after or patch exists)
- ✅ Unknown actor/source explicitly supported and tested
- ✅ Drift hashing deterministic and verified
- ✅ UI drift list + detail works with pagination
- ✅ JSON export works at scale and is chunked
- ✅ Forbidden language tests pass (build fails if violated)
- ✅ No Jira API calls in drift compute path (verified by test)
- ✅ Phase-6 snapshot schemas unchanged
- ✅ All 6 test suites pass with >90% coverage

---

## 11. Timeline

**Expected:** 4-6 hours for full implementation, testing, and documentation.

**Next step:** Proceed with implementation sequence above.

