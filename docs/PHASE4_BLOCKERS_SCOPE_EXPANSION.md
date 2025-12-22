# Phase 4 Blockers: Scope Expansion Requirements

**Document Version**: 1.0  
**Status**: Infrastructure created; 11 checks marked UNKNOWN pending runtime fixtures  
**Last Updated**: 2025-12-22  
**Next Phase**: Phase 5 (Runtime Fixtures & CI Integration)

---

## Executive Summary

The Operator Verification SOP test suite (Phase 4) has been successfully implemented with **20 checks across 5 levels**. However, **11 of the 20 checks are marked UNKNOWN** because they require additional infrastructure that goes beyond pure static code verification.

This document catalogs:
1. **Why these checks are blocked**
2. **What infrastructure is required** to unblock them
3. **Estimated effort** to implement each blocker
4. **Prioritization** for Phase 5 work

**Key Insight**: The 9 passing checks (L1-DET-001, L4-CLAIMS/DOCS/POLICY) prove the verification framework works. The 11 unknown checks need runtime fixtures, not framework fixes.

---

## Blocked Checks Inventory

### Summary Table

| Level | Check ID | Title | Status | Blocker | Est. Effort |
|-------|----------|-------|--------|---------|-------------|
| L1 | L1-CF-001 | Counterfactual Proof Integrity | ⚠️ UNKNOWN | Evidence bundle instantiation | Medium |
| L1 | L1-TRUTH-001 | No Misleading Outputs | ⚠️ UNKNOWN | Output envelope validation | Medium |
| L2 | L2-ATTR-001 | Attribution Completeness | ⚠️ UNKNOWN | Evidence bundle instantiation | Medium |
| L2 | L2-PAG-001 | Pagination Integrity | ⚠️ UNKNOWN | Pagination fixture (N=1000) | Medium |
| L2 | L2-PERM-001 | Permission Boundaries | ⚠️ UNKNOWN | 403 error injection | Low |
| L3 | L3-FAIL-001 | API Failure Handling | ⚠️ UNKNOWN | Error injection framework | High |
| L3 | L3-STOR-001 | Storage Failure Handling | ⚠️ UNKNOWN | Storage mock failures | High |
| L3 | L3-PART-001 | Partial Write + Quarantine | ⚠️ UNKNOWN | Partial write injection | High |
| L3 | L3-REPAIR-001 | Repair on Rerun | ⚠️ UNKNOWN | Baseline capture + comparison | Medium |
| L3 | L3-CONC-001 | Duplicate Invocation | ⚠️ UNKNOWN | Concurrent handler invocation | High |
| L3 | L3-CONC-002 | Overlapping Interleaving | ⚠️ UNKNOWN | Deterministic interleaving | High |
| L4 | L4-POLICY-002 | No Scope Drift | ⚠️ UNKNOWN | manifest.yml parsing | Low |
| L5 | L5-TRACE-001 | Audit Traceability | ⚠️ UNKNOWN | Report artifact generation | Medium |

---

## Blocker Categorization

### Category A: Evidence Bundle Infrastructure (3 checks)

**Affected Checks**:
- L1-CF-001: Counterfactual Proof Integrity
- L2-ATTR-001: Source Attribution Completeness
- L1-TRUTH-001: No Misleading Outputs (partially)

**What's Blocked**:
These checks need to verify that FirstTry generates "evidence bundles" — detailed proof artifacts that link policy detections to actual issue data. Currently, evidence bundles exist in CLAIMS_PROOF_CATALOG.md but are not instantiated during verification runs.

**Required Infrastructure**:
```typescript
// Need to implement:
interface EvidenceBundle {
  claimId: string;
  timestamp: ISO8601;
  issueKey: string;
  policiesDetected: PolicyResult[];
  dataSnapshot: { [field: string]: unknown };
  auditTrail: AuditEntry[];
}

// Then instantiate during test runs:
const bundles = await generateEvidenceBundles({
  issueQueries: ['PROJECT = "TEST"'],
  policiesEnabled: ['all'],
});

// Then validate:
ensureBundlesMatchClaimsProof(bundles, CLAIMS_PROOF_CATALOG);
```

**Effort Estimate**: **MEDIUM** (2-3 days)
- Create EvidenceBundle interface
- Wire bundle generation into verification runner
- Add JSON serialization
- Validate against CLAIMS_PROOF_CATALOG

**Priority**: **HIGH** — Required for L1-2 credibility

---

### Category B: Fixture Adapters (2 checks)

