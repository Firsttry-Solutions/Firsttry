# PHASE P4: EVIDENCE MODEL & ARCHITECTURE

**Date:** December 21, 2025  
**Status:** Complete  
**Lock:** Non-negotiable contracts enforced

---

## 1. Overview

Phase P4 implements forensic-grade evidence bundling and regeneration guarantees. Every output is now bound to immutable, cryptographically-verified evidence that can be:

- Explained after the fact
- Regenerated deterministically
- Verified as untampered
- Defended in audits and procurement

### Core Principle

**Evidence is not logs.** Evidence is the minimum complete set of facts required to explain an output and prove its integrity.

---

## 2. Evidence Bundle (Canonical Structure)

An **EvidenceBundle** contains:

### Identity & Isolation
- `evidenceId` (UUID): Unique identifier
- `schemaVersion` (literal `"1.0.0"`): Locked at creation
- `tenantKey`: Tenant identifier (all storage keys scoped)
- `cloudId`: Jira Cloud identifier

### Temporal Context
- `createdAtISO`: When evidence was created (informational)
- `generatedAtISO`: When output was actually generated
- `rulesetVersion`: Which rule version applied

### Input Binding
- `snapshotRefs`: Array of snapshots used
  - Each ref includes ID, hash, type, and capture time
  - Sorted by ID for determinism
- `normalizedInputs`: Canonical form of all inputs
  - Tenant key, cloud ID
  - Report trigger type (MANUAL / AUTO_12H / AUTO_24H)
  - Observation window
  - Ruleset version used
  - Computation timestamp

### Output Binding
- `outputTruthMetadata`: Complete P2 truth metadata
  - Validity status
  - Confidence level
  - Completeness percentage
  - Drift status
  - Reasons and warnings
  - Missing data list

### Environment Context
- `driftStatusAtGeneration`: Drift state when computed
- `environmentFacts`: Schema versions and feature flags
  - Output schema version
  - Truth ruleset version
  - Evidence schema version
  - Feature enablement flags

### Explicit Disclosures
- `missingData`: List of intentionally-excluded data
  - Dataset name
  - Reason code
  - Human-readable description

---

## 3. Evidence Hashing (Deterministic)

### Canonicalization Rules

1. **Fixed field order** (defined in code)
2. **Alphabetically sorted keys** (within each object)
3. **Sorted arrays** (by primary key for determinism)
4. **No whitespace** (compact JSON)
5. **Stable numbers** (standard JSON representation)
6. **Null values preserved** (as JSON null)

### Hash Computation

```
canonical_json = canonicalizeEvidenceBundle(evidence)
hash = SHA-256(canonical_json, utf8)
// Result: lowercase 64-character hex string
```

### Invariant

**Identical semantic evidence always produces identical hash.**

Any modification—no matter how small—changes the hash. This enables:
- Integrity verification (hash verification detects tampering)
- Reproducibility testing (same inputs → same hash)
- Audit trails (mismatch records invariant violation)

---

## 4. Evidence Store (Immutable, Append-Only)

### Storage Keys

```
p4:evidence:{tenant_key}:{evidence_id}  → StoredEvidence (bundle + hash)
p4:evidence_index:{tenant_key}:0        → List of evidence IDs
```

### Operations

#### `persistEvidence(bundle, retentionSeconds?)`

- Computes hash
- Checks immutability (fails if evidence already exists)
- Stores atomically (bundle + hash together, or not at all)
- Adds TTL if specified (90 days default)
- Returns evidenceId + hash

**Throws error if:**
- Evidence already exists with same ID
- Persistence fails (never silent)

#### `loadEvidence(evidenceId)`

- Returns StoredEvidence (bundle + hash + metadata)
- Returns null if not found
- Validates structure (throws if corrupted)

#### `verifyEvidenceIntegrity(evidenceId)`

- Recomputes hash
- Compares with stored hash
- Reports tampering detection

### Immutability Guarantee

Once persisted, evidence cannot be:
- Updated
- Deleted (except via retention policy)
- Modified

Attempts to overwrite raise INVARIANT error.

### Tenant Isolation

- All keys prefixed by `tenantKey`
- Storage layer enforces isolation
- Cross-tenant access requires explicit tenant parameter (no default fallback)

### Retention Control

- TTL set at persistence time (default 90 days)
- Forge storage layer auto-deletes expired records
- Audit trail records deletion reason

---

## 5. Deterministic Regeneration

### Engine: `regenerateOutputTruth(bundle)`

Given an EvidenceBundle:
1. Extracts normalized inputs
2. Uses rulesetVersion from bundle
3. Recomputes OutputTruthMetadata
4. Returns result (does not call live systems)

