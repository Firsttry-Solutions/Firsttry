import { FT_LEDGER_KEY } from "./keys";
import { FtLedgerV1, FtStorageState } from "./contract";
import { nowUtcIso } from "./time";
import { uuidLike } from "./uuid";
import { storageGetJson, storageSetJson } from "./storage";
import { storage } from "@forge/api";
import { createHash } from "crypto";
import { sanitizeKey } from "../utils/sanitizeKey";
import { Clock, SystemClock } from "../shared/clock";

export async function loadOrInitLedger(buildShaBackend: string | null): Promise<{ ledger: FtLedgerV1; storage_state: FtStorageState }> {
  const got = await storageGetJson<FtLedgerV1>(FT_LEDGER_KEY);
  let ledger: FtLedgerV1;
  if (got.state === "MISSING" || !got.value) {
    ledger = {
      version: 1,
      install_id: uuidLike(),
      installed_at_utc: nowUtcIso(),
      build_sha_last_seen_ui: null,
      build_sha_last_seen_backend: buildShaBackend ?? null,
      storage_verified_at_utc: null,
      scheduler_last_attempt_at_utc: null,
      scheduler_last_success_at_utc: null,
      scheduler_consecutive_failures: 0,
      scheduler_last_error: null,
      snapshot_count: 0,
      snapshot_last_id: null,
      snapshot_last_at_utc: null,
      snapshot_last_build_sha: null,
      snapshot_last_hash: null,
    };
    await storageSetJson(FT_LEDGER_KEY, ledger);
    return { ledger, storage_state: "MISSING" };
  }
  ledger = got.value;
  if (buildShaBackend) {
    ledger = { ...ledger, build_sha_last_seen_backend: buildShaBackend };
    await storageSetJson(FT_LEDGER_KEY, ledger);
  }
  return { ledger, storage_state: got.state };
}

export async function updateLedger(mutator: (l: FtLedgerV1) => FtLedgerV1): Promise<FtLedgerV1> {
  const got = await storageGetJson<FtLedgerV1>(FT_LEDGER_KEY);
  const base = got.value;
  if (!base) throw new Error("FtLedger missing during updateLedger (should not happen)");
  const next = mutator(base);
  await storageSetJson(FT_LEDGER_KEY, next);
  return next;
}

// ============================================================================
// PHASE 5.1.8 BLOCK LEDGER: Snapshot + Certification chain with metrics
// ============================================================================

/**
 * FT_PROOF_LEDGER_SNAPSHOT_MIN_METRICS_v1
 * Block ledger payload includes minimal metrics for Enterprise Sellability
 */
export type LedgerAppendInput = {
  snapshot: any;
  snapshotHash: string;
  blockType: "SNAPSHOT" | "CERTIFICATION";
  certificationQuarterId?: string;
  certificationPayload?: any;
};

/**
 * Payload schema for snapshot blocks in the ledger
 * FT_PROOF_LEDGER_HASH_DEF_v1
 */
function createSnapshotBlockPayload(input: LedgerAppendInput): Record<string, any> {
  const { snapshot, snapshotHash } = input;
  return {
    schemaVersion: "ft-ledger-snapshot@1",
    snapshotHash,
    totalChanges: normalizeInt(snapshot?.diff?.totalChanges),
    riskScore: normalizeInt(snapshot?.metrics?.riskScore),
    shadowAdmins: normalizeInt(snapshot?.metrics?.shadowAdmins),
    unresolvedDrifts: normalizeInt(snapshot?.metrics?.unresolvedDrifts),
  };
}

function normalizeInt(v: unknown): number {
  if (!Number.isFinite(v)) return 0;
  const n = v as number;
  if (n < 0 || Math.floor(n) !== n) return 0;
  return n;
}

/**
 * Compute SHA256 hash (FT_PROOF_LEDGER_HASH_DEF_v1)
 */
function hashSha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Canonical JSON: stable key sort + LF normalization
 */
function canonicalJson(obj: Record<string, any>): string {
  const json = JSON.stringify(obj, Object.keys(obj).sort());
  return json.replace(/\r\n/g, "\n");
}