**Affected Checks**:
- L2-PAG-001: Pagination Integrity
- L2-PERM-001: Permission Boundary Correctness

**What's Blocked**:

**L2-PAG-001**: Needs to verify that when Jira returns >1000 pages of results, FirstTry handles pagination correctly (no silent truncation). Currently no fixture can generate N=1000 pages.

**L2-PERM-001**: Needs to verify that when Jira returns 403 (permission denied), FirstTry handles it gracefully. Currently API mock doesn't support error injection.

**Required Infrastructure**:

```typescript
// Pagination fixture adapter
class PaginationFixture {
  async generateLargeResultSet(count: number): Promise<Issue[]> {
    // Generate N=1000 synthetic issues
    return Array.from({ length: count }, (_, i) => ({
      key: `SCALE-${i + 1}`,
      summary: `Test issue ${i + 1}`,
      ...
    }));
  }
}

// Error injection adapter
class ErrorInjectionFixture {
  async injectError(status: number, at: Matcher): Promise<void> {
    // When API call matches Matcher, return status code
  }
}
```

**Effort Estimate**: **LOW-MEDIUM** (1-2 days)
- Create PaginationFixture class
- Create ErrorInjectionFixture class
- Wire into test harness
- Add validation logic

**Priority**: **MEDIUM** — L2 is important but L1 is more critical

---

### Category C: Failure Injection Framework (6 checks)

**Affected Checks**:
- L3-FAIL-001: API Failure Handling (429, 5xx, timeout)
- L3-STOR-001: Storage Failure Handling
- L3-PART-001: Partial Write + Quarantine
- L3-REPAIR-001: Repair on Rerun
- L3-CONC-001: Duplicate Invocation Idempotency
- L3-CONC-002: Overlapping Run Interleaving

**What's Blocked**:
These checks need to verify that FirstTry handles failure modes gracefully. But without being able to inject failures deterministically, the checks can only verify the "happy path."

**Required Infrastructure**:

```typescript
// Failure injection framework
interface FailureInjectionConfig {
  failures: {
    apiError?: { status: number; at: TimeOffset };
    storageError?: { code: string; at: TimeOffset };
    partialWrite?: { failAfterWrites: number; at: TimeOffset };
    concurrent?: { duplicateInvocations: number; timing: 'overlap' | 'sequential' };
  };
}

// Usage in test:
const result = await runWithFailureInjection({
  failures: {
    apiError: { status: 429, at: { ms: 100 } },
  },
  expectedBehavior: 'backoff_and_retry',
});
```

**Effort Estimate**: **HIGH** (3-5 days)
- Create failure injection framework
- Add time-based trigger mechanism
- Implement for API, storage, concurrent paths
- Add validation logic
- Ensure deterministic timing

**Priority**: **MEDIUM-HIGH** — L3 is critical for reliability claims

---

### Category D: Manifest Introspection (1 check)

**Affected Checks**:
- L4-POLICY-002: No Scope Drift

**What's Blocked**:
This check needs to verify that the app's actual permissions (in manifest.yml) match what docs claim. Currently the check is marked UNKNOWN because manifest.yml is not present in test environment.

**Required Infrastructure**:

```typescript
// Parse manifest.yml
const manifest = parseYAML(readFileSync('manifest.yml', 'utf-8'));

// Extract declared permissions
const declaredPermissions = {
  scopes: manifest.app.scopes,
  webhooks: manifest.webhooks,
  storage: manifest.storage.quota,
};

// Verify against docs
ensureDocsMatchManifest(CLAIMED_PERMISSIONS, declaredPermissions);
```

**Effort Estimate**: **LOW** (< 1 day)
- Read manifest.yml
- Extract key fields
- Add validation logic
- Update test to compare

**Priority**: **LOW** — L4 has other more critical checks already passing

---

### Category E: Report Artifact Generation (1 check)

**Affected Checks**:
- L5-TRACE-001: Legal/Audit Traceability

**What's Blocked**:
This check needs to verify that the generated OV_REPORT.md artifact includes all required metadata for legal traceability (timestamp, environment, signatures). Currently checks other artifacts but not the report itself.

**Required Infrastructure**:

```typescript
// Generate report with metadata
function generateReportWithMetadata(results: CheckResult[]) {
  return {
    timestamp: ISO8601,
    environment: {
      nodeVersion: process.version,
      npmVersion: npmVersion,
      platform: process.platform,
    },
    signature: computeSignature(results),
    checksum: computeChecksum(reportContent),
    results: results,
  };
}

// Validate traceability
ensureReportHasRequiredMetadata(report);
```

