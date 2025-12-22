/**
 * PHASE P6: POLICY LIFECYCLE MANAGEMENT
 * Module exports for ruleset registry, schema migrations, and compatibility gates
 */

export {
  registerRuleset,
  getRuleset,
  getCurrentRulesetVersion,
  validateRulesetExists,
  listRulesets,
  initializeDefaultRulesets,
  DEFAULT_CURRENT_RULESET_VERSION,
  RulesetInvariantError,
  type RulesetVersion,
  type RulesetDefinition,
  type RulesetComputeInputs,
} from './ruleset_registry';

export {
  applySchemaMigrations,
  needsMigration,
  getMigrationPath,
  registerSchemaMigration,
  initializeDefaultMigrations,
  SchemaMigrationError,
} from './schema_migrations';

export {
  computeShadowEvaluation,
  getShadowEvaluation,
  listShadowEvaluations,
  clearShadowEvaluations,
  shadowEvaluationIndicatesChanges,
  type ShadowEvaluationResult,
} from './shadow_evaluator';

export {
  gatePinnedRulesetExists,
  gateSchemaCanBeMigrated,
  gateRulesetIsImmutable,
  gateValidityMeaningPreserved,
  gatePreRegenerationValidation,
  getCompatibilityStatus,
  CompatibilityGateError,
} from './compatibility_gates';
