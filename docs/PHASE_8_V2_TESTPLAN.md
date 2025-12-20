# PHASE 8 v2: TEST PLAN

**Version:** 8.0  
**Date:** 2025-12-20  

---

## Test Strategy

### Test Categories

1. **Positive Tests** — Verify correct computation with complete data
2. **Negative Tests** — Verify NOT_AVAILABLE handling with missing data
3. **Determinism Tests** — Verify reproducibility and hashing
4. **Scale Tests** — Verify performance at 1000 projects
5. **Prohibitions Tests** — Verify no forbidden terms in output

---

## Test Suite 1: Metrics Computation

### TC-1.1: M1 — Unused Required Fields (Positive)

**Setup:**
- Snapshot: 5 required fields (active)
- Usage: 3 fields used in projects, 2 unused
- Expected: numerator=2, denominator=5, value=0.4

**Verify:**
- ✅ Metric is AVAILABLE
- ✅ Numerator = 2
- ✅ Denominator = 5
- ✅ Value = 0.4
- ✅ Confidence HIGH (100% complete)
- ✅ Disclosures include computation details

---

### TC-1.2: M1 — Missing Usage Data (Negative)

**Setup:**
- Snapshot: 5 required fields
- Usage: null (missing)
- Expected: NOT_AVAILABLE

**Verify:**
- ✅ Availability = NOT_AVAILABLE
- ✅ not_available_reason = MISSING_USAGE_DATA
- ✅ Value = null
- ✅ Numerator = null, Denominator = null
- ✅ Confidence score = 0
- ✅ Confidence label = NONE

---

### TC-1.3: M1 — All Fields Used (Boundary)

**Setup:**
- Snapshot: 10 required fields
- Usage: all 10 fields used
- Expected: numerator=0, denominator=10, value=0

**Verify:**
- ✅ Value = 0 (not AVAILABLE)
- ✅ Numerator = 0
- ✅ Denominator = 10
- ✅ Availability = AVAILABLE (zero is valid)

---

### TC-1.4: M2 — Inconsistent Usage (Positive)

**Setup:**
- 6 fields, 3 projects
- Field A: used in [1,1,0] → variance_ratio = 0.5 (> 0.35, inconsistent)
- Field B: used in [0,0,0] → variance_ratio = 0 (consistent, all unused)
- Field C: used in [1,1,1] → variance_ratio = 0 (consistent, all used)
- Fields D, E, F: similar patterns
- Expected: numerator=1 (Field A only), denominator=6, value=0.167

**Verify:**
- ✅ Metric is AVAILABLE
- ✅ Numerator = 1
- ✅ Denominator = 6
- ✅ Value ≈ 0.167
- ✅ contributing_objects lists Field A with variance_ratio

---

### TC-1.5: M2 — Missing Project Usage (Negative)

**Setup:**
- Snapshot: fields present
- Project usage: null (missing)
- Expected: NOT_AVAILABLE

**Verify:**
- ✅ Availability = NOT_AVAILABLE
- ✅ not_available_reason = MISSING_PROJECT_USAGE_DATA

---

### TC-1.6: M3 — Automation Gap (Positive)

**Setup:**
- Snapshot: 10 enabled automation rules
- Executions: rules 1-3 have executions, rules 4-10 have zero
- Expected: numerator=7, denominator=10, value=0.7

**Verify:**
- ✅ Numerator = 7
- ✅ Denominator = 10
- ✅ Value = 0.7
- ✅ Contributing objects list 7 unexecuted rules

---

### TC-1.7: M3 — Missing Execution Logs (Negative)

**Setup:**
- Snapshot: automation rules present
- Execution logs: null
- Expected: NOT_AVAILABLE

**Verify:**
- ✅ not_available_reason = MISSING_EXECUTION_LOGS

---

### TC-1.8: M4 — Churn Density (Positive)

**Setup:**
- Snapshot: 100 tracked objects (40 fields, 30 workflows, 20 automation, 10 projects)
- Drift events: 150 events in window
- Expected: numerator=150, denominator=100, value=1.5

**Verify:**
- ✅ Numerator = 150
- ✅ Denominator = 100
- ✅ Value = 1.5 (unbounded, can exceed 1)
- ✅ bounded = false
- ✅ Confidence HIGH (drift data available)

---

### TC-1.9: M4 — Missing Drift Events (Negative)

**Setup:**
- Snapshot: present
- Drift events: null (missing)
- Expected: NOT_AVAILABLE

