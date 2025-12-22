# PHASE P4: REGENERATION GUARANTEES & INVARIANTS

**Date:** December 21, 2025  
**Status:** Complete  
**Lock:** Non-negotiable contracts

---

## 1. The Regeneration Guarantee

### Core Contract

Given:
- An EvidenceBundle
- The same rulesetVersion
- The same regeneration engine version

**The system MUST recompute OutputTruthMetadata identically to the original, or raise an explicit INVARIANT error.**

There is no middle ground. No silent mismatches. No weak warnings.

---

## 2. Why Regeneration Matters

### Problem It Solves

When an output is created:
- Inputs are used
- Rules are applied
- Truth is computed
- Output is generated

Months later, an auditor asks: **"Can you prove this output was correct at the time?"**

**Regeneration proves it.**

By feeding the same inputs through the same rules, we can:
1. Reproduce the exact same truth
2. Detect if anything was modified
3. Explain why the output was what it was
4. Defend it in procurement and disputes

---

## 3. Determinism is the Key

### What Makes Regeneration Possible

Regeneration works ONLY if truth computation is **deterministic**:

```
Same inputs + same ruleset + same algorithm = same output (always)
```

This means:
- **No randomness** (e.g., no random sampling)
- **No timestamps in logic** (timestamps informational only)
- **No external state** (no "ask the API at runtime")
- **No system time** (use stored times from evidence)
- **No feature flags** (use version from evidence)

### P3 Proves Determinism

Phase P3 already proves determinism with 10+ tests:
- Same metrics run → identical hash
- Different metrics → different hash
- Hash is stable across time and systems
- Hash changes only when data changes

**P4 builds on this proof** to ensure regeneration is deterministic.

---

## 4. The Regeneration Algorithm

### Input: EvidenceBundle

Contains:
- Snapshot references (ID, hash, capture time)
- Normalized inputs (tenant, trigger type, window size)
- Output truth metadata (completeness, confidence, validity)
- Ruleset version
- Missing data list

### Process: `regenerateOutputTruth(bundle)`

```
1. Extract normalized inputs from bundle
2. Load ruleset version from bundle (not current)
3. Recompute completeness from missing data
4. Recompute confidence from completeness
5. Recompute validity from confidence
6. Recompute reasons and warnings
7. Return OutputTruthMetadata
```

### Output: OutputTruthMetadata

Same structure as P2:
- `validityStatus` ('VALID', 'INVALID', 'DEGRADED', 'EXPIRED')
- `confidenceLevel` ('HIGH', 'MEDIUM', 'LOW', 'NONE')
- `completenessPercent` (0-100)
- `reasons` (list of why validity is not VALID)
- `warnings` (additional context)
- `missingData` (list of excluded datasets)
- `driftStatus` ('stable', 'detected', 'unknown')

---

## 5. Verification: The Invariant Check

### Function: `verifyRegeneration(tenantKey, cloudId, evidenceId)`

1. **Load evidence** from store
2. **Regenerate truth** using `regenerateOutputTruth()`
3. **Compare** original vs. regenerated field-by-field
4. **If mismatch:** Raise `RegenerationInvariantError` (never silent)
5. **If match:** Return verification result (verified = true)

### Field Comparison

Compare these critical fields:

```typescript
if (original.completenessPercent !== regenerated.completenessPercent) {
  → INVARIANT VIOLATION
}
if (original.confidenceLevel !== regenerated.confidenceLevel) {
  → INVARIANT VIOLATION
}
if (original.validityStatus !== regenerated.validityStatus) {
  → INVARIANT VIOLATION
}
if (original.reasons.sort().join() !== regenerated.reasons.sort().join()) {
  → INVARIANT VIOLATION
}
```

---

## 6. Invariant Violations: Never Silent

### When Detected

A mismatch is detected if:
- Completeness changed
- Confidence changed
- Validity changed
- Reasons changed
- Warnings changed

### What Happens

**Immediate (Synchronous):**
1. `RegenerationInvariantError` raised
2. Error code assigned (HASH_MISMATCH, MISSING_EVIDENCE, etc.)
3. Call site must catch and handle

**Audit Trail (Async):**
1. Audit event recorded
2. Full details logged (original vs. regenerated truth)
3. Invariant violation flag set
4. Output marked INVALID

**Export-Time (When Accessed):**
1. Evidence pack requires watermark
2. Export requires explicit acknowledgment
3. Output clearly marked as unverified

### Example

```typescript
try {
  const result = await verifyRegeneration(tenant, cloud, evidenceId);
  // result.verified === true
  // Export proceeds normally
} catch (error: RegenerationInvariantError) {
  // result.verified === false
  // error.reason === 'HASH_MISMATCH' (or other code)
  // Audit event recorded
  // Output marked INVALID
  // Export requires acknowledgment
}
```

---

## 7. Why Mismatches Happen (Root Causes)