**Effort Estimate**: **MEDIUM** (1-2 days)
- Add metadata fields to report generator
- Compute signature/checksum
- Add validation logic
- Update report template

**Priority**: **LOW-MEDIUM** — Important for audit but not blocking initial release

---

## Implementation Roadmap (Phase 5)

### Week 1: Foundation

**Day 1-2: Evidence Bundle Infrastructure** (Category A)
- [ ] Create EvidenceBundle interface
- [ ] Implement bundle generation
- [ ] Validate against CLAIMS_PROOF_CATALOG
- **Unblocks**: L1-CF-001, L2-ATTR-001 (2 checks)

**Day 3: Manifest Introspection** (Category D)
- [ ] Add manifest.yml to test environment
- [ ] Parse and validate
- **Unblocks**: L4-POLICY-002 (1 check)

**Day 4-5: Fixture Adapters** (Category B)
- [ ] PaginationFixture for L2-PAG-001
- [ ] ErrorInjectionFixture for L2-PERM-001
- **Unblocks**: L2-PAG-001, L2-PERM-001 (2 checks)

### Week 2: Failure Injection Framework

**Day 6-10: Error Injection Infrastructure** (Category C)
- [ ] Time-based trigger mechanism
- [ ] API error injection
- [ ] Storage failure injection
- [ ] Partial write injection
- [ ] Concurrent invocation injection
- [ ] Deterministic interleaving
- **Unblocks**: L3-FAIL-001 through L3-CONC-002 (6 checks)

### Week 3: Report Artifacts & Polish

**Day 11-12: Report Traceability** (Category E)
- [ ] Add metadata to report generator
- [ ] Compute signature/checksum
- [ ] Update OV_REPORT.md template
- **Unblocks**: L5-TRACE-001 (1 check)

**Day 13-15: CI Integration & Testing**
- [ ] Add to CI/CD pipeline
- [ ] Set up divergence alerting
- [ ] End-to-end validation
- [ ] Documentation

---

## Effort Summary

| Category | Checks | Effort | Days | Priority |
|----------|--------|--------|------|----------|
| A: Evidence Bundle | 3 | MEDIUM | 2-3 | HIGH |
| B: Fixture Adapters | 2 | LOW-MEDIUM | 1-2 | MEDIUM |
| C: Failure Injection | 6 | HIGH | 3-5 | MEDIUM-HIGH |
| D: Manifest Parsing | 1 | LOW | <1 | LOW |
| E: Report Artifacts | 1 | MEDIUM | 1-2 | LOW-MEDIUM |
| **TOTAL** | **13** | **HIGH** | **8-13 days** | **Varies** |

**Critical Path**: Evidence Bundle (A) → Failure Injection (C) → Report (E)  
**Estimated Timeline**: 2-3 weeks with full team

---

## Decision: Include as Phase 5 or Defer?

### Argument for Phase 5 (Include Now)

✅ **Pros**:
- Framework already exists; just needs fixtures
- Can complete in 2-3 weeks
- Unblocks 11 additional checks
- Required for marketplace credibility
- Many blockers are "low-hanging fruit"

❌ **Cons**:
- Additional 2-3 weeks of work
- Adds complexity to testing infrastructure
- Requires test harness modifications

### Argument for Deferring (Skip for Now)

✅ **Pros**:
- Phase 4 is already complete with 9 passing checks
- L4 checks (most critical) already mostly passing
- Can release with current infrastructure
- Phase 5 can be planned later

❌ **Cons**:
- 11 checks stuck as UNKNOWN
- Cannot fully verify failure modes
- Incomplete verification story
- May need to re-do work later

---

## Recommendation

**INCLUDE AS PHASE 5 (Sequential After Phase 4)**

Rationale:
- Phase 4 framework is clean and extensible
- Most blockers are well-understood
- Effort is moderate (13 days vs weeks of rework later)
- Marketplace credibility requires comprehensive verification
- Failure injection (Category C) is critical for reliability claims

---

## Related Documents

- [OV_REPORT.md](../atlassian/forge-app/audit/operator_verification/OV_REPORT.md) — Current verification results
- [ov_matrix.json](../atlassian/forge-app/tests/operator_verification/ov_matrix.json) — Check registry
- [PHASE4_COMPLETION_MANIFEST.md](#phase4-completion-manifest) — What Phase 4 delivered

---

## Change Log

| Date | Entry |
|---|---|
| 2025-12-22 | v1.0 - Documented all 11 blockers with effort estimates and roadmap |