### Purity Contract

This is a **pure function**:
- **Deterministic**: Same evidence → same output (always)
- **Isolated**: Uses only evidence data (no external calls)
- **Testable**: Can be called repeatedly, no state changes
- **Reproducible**: Same algorithm across systems and time

### Comparison: Original vs. Regenerated

```typescript
const original = bundle.outputTruthMetadata;
const regenerated = regenerateOutputTruth(bundle);

// Compare critical fields
if (original.completenessPercent !== regenerated.completenessPercent) {
  // INVARIANT VIOLATION
  throw new RegenerationInvariantError(...);
}
```

---

## 6. Regeneration Verification (Invariant Enforcement)

### Function: `verifyRegeneration(tenantKey, cloudId, evidenceId)`

1. Loads evidence from store
2. Calls regenerateOutputTruth()
3. Compares original vs. regenerated truth
4. Records result in audit trail

### Outcomes

**Match (Verified ✅)**
- Audit event: SUCCESS
- Result: `verified = true`
- Export: Allowed

**Mismatch (Invariant Violation ❌)**
- Audit event: FAILURE (with details)
- Result: `verified = false`
- Throws: `RegenerationInvariantError`
- Export: Requires watermarking/acknowledgment

### No Silent Failures

Mismatches are NEVER hidden:
- Exception raised
- Audit event recorded
- Determinism metric marked FAIL
- Output marked INVALID

---

## 7. Evidence Pack Export

### Structure

```typescript
{
  evidence: EvidenceBundle;
  evidenceHash: string;
  regenerationVerification: VerificationResult;
  missingDataList: MissingDataDisclosure[];
  exportedAtISO: string;
  requiresAcknowledgment: boolean;
  watermarkText?: string;
  acknowledgmentReason?: string;
}
```

### Export Formats

**JSON Export** (`evidence_(id).json`)
- Full structured data
- Machine-readable
- For systems integration and archival

**Markdown Export** (`evidence_(id).md`)
- Human-readable report
- Includes verification status
- Shows watermarks if unverified
- Lists all missing data
- Suitable for audit/procurement responses

### Watermarking Rules

**Applied if:**
- Regeneration verification fails
- Evidence integrity check fails
- Schema version unsupported

**Watermark includes:**
- Reason for degradation
- Invariant violation code
- Explicit acknowledgment requirement

---

## 8. Missing Data Preservation

### Design

Missing data is captured at generation time:

```typescript
missingData: [
  {
    datasetName: "automation_rules",
    reasonCode: "MISSING_PERMISSION",
    description: "User lacks Administer automation rules permission"
  }
]
```

### Through Regeneration

When regenerating, missing data is preserved exactly:
- Lists are stored in evidence
- Not re-discovered from live systems
- Explains why outputs are incomplete
- Enables historical accuracy

### Example

If a dataset was missing when evidence was generated, the regenerated truth will show the same missing data—not current availability.

---

## 9. Tenant Isolation

### Enforcement

Every evidence store is tenant-scoped:

```typescript
const store = getEvidenceStore(tenantKey);
// Store operations use tenantKey in all keys
```

### Keys Always Include Tenant

```
p4:evidence:tenant-a:evidence-001    ← Tenant A only
p4:evidence:tenant-b:evidence-001    ← Tenant B only
```

### No Cross-Tenant Access

- No default fallback to other tenants
- Storage layer enforces prefix matching
- Audit trail records any unauthorized attempts

---

## 10. Retention & Lifecycle

### Default Retention

- Max age: 90 days
- Configurable per evidence
- TTL set at persistence time

### Deletion

Evidence is deleted by Forge storage layer (automatic TTL expiry):
1. Record becomes inaccessible
2. Audit event records deletion
3. No manual delete operations allowed

### Why 90 Days?

- Aligns with P1/P2 retention policy
- Gives time for audit and compliance
- Evidence can be exported and archived before expiry

---

## 11. Auditing & Compliance

### Events Recorded

For each evidence operation:
- **PERSIST**: Success/failure, tenant, size
- **LOAD**: Access, tenant, result
- **VERIFY**: Success/mismatch, tenant, invariant code
- **EXPORT**: Format, tenant, acknowledgment required
- **INVARIANT_VIOLATION**: Detailed failure info

### Query Evidence Audit Trail

```typescript
auditStore.listEventsByType('p4_regeneration_verification')
  .filter(e => e.invariantViolation === 'HASH_MISMATCH')
```

---

## 12. Testing & Validation

### Test Suite (41 Tests)