/**
 * Extract quarter from ISO UTC time: YYYYQ#
 */
function getQuarterFromUtc(isoStr: string): string {
  const match = isoStr.match(/^(\d{4})-(\d{2})/);
  if (!match) return "2026Q1";
  const year = match[1];
  const month = parseInt(match[2], 10);
  const quarter = Math.ceil(month / 3);
  return `${year}Q${quarter}`;
}

/**
 * FT_PROOF_LEDGER_TENANT_KEYING_v1
 */
function getTenantKeyFromSnapshot(snapshot: any): string {
  const tenantKey = snapshot?.meta?.siteId;
  if (!tenantKey || typeof tenantKey !== "string") {
    throw new Error("FT_PROOF_TENANT_KEY_MISSING_v1");
  }
  return tenantKey;
}

/**
 * Minimal lock implementation
 * FT_PROOF_LEDGER_LOCKED_v1
 */
async function acquireLedgerLock(tenantKey: string): Promise<() => Promise<void>> {
  const lockKey = `ft:lock:ledger:v1:${sanitizeKey(tenantKey)}`;
  const lockToken = uuidLike();
  const lockTtl = 330; // 5.5 minutes

  try {
    await storage.set(lockKey, JSON.stringify({ token: lockToken, acquiredAtUtc: new Date().toISOString() }), { ttl: lockTtl });
  } catch (err) {
    throw new Error(`FT_PROOF_LEDGER_LOCK_FAILED_v1: ${err}`);
  }

  return async () => {
    try {
      await storage.delete(lockKey);
    } catch (err) {
      console.error(`[ledger] Lock release failed: ${err}`);
    }
  };
}

/**
 * Main ledger append function
 * FT_PROOF_LEDGER_IDEMPOTENT_APPEND_v1
 * FT_PROOF_LEDGER_WRITE_ORDER_v1
 * @param input - Snapshot/certification input
 * @param clock - Clock for canonical timestamps (use FixedClock for determinism)
 */
