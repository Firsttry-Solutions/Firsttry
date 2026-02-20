/**
 * verify_ecl_state.mjs — Offline ECL Export Verifier (Phase 2)
 *
 * Usage: node tools/verify_ecl_state.mjs <export.json>
 *
 * Output (always exactly 5 lines):
 *   VERIFIER_RESULT=FULL_PASS|MISMATCH|INCOMPLETE
 *   VERIFIED_MANIFEST=1|0
 *   VERIFIED_PAYLOAD=1|0
 *   SNAPSHOT_CHAIN=PASS|FAIL|SKIP
 *   LEDGER_CHAIN=PASS|FAIL|SKIP
 *
 * Exit codes: 0=FULL_PASS, 1=MISMATCH, 2=INCOMPLETE
 *
 * canonicalStringify inlined from src/utils/canonicalJson.ts (FT_ECL_CORE: CANONICAL_JSON_V1)
 * MUST stay bit-for-bit identical to producer logic. DO NOT use JSON.stringify directly.
 *
 * // FT_ECL_CORE: CANONICAL_JSON_V1
 * // FT_PROOF: VERIFY_ECL_STATE_V1
 */

import fs from 'node:fs';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// canonicalStringify — inlined from src/utils/canonicalJson.ts
// Rules: keys sorted ASCII ascending, array order preserved,
//        undefined/Date/Function/non-finite/circular → THROW
// ---------------------------------------------------------------------------
function canonicalStringify(obj, _seen) {
  const seen = _seen ?? new Set();

  if (obj === null) return 'null';

  if (obj === undefined) {
    throw new Error(
      '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: undefined value is not JSON-safe'
    );
  }
  if (obj instanceof Date) {
    throw new Error(
      '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: Date objects must be converted to ISO strings before serialization'
    );
  }
  if (typeof obj === 'function') {
    throw new Error(
      '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: functions are not JSON-safe'
    );
  }
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) {
      throw new Error(
        '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: non-finite number (NaN/Infinity) is not JSON-safe'
      );
    }
    if (Object.is(obj, -0)) return '0';
    return String(obj);
  }
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'bigint') {
    throw new Error(
      '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: BigInt is not JSON-safe'
    );
  }
  if (typeof obj === 'symbol') {
    throw new Error(
      '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: Symbol is not JSON-safe'
    );
  }
  if (typeof obj === 'object') {
    if (seen.has(obj)) {
      throw new Error(
        '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: circular reference detected'
      );
    }
    seen.add(obj);
    if (Array.isArray(obj)) {
      const items = obj.map((item) => {
        if (item === undefined) {
          throw new Error(
            '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: undefined in array is not JSON-safe'
          );
        }
        return canonicalStringify(item, seen);
      });
      seen.delete(obj);
      return '[' + items.join(',') + ']';
    }
    // Plain object: sort keys ASCII ascending
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((key) => {
      const val = obj[key];
      if (val === undefined) {
        throw new Error(
          `[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: undefined value for key "${key}" is not JSON-safe`
        );
      }
      return JSON.stringify(key) + ':' + canonicalStringify(val, seen);
    });
    seen.delete(obj);
    return '{' + pairs.join(',') + '}';
  }
  throw new Error(
    `[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: unsupported type "${typeof obj}"`
  );
}

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function printSummary(result, verifiedManifest, verifiedPayload, snapshotChain, ledgerChain) {
  console.log(`VERIFIER_RESULT=${result}`);
  console.log(`VERIFIED_MANIFEST=${verifiedManifest}`);
  console.log(`VERIFIED_PAYLOAD=${verifiedPayload}`);
  console.log(`SNAPSHOT_CHAIN=${snapshotChain}`);
  console.log(`LEDGER_CHAIN=${ledgerChain}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function verifySnapshotChain(blocks) {
  if (!Array.isArray(blocks)) return { status: 'SKIP', reason: 'NOT_READY:SNAPSHOT_CHAIN_BLOCKS' };

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!isObject(block)) return { status: 'FAIL', reason: 'MISMATCH:SNAPSHOT_BLOCK_OBJECT' };
    if (typeof block.index !== 'number') return { status: 'FAIL', reason: 'MISMATCH:SNAPSHOT_INDEX' };
    if (typeof block.prevHash !== 'string') return { status: 'FAIL', reason: 'MISMATCH:SNAPSHOT_PREV_HASH' };
    if (typeof block.payloadHash !== 'string') return { status: 'FAIL', reason: 'MISMATCH:SNAPSHOT_PAYLOAD_HASH' };
    if (typeof block.blockHash !== 'string') return { status: 'FAIL', reason: 'MISMATCH:SNAPSHOT_BLOCK_HASH' };

    const expectedBlockHash = sha256Hex(block.prevHash + block.payloadHash);
    if (expectedBlockHash !== block.blockHash) return { status: 'FAIL', reason: 'MISMATCH:SNAPSHOT_BLOCK_HASH_RECOMPUTE' };

    if (i > 0 && block.prevHash !== blocks[i - 1].blockHash) {
      return { status: 'FAIL', reason: 'MISMATCH:SNAPSHOT_CHAIN_LINK' };
    }
  }

  return { status: 'PASS' };
}

function verifyLedgerChain(blocks) {
  if (!Array.isArray(blocks)) return { status: 'SKIP', reason: 'NOT_READY:LEDGER_CHAIN_BLOCKS' };

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!isObject(block)) return { status: 'FAIL', reason: 'MISMATCH:LEDGER_BLOCK_OBJECT' };
    if (typeof block.index !== 'number') return { status: 'FAIL', reason: 'MISMATCH:LEDGER_INDEX' };
    if (typeof block.prevHash !== 'string') return { status: 'FAIL', reason: 'MISMATCH:LEDGER_PREV_HASH' };
    if (typeof block.payloadHash !== 'string') return { status: 'FAIL', reason: 'MISMATCH:LEDGER_PAYLOAD_HASH' };
    if (typeof block.entryHash !== 'string') return { status: 'FAIL', reason: 'MISMATCH:LEDGER_ENTRY_HASH' };

    const expectedEntryHash = sha256Hex(block.prevHash + block.payloadHash);
    if (expectedEntryHash !== block.entryHash) return { status: 'FAIL', reason: 'MISMATCH:LEDGER_ENTRY_HASH_RECOMPUTE' };

    if (i > 0 && block.prevHash !== blocks[i - 1].entryHash) {
      return { status: 'FAIL', reason: 'MISMATCH:LEDGER_CHAIN_LINK' };
    }
  }

  return { status: 'PASS' };
}

async function main() {
  let result = 'INCOMPLETE';
  let verifiedManifest = 0;
  let verifiedPayload = 0;
  let snapshotChain = 'SKIP';
  let ledgerChain = 'SKIP';
  let exitCode = 2;

  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('REASON=NOT_READY:INPUT_PATH');
    printSummary(result, verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
    process.exit(2);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch {
    console.error('REASON=NOT_READY:INPUT_PARSE');
    printSummary(result, verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
    process.exit(2);
  }

  const manifest = parsed?.manifest;
  const payload = parsed?.payload;

  if (!isObject(manifest) || !isObject(payload)) {
    console.error('REASON=NOT_READY:EXPORT_SHAPE');
    printSummary(result, verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
    process.exit(2);
  }

  const expectedManifest = payload?.proofs?.exportManifestSha256;
  const expectedPayload = payload?.proofs?.exportPayloadSha256;

  if (typeof expectedManifest !== 'string' || typeof expectedPayload !== 'string') {
    console.error('REASON=NOT_READY:PROOF_HASH_FIELDS');
    printSummary(result, verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
    process.exit(2);
  }

  const computedManifest = sha256Hex(canonicalStringify(manifest));
  verifiedManifest = computedManifest === expectedManifest ? 1 : 0;
  if (verifiedManifest === 0) {
    result = 'MISMATCH';
    snapshotChain = 'SKIP';
    ledgerChain = 'SKIP';
    printSummary(result, verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
    process.exit(1);
  }

  let payloadForHash;
  try {
    payloadForHash = JSON.parse(JSON.stringify(payload));
  } catch {
    console.error('REASON=NOT_READY:PAYLOAD_CLONE');
    printSummary('INCOMPLETE', verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
    process.exit(2);
  }

  if (!isObject(payloadForHash.proofs)) {
    console.error('REASON=NOT_READY:PAYLOAD_PROOFS_OBJECT');
    printSummary('INCOMPLETE', verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
    process.exit(2);
  }

  delete payloadForHash.proofs.exportManifestSha256;
  delete payloadForHash.proofs.exportPayloadSha256;

  const computedPayload = sha256Hex(canonicalStringify(payloadForHash));
  verifiedPayload = computedPayload === expectedPayload ? 1 : 0;
  if (verifiedPayload === 0) {
    result = 'MISMATCH';
    snapshotChain = 'SKIP';
    ledgerChain = 'SKIP';
    printSummary(result, verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
    process.exit(1);
  }

  const snapshot = verifySnapshotChain(payload.snapshotChainBlocks);
  snapshotChain = snapshot.status;
  if (snapshotChain === 'FAIL') {
    printSummary('MISMATCH', verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
    process.exit(1);
  }

  const ledger = verifyLedgerChain(payload.ledgerBlocks);
  ledgerChain = ledger.status;
  if (ledgerChain === 'FAIL') {
    printSummary('MISMATCH', verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
    process.exit(1);
  }

  if (snapshotChain === 'SKIP' || ledgerChain === 'SKIP') {
    console.error(`REASON=${snapshot.reason || ledger.reason || 'NOT_READY:CHAIN_BLOCKS'}`);
    printSummary('INCOMPLETE', verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
    process.exit(2);
  }

  result = 'FULL_PASS';
  exitCode = 0;
  printSummary(result, verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
  process.exit(exitCode);
}

void main();
