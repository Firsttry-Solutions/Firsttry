/**
 * Snapshot Payload Contract — ECL Enterprise Hardening
 *
 * Strict schema for all governance snapshots.
 * All fields are mandatory. No optional fields.
 * Any missing field causes THROW at validation.
 *
 * // FT_ECL_CORE: SNAPSHOT_SCHEMA_V1
 */

// FT_ECL_CORE: SNAPSHOT_SCHEMA_V1

/**
 * Governance snapshot schema version constant.
 * Bump when schema changes; maintain migration guard.
 */
export const SNAPSHOT_SCHEMA_VERSION = 'ecl.snapshot@1' as const;

/**
 * Ruleset version constant — governs drift classification rules.
 */
export const RULESET_VERSION = 'ecl.ruleset@1' as const;

/**
 * User record within snapshot.
 * All fields mandatory.
 */
export interface SnapshotUser {
  readonly accountId: string;
  readonly displayName: string;
  readonly emailAddress: string;
  readonly active: boolean;
}

/**
 * Role record within snapshot.
 * All fields mandatory.
 */
export interface SnapshotRole {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly admin: boolean;
}

/**
 * Permission scheme record within snapshot.
 */
export interface SnapshotPermission {
  readonly schemeId: string;
  readonly schemeName: string;
  readonly grants: ReadonlyArray<{
    readonly permission: string;
    readonly holder: string;
  }>;
}

/**
 * Workflow record within snapshot.
 */
export interface SnapshotWorkflow {
  readonly id: string;
  readonly name: string;
  readonly steps: ReadonlyArray<string>;
  readonly transitions: ReadonlyArray<string>;
}

/**
 * App install record within snapshot.
 */
export interface SnapshotAppInstall {
  readonly appKey: string;
  readonly appName: string;
  readonly installedAt: string;
  readonly scopes: ReadonlyArray<string>;
}

/**
 * Full governance snapshot payload.
 *
 * ALL FIELDS MANDATORY. No optional fields.
 * Validated at runtime by validateSnapshotPayload().
 *
 * // FT_ECL_CORE: SNAPSHOT_SCHEMA_V1
 */
export interface SnapshotPayload {
  readonly users: ReadonlyArray<SnapshotUser>;
  readonly roles: ReadonlyArray<SnapshotRole>;
  readonly permissions: ReadonlyArray<SnapshotPermission>;
  readonly workflows: ReadonlyArray<SnapshotWorkflow>;
  readonly appInstalls: ReadonlyArray<SnapshotAppInstall>;
  readonly generatedUtc: string;     // ISO 8601 string — MUST NOT be a Date object
  readonly schemaVersion: string;    // Must equal SNAPSHOT_SCHEMA_VERSION
  readonly ruleSetVersion: string;   // Must equal RULESET_VERSION
  readonly siteId: string;           // Atlassian site ID
}

/**
 * Required keys for SnapshotPayload.
 * Used by validateSnapshotPayload() to verify completeness.
 */
const REQUIRED_SNAPSHOT_KEYS: ReadonlyArray<keyof SnapshotPayload> = [
  'users',
  'roles',
  'permissions',
  'workflows',
  'appInstalls',
  'generatedUtc',
  'schemaVersion',
  'ruleSetVersion',
  'siteId',
] as const;

/**
 * Validate a snapshot payload is complete and well-formed.
 * THROW on any missing or undefined field.
 *
 * @throws {Error} if any required field is missing or undefined.
 */
export function validateSnapshotPayload(payload: unknown): asserts payload is SnapshotPayload {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(
      '[FT_ECL_CORE:SNAPSHOT_SCHEMA_V1] FAIL-CLOSED: snapshot payload must be a non-null object'
    );
  }

  const record = payload as Record<string, unknown>;
  for (const key of REQUIRED_SNAPSHOT_KEYS) {
    if (record[key] === undefined || record[key] === null) {
      throw new Error(
        `[FT_ECL_CORE:SNAPSHOT_SCHEMA_V1] FAIL-CLOSED: required field "${key}" is missing or null`
      );
    }
  }

  if (typeof record['generatedUtc'] !== 'string') {
    throw new Error(
      '[FT_ECL_CORE:SNAPSHOT_SCHEMA_V1] FAIL-CLOSED: generatedUtc must be an ISO string, not a Date object'
    );
  }

  if (typeof record['schemaVersion'] !== 'string') {
    throw new Error(
      '[FT_ECL_CORE:SNAPSHOT_SCHEMA_V1] FAIL-CLOSED: schemaVersion must be a string'
    );
  }

  if (typeof record['ruleSetVersion'] !== 'string') {
    throw new Error(
      '[FT_ECL_CORE:SNAPSHOT_SCHEMA_V1] FAIL-CLOSED: ruleSetVersion must be a string'
    );
  }

  if (typeof record['siteId'] !== 'string' || record['siteId'].length === 0) {
    throw new Error(
      '[FT_ECL_CORE:SNAPSHOT_SCHEMA_V1] FAIL-CLOSED: siteId must be a non-empty string'
    );
  }

  if (!Array.isArray(record['users'])) {
    throw new Error('[FT_ECL_CORE:SNAPSHOT_SCHEMA_V1] FAIL-CLOSED: users must be an array');
  }
  if (!Array.isArray(record['roles'])) {
    throw new Error('[FT_ECL_CORE:SNAPSHOT_SCHEMA_V1] FAIL-CLOSED: roles must be an array');
  }
  if (!Array.isArray(record['permissions'])) {
    throw new Error('[FT_ECL_CORE:SNAPSHOT_SCHEMA_V1] FAIL-CLOSED: permissions must be an array');
  }
  if (!Array.isArray(record['workflows'])) {
    throw new Error('[FT_ECL_CORE:SNAPSHOT_SCHEMA_V1] FAIL-CLOSED: workflows must be an array');
  }
  if (!Array.isArray(record['appInstalls'])) {
    throw new Error('[FT_ECL_CORE:SNAPSHOT_SCHEMA_V1] FAIL-CLOSED: appInstalls must be an array');
  }
}

// FT_ECL_CORE: SNAPSHOT_SCHEMA_V1 END
