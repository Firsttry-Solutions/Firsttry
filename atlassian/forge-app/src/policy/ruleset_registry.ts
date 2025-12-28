/**
 * PHASE P6: RULESET REGISTRY (Immutable, Internal)
 * 
 * Manages evolution of truth computation rules without breaking historical regeneration.
 * 
 * Rules:
 * - Rulesets are immutable once registered
 * - Each ruleset has a deterministic computeTruth function
 * - Overwriting a ruleset throws INVARIANT error
 * - Historical evidence regenerates using its PINNED ruleset, never the current one
 * - System chooses safe defaults automatically (no user interaction)
 */

import { OutputTruthMetadata } from '../output/output_contract';
import { EvidenceBundle } from '../evidence/evidence_model';

/**
 * Ruleset version identifier (immutable, unique)
 */
export type RulesetVersion = string;

/**
 * Definition of a ruleset (immutable once created)
 * Contains the truth computation function and metadata
 */
export interface RulesetDefinition {
  version: RulesetVersion;
  description: string;
  createdAtISO: string;
  
  // Deterministic computation function
  // Given evidence inputs, produce OutputTruthMetadata
  // MUST be deterministic: same inputs → same output always
  computeTruth: (inputs: RulesetComputeInputs) => OutputTruthMetadata;
  
  // Optional: migration function for evidence schema upgrades
  // Transforms older evidence schema to current format
  // Must be deterministic and non-destructive
  schemaMigration?: (bundle: EvidenceBundle) => EvidenceBundle;
}

/**
 * Inputs for ruleset computeTruth function
 * Extracted from EvidenceBundle for clean interface
 */
export interface RulesetComputeInputs {
  generatedAtISO: string;
  snapshotId: string;
  rulesetVersion: string;
  completenessPercent: number;
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  validityStatus: 'VALID' | 'INVALID' | 'UNKNOWN';
  driftStatus: 'stable' | 'detected' | 'unknown';
  missingData: string[];
  nowISO: string;
}

/**
 * INVARIANT Error: Ruleset registry violation
 */
export class RulesetInvariantError extends Error {
  constructor(
    public version: RulesetVersion,
    public reason: 'ALREADY_EXISTS' | 'NOT_FOUND' | 'SCHEMA_MISMATCH',
    message: string
  ) {
    super(`RulesetInvariant[${version}]:${reason} - ${message}`);
  }
}

/**
 * Default ruleset version (hard-coded, immutable)
 * This is the version used for all new evidence generation
 */
export const DEFAULT_CURRENT_RULESET_VERSION: RulesetVersion = 'ruleset/2025-12-22';

/**
 * Legacy/default ruleset version used when evidence omits a pinned version.
 *
 * Backward-compatibility note:
 * - Older evidence may reference simple numeric versions like '1.0'.
 * - We keep a named constant so regeneration can deterministically fall back
 *   to a stable legacy ruleset when the stored bundle lacks a version.
 * - This constant is intentionally separate from the current ruleset id.
 */
export const DEFAULT_RULESET_VERSION: RulesetVersion = '1.0';

/**
 * Registry of all known rulesets (immutable after registration)
 * Internal storage: version → definition
 */
const rulesetRegistry = new Map<RulesetVersion, RulesetDefinition>();

/**
 * Track which rulesets have been registered (for immutability enforcement)
 */
const registeredRulesets = new Set<RulesetVersion>();

/**
 * Get the current/default ruleset version
 * Used for new evidence generation
 */
export function getCurrentRulesetVersion(): RulesetVersion {
  return DEFAULT_CURRENT_RULESET_VERSION;
}

/**
 * Register a new ruleset (immutable, no overwrites allowed)
 * 
 * RULES:
 * - Once registered, a version CANNOT be overwritten
 * - Attempting to overwrite throws INVARIANT error
 * - All registrations happen during system initialization (no user action)
 * - Internal only (not exposed in UI or APIs)
 * 
 * @param definition The ruleset to register
 * @throws RulesetInvariantError if version already exists
 */
export function registerRuleset(definition: RulesetDefinition): void {
  if (registeredRulesets.has(definition.version)) {
    throw new RulesetInvariantError(
      definition.version,
      'ALREADY_EXISTS',
      `Ruleset ${definition.version} has already been registered and is immutable`
    );
  }

  rulesetRegistry.set(definition.version, definition);
  registeredRulesets.add(definition.version);
}

/**
 * Get a ruleset by version
 * Used for historical regeneration (evidence uses its pinned version)
 * 
 * @param version The ruleset version to retrieve
 * @returns The ruleset definition, or throws error if not found
 * @throws RulesetInvariantError if version not found
 */