### Legitimate Reasons (Should Not Happen in P4)

1. **Evidence corruption** → Use hash verification to detect
2. **Logic bug in regeneration** → Caught by tests
3. **Missing data** → Regeneration should handle gracefully
4. **Schema version mismatch** → Check schema version before regenerating

### Illegitimate Reasons (Invariant Violations)

These indicate problems requiring investigation:

1. **Evidence was tampered with** (hash mismatch)
   - Use evidence hash to detect
   - Audit trail captures when

2. **Ruleset changed** (but evidence locked to old version)
   - Regeneration uses stored rulesetVersion (expected behavior)
   - Evidence records what version was used

3. **Time-dependent logic** (timestamps in rules)
   - Rules should not use current time
   - Should use timestamps from evidence
   - If mismatches occur, indicates hidden time dependency

4. **External state** (regeneration called external system)
   - Regeneration should be pure (no Jira calls, no API calls)
   - If mismatch, indicates code modified truth computation

---

## 8. Testing Regeneration

### Unit Tests

```typescript
// Same evidence produces same regenerated truth
const verification = verifyRegeneratedTruth(evidence);
expect(verification.matches).toBe(true);

// Different evidence produces different regenerated truth
const modified = {...evidence, completenessPercent: 50};
const result = verifyRegeneratedTruth(modified);
expect(result.matches).toBe(false);
expect(result.differences?.length).toBeGreaterThan(0);
```

### Integration Tests

```typescript
// Load real evidence from store
const stored = await store.loadEvidence(evidenceId);

// Regenerate
const result = await verifyRegeneration(tenant, cloud, evidenceId);

// Must match
expect(result.verified).toBe(true);
expect(result.matchesStored).toBe(true);
```

### Property Tests

For all possible evidence bundles:
- Determinism: regenerate twice, hashes identical
- Consistency: different modifications change output differently
- Completeness: all fields compared
- Isolation: no external calls made

---

## 9. Guarantees by Use Case

### Use Case 1: Export Verification

**Scenario:** User requests to export an output

**Guarantee:**
- Evidence is loaded
- Regeneration is verified
- If mismatch → Watermark applied, acknowledgment required
- If verified → Export proceeds normally

**Example:**

```typescript
const pack = await generateEvidencePack(tenant, cloud, evidenceId);

if (pack.regenerationVerification.verified) {
  // Export clean JSON/PDF
  return exportJSON(pack);
} else {
  // Require acknowledgment
  return {
    watermark: "⚠️ VERIFICATION FAILED",
    requiresAcknowledgment: true,
    reason: pack.regenerationVerification.mismatchDetails
  };
}
```

### Use Case 2: Audit Trail Inspection

**Scenario:** Auditor asks "Was this output correct?"

**Guarantee:**
- Evidence proves what was stored
- Regeneration proves what should have been computed
- If match → Output was correct at the time
- If mismatch → Invariant violation recorded in audit trail

**Example:**

```typescript
// Auditor retrieves evidence pack
const pack = await auditStore.getEvidencePackForOutput(outputId);

// Check verification result
if (pack.regenerationVerification.verified) {
  console.log("✅ Output verified as correct");
} else {
  console.log("❌ Invariant violation detected:");
  console.log(pack.regenerationVerification.mismatchDetails);
  console.log("Audit event:", pack.regenerationVerification.auditEventId);
}
```

### Use Case 3: Procurement Response

**Scenario:** Customer asks "Prove this analysis is correct"

**Guarantee:**
- Evidence pack is exportable
- Includes full regeneration verification
- Shows all missing data
- If unverified, watermark is explicit

**Example:**

```typescript
// Generate markdown export for customer
const markdown = await exportEvidencePackAsMarkdown(tenant, cloud, evidenceId);

// Response includes:
// - Verification status (✅ or ⚠️)
// - What was included
// - What was missing (with reasons)
// - Hash verification proof
// - Audit trail reference
```

---

## 10. No Bypass Mechanisms

### What is NOT Allowed

- Feature flags to disable regeneration verification
- Weak warnings instead of errors
- Silent mismatches
- Auto-correction of mismatches
- Conditional verification (always verify)
- Optional evidence (all outputs bind to evidence)

### What IS Guaranteed

- Verification happens ALWAYS
- Mismatches raise explicit errors
- All mismatches are recorded
- Watermarks are mandatory for unverified outputs
- Acknowledgments are required for exports

---

## 11. Failure Scenarios

### Scenario 1: Evidence Not Found

```
Error: Evidence not found
Code: MISSING_EVIDENCE
Action: Output cannot be verified
Result: Export blocked (watermark applied, requires explanation)
```

### Scenario 2: Hash Mismatch (Tampering Detected)

```
Error: Hash mismatch - evidence may be corrupted
Code: HASH_MISMATCH
Action: Regeneration fails, invariant violation recorded
Result: Output marked INVALID, watermark applied, audit event recorded
```

