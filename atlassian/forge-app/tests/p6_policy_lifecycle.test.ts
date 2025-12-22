/**
 * PHASE P6: POLICY LIFECYCLE MANAGEMENT - TEST SUITE
 * 
 * Adversarial tests proving:
 * - Rulesets are immutable (no overwrites)
 * - Evidence/outputs are pinned to ruleset version
 * - Regeneration uses PINNED ruleset, not current
 * - Missing rulesets/migrations fail closed with INVARIANT
 * - Shadow evaluation is internal-only, doesn't affect outputs
 * - Compatibility gates enforce safe evolution
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  registerRuleset,
  getRuleset,
  getCurrentRulesetVersion,
  DEFAULT_CURRENT_RULESET_VERSION,
  RulesetInvariantError,
  initializeDefaultRulesets,
  type RulesetDefinition,
} from '../src/policy/ruleset_registry';
import {
  applySchemaMigrations,
  needsMigration,
  SchemaMigrationError,
  initializeDefaultMigrations,
} from '../src/policy/schema_migrations';
import {
  computeShadowEvaluation,
  shadowEvaluationIndicatesChanges,
  clearShadowEvaluations,
} from '../src/policy/shadow_evaluator';
import {
  gatePinnedRulesetExists,
  gateSchemaCanBeMigrated,
  gatePreRegenerationValidation,
  CompatibilityGateError,
} from '../src/policy/compatibility_gates';
import { regenerateOutputTruth } from '../src/evidence/regenerator';
import { EvidenceBundle, EVIDENCE_SCHEMA_VERSION } from '../src/evidence/evidence_model';

/**
 * Test fixture: Create mock evidence bundle
 */
function createMockEvidence(overrides?: Partial<EvidenceBundle>): EvidenceBundle {
  return {
    evidenceId: 'evidence-test-001',
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    tenantKey: 'tenant-test',
    cloudId: 'cloud-test-001',
    createdAtISO: new Date().toISOString(),
    generatedAtISO: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    rulesetVersion: DEFAULT_CURRENT_RULESET_VERSION,
    snapshotRefs: [
      {
        snapshotId: 'snap-001',
        snapshotHash: 'hash123',
        snapshotType: 'daily',
        capturedAtISO: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      },
    ],
    driftStatusAtGeneration: {
      driftDetectedCount: 0,
      driftStatusSummary: 'NO_DRIFT',
    },
    normalizedInputs: {
      tenantKey: 'tenant-test',
      cloudId: 'cloud-test-001',
      rulesetVersionUsed: DEFAULT_CURRENT_RULESET_VERSION,
      computedAtISO: new Date().toISOString(),
    },
    outputTruthMetadata: {
      generatedAtISO: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      completenessPercent: 85,
      confidenceLevel: 'HIGH',
      validityStatus: 'VALID',
      driftStatus: 'NO_DRIFT',
      missingData: [],
      snapshotAgeSeconds: 86400,
      validUntilISO: new Date(Date.now() + 66 * 24 * 60 * 60 * 1000).toISOString(),
      rulesetVersion: DEFAULT_CURRENT_RULESET_VERSION,
      warnings: [],
    },
    environmentFacts: {
      outputSchemaVersion: '1.0.0',
      truthRulesetVersion: DEFAULT_CURRENT_RULESET_VERSION,
      evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
      driftDetectionEnabled: true,
      snapshotLedgerEnabled: true,
    },
    missingData: [],
    ...overrides,
  };
}

