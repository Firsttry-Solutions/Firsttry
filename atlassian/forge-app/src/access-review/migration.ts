/**
 * PHASE 3 v1.2 - Deterministic Schema Migration Engine
 * Safe, audited database schema evolution
 *
 * Requirements:
 * - Schema version tracking
 * - Deterministic migrations (idempotent)
 * - Backward compatibility checks
 * - Migration audit trail
 * - Rollback capability (optional)
 * - Marker: [FT_SCHEMA_MIGRATION_COMPLETE]
 */

import * as crypto from "crypto";
import { ReviewError, ReviewErrorCode } from "./types";

// ============================================================================
// Error Handling
// ============================================================================

export class MigrationError extends ReviewError {
  constructor(message: string, public reason: string) {
    super(message);
    this.name = "MigrationError";
    this.code = "MIGRATION_FAILED" as ReviewErrorCode;
  }
}

export class SchemaVersionError extends MigrationError {
  constructor(message: string) {
    super(message, "SCHEMA_VERSION_MISMATCH");
    this.name = "SchemaVersionError";
  }
}

export class MigrationRollbackError extends MigrationError {
  constructor(message: string) {
    super(message, "ROLLBACK_FAILED");
    this.name = "MigrationRollbackError";
  }
}

// ============================================================================
// Schema Versioning
// ============================================================================

export interface SchemaVersion {
  major: number;
  minor: number;
  patch: number;
  timestamp: number;
  hash: string;
}

export interface SchemaMigration {
  id: string;
  fromVersion: SchemaVersion;
  toVersion: SchemaVersion;
  description: string;
  up: (data: any) => any; // Migration function
  down?: (data: any) => any; // Rollback function (optional)
  isIdempotent: boolean;
  checksum: string;
  createdAt: number;
}

export interface MigrationExecutionRecord {
  migrationId: string;
  executedAt: number;
  duration: number;
  success: boolean;
  recordsAffected: number;
  error?: string;
  checksum: string;
  appliedToVersion: SchemaVersion;
}

export interface MigrationState {
  currentVersion: SchemaVersion;
  executedMigrations: MigrationExecutionRecord[];
  pendingMigrations: SchemaMigration[];
  rollbackCapable: boolean;
  lastExecutedAt: number;
}

// ============================================================================
// Schema Version Management
// ============================================================================

export function parseVersion(versionString: string): SchemaVersion {
  const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new SchemaVersionError(`Invalid version format: ${versionString}`);
  }

  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    timestamp: Date.now(),
    hash: "",
  };
}

export function compareVersions(
  v1: SchemaVersion,
  v2: SchemaVersion
): -1 | 0 | 1 {
  if (v1.major !== v2.major) return v1.major < v2.major ? -1 : 1;
  if (v1.minor !== v2.minor) return v1.minor < v2.minor ? -1 : 1;
  if (v1.patch !== v2.patch) return v1.patch < v2.patch ? -1 : 1;
  return 0;
}