export function getRuleset(version: RulesetVersion): RulesetDefinition {
  const ruleset = rulesetRegistry.get(version);
  
  if (!ruleset) {
    throw new RulesetInvariantError(
      version,
      'NOT_FOUND',
      `Ruleset ${version} not found in registry. Historical evidence cannot be regenerated.`
    );
  }
  
  return ruleset;
}

/**
 * List all registered ruleset versions
 */
export function listRulesets(): RulesetVersion[] {
  return Array.from(registeredRulesets).sort();
}

/**
 * Initialize default rulesets (called at system startup)
 * 
 * This is where new ruleset versions are added.
 * No user interaction, fully automatic.
 */
export function initializeDefaultRulesets(): void {
  // Only register once
  if (registeredRulesets.size > 0) {
    return;
  }

  // Register the default/current ruleset
  registerRuleset({
    version: DEFAULT_CURRENT_RULESET_VERSION,
    description: 'Default truth computation ruleset (2025-12-22)',
    // Use a stable, deterministic createdAt timestamp to avoid test-time
    // non-determinism. This file is source-controlled and the timestamp is
    // a historical marker, not runtime state.
    createdAtISO: '2025-12-22T00:00:00.000Z',
    
    computeTruth: (inputs: RulesetComputeInputs): OutputTruthMetadata => {
      // Current truth computation logic
      // This function is deterministic: same inputs → same output always
      return {
        generatedAtISO: inputs.generatedAtISO,
        completenessPercent: inputs.completenessPercent,
        confidenceLevel: inputs.confidenceLevel,
        validityStatus: inputs.validityStatus,
        driftStatus: inputs.driftStatus,
        missingData: inputs.missingData,
        snapshotAgeSeconds: Math.floor(
          (new Date(inputs.nowISO).getTime() - new Date(inputs.generatedAtISO).getTime()) / 1000
        ),
        validUntilISO: new Date(
          new Date(inputs.generatedAtISO).getTime() + 90 * 24 * 60 * 60 * 1000
        ).toISOString(),
        rulesetVersion: inputs.rulesetVersion,
        warnings: [],
      };
    },
  });

  // Register a legacy '1.0' ruleset to remain compatible with historical
  // evidence produced early in the project's lifecycle. This ruleset
  // reproduces the earlier computation behavior deterministically so that
  // regeneration of legacy evidence remains stable.
  registerRuleset({
    version: DEFAULT_RULESET_VERSION,
    description: 'Legacy ruleset (1.0) — maintained for backward compatibility',
    createdAtISO: '2025-12-20T00:00:00.000Z',
    computeTruth: (inputs: RulesetComputeInputs): OutputTruthMetadata => {
      // Reconstruct the legacy OutputTruthMetadata deterministically from
      // the provided inputs. This mirrors the historical rules used when
      // the evidence was originally generated.
      const snapshotAgeSeconds = Math.floor(
        (new Date(inputs.nowISO).getTime() - new Date(inputs.generatedAtISO).getTime()) / 1000
      );

      return {
        generatedAtISO: inputs.nowISO,
        completenessPercent: inputs.completenessPercent,
        confidenceLevel: inputs.confidenceLevel,
        validityStatus: inputs.validityStatus,
        driftStatus: inputs.driftStatus,
        missingData: Array.isArray(inputs.missingData) ? [...inputs.missingData].sort() : [],
        snapshotAgeSeconds,
        validUntilISO: new Date(new Date(inputs.nowISO).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        rulesetVersion: inputs.rulesetVersion,
        warnings: [],
      };
    },
  });
}

// Initialize default rulesets eagerly so that consumers importing this module
// can rely on legacy and current ruleset ids being resolvable without
// requiring explicit runtime initialization calls. This is safe because
// registration is idempotent and does not mutate behavior.
initializeDefaultRulesets();

/**
 * Validate that a ruleset version is available
 * Used during evidence creation and regeneration
 * 
 * @throws RulesetInvariantError if version not found
 */
export function validateRulesetExists(version: RulesetVersion): void {
  getRuleset(version); // Will throw if not found
}

/**
 * Get the schema migration function for a ruleset (if any)
 * Used to upgrade older evidence to current internal representation
 * 
 * @returns The migration function, or undefined if no migration needed
 */
export function getSchemaMigration(version: RulesetVersion): ((bundle: EvidenceBundle) => EvidenceBundle) | undefined {
  const ruleset = getRuleset(version);
  return ruleset.schemaMigration;
}