### Scenario 3: Truth Mismatch (Logic Inconsistency)

```
Error: Regenerated truth differs from stored truth
Code: INVARIANT_VIOLATION
Details: completenessPercent 85 vs 75, confidenceLevel HIGH vs MEDIUM
Action: Output marked invalid, watermark applied
Result: Audit trail shows exact differences
```

### Scenario 4: Schema Version Unsupported

```
Error: Evidence schema version "2.0" not supported (current: "1.0.0")
Code: SCHEMA_VERSION_UNSUPPORTED
Action: Cannot verify with current engine
Result: Requires migration tool or expert review
```

---

## 12. Recovery & Remediation

### If Invariant Violation Occurs

1. **DO NOT ignore it**
2. **DO investigate** the root cause
3. **DO record** findings in audit trail
4. **DO watermark** affected outputs
5. **DO require acknowledgments** for any exports

### Root Cause Investigation Checklist

- [ ] Evidence integrity: Is hash correct?
- [ ] Logic changes: Did truth computation rules change?
- [ ] Time dependencies: Is there hidden timestamp logic?
- [ ] External calls: Did regeneration call live systems?
- [ ] Data corruption: Was evidence modified outside storage layer?
- [ ] Schema mismatch: Was evidence upgraded to newer schema?

### Once Root Cause Found

- **If logic bug:** Fix code, re-run tests, verify determinism
- **If time dependency:** Remove timestamp logic, use evidence times
- **If external call:** Remove live system calls, use only evidence data
- **If data corruption:** Restore from backup, add integrity checks
- **If expected (schema change):** Document version migration path

---

## 13. Monitoring & Alerting

### Metrics to Track

```
regeneration_verification_success_rate        (target: 100%)
regeneration_verification_fail_count          (target: 0)
invariant_violation_occurrences               (target: 0)
hash_mismatch_detections                      (target: 0)
evidence_export_watermark_required_percent    (target: 0%)
```

### Alerts to Configure

- Regeneration failure (invariant violation)
- Hash mismatch detected (evidence tampering)
- First export with watermark (output unverified)
- Evidence not found (orphaned output)
- Schema version unsupported (old evidence)

---

## 14. Performance Implications

### Regeneration Cost

- Load evidence: <100ms
- Deserialize: <10ms
- Recompute truth: <50ms
- Verify fields: <10ms
- Record audit: <100ms
- **Total:** <300ms per verification

### Optimization

- Regeneration happens ONCE on export (not on every read)
- Results cached in evidence pack
- No re-verification needed if pack already computed

---

## 15. Security Implications

### What Regeneration Proves

✅ Evidence has not been tampered (hash binding)  
✅ Logic is deterministic (regeneration works)  
✅ Output was correct at the time (regeneration matches)  
✅ No external state was used (pure function)  

### What Regeneration Does NOT Prove

❌ Output is still correct today (time may have changed data)  
❌ Inputs were accurate (only that truth followed from inputs)  
❌ Rules are best-practice (only that rules were applied)  
❌ No Jira bugs exist (only that snapshot was accurate)  

---

## 16. Edge Cases

### Missing Data in Evidence

```typescript
// If evidence.missingData includes a dataset
// Regeneration produces same missing data
// No attempt to fill it from live system
```

### Empty Snapshots

```typescript
// If snapshot had 0 projects/fields
// Regeneration produces same 0-completeness truth
// No fallback to live system to "get current state"
```

### Very Old Evidence (Before Schema Changed)

```typescript
// If evidence schema version differs from current
// Check version before regenerating
// Either: migrate schema, or reject with version error
```

### Time-Zone Differences

```typescript
// All timestamps use ISO 8601 UTC
// Canonical form normalizes time representations
// Hash unaffected by time zone conversions
```

---

## 17. Conclusion: The Invariant

### Non-Negotiable

Every output bound to evidence MUST satisfy:

```
∀ evidence: regenerateOutputTruth(evidence) = stored truth
           OR exception is raised (never silent)
```

This is the basis of forensic-grade guarantees. Once this invariant is proven, auditors can trust that:

- Outputs are explainable
- Explanations are reproducible
- Proofs are verifiable
- Evidence is immutable

---

## 18. Quick Reference

| Question | Answer |
|----------|--------|
| What is regeneration? | Recomputing output truth from stored evidence |
| Why do it? | Proves outputs were correct and explainable |
| When does it happen? | On evidence verification (e.g., export) |
| What if it fails? | Invariant error raised, output marked invalid |
| Can failures be ignored? | No. Always explicit, always audited |
| Can I disable it? | No. Mandatory for all outputs |
| What about old evidence? | Check schema version before regenerating |
| How long does it take? | ~300ms per verification (acceptable) |

---

**Status:** Complete and Production-Ready  
**Lock:** These guarantees are non-negotiable.
