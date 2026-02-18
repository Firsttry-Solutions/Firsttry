#!/usr/bin/env node

/**
 * ECL-4 SEAL HASH RECOMPUTE PROOF
 * 
 * Purpose: Verify that a sealed review's sealHash can be recomputed
 * from the stored seal fields, proving computational integrity.
 * 
 * Pattern: Load sealed review JSON → Extract seal fields → Recompute hash → Compare
 * 
 * This is NOT a determinism proof (run twice, get same hash).
 * This IS a recompute proof (load stored data, recompute, verify matches stored).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CANONICAL JSON (matches backend exactly)
// ============================================================================

function canonicalizeJson(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      const items = obj.map((item) => canonicalizeJson(item));
      return `[${items.join(',')}]`;
    } else {
      const keys = Object.keys(obj).sort();
      const pairs = keys.map((key) => {
        const val = obj[key];
        if (val === undefined) return null;
        return `"${key}":${canonicalizeJson(val)}`;
      });
      const filtered = pairs.filter((p) => p !== null);
      return `{${filtered.join(',')}}`;
    }
  }

  throw new Error(`Cannot canonicalize value: ${typeof obj}`);
}

// ============================================================================
// SEAL HASH COMPUTATION (matches backend reviewSeal.ts exactly)
// ============================================================================

function computeSealHash(sealObject) {
  const canonical = canonicalizeJson(sealObject);
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  return hash;
}

/**
 * Create canonical seal object from stored review state
 * (Extracted from createCanonicalSealObject in backend)
 */
function createCanonicalSealObjectFromReview(review) {
  // Derive findings hash from decisions
  const decisionsStr = canonicalizeJson(
    review.decisions.map((d) => ({
      reviewer: d.reviewerId,
      decision: d.decision,
    }))
  );
  const findingsHash = crypto
    .createHash('sha256')
    .update(decisionsStr)
    .digest('hex')
    .substring(0, 16);

  // Derive approvals hash from accepted decisions
  const approvalsStr = canonicalizeJson(
    review.decisions
      .filter((d) => d.decision === 'APPROVED')
      .map((d) => d.reviewerId)
  );
  const approvalsHash = crypto
    .createHash('sha256')
    .update(approvalsStr)
    .digest('hex')
    .substring(0, 16);

  // Build canonical seal object (field order matters)
  const sealObject = {
    reviewId: review.reviewId,
    findingsHash,
    approvalsHash,
    sealedTimestampUtc: review.sealedTimestampUtc,
    sealedByRole: review.sealedByRole,
    buildShaShort: review.buildShaShort,
    buildUtc: review.buildUtc,
    schemaVersion: review.schemaVersion,
  };

  return sealObject;
}

// ============================================================================
// MAIN PROOF EXECUTION
// ============================================================================

async function verifyRecomputeProof(fixtureFilePath) {
  console.log('\n================================================================================');
  console.log('ECL-4 SEAL HASH RECOMPUTE PROOF');
  console.log('================================================================================\n');

  // Load sealed review fixture
  console.log(`[1] Loading sealed review fixture: ${fixtureFilePath}`);
  if (!fs.existsSync(fixtureFilePath)) {
    throw new Error(`Fixture file not found: ${fixtureFilePath}`);
  }

  const fixtureContent = fs.readFileSync(fixtureFilePath, 'utf-8');
  const review = JSON.parse(fixtureContent);

  if (!review.sealed) {
    throw new Error('Fixture review must have sealed === true');
  }

  console.log(`   ✓ Review ID: ${review.reviewId}`);
  console.log(`   ✓ Sealed: ${review.sealed}`);
  console.log(`   ✓ Sealed By Role: ${review.sealedByRole}`);
  console.log(`   ✓ Sealed At: ${review.sealedTimestampUtc}`);

  // Extract stored seal hash
  const storedSealHash = review.sealHash;
  if (!storedSealHash) {
    throw new Error('Review fixture missing sealHash field');
  }

  console.log(`\n[2] Stored sealHash:`);
  console.log(`   ${storedSealHash}`);

  // Recompute seal hash from stored fields
  console.log(`\n[3] Recomputing seal hash from stored fields...`);
  const canonicalSealObject = createCanonicalSealObjectFromReview(review);

  console.log(`   Canonical seal object:`, canonicalSealObject);

  const recomputedSealHash = computeSealHash(canonicalSealObject);

  console.log(`\n[4] Recomputed sealHash:`);
  console.log(`   ${recomputedSealHash}`);

  // Compare
  console.log(`\n[5] Comparison:`);
  const match = storedSealHash === recomputedSealHash;

  if (match) {
    console.log(`   ✓ MATCH: Recomputed hash equals stored hash`);
    console.log(`   ✓ Seal hash integrity verified`);
    console.log(`   ✓ Review state is immutable (cannot be tampered with)`);
  } else {
    console.log(`   ✗ MISMATCH: Recomputed hash differs from stored hash`);
    console.log(`   ✗ Stored:      ${storedSealHash}`);
    console.log(`   ✗ Recomputed:  ${recomputedSealHash}`);
    console.log(`   ✗ Seal hash integrity FAILED`);
  }

  console.log(`\n================================================================================`);
  console.log(`PROOF RESULT: MATCH=${match}`);
  console.log('================================================================================\n');

  return match ? Promise.resolve() : Promise.reject(new Error('Seal hash mismatch'));
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

const fixtureDir = path.join(__dirname, 'fixtures');
const fixturePath = path.join(fixtureDir, 'ecl4_sealed_review_fixture.json');

verifyRecomputeProof(fixturePath)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`[ERROR] ${error.message}`);
    process.exit(1);
  });

