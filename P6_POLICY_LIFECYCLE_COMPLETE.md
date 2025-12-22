# PHASE P6: POLICY LIFECYCLE MANAGEMENT - COMPLETE

## Contract Summary
Enable safe evolution of truth rules and evidence schemas without user action or breaking historical regeneration.

**Key Principles:**
- **Immutability**: Rulesets cannot be overwritten, only new versions registered
- **Pinning**: Evidence and outputs are pinned to the ruleset version used at generation
- **Backward Compatibility**: Historical evidence regenerates with its PINNED ruleset, never current
- **Fail-Closed**: Missing rulesets/migrations raise explicit INVARIANT errors
- **Silent Shadow**: Shadow evaluation never affects runtime outputs without developer action

---

## Implementation Status

### ✅ P6.1: Ruleset Registry (Immutable Registry Pattern)

**File:** [src/policy/ruleset_registry.ts](src/policy/ruleset_registry.ts)

#### Features Implemented:
- ✅ `registerRuleset(definition)` - Register new ruleset (immutable, no overwrites)
- ✅ `getRuleset(version)` - Retrieve registered ruleset definition
- ✅ `getCurrentRulesetVersion()` - Get current active version
- ✅ `initializeDefaultRulesets()` - Initialize default rulesets
- ✅ `RulesetInvariantError` - Explicit error on violations

#### Invariants Enforced:
```typescript
// INVARIANT: Rulesets are immutable
registerRuleset(def1);  // OK
registerRuleset(def1);  // ERROR: ALREADY_EXISTS - INVARIANT VIOLATION

// INVARIANT: Missing ruleset throws explicit error
getRuleset('nonexistent');  // Throws RulesetInvariantError(NOT_FOUND)
```

#### Test Coverage:
- TC-P6-1.0: Registry immutability (no overwrites)
- TC-P6-1.1: Ruleset retrieval
- TC-P6-1.2: Missing ruleset error

---

### ✅ P6.2: Output & Evidence Pinning

**Files:**
- [src/evidence/evidence_model.ts](src/evidence/evidence_model.ts) - `EvidenceBundle.rulesetVersion`
- [src/output/output_contract.ts](src/output/output_contract.ts) - `OutputTruthMetadata.rulesetVersion`

#### Features Implemented:
- ✅ Evidence bundles include `rulesetVersion` (pinned at generation)
- ✅ Output metadata includes `rulesetVersion` (pinned at generation)
- ✅ Pinning prevents silent drift under new rules

#### Pinning Guarantees:
```typescript
// Evidence is pinned to ruleset version at generation
const evidence = {
  rulesetVersion: 'ruleset/v1.0',  // ← Pinned
  outputTruthMetadata: {
    rulesetVersion: 'ruleset/v1.0',  // ← Also pinned
  },
};

// Even if current version is v2.0, evidence still uses v1.0
getCurrentRulesetVersion();  // Returns 'ruleset/v2.0'
// But regeneration uses v1.0 (pinned), not v2.0 (current)
```

#### Test Coverage:
- TC-P6-2.0: Evidence includes pinned version
- TC-P6-2.1: Output includes pinned version
- TC-P6-2.2: Pinning consistency

---

### ✅ P6.3: Regeneration Uses Pinned Ruleset

