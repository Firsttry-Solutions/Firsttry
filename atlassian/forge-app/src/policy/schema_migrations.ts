/**
 * PHASE P6: EVIDENCE SCHEMA MIGRATIONS (Deterministic, No Prompts)
 * 
 * Handles safe evolution of EvidenceBundle schema versions.
 * 
 * Rules:
 * - Migrations are deterministic and non-destructive
 * - Additive only (never removes fields)
 * - Applied automatically before regeneration
 * - Missing migrations = INVARIANT failure
 * - No user interaction required
 */

import { EvidenceBundle, EVIDENCE_SCHEMA_VERSION } from '../evidence/evidence_model';

/**
 * INVARIANT Error: Schema migration failure
 */
export class SchemaMigrationError extends Error {
  constructor(
    public sourceVersion: string,
    public targetVersion: string,
    public reason: 'NOT_FOUND' | 'MIGRATION_FAILED',
    message: string
  ) {
    super(`SchemaMigration[${sourceVersion}→${targetVersion}]:${reason} - ${message}`);
  }
}

/**
 * Registry of all schema migrations
 * Maps: sourceVersion → targetVersion → migration function
 */
interface MigrationMap {
  [sourceVersion: string]: {
    [targetVersion: string]: (bundle: EvidenceBundle) => EvidenceBundle;
  };
}

const migrations: MigrationMap = {
  // Current version doesn't need migration
  // Future versions will be added here as additive upgrades
};

/**
 * Apply schema migrations to an evidence bundle
 * 
 * If bundle's schemaVersion doesn't match current version,
 * apply deterministic migrations to bring it up to current.
 * 
 * RULES:
 * - Migrations must exist for each version jump
 * - If migration missing → throw SchemaMigrationError (INVARIANT)
 * - Migrations are pure functions (no side effects)
 * - Same input → same output always
 * 
 * @param bundle The evidence bundle to migrate
 * @returns The migrated bundle (or original if already current version)
 * @throws SchemaMigrationError if migration not found
 */
export function applySchemaMigrations(bundle: EvidenceBundle): EvidenceBundle {
  const sourceVersion = bundle.schemaVersion;
  const targetVersion = EVIDENCE_SCHEMA_VERSION;

  // If already current version, no migration needed
  if (sourceVersion === targetVersion) {
    return bundle;
  }

  // Find migration path
  if (!migrations[sourceVersion] || !migrations[sourceVersion][targetVersion]) {
    throw new SchemaMigrationError(
      sourceVersion,
      targetVersion,
      'NOT_FOUND',
      `No migration path found from schema ${sourceVersion} to ${targetVersion}`
    );
  }

  try {
    const migrationFn = migrations[sourceVersion][targetVersion];
    const migratedBundle = migrationFn(bundle);
    
    // Verify migration produced valid bundle
    if (!migratedBundle || typeof migratedBundle !== 'object') {
      throw new SchemaMigrationError(
        sourceVersion,
        targetVersion,
        'MIGRATION_FAILED',
        'Migration produced invalid result'
      );
    }

    return migratedBundle;
  } catch (error) {
    if (error instanceof SchemaMigrationError) {
      throw error;
    }
    throw new SchemaMigrationError(
      sourceVersion,
      targetVersion,
      'MIGRATION_FAILED',
      `Migration execution failed: ${(error as Error).message}`
    );
  }
}

/**
 * Check if a schema version needs migration
 * 
 * @param version The schema version to check
 * @returns true if bundle with this version needs migration, false otherwise
 */
export function needsMigration(version: string): boolean {
  return version !== EVIDENCE_SCHEMA_VERSION;
}

/**
 * Get all migration steps needed for a version
 * 
 * @param fromVersion Starting schema version
 * @param toVersion Target schema version (defaults to current)
 * @returns Array of migration steps needed
 */
export function getMigrationPath(
  fromVersion: string,
  toVersion: string = EVIDENCE_SCHEMA_VERSION
): Array<{ from: string; to: string }> {
  const path: Array<{ from: string; to: string }> = [];

  if (fromVersion === toVersion) {
    return path;
  }

  // Simple case: direct migration exists
  if (migrations[fromVersion] && migrations[fromVersion][toVersion]) {
    path.push({ from: fromVersion, to: toVersion });
    return path;
  }

  // Complex case: multi-step migration (not implemented yet, but available for future)
  // Would traverse migration graph to find path from fromVersion to toVersion

  throw new SchemaMigrationError(
    fromVersion,
    toVersion,
    'NOT_FOUND',
    `No migration path available`
  );
}

/**
 * Register a new schema migration (internal only)
 * Called during system initialization
 * 
 * RULES:
 * - Migrations are deterministic and non-destructive
 * - Must handle all edge cases
 * - Should be thoroughly tested before registration
 * 
 * @param fromVersion Source schema version
 * @param toVersion Target schema version
 * @param migrationFn Deterministic migration function
 */
export function registerSchemaMigration(
  fromVersion: string,
  toVersion: string,
  migrationFn: (bundle: EvidenceBundle) => EvidenceBundle
): void {
  if (!migrations[fromVersion]) {
    migrations[fromVersion] = {};
  }

  migrations[fromVersion][toVersion] = migrationFn;
}

/**
 * Initialize default migrations (called at system startup)
 * Currently empty as v1.0.0 is the starting version
 * Future versions will register migrations here
 */
export function initializeDefaultMigrations(): void {
  // No migrations for v1.0.0 (baseline version)
  // As schema evolves, migrations will be registered here
  // Example:
  // registerSchemaMigration('1.0.0', '1.1.0', migrate_1_0_to_1_1);
}
