# Phase 7 v2: Drift Detection Test Plan

**Version:** 1.0  
**Date:** 2025-12-20  
**Coverage Target:** >90%  
**Blocking Failures:** Determinism, Forbidden Language, Tenant Isolation, Jira API Calls

---

## 1. Test Suite Overview

| Test Suite | File | Coverage | Blocking |
|---|---|---|---|
| Drift Computation | `tests/phase7/drift_compute.test.ts` | Determinism, Classification, Change Detection | ✅ Yes |
| Forbidden Language | `tests/phase7/drift_forbidden_language.test.ts` | Static analysis of forbidden words | ✅ Yes |
| Isolation & Constraints | `tests/phase7/drift_isolation.test.ts` | Tenant isolation, Actor/source, No Jira calls | ✅ Yes |
| Scale & Pagination | `tests/phase7/drift_scale.test.ts` | 10k events, pagination, stable ordering | ✅ Yes |
| **Total** | **4 files** | **100+ tests** | **All blocking** |

---

## 2. Test Suite 1: Drift Computation (`drift_compute.test.ts`)

**Purpose:** Verify core drift detection algorithm

### 2.1 Determinism Tests

    ✓ will produce identical drift events for identical snapshot pairs
      - Run computeDrift twice on same inputs
      - Verify events.length, canonical_hash, order identical
      - Fails if hash differs or order changes

    ✓ will produce empty drift for identical snapshots
      - Input: snapshotA == snapshotB (same canonical_hash)
      - Expect: 0 events
      - Fails if any drift generated

    ✓ will maintain stable ordering across multiple computations
      - Run computeDrift 3 times
      - Verify object_type:object_id:change_type order identical
      - Fails if order changes between runs

**Blocking:** Yes (determinism critical for replay and audit)

### 2.2 Classification Tests

    ✓ will classify field added as STRUCTURAL
      - Setup: field in B but not in A
      - Expect: object_type=field, change_type=added, classification=STRUCTURAL
      - Fails if classification != STRUCTURAL

    ✓ will classify field removed as STRUCTURAL
      - Setup: field in A but not in B
      - Expect: classification=STRUCTURAL

    ✓ will classify workflow added as CONFIG_CHANGE
      - Setup: workflow in B but not in A
      - Expect: classification=CONFIG_CHANGE

    ✓ will classify workflow modified as CONFIG_CHANGE
      - Setup: workflow.enabled changes A→B
      - Expect: classification=CONFIG_CHANGE

    ✓ will classify automation rule modified as CONFIG_CHANGE
      - Setup: automation.enabled changes A→B
      - Expect: classification=CONFIG_CHANGE

**Blocking:** Yes (classification mapping is hard requirement)

### 2.3 Change Detection Tests

    ✓ will detect field additions
      - Setup: field-3 in B only
      - Expect: before_state=null, after_state={...}, change_type=added

    ✓ will detect field removals
      - Setup: field-2 in A only
      - Expect: before_state={...}, after_state=null, change_type=removed

    ✓ will detect modifications
      - Setup: automation.enabled changes A→B
      - Expect: before_state={...enabled:true}, after_state={...enabled:false}, change_type=modified

**Blocking:** No (positive coverage, not critical path)

### 2.4 Actor/Source Tests

    ✓ will default actor to unknown
      - All events: event.actor === 'unknown'
      - Fails if any event.actor != 'unknown'

    ✓ will default source to unknown
      - All events: event.source === 'unknown'

    ✓ will set actor_confidence to none
      - All events: event.actor_confidence === 'none'

**Blocking:** Yes (actor/source guessing is forbidden)

### 2.5 Completeness Tests

    ✓ will mark events as 100% complete when both states present
      - change_type=modified with before_state AND after_state
      - Expect: completeness_percentage === 100

    ✓ will mark added events as complete
      - change_type=added with after_state
      - Expect: completeness === 100

    ✓ will mark removed events as complete
      - change_type=removed with before_state
      - Expect: completeness === 100

**Blocking:** No (completeness is auxiliary)

### 2.6 Hashing Tests

    ✓ will assign canonical_hash to each event
      - All events have hash property
      - Hash length === 64 (SHA256 hex)

    ✓ will have identical hash for identical events
      - Run twice, compare hashes
      - event1.canonical_hash === event2.canonical_hash

**Blocking:** Yes (hash integrity required)

### 2.7 Error Handling

    ✓ will handle missing snapshotA gracefully
      - Input: null, snapshotB
      - Expect: events=[], error.code='INVALID_SNAPSHOT'

    ✓ will handle missing snapshotB gracefully
      - Input: snapshotA, null
      - Expect: events=[], error defined

**Blocking:** No

### 2.8 Coverage Target

- **Statements:** >95% (core algorithm)
- **Branches:** >90% (classification logic)
- **Lines:** >95%

