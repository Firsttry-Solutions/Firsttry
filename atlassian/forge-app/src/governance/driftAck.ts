/**
 * Deterministic Drift Acknowledgement Workflow for ECL-3
 *
 * Records explicit acknowledgements of infrastructure drift with:
 * - Ticket linkage (optional, may be null)
 * - Reason classification
 * - RBAC validation
 * - Deterministic build identity anchoring
 * - SHA-256 hash verification (tamper detection)
 *
 * Storage Namespace: ecl.drift.ack
 * Fail-closed semantics throughout
 *
 * FT_ECL_PHASE: ECL-3 DRIFT_ACK
 */

import { storage } from "@forge/api";
import { sha256Hex, canonicalJsonString } from "../milestone1/canonicalize";
import { EclRole, EclAction, hasPermission } from "./rbac";
import { BACKEND_GIT_SHA_SHORT, BACKEND_BUILD_TIME_UTC } from "../build/buildIdentityBackend.gen";
import { Clock, SystemClock } from "../shared/clock";

/**
 * Drift acknowledgement reason codes (hardcoded)
 */
export enum EclDriftAckReasonCode {
  AUTHORIZED_CHANGE = "authorized_change",
  TEMP_EXCEPTION = "temp_exception",
  FALSE_POSITIVE = "false_positive",
  ACCEPTED_RISK = "accepted_risk"
}

/**
 * Drift acknowledgement record (stored)
 * All fields required for determinism and auditability
 */
export interface DriftAckRecord {
  // Drift identifier (content-addressed from drift event)
  driftId: string;

  // Optional ticket reference (may be null if no related ticket)
  ticketId: string | null;

  // Reason classification
  reasonCode: EclDriftAckReasonCode;

  // Role of the acknowledger
  approverRole: EclRole;

  // Acknowledgement timestamp (ISO-8601 UTC)
  ackTimestampUtc: string;

  // Build identity anchors (deterministic)
  buildShaShort: string;
  buildUtc: string;
  schemaVersion: string;

  // SHA-256 hash of canonical JSON (computed without this field)
  ackHash: string;
}

/**
 * Schema version for drift ack records
 */
const DRIFT_ACK_SCHEMA_VERSION = "ecl.driftAck@1";

/**
 * Assert non-empty string value (fail-closed)
 */
function assertNonEmptyString(value: any, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`FAIL_CLOSED: ${label} must be a non-empty string, got ${typeof value}`);
  }
}

/**
 * Get storage key for drift acknowledgement
 * @param driftId The drift identifier
 * @returns Storage key string
 */
export function getAckKey(driftId: string): string {
  return `ecl.drift.ack.${driftId}`;
}

/**
 * Acknowledge a drift event with optional ticket linkage
 *
 * FAIL-CLOSED RULES:
 * - driftId must be non-empty string
 * - reasonCode must be valid enum value
 * - actorRole must have ACCEPT_DRIFT permission
 * - ticketId argument must be explicitly provided (not undefined)
 * - buildShaShort/buildUtc sourced from same build identity as governance action log
 * - ack hash computed from canonical representation (without ackHash field)
 * - storage write failure throws explicit error code
 *
 * @param driftId Unique drift identifier
 * @param ticketId Optional ticket reference (null allowed if no ticket)
 * @param reasonCode Reason classification from enum
 * @param actorRole Role of acknowledger (must have permission for ACCEPT_DRIFT)
 * @returns Promise<DriftAckRecord> The created acknowledgement record
 * @throws On validation failure, permission denial, or storage error
 */
export async function acknowledgeDrift(
  driftId: string,
  ticketId: string | null,
  reasonCode: EclDriftAckReasonCode,
  actorRole: EclRole,
  clock: Clock = SystemClock
): Promise<DriftAckRecord> {
  // Validate driftId (fail-closed)
  assertNonEmptyString(driftId, "driftId");

  // Validate reasonCode is enum value (fail-closed)
  const validReasons = Object.values(EclDriftAckReasonCode);
  if (!validReasons.includes(reasonCode)) {
    throw new Error(`FAIL_CLOSED: reasonCode must be valid enum value, got ${reasonCode}`);
  }

  // Validate ticketId argument was explicitly provided (not undefined)
  // (null IS valid; undefined is not)
  if (ticketId === undefined) {
    throw new Error("FT_ECL_TICKET_UNSET: ticketId must be explicitly set (may be null)");
  }

  // Validate actorRole has permission for ACCEPT_DRIFT (fail-closed)
  if (!hasPermission(actorRole, EclAction.ACCEPT_DRIFT)) {
    throw new Error("FT_ECL_RBAC_DENY: actorRole does not have permission for ACCEPT_DRIFT");
  }

  // Get current timestamp
  const ackTimestampUtc = clock.nowISO();

  // Build identity from same source as governance action log
  const buildShaShort = BACKEND_GIT_SHA_SHORT;
  const buildUtc = BACKEND_BUILD_TIME_UTC;
  const schemaVersion = DRIFT_ACK_SCHEMA_VERSION;

  // Build record WITHOUT ackHash for hashing
  const recordForHashing = {
    driftId,
    ticketId,
    reasonCode,
    approverRole: actorRole,
    ackTimestampUtc,
    buildShaShort,
    buildUtc,
    schemaVersion
  };

  // Compute ackHash using canonical representation
  let ackHash: string;
  try {
    const canonical = canonicalJsonString(recordForHashing);
    ackHash = sha256Hex(canonical);
  } catch (err) {
    throw new Error(`FAIL_CLOSED: Cannot compute ackHash: ${err}`);
  }

  // Complete record with ackHash
  const completeRecord: DriftAckRecord = {
    ...recordForHashing,
    ackHash
  };

  // Store to Forge storage under prefixed key
  const storageKey = getAckKey(driftId);

  try {
    await storage.set(storageKey, JSON.stringify(completeRecord));
  } catch (err) {
    throw new Error(`FT_ECL_DRIFT_ACK_WRITE_FAILED: Cannot persist drift ack record: ${err}`);
  }

  return completeRecord;
}