**File:** [src/evidence/regenerator.ts](src/evidence/regenerator.ts#L131)

#### Features Implemented:
- ✅ `regenerateOutputTruth(evidence)` - Regenerate using PINNED ruleset
- ✅ Explicit error if pinned ruleset missing (fail-closed)
- ✅ Result rulesetVersion matches input (immutable reference)

#### Regeneration Guarantees:
```typescript
// Historical evidence regenerates with PINNED ruleset
const evidence = {
  rulesetVersion: 'ruleset/v1.0',  // ← Pinned at generation
  // ...other fields...
};

// Regeneration:
// 1. Look up PINNED ruleset (v1.0)
// 2. Apply v1.0's computeTruth
// 3. Return output with same rulesetVersion (v1.0)
// 4. NEVER use current ruleset (v2.0)

const regenerated = regenerateOutputTruth(evidence);
expect(regenerated.rulesetVersion).toBe('ruleset/v1.0');  // Same as input

// If pinned ruleset missing:
const missingEvidence = { rulesetVersion: 'ruleset/missing' };
regenerateOutputTruth(missingEvidence);  // ERROR: RulesetInvariantError(NOT_FOUND)
```

#### Test Coverage:
- TC-P6-3.0: Uses pinned ruleset
- TC-P6-3.1: Fails if missing
- TC-P6-3.2: Historical evidence uses own pinned ruleset
- TC-P6-3.3: Result version matches input

---

### ✅ P6.4: Schema Migration (Deterministic, No Prompts)

**File:** [src/policy/schema_migrations.ts](src/policy/schema_migrations.ts)

#### Features Implemented:
- ✅ `applySchemaMigrations(bundle)` - Deterministic migration
- ✅ `needsMigration(schemaVersion)` - Check if migration needed
- ✅ `initializeDefaultMigrations()` - Initialize migrations
- ✅ `SchemaMigrationError` - Explicit error on missing migration

#### Migration Guarantees:
```typescript
// Current schema needs no migration
const evidence = { schemaVersion: EVIDENCE_SCHEMA_VERSION };
needsMigration(evidence.schemaVersion);  // false
applySchemaMigrations(evidence);  // returns unchanged

// Old schema migrates deterministically
const oldEvidence = { schemaVersion: 'v1.0' };
const migrated = applySchemaMigrations(oldEvidence);  // v1.0 → current

// Missing schema errors explicitly
const futureEvidence = { schemaVersion: 'future' };
applySchemaMigrations(futureEvidence);  // ERROR: SchemaMigrationError(MIGRATION_NOT_FOUND)
```

#### Test Coverage:
- TC-P6-4.0: Current version needs no migration
- TC-P6-4.1: Current version unchanged
- TC-P6-4.2: Missing migration fails closed

---

### ✅ P6.5: Compatibility Gates (Fail-Closed)

**File:** [src/policy/compatibility_gates.ts](src/policy/compatibility_gates.ts)

#### Features Implemented:
- ✅ `gatePinnedRulesetExists(version)` - Verify ruleset exists
- ✅ `gateSchemaCanBeMigrated(evidence)` - Verify migration exists
- ✅ `gatePreRegenerationValidation(evidence)` - Full pre-regen check
- ✅ `CompatibilityGateError` - Explicit error on gate violation

#### Gate Guarantees:
```typescript
// Gates enforce invariants before operations
const evidence = { rulesetVersion: 'ruleset/v1.0' };

// Check before regeneration
gatePreRegenerationValidation(evidence);  // OK if both exist
// - Pinned ruleset exists
// - Schema can be migrated

// Gates fail closed
gatePinnedRulesetExists('missing');  // ERROR: CompatibilityGateError

// No silent fallbacks - explicit errors always
try {
  regenerateOutputTruth(badEvidence);
} catch (e) {
  // Always explicit error, never silent degradation
}
```

#### Test Coverage:
- TC-P6-5.0: Gate verifies ruleset exists
- TC-P6-5.1: Gate fails closed on missing ruleset
- TC-P6-5.2: Gate verifies schema migration
- TC-P6-5.3: Pre-regen validation passes for valid evidence
- TC-P6-5.4: Pre-regen validation fails on missing ruleset

---

### ✅ P6.6: Shadow Evaluation (Internal Only)

**File:** [src/policy/shadow_evaluator.ts](src/policy/shadow_evaluator.ts)

#### Features Implemented:
- ✅ `computeShadowEvaluation(bundle)` - Silent side-effect free computation
- ✅ Tenant-scoped internal storage (never crosses tenant boundaries)
- ✅ `shadowEvaluationIndicatesChanges(result)` - Query without side effects
- ✅ `clearShadowEvaluations(tenantKey?)` - Clear evaluations

#### Shadow Evaluation Guarantees:
```typescript
// Shadow evaluation is INTERNAL ONLY
const evidence = { /* original evidence */ };
const originalOutput = evidence.outputTruthMetadata;

// Compute shadow (no side effects)
const shadowResult = computeShadowEvaluation(evidence);

// Original evidence untouched
expect(evidence.outputTruthMetadata).toEqual(originalOutput);  // ✓

// Shadow never affects exports without developer action
// Result is informational only:
// - Shows what WOULD change under current ruleset
// - Tenant-scoped (no cross-tenant access)
// - Automatically expired per P1 policy (90-day TTL)

// Query shadow results without side effects
const wouldChange = shadowEvaluationIndicatesChanges(shadowResult);
// Returns true/false - never modifies state
```

#### Test Coverage:
- TC-P6-6.0: Outputs not changed
- TC-P6-6.1: Tenant-scoped results
- TC-P6-6.2: Status returned without affecting exports
- TC-P6-6.3: Change indication queries

---

### ✅ P6.7: Invariant Enforcement

**Invariants Enforced:**

```typescript
// INVARIANT 1: Rulesets are immutable
registerRuleset(def);
registerRuleset(def);  // ERROR: ALREADY_EXISTS

// INVARIANT 2: Regeneration uses PINNED ruleset
regenerateOutputTruth(evidence);  // Uses evidence.rulesetVersion, NEVER current

// INVARIANT 3: Missing ruleset fails CLOSED
const badEvidence = { rulesetVersion: 'missing' };
regenerateOutputTruth(badEvidence);  // ERROR: RulesetInvariantError(NOT_FOUND)
// Never silent fallback to current ruleset

// INVARIANT 4: Missing migration fails CLOSED
const futureEvidence = { schemaVersion: 'future' };
applySchemaMigrations(futureEvidence);  // ERROR: SchemaMigrationError
// Never silent skip or partial migration

// INVARIANT 5: Shadow never changes runtime behavior
computeShadowEvaluation(evidence);
// evidence.outputTruthMetadata unchanged
// exports unchanged
// runtime unaffected
```

#### Test Coverage:
- TC-P6-7.0: Missing ruleset error
- TC-P6-7.1: Missing migration error
- TC-P6-7.2: Overwriting ruleset error

---

### ✅ P6.8: Backward Compatibility

**Compatibility Guarantees:**

```typescript
// Historical evidence can ALWAYS be regenerated
const historicalEvidence = {
  rulesetVersion: 'ruleset/v1.0',
  generatedAtISO: '2024-01-01T00:00:00Z',  // 1 year ago
  // ...
};

// Even if current version is v5.0, historical evidence uses v1.0
const regenerated = regenerateOutputTruth(historicalEvidence);
expect(regenerated.rulesetVersion).toBe('ruleset/v1.0');  // ✓

// NO silent fallback
const missingHistorical = { rulesetVersion: 'ruleset/retired' };
regenerateOutputTruth(missingHistorical);  // ERROR: explicit, not silent
// Never switches to current ruleset
// Never skips regeneration
// Never partially regenerates
```

#### Test Coverage:
- TC-P6-8.0: Historical evidence regenerates with pinned ruleset
- TC-P6-8.1: No silent fallback on missing ruleset

---

## Type Definitions

### RulesetDefinition
```typescript
interface RulesetDefinition {
  version: RulesetVersion;
  description: string;
  createdAtISO: string;
  
  // Deterministic truth computation
  computeTruth: (inputs: RulesetComputeInputs) => OutputTruthMetadata;
  
  // Optional schema migration
  schemaMigration?: (bundle: EvidenceBundle) => EvidenceBundle;
}
```

### EvidenceBundle (P6 Extensions)
```typescript
interface EvidenceBundle {
  // ... existing fields ...
  
  // PINNED at generation time
  rulesetVersion: RulesetVersion;
  schemaVersion: string;
}
```

### OutputTruthMetadata (P6 Extensions)
```typescript
interface OutputTruthMetadata {
  // ... existing fields ...
  
  // PINNED at generation time
  rulesetVersion: RulesetVersion;
}
```

---

## Failure Modes & Error Handling

### Fail-Closed Pattern
```typescript
try {
  gatePreRegenerationValidation(evidence);
  // If this succeeds, ALL invariants are satisfied
  const result = regenerateOutputTruth(evidence);
} catch (error) {
  if (error instanceof CompatibilityGateError) {
    // Gate violation - cannot proceed safely
    // log error, reject operation, alert operator
  } else if (error instanceof RulesetInvariantError) {
    // Ruleset missing/invalid
    // log error, reject operation, alert operator
  } else if (error instanceof SchemaMigrationError) {
    // Migration missing/failed
    // log error, reject operation, alert operator
  }
}
```

### No Silent Failures
- ✗ Never silent fallback to current ruleset
- ✗ Never skip regeneration on error
- ✗ Never partially migrate schema
- ✓ Always explicit errors
- ✓ Always fail closed
- ✓ Always alertable

---

## Key Design Decisions

### Why Pinning?
- Historical evidence must regenerate consistently
- Prevents silent drift when rules change
- Enables safe evolution of rulesets
- Clear audit trail of which ruleset generated each output

### Why Immutable Rulesets?
- Prevents accidental overwrites that would break historical regeneration
- Ensures determinism: same version = same computation
- Simplifies auditing and compliance

### Why Fail-Closed?
- Missing ruleset = potential data corruption risk
- Silent fallback would hide bugs
- Explicit errors force investigation and fixes
- Better than partial degradation

### Why Shadow Evaluation?
- Shows impact of rule changes before deployment
- Tenants don't see changes unless we explicitly enable them
- No runtime overhead (internal only)
- Informs rule versioning strategy

---

## Test Suite Summary

**File:** [tests/p6_policy_lifecycle.test.ts](tests/p6_policy_lifecycle.test.ts)

**Total Tests:** 27/27 ✅ PASSING

**Categories:**
- Ruleset Registry: 3 tests
- Output Pinning: 3 tests
- Regeneration: 4 tests
- Schema Migration: 3 tests
- Compatibility Gates: 5 tests
- Shadow Evaluation: 4 tests
- Invariant Enforcement: 3 tests
- Backward Compatibility: 2 tests

**Test Execution:**
```bash
npx vitest run tests/p6_policy_lifecycle.test.ts
# ✓ 27 passed (27 total)
```

---

## Running the Tests

```bash
# Run P6 test suite
cd /workspaces/Firstry/atlassian/forge-app
npx vitest run tests/p6_policy_lifecycle.test.ts

# Watch mode
npx vitest watch tests/p6_policy_lifecycle.test.ts

# With coverage
npx vitest run --coverage tests/p6_policy_lifecycle.test.ts
```

---

## Integration Checklist

- ✅ Ruleset registry implemented (immutable)
- ✅ Output pinning implemented (rulesetVersion)
- ✅ Regeneration uses pinned ruleset
- ✅ Schema migrations deterministic
- ✅ Compatibility gates fail-closed
- ✅ Shadow evaluation internal-only
- ✅ Invariants enforced with explicit errors
- ✅ Backward compatibility guaranteed
- ✅ 27/27 tests passing
- ✅ Type definitions complete
- ✅ Error handling fail-closed

---

## Next Steps (Future Phases)

### Future Enhancement: Persistent Ruleset Registry
- Extend beyond in-memory Map
- Add Forge storage persistence
- Enable ruleset versioning UI

### Future Enhancement: Shadow Evaluation UI
- Optional UI to show what would change
- Operator approval before deployment
- Automated rollback on negative delta

### Future Enhancement: Rule Versioning Strategy
- Define versioning conventions (semver, custom)
- Document version compatibility
- Automate compatibility checking

---

## References

- [P1: Policy Retention & Cleanup](P1_EVIDENCE_RETENTION_COMPLETE.md) - Ruleset TTL policy
- [P2: Output Truth Metadata](P2_OUTPUT_TRUTH_COMPLETE.md) - Output generation
- [P4: Evidence & Regeneration](P4_EVIDENCE_AND_REGENERATION_COMPLETE.md) - Regeneration engine
- [P6 Contract](P6_CONTRACT.md) - Full specification

---

**Status:** ✅ COMPLETE
**Date:** 2025-01-20
**All Invariants:** ✅ ENFORCED
**All Tests:** ✅ PASSING (27/27)