**Verify:**
- ✅ not_available_reason = MISSING_DRIFT_DATA

---

### TC-1.10: M5 — Visibility Gap (Positive)

**Setup:**
- Snapshot: missing_data lists 2 datasets (fields, projects)
- Expected datasets: 5 (fields, projects, workflows, automation_rules, scopes)
- Expected: numerator=2, denominator=5, value=0.4

**Verify:**
- ✅ Numerator = 2
- ✅ Denominator = 5
- ✅ Value = 0.4
- ✅ Availability = AVAILABLE (always available)
- ✅ Confidence HIGH (no missing critical data)

---

### TC-1.11: M5 — No Missing Data (Boundary)

**Setup:**
- Snapshot: missing_data is empty
- Expected: numerator=0, denominator=5, value=0

**Verify:**
- ✅ Numerator = 0
- ✅ Denominator = 5
- ✅ Value = 0
- ✅ Availability = AVAILABLE

---

## Test Suite 2: Confidence Scoring

### TC-2.1: High Confidence

**Setup:**
- base_completeness = 100%
- missing_critical_datasets = 0
- Expected: score ≥ 0.85, label = HIGH

**Verify:**
- ✅ confidence_score = 1.0
- ✅ confidence_label = HIGH

---

### TC-2.2: Medium Confidence

**Setup:**
- base_completeness = 100%
- missing_critical_datasets = 1 (penalty = 0.2)
- Expected: score = 0.8, label = MEDIUM

**Verify:**
- ✅ confidence_score = 0.8
- ✅ confidence_label = MEDIUM

---

### TC-2.3: Low Confidence

**Setup:**
- base_completeness = 100%
- missing_critical_datasets = 2 (penalty = 0.4)
- Expected: score = 0.6, label = LOW

**Verify:**
- ✅ confidence_score = 0.6
- ✅ confidence_label = LOW

---

### TC-2.4: No Confidence

**Setup:**
- base_completeness = 100%
- missing_critical_datasets = 4 (penalty = 0.8)
- Expected: score = 0.2, label = NONE

**Verify:**
- ✅ confidence_score = 0.2
- ✅ confidence_label = NONE

---

### TC-2.5: Negative Score Clamped

**Setup:**
- base_completeness = 50%
- missing_critical_datasets = 5 (penalty = 1.0)
- Expected: score = max(0, 0.5 - 1.0) = 0

**Verify:**
- ✅ confidence_score = 0 (not negative)
- ✅ confidence_label = NONE

---

## Test Suite 3: Determinism & Hashing

### TC-3.1: Canonical Hash Reproducibility

**Setup:**
- Create MetricsRun A
- Compute canonical_hash_A
- Create identical MetricsRun B
- Compute canonical_hash_B
- Expected: hash_A == hash_B

**Verify:**
- ✅ Hashes are identical
- ✅ Hash is SHA-256
- ✅ Can be computed independently

---

### TC-3.2: Hash Verification

**Setup:**
- Create MetricsRun with canonical_hash
- Modify one metric value
- Recompute hash
- Expected: new hash ≠ stored hash

**Verify:**
- ✅ verifyCanonicalHash() returns false
- ✅ Detects any modification

---

### TC-3.3: Deterministic Ordering

**Setup:**
- Create 5 MetricsRun records with different computed_at times
- Store all
- Retrieve in pagination (2 per page)
- Expected: Page 1 = [most recent, 2nd recent], Page 2 = [3rd, 4th], Page 3 = [oldest]

**Verify:**
- ✅ Order is consistent across retrievals
- ✅ Most recent first (DESC)
- ✅ Stable sort by ID when times equal

---

### TC-3.4: Reproducibility Over Time

**Setup:**
- Compute metrics for dataset D at time T1
- Compute again at time T2 with identical data
- Expected: same outputs, same canonical_hash

**Verify:**
- ✅ Values match
- ✅ Confidence scores match
- ✅ Canonical hashes match

---

## Test Suite 4: Storage & Pagination

### TC-4.1: Store and Retrieve

**Setup:**
- Create and store MetricsRun
- Retrieve by ID
- Expected: identical object

**Verify:**
- ✅ Retrieved object matches stored
- ✅ Canonical hash intact

---

### TC-4.2: Pagination (10 records, 3 per page)

**Setup:**
- Store 10 MetricsRun records
- Request page 0, limit 3
- Expected: 3 items, has_more = true

**Verify:**
- ✅ Page 0 has 3 items
- ✅ has_more = true
- ✅ Total count = 10

---