/**
 * Retrieve drift acknowledgement record
 *
 * FAIL-CLOSED RULES:
 * - Storage read error throws explicit error code
 * - Record not found returns null (normal state)
 * - Stored record hash is recomputed and verified
 * - Hash mismatch throws tamper detection error
 *
 * @param driftId The drift identifier
 * @returns Promise<DriftAckRecord | null> The record if found, null if not found
 * @throws On storage read error or tamper detection
 */
export async function getDriftAck(driftId: string): Promise<DriftAckRecord | null> {
  assertNonEmptyString(driftId, "driftId");

  const storageKey = getAckKey(driftId);

  // Attempt storage read (fail-closed)
  let valueStr: string | undefined;
  try {
    valueStr = await storage.get(storageKey);
  } catch (err) {
    throw new Error(`FT_ECL_DRIFT_ACK_READ_FAILED: Cannot read drift ack from storage: ${err}`);
  }

  // Not found
  if (valueStr === undefined) {
    return null;
  }

  // Parse record (fail-closed)
  let record: DriftAckRecord;
  try {
    record = JSON.parse(valueStr);
  } catch (err) {
    throw new Error(`FT_ECL_DRIFT_ACK_TAMPER_DETECTED: Cannot parse drift ack record: ${err}`);
  }

  // Validate record structure
  if (!record || !record.driftId || record.ackHash === undefined) {
    throw new Error("FT_ECL_DRIFT_ACK_TAMPER_DETECTED: Missing required fields in drift ack record");
  }

  // ECL-3: Hash re-verification + tamper detection
  const recordForVerification = {
    driftId: record.driftId,
    ticketId: record.ticketId,
    reasonCode: record.reasonCode,
    approverRole: record.approverRole,
    ackTimestampUtc: record.ackTimestampUtc,
    buildShaShort: record.buildShaShort,
    buildUtc: record.buildUtc,
    schemaVersion: record.schemaVersion
  };

  try {
    const canonical = canonicalJsonString(recordForVerification);
    const recomputedHash = sha256Hex(canonical);

    if (recomputedHash !== record.ackHash) {
      throw new Error(
        `FT_ECL_DRIFT_ACK_TAMPER_DETECTED: Hash mismatch for driftId ${driftId}. ` +
        `Expected ${recomputedHash}, got ${record.ackHash}`
      );
    }
  } catch (hashErr) {
    const errMsg = String(hashErr);
    if (errMsg.includes("FT_ECL_DRIFT_ACK_TAMPER_DETECTED")) {
      throw hashErr;
    }
    throw new Error(`FT_ECL_DRIFT_ACK_TAMPER_DETECTED: Cannot verify ack hash: ${hashErr}`);
  }

  return record;
}

/**
 * Verify a drift ack record's hash
 * @param record The record to verify
 * @returns true if hash matches, false otherwise
 */
export function verifyDriftAckHash(record: DriftAckRecord): boolean {
  try {
    const recordForVerification = {
      driftId: record.driftId,
      ticketId: record.ticketId,
      reasonCode: record.reasonCode,
      approverRole: record.approverRole,
      ackTimestampUtc: record.ackTimestampUtc,
      buildShaShort: record.buildShaShort,
      buildUtc: record.buildUtc,
      schemaVersion: record.schemaVersion
    };

    const canonical = canonicalJsonString(recordForVerification);
    const recomputedHash = sha256Hex(canonical);

    return recomputedHash === record.ackHash;
  } catch (err) {
    console.error(`[ECL-3 DRIFT_ACK] Hash verification failed: ${err}`);
    return false;
  }
}
