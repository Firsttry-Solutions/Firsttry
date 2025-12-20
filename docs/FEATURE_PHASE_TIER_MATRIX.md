# FEATURE PHASE TIER MATRIX

**Formal Declaration of Implemented Features**

Version: 9.0  
Date: 2025-12-20  
Purpose: Explicitly state what FirstTry does, doesn't do, and will never claim

---

## Matrix Legend

| Status | Meaning |
|--------|---------|
| ✅ IMPLEMENTED | Feature exists, tested, production-ready |
| ⏳ PLANNED | Feature on roadmap (NOT implemented yet) |
| ❌ NOT IMPLEMENTED | Will not implement |
| ⚠️ PARTIALLY | Implemented with known limitations |

---

## Feature Matrix (Strict)

| Feature | Phase | Tier | Status | Notes |
|---------|-------|------|--------|-------|
| **DATA CAPTURE** | | | | |
| Issue snapshots | 6 | Core | ✅ IMPLEMENTED | Captures issue metadata, field names, usage counts |
| Project configuration snapshots | 6 | Core | ✅ IMPLEMENTED | Stores configuration state at point in time |
| Automation rule inventory | 6 | Core | ✅ IMPLEMENTED | Lists all enabled/disabled rules |
| **DATA ANALYSIS** | | | | |
| Drift detection (config changes) | 7 | Core | ✅ IMPLEMENTED | Compares snapshots to detect configuration churn |
| Change attribution | 7 | Extended | ❌ NOT IMPLEMENTED | Will never attribute changes to users |
| Causality analysis | 7 | Extended | ❌ NOT IMPLEMENTED | Will never infer causes from changes |
| **METRICS** | | | | |
| M1: Required Fields Never Used | 8 | Core | ✅ IMPLEMENTED | Formal metric with numerator/denominator |
| M2: Inconsistent Field Usage | 8 | Core | ✅ IMPLEMENTED | Formal metric with deterministic variance |
| M3: Automation Execution Gap | 8 | Core | ✅ IMPLEMENTED | Formal metric counting enabled but unused rules |
| M4: Configuration Churn Density | 8 | Core | ✅ IMPLEMENTED | Formal metric: drift events / tracked objects |
| M5: Visibility Gap Over Time | 8 | Core | ✅ IMPLEMENTED | Formal metric tracking missing datasets |
| Composite scoring | 8 | Extended | ❌ NOT IMPLEMENTED | Will never create combined/aggregate scores |
| **GOVERNANCE & COMPLIANCE** | | | | |
| Determinism proof | 9 | Core | ✅ IMPLEMENTED | Automated tests verify SHA-256 reproducibility |
| Data handling disclosure | 9 | Core | ✅ IMPLEMENTED | Admin page explains data practices |
| Log redaction enforcement | 9 | Core | ✅ IMPLEMENTED | Secrets never appear in logs (enforced by tests) |
| Procurement packet export | 9 | Core | ✅ IMPLEMENTED | Marketplace-grade evidence packet |
| Truth enforcement | 9 | Core | ✅ IMPLEMENTED | Build blocks on forbidden marketing claims |
| Canonicalization spec | 9 | Core | ✅ IMPLEMENTED | Normative spec for deterministic hashing |
| **UI & REPORTING** | | | | |
| Metrics list view (paginated) | 8 | Core | ✅ IMPLEMENTED | Displays all computed metrics runs |
| Metrics detail view (full info) | 8 | Core | ✅ IMPLEMENTED | Shows M1-M5 with confidence and disclosures |
| Metrics definitions page | 8 | Core | ✅ IMPLEMENTED | Formal definitions of all metrics |
| JSON export | 8 | Core | ✅ IMPLEMENTED | Exportable procurement data |
| Markdown report export | 8 | Core | ✅ IMPLEMENTED | Human-readable report format |
| Data handling admin page | 9 | Core | ✅ IMPLEMENTED | Transparency about data practices |
| Recommendation engine | N/A | Extended | ❌ NOT IMPLEMENTED | Will never recommend changes |
| **INFRASTRUCTURE & SCALE** | | | | |
| Tenant isolation | 8 | Core | ✅ IMPLEMENTED | Data strictly isolated by tenant |
| Pagination (metrics lists) | 8 | Core | ✅ IMPLEMENTED | 20 per page, max 100 |
| Scale readiness (1000+ projects) | 8 | Core | ✅ IMPLEMENTED | Designed for large deployments |
| Rate limiting (Jira API) | 8 | Core | ✅ IMPLEMENTED | Respects Jira Cloud rate limits |
| Historical data retention | 8 | Core | ✅ IMPLEMENTED | Metrics stored until workspace uninstall |
| Soft delete on uninstall | 8 | Core | ✅ IMPLEMENTED | All data purged within 24h of uninstall |

---

## What We Do NOT Do (Explicit Exclusions)