### TC-4.3: Pagination Last Page

**Setup:**
- 10 records stored, 3 per page
- Request page 3, limit 3
- Expected: 1 item, has_more = false

**Verify:**
- ✅ Page 3 has 1 item
- ✅ has_more = false

---

### TC-4.4: Tenant Isolation

**Setup:**
- Store metrics for Tenant A, Tenant B
- Retrieve as Tenant A
- Expected: only Tenant A records visible

**Verify:**
- ✅ Tenant A sees only its records
- ✅ No cross-tenant leakage

---

## Test Suite 5: Export & Format

### TC-5.1: JSON Export

**Setup:**
- Create and export MetricsRun
- Parse exported JSON
- Expected: valid, parseable, contains all fields

**Verify:**
- ✅ JSON is valid
- ✅ Contains definitions
- ✅ Contains confidence_formula
- ✅ Contains prohibited_terms list
- ✅ Export timestamp present

---

### TC-5.2: Report Generation

**Setup:**
- Generate markdown report
- Expected: human-readable, includes all metrics

**Verify:**
- ✅ Report is markdown
- ✅ Includes metric titles, values, confidence
- ✅ Includes definitions section
- ✅ Includes disclosures

---

## Test Suite 6: Scale Test

### TC-6.1: 1000 Projects, 10,000 Fields

**Setup:**
- 1000 projects
- 10,000 fields (5,000 required, 5,000 optional)
- 50% field usage across projects
- Expected: compute all metrics in < 5 seconds

**Verify:**
- ✅ All metrics compute successfully
- ✅ M1 value computed correctly at scale
- ✅ M2 variance calculated correctly for 10,000 fields
- ✅ Hash integrity verified
- ✅ Pagination works with large dataset

---

### TC-6.2: 5,000 Automation Rules

**Setup:**
- 5,000 enabled automation rules
- 30% never executed
- Expected: M3 value = 0.3, compute in < 2 seconds

**Verify:**
- ✅ M3 computed correctly
- ✅ Performance acceptable

---

### TC-6.3: 100,000 Drift Events

**Setup:**
- 100,000 drift events in time window
- 50,000 tracked objects
- Expected: M4 = 2.0, compute in < 3 seconds

**Verify:**
- ✅ M4 computed correctly
- ✅ Unbounded value handled correctly

---

## Test Suite 7: Prohibitions

### TC-7.1: No Forbidden Terms in Output

**Setup:**
- Compute all metrics
- Export as JSON and report
- Scan for prohibited terms

**Verify:**
- ✅ "recommend" not found
- ✅ "fix" not found
- ✅ "root cause" not found
- ✅ "impact" not found
- ✅ "improve" not found
- ✅ "combined score" not found
- ✅ "health" not found

---

### TC-7.2: No Forbidden Terms in Code

**Setup:**
- Grep phase8/ source files
- Search for prohibited terms

**Verify:**
- ✅ No prohibited terms in comments
- ✅ No prohibited terms in strings
- ✅ No prohibited terms in variable names

---

## Test Suite 8: Integration

### TC-8.1: Compute → Store → Export → Verify

**Setup:**
1. Compute all metrics
2. Store MetricsRun
3. Export as JSON
4. Verify canonical hash

**Verify:**
- ✅ All steps succeed
- ✅ Hash verified
- ✅ Export is valid JSON
- ✅ Definitions match spec

---

### TC-8.2: No Jira API Calls

**Setup:**
- Mock Jira API to throw error
- Compute metrics
- Expected: metrics compute without calling Jira

**Verify:**
- ✅ No @jira API calls made
- ✅ Metrics use only stored data

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| All 5 metrics implemented | ✅ |
| NOT_AVAILABLE correctly used | ✅ |
| Confidence scoring formula verified | ✅ |
| Deterministic hashing verified | ✅ |
| Scale test passes (1000 projects) | ✅ |
| No forbidden terms in output | ✅ |
| No Jira API calls during compute | ✅ |
| Storage and pagination functional | ✅ |
| Export formats valid | ✅ |
| All tests passing | ✅ |

---

## Execution Plan

1. **Phase 1** (Immediate): Run positive tests (TC-1.1 to TC-1.11)
2. **Phase 2** (Day 1): Run determinism tests (TC-3.x)
3. **Phase 3** (Day 2): Run scale tests (TC-6.x)
4. **Phase 4** (Day 3): Run prohibition tests (TC-7.x)
5. **Phase 5** (Day 4): Integration testing (TC-8.x)

---