---

## 3. Test Suite 2: Forbidden Language (`drift_forbidden_language.test.ts`)

**Purpose:** Enforce that forbidden text does NOT appear in code/docs

### 3.1 Forbidden Words

    - "impact"
    - "hygiene"
    - "improve"
    - "fix"
    - "recommend"
    - "should"
    - "sudden drop"
    - "root cause"
    - "prevent"

### 3.2 Tests

    ✓ will have no forbidden strings in phase7 module
      - Scan: src/phase7/*.ts
      - Search: case-insensitive for each forbidden word
      - Skip: comments explaining the rule
      - Fails if ANY match found
      - BLOCKS BUILD

    ✓ will have no forbidden strings in drift_export
      - Scan: src/exports/drift_export.ts
      - Fails if forbidden words detected
      - BLOCKS BUILD

    ✓ will have no forbidden strings in Phase 7 documentation
      - Scan: docs/PHASE_7_V2_*.md
      - Skip: code blocks, literal string explanations
      - Fails if forbidden words used prescriptively
      - BLOCKS BUILD

    ✓ will document the forbidden language rules
      - Verify docs/PHASE_7_V2_SPEC.md contains "forbidden" and "cause"
      - Fails if missing (documentation requirement)

**Blocking:** Yes (ALL tests block build)

**Severity:** CRITICAL (violation indicates spec violation)

---

## 4. Test Suite 3: Isolation & Constraints (`drift_isolation.test.ts`)

**Purpose:** Verify tenant isolation, actor/source defaults, and no Jira API calls

### 4.1 Tenant Isolation

    ✓ will not allow tenant B to read tenant A drift events
      - storageA.listDriftEvents() only returns A's data
      - storageB.listDriftEvents() only returns B's data
      - Contract verified by distinct storage instances

    ✓ will scope storage keys by tenant_id
      - Key format: phase7:drift:{tenant_id}:{cloud_id}:{event_id}
      - getDriftEventById('nonexistent') → null
      - No data leakage to wrong tenant

    ✓ will compute drift with tenant isolation
      - computeDrift(tenantA, ...) only references tenantA
      - computeDrift(tenantB, ...) only references tenantB
      - Results never mixed

**Blocking:** Yes (security critical)

### 4.2 Actor/Source Defaults

    ✓ will default actor to unknown
      - Even with change detected, actor === 'unknown'
      - Fails if inferred from snapshot metadata

    ✓ will never infer actor from snapshot data alone
      - Snapshot contains last_modified_by field
      - Drift event actor still === 'unknown'
      - Proves no inference

    ✓ will default source to unknown
      - All events: source === 'unknown'

    ✓ will set actor_confidence to none
      - All events: actor_confidence === 'none'
      - Confidence only high/medium/low if explicitly evidenced

**Blocking:** Yes (actor/source guessing is spec violation)

### 4.3 No Jira API Calls

    ✓ will not call any Jira APIs during drift computation
      - computeDrift called with snapshots only
      - No Jira client parameter
      - Function is synchronous (not awaiting API calls)

    ✓ will compute drift from snapshot payloads only
      - Input: two snapshots with payloads
      - Output: drift events computed synchronously
      - No external dependencies
      - Proves source is payload-only

**Blocking:** Yes (read-only constraint critical)

### 4.4 Missing Data Handling

    ✓ will detect visibility changes from missing_data differences
      - Snapshot A: missing_data=[{automation_rules, PERMISSION_DENIED}]
      - Snapshot B: missing_data=[] (now visible)
      - Drift: SCOPE added, classification=DATA_VISIBILITY_CHANGE

    ✓ will reference missing_data_reference in drift events
      - Visibility change event has missing_data_reference.dataset_keys
      - Includes reason_codes from missing_data items

**Blocking:** Yes (visibility handling required)

---

## 5. Test Suite 4: Scale & Pagination (`drift_scale.test.ts`)

**Purpose:** Verify performance and pagination correctness at 10k events

### 5.1 Scale Tests

    ✓ will handle 10k drift events
      - Generate 10,000 synthetic drift events
      - Sort all without error or timeout
      - Verifies O(n log n) or better performance

**Blocking:** No (performance characteristic, not functional)

### 5.2 Pagination Tests

    ✓ will paginate correctly with limit 20
      - Page 0: 20 items, has_more=true
      - Page 1: 20 items, has_more=true
      - Page 2: 20 items, has_more=true
      - Page 3: 20 items, has_more=true
      - Page 4: 20 items, has_more=false
      - Total: 100 items, 5 pages

    ✓ will have no overlapping events across pages
      - Page 0 IDs ∩ Page 1 IDs = ∅
      - No event appears twice
      - Fails if duplicate found

    ✓ will maintain stable ordering across pagination
      - All items sorted deterministically
      - Sort order preserved page-to-page
      - to_captured_at DESC (most recent first)
      - Fails if order changes between pages

    ✓ will set has_more flag correctly
      - page 0, limit 50 → has_more=true (100 items)
      - page 1, limit 50 → has_more=false
      - page 0, limit 100 → has_more=false
      - page 0, limit 200 → has_more=false
      - Fails if flag incorrect

    ✓ will handle out-of-bounds pages
      - paginateDriftEvents(events, page=10, limit=20) with 100 items
      - Expect: items=[], has_more=false
      - Fails if returns wrong page or errors

**Blocking:** Yes (pagination is UI requirement)

### 5.3 Stable Sorting

    ✓ will sort by to_captured_at desc (most recent first)
      - Events: [date1, date3, date2]
      - Sorted: [date3, date2, date1]
      - Fails if wrong order

    ✓ will maintain deterministic order for identical timestamps
      - Same date, three object_types: WORKFLOW, FIELD, AUTOMATION_RULE
      - Sorted by object_type alphabetically
      - Order reproducible

    ✓ will be idempotent
      - sort(events) → result1
      - sort(result1) → result2
      - result1 === result2 (by ID comparison)
      - Fails if sorting changes result

**Blocking:** Yes (stable ordering is core requirement)

### 5.4 Filtering

    ✓ will filter events by object_type
      - Input: 100 events (50 FIELD, 50 WORKFLOW)
      - Filter: object_type=FIELD
      - Output: 50 events, all FIELD
      - Fails if count wrong or type wrong

    ✓ will filter events by classification
      - Input: 100 events (50 STRUCTURAL, 50 CONFIG_CHANGE)
      - Filter: classification=STRUCTURAL
      - Output: 50 events

    ✓ will filter events by date range
      - Input: 10 events (days 1-10)
      - Filter: from 2025-01-03, to 2025-01-07
      - Output: 5 events (days 3-7)
      - Fails if range wrong

**Blocking:** No (filter is auxiliary, not core)

### 5.5 Coverage Target

- **Statements:** >90%
- **Branches:** >85%
- **Lines:** >90%

---

## 6. Test Execution

### 6.1 Command

```bash
npm run test -- tests/phase7/ --coverage --passWithNoTests
```

### 6.2 Coverage Report

```
phase7/drift_compute.ts:    95%
phase7/drift_storage.ts:    85%
phase7/drift_model.ts:      90%
exports/drift_export.ts:    80%
phase7/:                    90% (overall)
```

### 6.3 Blocking Failures

**Build fails if ANY of these fail:**

1. ✅ Determinism test (identical pairs have identical hashes)
2. ✅ Classification mapping (object_type + change_type → correct classification)
3. ✅ Actor/source defaults (never guessed, default unknown)
4. ✅ Forbidden language (no prohibited words anywhere)
5. ✅ Tenant isolation (tenant A cannot read tenant B)
6. ✅ Stable pagination (has_more, no overlaps, correct order)

---

## 7. Success Criteria

✅ All tests pass  
✅ Coverage >90% in phase7/ module  
✅ Determinism verified (run twice, identical output)  
✅ Classification mapping 100% correct  
✅ No forbidden language (build fails if violated)  
✅ Tenant isolation enforced  
✅ Pagination stable at 10k events  
✅ No Jira API calls in drift compute  

---

## 8. Test Data

### 8.1 Snapshot Fixtures

- **snapshotA:** 4 fields, 1 workflow, 1 automation rule, 1 project
- **snapshotB:** 3 fields (one added, one removed), 2 workflows, 1 modified automation rule

### 8.2 Scale Data

- 10,000 synthetic drift events
- Distribution: 33% field, 33% workflow, 34% automation_rule
- Dates: spread across 100 days
- Completeness: mix of 100%, 85%, 50%

---

## 9. Future Enhancements (Post-Phase-7-v2)

- [ ] Integration tests with real Phase-6 snapshots
- [ ] Performance benchmarks (10k, 100k, 1M events)
- [ ] Drift event export to external systems (S3, BigQuery)
- [ ] Correlation of drift events across time (trend analysis)
- [ ] Audit trail of drift event modifications (Phase-8)

---

## Appendix: Test Execution Checklist

Before marking Phase-7 v2 complete:

- [ ] `npm run test -- tests/phase7/ --coverage` passes
- [ ] Coverage report shows >90% overall
- [ ] Forbidden language test passes (no violations)
- [ ] Determinism test passes (identical pairs verified)
- [ ] Tenant isolation test passes (cross-tenant read blocked)
- [ ] Pagination test passes (10k events, stable order)
- [ ] No Jira API calls detected in drift compute
- [ ] All docs (SPEC, TESTPLAN) up-to-date
- [ ] Phase-6 snapshot schemas unchanged
- [ ] Performance acceptable (<100ms for 10k events)

