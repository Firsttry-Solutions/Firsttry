#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';

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

async function loadCanonicalStringify() {
  try {
    const mod = await import('../src/utils/canonicalJson.ts');
    if (typeof mod.canonicalStringify !== 'function') {
      return { ok: false, reason: 'NOT_READY:CANONICAL_STRINGIFY_MISSING' };
    }
    return { ok: true, canonicalStringify: mod.canonicalStringify };
  } catch {
    return { ok: false, reason: 'NOT_READY:CANONICAL_STRINGIFY_IMPORT_FAIL' };
  }
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

  const canonical = await loadCanonicalStringify();
  if (!canonical.ok) {
    console.error(`REASON=${canonical.reason}`);
    printSummary(result, verifiedManifest, verifiedPayload, snapshotChain, ledgerChain);
    process.exit(2);
  }

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

  const computedManifest = sha256Hex(canonical.canonicalStringify(manifest));
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

  const computedPayload = sha256Hex(canonical.canonicalStringify(payloadForHash));
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
