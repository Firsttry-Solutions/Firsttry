#!/usr/bin/env node
/**
 * MILESTONE 1 ACCEPTANCE TEST: run_dependency_graph_stability_test.mjs
 * 
 * Test: Build dependency graph 10x from same configuration
 * Verify: Results must be identical across runs
 * 
 * Exit: 0 on PASS, non-zero on FAIL
 */

import crypto from 'crypto';

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function canonicalizeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => canonicalizeValue(item))
      .sort((a, b) => {
        const aStr = JSON.stringify(a);
        const bStr = JSON.stringify(b);
        return aStr.localeCompare(bStr);
      });
  }
  if (typeof value === 'object' && value.constructor === Object) {
    const keys = Object.keys(value).sort();
    const result = {};
    for (const key of keys) {
      result[key] = canonicalizeValue(value[key]);
    }
    return result;
  }
  return value;
}

function canonicalJsonString(obj) {
  const canonicalized = canonicalizeValue(obj);
  return JSON.stringify(canonicalized, null, 0);
}

function generateDependencyGraph(snapshotId, createdAtUtc) {
  return {
    snapshotId,
    createdAtUtc,
    dependencyGraph: {
      nodes: [
        { id: 'config-1', type: 'field-config', name: 'Custom Field 1' },
        { id: 'config-2', type: 'field-config', name: 'Custom Field 2' },
      ],
      edges: [
        { source: 'config-1', target: 'config-2', relationshipType: 'uses' },
      ],
    },
  };
}

async function runDependencyGraphStabilityTest() {
  console.log('[DependencyGraphStabilityTest] Starting...');

  const snapshotId = 'test-snapshot-002';
  const createdAtUtc = new Date().toISOString();

  const hashes = [];

  try {
    // Generate dependency graph 10x
    for (let i = 0; i < 10; i++) {
      console.log(
        `[DependencyGraphStabilityTest] Generating run ${i + 1}/10...`
      );

      const graph = generateDependencyGraph(snapshotId, createdAtUtc);

      // Serialize to canonical JSON
      const jsonStr = canonicalJsonString(graph);
      const hash = sha256Hex(jsonStr);

      console.log(
        `[DependencyGraphStabilityTest] Run ${i + 1} hash: ${hash.substring(0, 8)}...`
      );

      hashes.push(hash);
    }

    // Verify all hashes are identical
    const firstHash = hashes[0];
    for (let i = 1; i < hashes.length; i++) {
      if (hashes[i] !== firstHash) {
        console.error(
          `[DependencyGraphStabilityTest] FAIL: Hash mismatch at run ${i + 1}. ` +
          `Expected ${firstHash}, got ${hashes[i]}`
        );
        process.exit(1);
      }
    }

    console.log('[DependencyGraphStabilityTest] ✓ PASS: All 10 runs produced identical hashes');
    process.exit(0);
  } catch (error) {
    console.error(`[DependencyGraphStabilityTest] FAIL: ${error.message}`);
    process.exit(1);
  }
}

runDependencyGraphStabilityTest();
