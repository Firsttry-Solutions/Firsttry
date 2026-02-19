/**
 * Deterministic Export Pipeline — ECL Enterprise Hardening
 *
 * All export artifacts must include the full provenance chain.
 * If any field is missing → THROW.
 *
 * exportSha256 = SHA256(canonicalStringify(exportPayloadWithoutHash))
 *
 * Required fields:
 * - snapshotHash
 * - previousHash
 * - chainIndex
 * - attestationSealHash
 * - baselineVersion
 * - buildShaShort
 * - buildUtc
 * - schemaVersion
 * - ruleSetVersion
 * - exportSha256 (computed last)
 *
 * // FT_ECL_ENGINE: EXPORT_PIPELINE_V1
 */

// FT_ECL_ENGINE: EXPORT_PIPELINE_V1

import * as crypto from 'crypto';
import { canonicalStringify } from '../utils/canonicalJson';
import { DriftResult } from '../drift/riskEngine';
import { RiskPostureResult } from '../governance/riskPosture';

/**
 * Export payload without the self-referential hash field.
 * Hashed via canonicalStringify to produce exportSha256.
 */
interface ExportPayloadWithoutHash {
  readonly snapshotHash: string;
  readonly previousHash: string;
  readonly chainIndex: number;
  readonly attestationSealHash: string;
  readonly baselineVersion: number;
  readonly buildShaShort: string;
  readonly buildUtc: string;
  readonly schemaVersion: string;
  readonly ruleSetVersion: string;
  readonly exportedUtc: string;
  readonly driftSummary: {
    readonly severity: string;
    readonly findingCount: number;
    readonly hasCritical: boolean;
    readonly hasHigh: boolean;
    readonly hasMedium: boolean;
  };
  readonly riskPosture: string;
}

/**
 * Full deterministic export payload — includes exportSha256.
 */
export interface ExportPayload extends ExportPayloadWithoutHash {
  readonly exportSha256: string;
}

/**
 * Compute SHA-256 of canonical JSON.
 */
function sha256Hex(obj: unknown): string {
  const canonical = canonicalStringify(obj);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Assert a required string field is present and non-empty.
 */
function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `[FT_ECL_ENGINE:EXPORT_PIPELINE_V1] FAIL-CLOSED: required field "${field}" must be a non-empty string`
    );
  }
  return value;
}

/**
 * Assert a required number field is present and finite.
 */
function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `[FT_ECL_ENGINE:EXPORT_PIPELINE_V1] FAIL-CLOSED: required field "${field}" must be a finite number`
    );
  }
  return value;
}

/**
 * Build the deterministic export payload.
 *
 * All fields required — THROW on any missing field.
 * exportSha256 is computed as SHA256(canonicalStringify(payloadWithoutHash)).
 *
 * @param params - All required export provenance fields
 * @returns Signed export payload with exportSha256
 * @throws {Error} if any required field is missing
 */
export function buildExportPayload(params: {
  snapshotHash: unknown;
  previousHash: unknown;
  chainIndex: unknown;
  attestationSealHash: unknown;
  baselineVersion: unknown;
  buildShaShort: unknown;
  buildUtc: unknown;
  schemaVersion: unknown;
  ruleSetVersion: unknown;
  exportedUtc: unknown;
  driftResult: DriftResult;
  riskPostureResult: RiskPostureResult;
}): ExportPayload {
  const {
    snapshotHash,
    previousHash,
    chainIndex,
    attestationSealHash,
    baselineVersion,
    buildShaShort,
    buildUtc,
    schemaVersion,
    ruleSetVersion,
    exportedUtc,
    driftResult,
    riskPostureResult,
  } = params;

  // Validate all required fields — THROW on missing
  const validatedSnapshotHash = requireString(snapshotHash, 'snapshotHash');
  const validatedPreviousHash = requireString(previousHash, 'previousHash');
  const validatedChainIndex = requireNumber(chainIndex, 'chainIndex');
  const validatedAttestationSealHash = requireString(attestationSealHash, 'attestationSealHash');
  const validatedBaselineVersion = requireNumber(baselineVersion, 'baselineVersion');
  const validatedBuildShaShort = requireString(buildShaShort, 'buildShaShort');
  const validatedBuildUtc = requireString(buildUtc, 'buildUtc');
  const validatedSchemaVersion = requireString(schemaVersion, 'schemaVersion');
  const validatedRuleSetVersion = requireString(ruleSetVersion, 'ruleSetVersion');
  const validatedExportedUtc = requireString(exportedUtc, 'exportedUtc');

  if (!driftResult) {
    throw new Error(
      '[FT_ECL_ENGINE:EXPORT_PIPELINE_V1] FAIL-CLOSED: driftResult is required'
    );
  }
  if (!riskPostureResult) {
    throw new Error(
      '[FT_ECL_ENGINE:EXPORT_PIPELINE_V1] FAIL-CLOSED: riskPostureResult is required'
    );
  }

  const payloadWithoutHash: ExportPayloadWithoutHash = {
    snapshotHash: validatedSnapshotHash,
    previousHash: validatedPreviousHash,
    chainIndex: validatedChainIndex,
    attestationSealHash: validatedAttestationSealHash,
    baselineVersion: validatedBaselineVersion,
    buildShaShort: validatedBuildShaShort,
    buildUtc: validatedBuildUtc,
    schemaVersion: validatedSchemaVersion,
    ruleSetVersion: validatedRuleSetVersion,
    exportedUtc: validatedExportedUtc,
    driftSummary: {
      severity: driftResult.severity,
      findingCount: driftResult.findings.length,
      hasCritical: driftResult.hasCritical,
      hasHigh: driftResult.hasHigh,
      hasMedium: driftResult.hasMedium,
    },
    riskPosture: riskPostureResult.posture,
  };

  // exportSha256 = SHA256(canonicalStringify(payloadWithoutHash))
  const exportSha256 = sha256Hex(payloadWithoutHash);

  return {
    ...payloadWithoutHash,
    exportSha256,
  };
}

// FT_ECL_ENGINE: EXPORT_PIPELINE_V1 END