export function versionToString(v: SchemaVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

export function computeVersionHash(v: SchemaVersion): string {
  const data = `${v.major}.${v.minor}.${v.patch}.${v.timestamp}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

// ============================================================================
// Migration Definition
// ============================================================================

export function defineMigration(options: {
  id: string;
  from: SchemaVersion;
  to: SchemaVersion;
  description: string;
  up: (data: any) => any;
  down?: (data: any) => any;
  isIdempotent?: boolean;
}): SchemaMigration {
  const id = options.id;
  const checksum = computeMigrationChecksum(options.up.toString());

  return {
    id,
    fromVersion: options.from,
    toVersion: options.to,
    description: options.description,
    up: options.up,
    down: options.down,
    isIdempotent: options.isIdempotent ?? true,
    checksum,
    createdAt: Date.now(),
  };
}

export function computeMigrationChecksum(migrationCode: string): string {
  const normalized = migrationCode.replace(/\s+/g, " ").trim();
  return crypto
    .createHash("sha256")
    .update(normalized)
    .digest("hex");
}

// ============================================================================
// Migration Execution
// ============================================================================

export class MigrationEngine {
  private state: MigrationState;

  constructor(currentVersion: SchemaVersion) {
    this.state = {
      currentVersion,
      executedMigrations: [],
      pendingMigrations: [],
      rollbackCapable: true,
      lastExecutedAt: 0,
    };
  }

  addMigration(migration: SchemaMigration): void {
    const comparison = compareVersions(migration.fromVersion, this.state.currentVersion);
    if (comparison !== 0) {
      throw new SchemaVersionError(
        `Migration not applicable. Current: ${versionToString(this.state.currentVersion)}, Expected from: ${versionToString(migration.fromVersion)}`
      );
    }

    this.state.pendingMigrations.push(migration);
    console.log(
      `[FT_MIGRATION_QUEUED] ${migration.id}: ${versionToString(migration.fromVersion)} → ${versionToString(migration.toVersion)}`
    );
  }

  executeMigration(migration: SchemaMigration, data: any): MigrationExecutionRecord {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let recordsAffected = 0;

    try {
      const transformed = migration.up(data);
      recordsAffected = Array.isArray(transformed) ? transformed.length : 1;
      success = true;

      // Update current version
      this.state.currentVersion = migration.toVersion;
      console.log(
        `[FT_MIGRATION_APPLIED] ${migration.id} completed (${recordsAffected} records)`
      );
    } catch (err: any) {
      error = err.message;
      console.error(`[FT_MIGRATION_ERROR] ${migration.id}: ${error}`);
    }

    const duration = Date.now() - startTime;
    const checksum = computeMigrationChecksum(migration.up.toString());

    const record: MigrationExecutionRecord = {
      migrationId: migration.id,
      executedAt: startTime,
      duration,
      success,
      recordsAffected,
      error,
      checksum,
      appliedToVersion: this.state.currentVersion,
    };

    if (success) {
      this.state.executedMigrations.push(record);
      this.state.lastExecutedAt = startTime;
      this.state.pendingMigrations = this.state.pendingMigrations.filter(
        (m) => m.id !== migration.id
      );
    }

    return record;
  }

  executePendingMigrations(data: any): MigrationExecutionRecord[] {
    const results: MigrationExecutionRecord[] = [];

    for (const migration of this.state.pendingMigrations) {
      const record = this.executeMigration(migration, data);
      results.push(record);

      // Stop if migration failed (fail-fast)
      if (!record.success) {
        throw new MigrationError(
          `Migration ${migration.id} failed: ${record.error}`,
          "MIGRATION_CHAIN_BROKEN"
        );
      }
    }

    return results;
  }

  rollbackMigration(
    migration: SchemaMigration,
    data: any
  ): MigrationExecutionRecord {
    if (!migration.down) {
      throw new MigrationRollbackError(
        `Rollback not supported for migration ${migration.id}`
      );
    }

    const startTime = Date.now();
    let success = false;

    try {
      migration.down(data);
      success = true;

      // Revert version
      this.state.currentVersion = migration.fromVersion;
      console.log(`[FT_MIGRATION_ROLLED_BACK] ${migration.id}`);
    } catch (err: any) {
      throw new MigrationRollbackError(
        `Rollback failed for ${migration.id}: ${err.message}`
      );
    }

    return {
      migrationId: migration.id,
      executedAt: startTime,
      duration: Date.now() - startTime,
      success,
      recordsAffected: 0,
      checksum: computeMigrationChecksum(migration.down.toString()),
      appliedToVersion: this.state.currentVersion,
    };
  }

  getState(): MigrationState {
    return { ...this.state };
  }

  getCurrentVersion(): string {
    return versionToString(this.state.currentVersion);
  }

  getPendingMigrations(): SchemaMigration[] {
    return [...this.state.pendingMigrations];
  }

  getExecutionHistory(): MigrationExecutionRecord[] {
    return [...this.state.executedMigrations];
  }
}

// ============================================================================
// Built-in Migrations for v1.1 to v1.2
// ============================================================================

const V1_1: SchemaVersion = {
  major: 1,
  minor: 1,
  patch: 0,
  timestamp: Date.now(),
  hash: "",
};

const V1_2: SchemaVersion = {
  major: 1,
  minor: 2,
  patch: 0,
  timestamp: Date.now(),
  hash: "",
};

export const MIGRATION_V1_1_TO_V1_2 = defineMigration({
  id: "migration_v1.1_to_v1.2_tenant_isolation",
  from: V1_1,
  to: V1_2,
  description: "Add tenant isolation and GDPR fields",
  up: (data: any) => {
    // Add tenant fields if missing
    if (!data.tenantId) {
      data.tenantId = "default-tenant";
    }

    // Add lifecycle metadata
    if (!data.lifecycle) {
      data.lifecycle = {
        createdAt: Date.now(),
        retentionYears: 7,
        purgeStrategy: "ANONYMIZE",
      };
    }

    // Add immutability fields
    if (!data.chain) {
      data.chain = {
        previousHash: null,
        sequenceNumber: 1,
        isSigned: false,
      };
    }

    return data;
  },
  down: (data: any) => {
    // Remove tenant and lifecycle fields
    delete data.tenantId;
    delete data.lifecycle;
    delete data.chain;
    return data;
  },
  isIdempotent: true,
});

// ============================================================================
// Migration Validation
// ============================================================================

export function validateDataIntegrity(
  before: any,
  after: any,
  operation: "UP" | "DOWN"
): void {
  // Basic integrity checks
  if (before === null && after === null) {
    throw new MigrationError(
      "Both before and after are null",
      "NULL_DATA_ERROR"
    );
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    if (after.length === 0 && before.length > 0 && operation === "UP") {
      throw new MigrationError(
        "Migration lost data (array became empty)",
        "DATA_LOSS_DETECTED"
      );
    }
  }
}

export function computeDataChecksum(data: any): string {
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

// ============================================================================
// MARKER
// ============================================================================

console.log("[FT_SCHEMA_MIGRATION_COMPLETE] Schema migration engine loaded");