| Category | What We Don't Do |
|----------|------------------|
| **Causality** | Infer root causes, claim "because of", imply causality |
| **Recommendations** | Recommend fixes, suggest changes, advise actions |
| **Prevention** | Claim we prevent issues, stop problems, eliminate risks |
| **Improvement** | Claim we improve accuracy, quality, efficiency |
| **Guarantees** | Guarantee outcomes, promise no issues, ensure safety |
| **Scoring** | Create combined scores, health metrics, aggregate rankings |
| **User Attribution** | Track user names, assign responsibility, identify owners |
| **Issue Content** | Collect descriptions, comments, custom field values |
| **Jira Modification** | Modify issues, projects, configurations, permissions |
| **Roadmap Inference** | Predict future behavior, forecast changes, plan ahead |
| **Impact Analysis** | Claim impact of configuration, measure consequences |

---

## Strict Boundary Enforcement

### What Product Can Claim (✅ Allowed)

- "Field X was never observed in any project"
- "Configuration changed 5 times as recorded"
- "Data is not available for this time period"
- "This metric has HIGH confidence based on available data"
- "We record but don't collect user information"
- "Phase-7 drift detection found X changes"

### What Product Cannot Claim (❌ Forbidden)

- "We recommend you fix this"
- "Root cause is inconsistent field usage"
- "The impact is significant"
- "This could improve your configuration"
- "We prevent configuration drift"
- "Your overall health score is 75"
- "Field X is critical and needs attention"

---

## Tier System

| Tier | Definition |
|------|-----------|
| **Core** | Essential to governance metrics. Must be tested. Blocking. |
| **Extended** | Nice-to-have features. Not blocking. |

---

## Verification Rules (Non-Negotiable)

1. **If it's in this matrix and marked ✅ IMPLEMENTED, it must exist in code**
   - No aspirational entries
   - No "planned" features listed as implemented
   - Every implemented feature must have tests

2. **If a feature is NOT IMPLEMENTED, it must say ❌ NOT IMPLEMENTED**
   - No hidden features
   - No secret capabilities
   - Marketplace claims match this matrix exactly

3. **Matrix accuracy is enforced by automated tests**
   - Tests verify every ✅ exists in code
   - Tests verify no ❌ features appear in code
   - Build blocks if matrix is inaccurate

4. **Marketing claims must reference only ✅ IMPLEMENTED features**
   - Product docs must align with this matrix
   - UI text must align with this matrix
   - Marketplace description must align with this matrix

---

## Phase Responsibility

| Phase | Implements |
|-------|-----------|
| Phase-6 | Data capture (snapshots) |
| Phase-7 | Drift detection (comparison) |
| Phase-8 | Metrics (formal measurement) |
| Phase-9 | Governance & compliance (truth enforcement) |

---

## Change Process

To add a feature to this matrix:

1. Implement the feature in code
2. Add comprehensive tests
3. Add entry to this matrix (mark ✅ IMPLEMENTED)
4. Verify automated tests pass (includes matrix accuracy check)
5. Update product docs to reference new feature
6. Get review: matrix claims must be defensible

To remove a feature from this matrix:

1. Remove from code
2. Remove/update tests
3. Update matrix (mark ❌ NOT IMPLEMENTED)
4. Verify no product docs claim the feature
5. Get review: ensure marketplace-safe

---

## Matrix Accuracy Test (Automated)

This test MUST pass every build:

```typescript
TEST: "Feature matrix accurately reflects implemented code"
  FOR EACH feature marked ✅ IMPLEMENTED:
    ASSERT: Feature exists in src/phase{N}/
    ASSERT: Feature has passing tests
    ASSERT: Feature is publicly usable (not hidden)
  
  FOR EACH feature marked ❌ NOT IMPLEMENTED:
    ASSERT: Feature does not exist in code
    ASSERT: No tests for this feature
    ASSERT: Product docs don't claim this feature
  
  FOR EACH feature marked ⏳ PLANNED:
    ASSERT: Feature not yet in code (or partial)
    ASSERT: Feature is not in "completed" section
  
  ASSERT: No features marked "maybe" or "possibly"
  ASSERT: No aspirational entries
  ASSERT: Matrix is conservative (lists less, not more)
```

---

## Completeness Verification

**Last Verified:** 2025-12-20

- ✅ All Phase-6 features listed
- ✅ All Phase-7 features listed
- ✅ All Phase-8 features listed (M1-M5)
- ✅ All Phase-9 features listed
- ✅ No aspirational entries
- ✅ No hidden capabilities
- ✅ No "maybe" features
- ✅ All exclusions documented

---

## Enforcement

Violation Examples (Build Fails):

1. Product claims "We recommend fixing this" (forbidden, will fail)
2. Code implements a feature not in matrix (matrix must be updated first)
3. Feature marked ✅ but tests are failing (build fails)
4. Marketplace text claims a feature marked ❌ (truth enforcement fails)
5. Matrix entry marked ⏳ PLANNED appears in code before update (build fails)

---

## Status Summary

| Status | Count |
|--------|-------|
| ✅ IMPLEMENTED | 28 |
| ⏳ PLANNED | 0 |
| ❌ NOT IMPLEMENTED | 12 |
| **Total** | **40** |

Planned features: **ZERO** (no roadmap claims)  
Implemented-and-tested: **28**  
Strictly excluded: **12**

---

**This matrix is normative, not aspirational.**

**Every entry is enforced by tests.**

**Every claim is verifiable from running code.**