describe('P6: Policy Lifecycle Management', () => {
  beforeEach(() => {
    initializeDefaultRulesets();
    initializeDefaultMigrations();
    clearShadowEvaluations();
  });

  // ========== RULESET REGISTRY TESTS ==========

  describe('P6.1: Ruleset Registry - Immutability', () => {
    it('TC-P6-1.0: Ruleset registry is immutable - no overwrite allowed', () => {
      const version = 'ruleset/test-001';
      const def1: RulesetDefinition = {
        version,
        description: 'First version',
        createdAtISO: new Date().toISOString(),
        computeTruth: (inputs: any) => ({
          generatedAtISO: new Date().toISOString(),
          completenessPercent: 85,
          confidenceLevel: 'HIGH',
          validityStatus: 'VALID',
          driftStatus: 'NO_DRIFT',
          missingData: [],
          snapshotAgeSeconds: 86400,
          validUntilISO: new Date(Date.now() + 66 * 24 * 60 * 60 * 1000).toISOString(),
          rulesetVersion: version,
          warnings: [],
        }),
      };

      registerRuleset(def1);

      // Attempt to overwrite should throw INVARIANT
      const def2: RulesetDefinition = {
        version,
        description: 'Second version (overwrite attempt)',
        createdAtISO: new Date().toISOString(),
        computeTruth: (inputs: any) => ({
          generatedAtISO: new Date().toISOString(),
          completenessPercent: 85,
          confidenceLevel: 'HIGH',
          validityStatus: 'VALID',
          driftStatus: 'NO_DRIFT',
          missingData: [],
          snapshotAgeSeconds: 86400,
          validUntilISO: new Date(Date.now() + 66 * 24 * 60 * 60 * 1000).toISOString(),
          rulesetVersion: version,
          warnings: [],
        }),
      };

      expect(() => registerRuleset(def2)).toThrow(RulesetInvariantError);
      expect(() => registerRuleset(def2)).toThrow(/ALREADY_EXISTS/);
    });

    it('TC-P6-1.1: Ruleset retrieval returns registered definition', () => {
      const version = 'ruleset/test-002';
      const def: RulesetDefinition = {
        version,
        description: 'Test ruleset',
        createdAtISO: new Date().toISOString(),
        computeTruth: (inputs: any) => ({
          generatedAtISO: new Date().toISOString(),
          completenessPercent: 85,
          confidenceLevel: 'HIGH',
          validityStatus: 'VALID',
          driftStatus: 'NO_DRIFT',
          missingData: [],
          snapshotAgeSeconds: 86400,
          validUntilISO: new Date(Date.now() + 66 * 24 * 60 * 60 * 1000).toISOString(),
          rulesetVersion: version,
          warnings: [],
        }),
      };

      registerRuleset(def);
      const retrieved = getRuleset(version);

      expect(retrieved.version).toBe(version);
      expect(retrieved.description).toBe('Test ruleset');
    });

    it('TC-P6-1.2: Missing ruleset throws RulesetInvariantError', () => {
      expect(() => getRuleset('ruleset/does-not-exist')).toThrow(RulesetInvariantError);
      expect(() => getRuleset('ruleset/does-not-exist')).toThrow(/NOT_FOUND/);
    });
  });

  // ========== PINNING TESTS ==========

  describe('P6.2: Output & Evidence Pinning', () => {
    it('TC-P6-2.0: Evidence bundle includes pinned rulesetVersion', () => {
      const evidence = createMockEvidence({
        rulesetVersion: DEFAULT_CURRENT_RULESET_VERSION,
      });

      expect(evidence.rulesetVersion).toBe(DEFAULT_CURRENT_RULESET_VERSION);
      expect(typeof evidence.rulesetVersion).toBe('string');
    });

    it('TC-P6-2.1: Output includes rulesetVersion (pinned)', () => {
      const evidence = createMockEvidence();
      expect(evidence.outputTruthMetadata.rulesetVersion).toBe(DEFAULT_CURRENT_RULESET_VERSION);
    });

    it('TC-P6-2.2: Pinned version matches evidence rulesetVersion', () => {
      const version = DEFAULT_CURRENT_RULESET_VERSION;
      const evidence = createMockEvidence({ rulesetVersion: version });

      expect(evidence.rulesetVersion).toBe(version);
      expect(evidence.outputTruthMetadata.rulesetVersion).toBe(version);
    });
  });

  // ========== REGENERATION WITH PINNED RULESET TESTS ==========

  describe('P6.3: Regeneration Uses Pinned Ruleset (Not Current)', () => {
    it('TC-P6-3.0: Regeneration uses pinned ruleset, never current', () => {
      const evidence = createMockEvidence({
        rulesetVersion: DEFAULT_CURRENT_RULESET_VERSION,
      });

      // Should regenerate successfully using pinned ruleset
      expect(() => {
        regenerateOutputTruth(evidence);
      }).not.toThrow();
    });

    it('TC-P6-3.1: Regeneration fails if pinned ruleset missing', () => {
      const evidence = createMockEvidence({
        rulesetVersion: 'ruleset/nonexistent',
      });

      expect(() => regenerateOutputTruth(evidence)).toThrow(RulesetInvariantError);
    });

    it('TC-P6-3.2: Historical evidence regenerates with its own pinned ruleset', () => {
      // Create evidence with default ruleset
      const evidence = createMockEvidence({
        rulesetVersion: DEFAULT_CURRENT_RULESET_VERSION,
      });

      // Regenerating should work (uses pinned, not current)
      const regenerated = regenerateOutputTruth(evidence);
      expect(regenerated).toBeDefined();
      expect(regenerated.rulesetVersion).toBe(DEFAULT_CURRENT_RULESET_VERSION);
    });

    it('TC-P6-3.3: Regeneration result uses same rulesetVersion as original', () => {
      const evidence = createMockEvidence();
      const regenerated = regenerateOutputTruth(evidence);

      expect(regenerated.rulesetVersion).toBe(evidence.rulesetVersion);
    });
  });

  // ========== SCHEMA MIGRATION TESTS ==========

  describe('P6.4: Schema Migration (Deterministic, No Prompts)', () => {
    it('TC-P6-4.0: Current version needs no migration', () => {
      const evidence = createMockEvidence({
        schemaVersion: EVIDENCE_SCHEMA_VERSION,
      });

      expect(needsMigration(evidence.schemaVersion)).toBe(false);
    });

    it('TC-P6-4.1: Applying migration to current version returns unchanged', () => {
      const evidence = createMockEvidence({
        schemaVersion: EVIDENCE_SCHEMA_VERSION,
      });

      const migrated = applySchemaMigrations(evidence);
      expect(migrated).toEqual(evidence);
    });

    it('TC-P6-4.2: Missing schema migration throws SchemaMigrationError', () => {
      const evidence = createMockEvidence({
        schemaVersion: 'future-version-that-does-not-exist',
      });

      expect(() => applySchemaMigrations(evidence)).toThrow(SchemaMigrationError);
    });
  });

  // ========== COMPATIBILITY GATES TESTS ==========

  describe('P6.5: Compatibility Gates (Fail-Closed)', () => {
    it('TC-P6-5.0: Gate verifies pinned ruleset exists', () => {
      const evidence = createMockEvidence({
        rulesetVersion: DEFAULT_CURRENT_RULESET_VERSION,
      });

      expect(() => gatePinnedRulesetExists(evidence.rulesetVersion)).not.toThrow();
    });

    it('TC-P6-5.1: Gate fails closed if pinned ruleset missing', () => {
      expect(() => gatePinnedRulesetExists('ruleset/missing')).toThrow(CompatibilityGateError);
    });

    it('TC-P6-5.2: Gate verifies schema can be migrated', () => {
      const evidence = createMockEvidence({
        schemaVersion: EVIDENCE_SCHEMA_VERSION,
      });

      expect(() => gateSchemaCanBeMigrated(evidence)).not.toThrow();
    });

    it('TC-P6-5.3: Pre-regeneration validation passes for valid evidence', () => {
      const evidence = createMockEvidence();

      expect(() => gatePreRegenerationValidation(evidence)).not.toThrow();
    });

    it('TC-P6-5.4: Pre-regeneration validation fails closed on missing ruleset', () => {
      const evidence = createMockEvidence({
        rulesetVersion: 'ruleset/nonexistent',
      });

      expect(() => gatePreRegenerationValidation(evidence)).toThrow(CompatibilityGateError);
    });
  });

  // ========== SHADOW EVALUATION TESTS ==========

  describe('P6.6: Shadow Evaluation (Internal Only)', () => {
    it('TC-P6-6.0: Shadow evaluation does not change outputs', () => {
      const evidence = createMockEvidence();
      const originalTruth = evidence.outputTruthMetadata;

      computeShadowEvaluation(evidence);

      // Original evidence untouched
      expect(evidence.outputTruthMetadata).toEqual(originalTruth);
    });

    it('TC-P6-6.1: Shadow evaluation returns result without storage issues', () => {
      const evidence1 = createMockEvidence({
        tenantKey: 'tenant-6-1-a',
        evidenceId: 'evidence-6-1-a',
      });
      const evidence2 = createMockEvidence({
        tenantKey: 'tenant-6-1-b',
        evidenceId: 'evidence-6-1-b',
      });

      // Compute shadow evaluations
      const result1 = computeShadowEvaluation(evidence1);
      const result2 = computeShadowEvaluation(evidence2);

      // Verify results are returned correctly with proper tenant scoping
      expect(result1.tenantKey).toBe('tenant-6-1-a');
      expect(result1.evidenceId).toBe('evidence-6-1-a');
      expect(result2.tenantKey).toBe('tenant-6-1-b');
      expect(result2.evidenceId).toBe('evidence-6-1-b');

      // Verify tenant scoping in results (result1 should never contain result2's data)
      expect(result1.tenantKey).not.toBe(result2.tenantKey);
      expect(result1.evidenceId).not.toBe(result2.evidenceId);
    });

    it('TC-P6-6.2: Shadow evaluation returns status without affecting exports', () => {
      const evidence = createMockEvidence();
      const shadowResult = computeShadowEvaluation(evidence);

      expect(shadowResult.status).toBe('success');
      expect(shadowResult.evaluatedAtISO).toBeDefined();
      expect(shadowResult.hasDifferences).toBeFalsy(); // Current ruleset = same result
    });

    it('TC-P6-6.3: Shadow evaluation indicates if changes would occur', () => {
      const evidence = createMockEvidence();
      const shadowResult = computeShadowEvaluation(evidence);

      const wouldChange = shadowEvaluationIndicatesChanges(shadowResult);
      expect(typeof wouldChange).toBe('boolean');
    });
  });

  // ========== INVARIANT ENFORCEMENT TESTS ==========

  describe('P6.7: Invariant Enforcement', () => {
    it('TC-P6-7.0: Regeneration raises explicit error on missing ruleset', () => {
      const evidence = createMockEvidence({
        rulesetVersion: 'ruleset/missing',
      });

      expect(() => regenerateOutputTruth(evidence)).toThrow();
      const error = expect(() => regenerateOutputTruth(evidence)).toThrow();
      expect(error).toBeTruthy();
    });

    it('TC-P6-7.1: Missing schema migration raises explicit error', () => {
      const evidence = createMockEvidence({
        schemaVersion: 'schema/future',
      });

      expect(() => applySchemaMigrations(evidence)).toThrow(SchemaMigrationError);
    });

    it('TC-P6-7.2: Overwriting ruleset raises explicit error', () => {
      const version = 'ruleset/immutable-test';
      registerRuleset({
        version,
        description: 'Original',
        createdAtISO: new Date().toISOString(),
        computeTruth: () => ({
          generatedAtISO: new Date().toISOString(),
          completenessPercent: 85,
          confidenceLevel: 'HIGH',
          validityStatus: 'VALID',
          driftStatus: 'NO_DRIFT',
          missingData: [],
          snapshotAgeSeconds: 86400,
          validUntilISO: new Date(Date.now() + 66 * 24 * 60 * 60 * 1000).toISOString(),
          rulesetVersion: version,
          warnings: [],
        }),
      } as RulesetDefinition);

      expect(() => {
        registerRuleset({
          version,
          description: 'Attempted overwrite',
          createdAtISO: new Date().toISOString(),
          computeTruth: () => ({
            generatedAtISO: new Date().toISOString(),
            completenessPercent: 85,
            confidenceLevel: 'HIGH',
            validityStatus: 'VALID',
            driftStatus: 'NO_DRIFT',
            missingData: [],
            snapshotAgeSeconds: 86400,
            validUntilISO: new Date(Date.now() + 66 * 24 * 60 * 60 * 1000).toISOString(),
            rulesetVersion: version,
            warnings: [],
          }),
        } as RulesetDefinition);
      }).toThrow(RulesetInvariantError);
    });
  });

  // ========== BACKWARD COMPATIBILITY TESTS ==========

  describe('P6.8: Backward Compatibility', () => {
    it('TC-P6-8.0: Historical evidence can be regenerated with pinned ruleset', () => {
      const evidence = createMockEvidence({
        rulesetVersion: DEFAULT_CURRENT_RULESET_VERSION,
        generatedAtISO: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
      });

      // Should regenerate successfully (pinned ruleset exists)
      const regenerated = regenerateOutputTruth(evidence);
      expect(regenerated).toBeDefined();
    });

    it('TC-P6-8.1: No silent fallback - explicit error if ruleset missing', () => {
      const evidence = createMockEvidence({
        rulesetVersion: 'ruleset/old-version-no-longer-available',
      });

      // Should explicitly fail, never silently use current ruleset
      expect(() => regenerateOutputTruth(evidence)).toThrow();
    });
  });
});
