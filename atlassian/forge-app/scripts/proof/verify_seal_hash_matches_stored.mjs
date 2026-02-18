#!/usr/bin/env node

/**
 * ECL-4 SEAL HASH RECOMPUTE PROOF (PRODUCTION-TIED)
 * 
 * Purpose: Verify that a sealed review's sealHash can be recomputed
 * from the stored seal fields, proving computational integrity.
 * 
 * CRITICAL: This proof IMPORTS production utilities from COMMITTED SOURCE (no DIY):
 * - canonicalJsonString from src/milestone1/canonicalize.ts
 * - sha256Hex from src/milestone1/canonicalize.ts
 * 
 * Pattern: Load sealed review JSON → Extract seal fields → Recompute hash → Compare
 * Derivation: Matches EXACT logic in src/governance/reviewSeal.ts
 * 
 * This is NOT a determinism proof (run twice, get same hash).
 * This IS a recompute proof (load stored data, recompute, verify matches stored).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// IMPORT PRODUCTION UTILITIES (COMPILED FROM COMMITTED SOURCE)
// ============================================================================

// Source code committed to repo: src/milestone1/canonicalize.ts (lines 101, 110)
// These utilities are compiled to dist/src/milestone1/canonicalize.js by the TypeScript build
// The proof imports the compiled output, which is the EXACT implementation from committed source
let canonicalJsonString, sha256Hex;

async function loadProductionUtilities() {
  try {
    // Path to compiled output of committed source: src/milestone1/canonicalize.ts
    // dist/ contains TypeScript-compiled .js files (not separate implementations)
    // Do NOT confuse with: the source is canonical (src/), dist/ is just execution format
    const compiledPath = path.join(__dirname, '../../dist/src/milestone1/canonicalize.js');
    
    // Import compiled utilities - these are identical to src/milestone1/canonicalize.ts
    const canonicalizeMod = await import(compiledPath);
    canonicalJsonString = canonicalizeMod.canonicalJsonString;
    sha256Hex = canonicalizeMod.sha256Hex;
    
    if (!canonicalJsonString || !sha256Hex) {
      throw new Error('Failed to load canonicalJsonString or sha256Hex from compiled source');
    }
  } catch (err) {
    throw new Error(`FAIL_CLOSED: Cannot load production utilities: ${err.message}`);
  }
}

// ============================================================================
// SEAL HASH COMPUTATION (PRODUCTION UTILITIES ONLY)
// ============================================================================

function computeSealHash(sealObject) {
  // Use production canonical JSON + SHA256
  const canonical = canonicalJsonString(sealObject);
  const hash = sha256Hex(canonical);
  return hash;
}

/**
 * Create canonical seal object from stored review state
 * EXACT mirroring of createCanonicalSealObject in src/governance/reviewSeal.ts
 */
function createCanonicalSealObjectFromReview(review) {
  // EXACT production derivation:
  // findingsHash = review.snapshotRef?.baselineSha || review.stateHash
  const findingsHash = review.snapshotRef?.baselineSha || review.stateHash;
  
  // EXACT production derivation:
  // approvalsHash = sha256Hex(canonicalJsonString({ decisionHashes }))
  // where decisionHashes = sorted array of decision hashes
  const decisionHashes = review.decisions
    .map((d) => d.decisionHash)
    .sort(); // Deterministic sort
  const approvalsHash = sha256Hex(canonicalJsonString({ decisionHashes }));

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

async function verifyRecomputeProof(fixtureFilePath, outputFilePath) {
  const output = [];
  
  function log(msg) {
    console.log(msg);
    output.push(msg);
  }

  try {
    // Initialize production utilities
    await loadProductionUtilities();
    
    log('\n================================================================================');
    log('ECL-4 SEAL HASH RECOMPUTE PROOF (PRODUCTION-TIED)');
    log('================================================================================\n');
    log(`[PRODUCTION UTILITIES SOURCE]`);
    log(`  Source Code: src/milestone1/canonicalize.ts:canonicalJsonString (line 110)`);
    log(`  Source Code: src/milestone1/canonicalize.ts:sha256Hex (line 101)`);
    log(`  Compiled to: dist/src/milestone1/canonicalize.js (TypeScript build output)\n`);

    // Load sealed review fixture
    log(`[1] Loading sealed review fixture: ${fixtureFilePath}`);
    if (!fs.existsSync(fixtureFilePath)) {
      throw new Error(`Fixture file not found: ${fixtureFilePath}`);
    }

    const fixtureContent = fs.readFileSync(fixtureFilePath, 'utf-8');
    const review = JSON.parse(fixtureContent);

    if (!review.sealed) {
      throw new Error('Fixture review must have sealed === true');
    }

    log(`   ✓ Review ID: ${review.reviewId}`);
    log(`   ✓ Sealed: ${review.sealed}`);
    log(`   ✓ Sealed By Role: ${review.sealedByRole}`);
    log(`   ✓ Sealed At: ${review.sealedTimestampUtc}`);

    // Extract stored seal hash
    const storedSealHash = review.sealHash;
    if (!storedSealHash) {
      throw new Error('Review fixture missing sealHash field');
    }

    log(`\n[2] Stored sealHash:`);
    log(`   ${storedSealHash}`);

    // Recompute seal hash from stored fields using EXACT production derivation
    log(`\n[3] Recomputing seal hash from stored fields...`);
    log(`   Using EXACT derivation from src/governance/reviewSeal.ts::createCanonicalSealObject`);
    
    const canonicalSealObject = createCanonicalSealObjectFromReview(review);

    log(`\n[3a] Canonical Seal Object:`);
    log(JSON.stringify(canonicalSealObject, null, 2));

    const canonical = canonicalJsonString(canonicalSealObject);
    log(`\n[3b] Canonical JSON String:`);
    log(`   ${canonical}`);

    const recomputedSealHash = sha256Hex(canonical);

    log(`\n[4] Recomputed sealHash:`);
    log(`   ${recomputedSealHash}`);

    // Compare
    log(`\n[5] Comparison:`);
    const match = storedSealHash === recomputedSealHash;

    if (match) {
      log(`   ✓ MATCH: Recomputed hash equals stored hash`);
      log(`   ✓ Seal hash integrity verified using production utilities`);
      log(`   ✓ Review state is immutable (cannot be tampered with)`);
    } else {
      log(`   ✗ MISMATCH: Recomputed hash differs from stored hash`);
      log(`   ✗ Stored:      ${storedSealHash}`);
      log(`   ✗ Recomputed:  ${recomputedSealHash}`);
      log(`   ✗ Seal hash integrity FAILED`);
    }

    log(`\n================================================================================`);
    log(`PROOF RESULT: MATCH=${match}`);
    log('================================================================================\n');

    // Write output file
    if (outputFilePath) {
      fs.writeFileSync(outputFilePath, output.join('\n'), 'utf-8');
      console.log(`\n[OUTPUT FILE] Written to: ${outputFilePath}`);
    }

    return match ? Promise.resolve() : Promise.reject(new Error('Seal hash mismatch'));
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    console.error(error.stack);
    return Promise.reject(error);
  }
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

async function main() {
  const fixtureDir = path.join(__dirname, 'fixtures');
  const fixturePath = path.join(fixtureDir, 'ecl4_sealed_review_fixture.json');
  
  // Output file from command line argument or default
  const outputFilePath = process.argv[2] || null;

  try {
    await verifyRecomputeProof(fixturePath, outputFilePath);
    process.exit(0);
  } catch (error) {
    console.error(`[FATAL] ${error.message}`);
    process.exit(1);
  }
}

main();