#### Evidence Hash Determinism (5 tests)
- Same evidence → identical hash
- Modified evidence → different hash
- Canonicalization determinism
- Helper function correctness
- Hash format validation

#### Evidence Immutability (5 tests)
- Append-only enforcement
- Overwrite rejection
- Hash verification detects tampering
- Tenant isolation
- Missing data preservation

#### Regeneration Determinism (4 tests)
- Regenerated truth matches original
- Mismatch detection
- Pure function verification
- Missing data through regeneration

#### Invariant Enforcement (3 tests)
- Explicit error raising
- Reason code tracking
- Hash mismatch detection

#### Evidence Pack Export (4 tests)
- Complete field presence
- Serializability
- Watermarking on unverified evidence
- Missing data list completeness

#### Integration & Compliance (4 tests)
- Evidence binding to outputs
- Tenant isolation
- Retention policy compatibility
- Schema version lock

#### P1-P3 Compatibility (4 tests)
- OutputTruthMetadata unchanged
- Snapshot structure unchanged
- P2 output contract compatibility
- P3 determinism proof validity

### Build-Blocking Rules

- All 41 tests must pass
- Any test failure blocks release
- No test skips or quarantines
- No allow-fail mechanisms

---

## 13. Invariant Violations & Recovery

### Violation Codes

- `HASH_MISMATCH`: Regenerated truth doesn't match stored
- `MISSING_EVIDENCE`: Evidence ID not found
- `SCHEMA_VERSION_UNSUPPORTED`: Schema version incompatible

### When Detected

1. Exception raised (RegenerationInvariantError)
2. Audit event recorded with full details
3. Output marked INVALID
4. Export requires watermark + acknowledgment

### No Recovery

Once detected, invariant violations are:
- Never silently ignored
- Never auto-corrected
- Require investigation and explicit acknowledgment

---

## 14. Example: Complete Flow

### 1. Output Generation

```typescript
// Output generation creates evidence
const evidence: EvidenceBundle = {
  evidenceId: generateUUID(),
  tenantKey: "tenant-123",
  snapshotRefs: [snapshot],
  outputTruthMetadata: computeOutputTruthMetadata({...}),
  // ... other fields
};

// Persist evidence BEFORE output is finalized
const store = getEvidenceStore("tenant-123");
const {evidenceId, hash} = await store.persistEvidence(evidence);

// Output references evidence
const output = {
  outputId: generateUUID(),
  evidenceId,        // Link to evidence
  evidenceHash: hash, // Bind to hash
  // ... other fields
};
```

### 2. Export Request

```typescript
// User requests export
const pack = await generateEvidencePack("tenant-123", "cloud-123", evidenceId);

// If unverified, requires watermark
if (pack.requiresAcknowledgment) {
  return {
    watermark: pack.watermarkText,
    requiresAcknowledgment: true,
    message: pack.acknowledgmentReason
  };
}

// User acknowledges degradation
// Export proceeds with watermark in output
```

### 3. Audit Verification

```typescript
// Later, during audit
const result = await verifyRegeneration("tenant-123", "cloud-123", evidenceId);

if (!result.verified) {
  // INVARIANT VIOLATION DETECTED
  // Audit trail shows exactly what mismatched
  console.error(result.mismatchDetails);
}
```

---

## 15. Non-Goals & Constraints

### What P4 Does NOT Do

- No live system calls during regeneration
- No recommendations or predictions
- No modifications to P1–P3
- No optional enforcement (all-or-nothing)
- No bypasses or feature flags

### What P4 Guarantees

- Every output is bound to evidence
- Evidence is immutable and verifiable
- Regeneration is deterministic
- Mismatches are explicit (never silent)
- Tenant data is isolated
- Retention is enforced

---

## 16. Glossary

| Term | Definition |
|------|-----------|
| **Evidence** | Minimum set of facts to explain and regenerate an output |
| **Evidence Bundle** | Canonical structure containing evidence (EvidenceBundle type) |
| **Evidence Hash** | SHA-256 of canonical evidence (immutable binding) |
| **Regeneration** | Recomputing output truth from stored evidence |
| **Invariant** | Non-negotiable rule (violations raise explicit errors) |
| **Determinism** | Same evidence always produces same regenerated truth |
| **Tenant Isolation** | Evidence scoped by tenantKey (no cross-tenant access) |
| **Watermark** | Visual/textual marker on unverified outputs |

---

## Conclusion

Phase P4 completes the forensic-grade evidence chain:
- P1 captures facts
- P2 computes truth
- P3 proves determinism
- **P4 binds everything together with immutable, verifiable evidence**

Every output is now explainable, reproducible, and defensible.