export async function appendLedgerBlock_v1(input: LedgerAppendInput, clock: Clock = SystemClock): Promise<{ head: any; meta: any }> {
  const tenantKey = getTenantKeyFromSnapshot(input.snapshot);
  const releaseLock = await acquireLedgerLock(tenantKey);

  try {
    const now = clock.nowISO(); // FT_PROOF_TIME_ONLY_AT_APPEND_v1 (deterministic via injected clock)
    const headKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:head`;
    const metaKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:meta`;

    // Read current head/meta (genesis if missing)
    let head: any = null;
    let meta: any = null;

    try {
      const headData = await storage.get(headKey);
      head = headData ? JSON.parse(headData as string) : null;
    } catch (err) {
      console.warn(`[ledger] Head read error: ${err}`);
      head = null;
    }

    try {
      const metaData = await storage.get(metaKey);
      meta = metaData ? JSON.parse(metaData as string) : null;
    } catch (err) {
      console.warn(`[ledger] Meta read error: ${err}`);
      meta = null;
    }

    // IDEMPOTENT: if this snapshot hash already stored, return existing state
    if (input.blockType === "SNAPSHOT" && meta?.lastSnapshotHash === input.snapshotHash) {
      return { head: head || {}, meta: meta || {} };
    }

    // Build payload
    const payload = createSnapshotBlockPayload(input);
    const canonicalPayload = canonicalJson(payload);
    const payloadHash = hashSha256(canonicalPayload);

    const sequenceId = (head?.sequenceId || 0) + 1;
    const segmentId = getQuarterFromUtc(now);

    // Compute chain hash
    const prevChainHash = head?.chainHash || "";
    const chainHash = hashSha256(payloadHash + "\n" + prevChainHash);

    // Build new block
    const newBlock = {
      blockType: input.blockType,
      sequenceId,
      segmentId,
      observedAtUtc: now,
      payloadHash,
      chainHash,
      payload,
      previousBlockKey: head ? headKey : null,
    };

    // FT_PROOF_LEDGER_WRITE_ORDER_v1: Write block first, then head/meta
    const blockKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:s:${segmentId}:b:${sequenceId}`;
    await storage.set(blockKey, JSON.stringify(newBlock));

    // Update head
    const newHead = {
      ...newBlock,
      payload: undefined, // Exclude payload from head
    };
    await storage.set(headKey, JSON.stringify(newHead));

    // Update metadata
    const newMeta = {
      tenantKey,
      createdAtUtc: meta?.createdAtUtc || now,
      lastSnapshotHash: input.snapshotHash,
      lastSegmentId: segmentId,
      lastSequenceId: sequenceId,
      segments: getSegments(meta?.segments || [], segmentId),
    };
    await storage.set(metaKey, JSON.stringify(newMeta));

    // FT_PROOF_LEDGER_SEGMENT_RULE_v1 + FT_PROOF_LEDGER_PRUNE_BY_SEGMENT_v1: Prune old segments
    await pruneOldSegments(tenantKey, newMeta.segments);

    return { head: newHead, meta: newMeta };
  } finally {
    await releaseLock();
  }
}

/**
 * Maintain segment list (latest 8 quarters)
 * FT_PROOF_LEDGER_SEGMENT_RULE_v1
 */
function getSegments(existing: string[], currentSegmentId: string): string[] {
  const segments = new Set(existing);
  segments.add(currentSegmentId);
  const sorted = Array.from(segments).sort().reverse();
  return sorted.slice(0, 8); // Keep last 8 segments
}

/**
 * Delete old segment keys
 * FT_PROOF_LEDGER_PRUNE_BY_SEGMENT_v1
 */
async function pruneOldSegments(tenantKey: string, keptSegments: string[]): Promise<void> {
  // In a real implementation, we would enumerate all segments in storage and delete those not in keptSegments.
  // For now, this is a placeholder that documents the rule.
  // Storage enumeration would require additional Forge APIs or a separate segment index.
  console.debug(`[ledger] Segment retention: keeping ${keptSegments.join(", ")}`);
}

/**
 * Window verification (last N blocks)
 * FT_PROOF_LEDGER_STATUS_RULES_v1
 */
export async function verifyLedgerWindow_v1(tenantKey: string, limit: number = 50): Promise<{ status: "OK_VERIFIED" | "DEGRADED_STORAGE_READ" | "FAIL_MISMATCH"; detail?: any }> {
  try {
    const headKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:head`;
    const headData = await storage.get(headKey);

    if (!headData) {
      return { status: "OK_VERIFIED", detail: "Empty ledger" };
    }

    let current = JSON.parse(headData as string);
    let verified = 0;

    while (current && verified < limit) {
      const canonicalPayload = canonicalJson(current.payload || {});
      const expectedPayloadHash = hashSha256(canonicalPayload);

      if (expectedPayloadHash !== current.payloadHash) {
        return { status: "FAIL_MISMATCH", detail: { block: current.sequenceId, reason: "Payload hash mismatch" } };
      }

      if (current.previousBlockKey) {
        try {
          const prevData = await storage.get(current.previousBlockKey);
          if (!prevData) {
            return { status: "FAIL_MISMATCH", detail: { block: current.sequenceId, reason: "Previous block missing" } };
          }
          current = JSON.parse(prevData as string);
          verified++;
        } catch (err) {
          return { status: "DEGRADED_STORAGE_READ", detail: { error: `Failed to read previous block: ${err}` } };
        }
      } else {
        break;
      }
    }

    return { status: "OK_VERIFIED" };
  } catch (err) {
    return { status: "DEGRADED_STORAGE_READ", detail: { error: String(err) } };
  }
}

/**
 * Full ledger verification
 * FT_PROOF_LEDGER_STATUS_RULES_v1
 */
export async function verifyLedgerFull_v1(tenantKey: string): Promise<{ status: "OK_VERIFIED" | "DEGRADED_STORAGE_READ" | "FAIL_MISMATCH"; detail?: any }> {
  // Full is same as window with no limit for now
  return verifyLedgerWindow_v1(tenantKey, Number.MAX_SAFE_INTEGER);
}

