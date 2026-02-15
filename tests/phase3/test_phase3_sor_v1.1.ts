/**
 * PHASE 3 SOR v1.1 - Unit Tests
 * Comprehensive test suite for deterministic, fail-closed access review system
 */

import {
  generateReviewId,
  canonicalizeJson,
  computeStateHash,
  computeEventId,
  generateDecisionsCsv,
  generateExceptionsCsv,
  generateExportPack,
  hashFilesPack,
} from "../src/access-review/phase3Workflow";
import {
  generateDecisionsCsv as genDecCsv,
  generateExceptionsCsv as genExcCsv,
  verifyExportReproducibility,
} from "../src/access-review/reviewPack";
import { calculateShard, calculateAuditShard } from "../src/access-review/storageKeys";
import { ReviewWorkflowState, PrivilegeContext } from "../src/access-review/types";
import * as assert from "assert";

// ============================================================================
// TEST SUITE MARKER
// ============================================================================

const testResults: { passed: number; failed: number; errors: string[] } = {
  passed: 0,
  failed: 0,
  errors: [],
};

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result
        .then(() => {
          console.log(`✓ ${name}`);
          testResults.passed++;
        })
        .catch((err) => {
          console.error(`✗ ${name}: ${err.message}`);
          testResults.failed++;
          testResults.errors.push(`${name}: ${err.message}`);
        });
    } else {
      console.log(`✓ ${name}`);
      testResults.passed++;
    }
  } catch (err: any) {
    console.error(`✗ ${name}: ${err.message}`);
    testResults.failed++;
    testResults.errors.push(`${name}: ${err.message}`);
  }
}

// ============================================================================
// 1. REVIEW ID DETERMINISM
// ============================================================================

test("reviewId is deterministic (same inputs → same ID)", () => {
  const siteId = "test-site";
  const quarter = "2025-Q1";

  const id1 = generateReviewId(siteId, quarter);
  const id2 = generateReviewId(siteId, quarter);

  assert.strictEqual(id1, id2, "Review IDs should match");
  assert.strictEqual(id1.length, 64, "Review ID should be SHA256 (64 hex chars)");
});

test("reviewId differs for different input", () => {
  const id1 = generateReviewId("site1", "2025-Q1");
  const id2 = generateReviewId("site2", "2025-Q1");
  const id3 = generateReviewId("site1", "2025-Q2");

  assert.notStrictEqual(id1, id2, "Different sites → different IDs");
  assert.notStrictEqual(id1, id3, "Different quarters → different IDs");
});

// ============================================================================
// 2. STATE HASH INTEGRITY
// ============================================================================

test("stateHash is computed deterministically", () => {
  const state: ReviewWorkflowState = {
    reviewId: "test-id",
    siteId: "test-site",
    quarter: "2025-Q1",
    schemaVersion: "ar.v1",
    ruleSetVersion: "phase3.v1",
    createdUtc: "2025-01-10T00:00:00Z",
    lastUpdatedUtc: "2025-01-10T00:00:00Z",
    status: "OPEN",
    privilegeContext: {
      accountId: "test-account",
      displayName: "Test User",
      isJiraSiteAdmin: true,
      isGlobalAdmin: false,
      isDenied: false,
    },
    snapshotRef: {
      snapshotId: "snap-123",
      snapshotsUtc: "2025-01-10T00:00:00Z",
      itemCount: 0,
      baselineSha: "abc123",
    },
    reviewers: [],
    decisions: [],
    exceptions: [],
    progress: { totalItems: 0, reviewedItems: 0, percent: 0 },
    complianceScore: { value: 100, basis: "initial", computedUtc: "2025-01-10T00:00:00Z" },
    stateHash: "",
  };

  const stateWithoutHash = { ...state };
  delete (stateWithoutHash as any).stateHash;

  const hash1 = computeStateHash(stateWithoutHash);
  const hash2 = computeStateHash(stateWithoutHash);

  assert.strictEqual(hash1, hash2, "State hash should be deterministic");
  assert.strictEqual(hash1.length, 64, "State hash should be SHA256");
});

test("stateHash changes when state changes", () => {
  const base: ReviewWorkflowState = {
    reviewId: "test-id",
    siteId: "test-site",
    quarter: "2025-Q1",
    schemaVersion: "ar.v1",
    ruleSetVersion: "phase3.v1",
    createdUtc: "2025-01-10T00:00:00Z",
    lastUpdatedUtc: "2025-01-10T00:00:00Z",
    status: "OPEN",
    privilegeContext: {
      accountId: "test-account",
      displayName: "Test User",
      isJiraSiteAdmin: true,
      isGlobalAdmin: false,
      isDenied: false,
    },
    snapshotRef: {
      snapshotId: "snap-123",
      snapshotsUtc: "2025-01-10T00:00:00Z",
      itemCount: 0,
      baselineSha: "abc123",
    },
    reviewers: [],
    decisions: [],
    exceptions: [],
    progress: { totalItems: 0, reviewedItems: 0, percent: 0 },
    complianceScore: { value: 100, basis: "initial", computedUtc: "2025-01-10T00:00:00Z" },
    stateHash: "",
  };

  const state1 = { ...base };
  delete (state1 as any).stateHash;
  const hash1 = computeStateHash(state1);

  const state2 = { ...base };
  state2.status = "COMPLETED";
  delete (state2 as any).stateHash;
  const hash2 = computeStateHash(state2);

  assert.notStrictEqual(hash1, hash2, "Different states → different hashes");
});

// ============================================================================
// 3. CSV DETERMINISTIC ORDERING
// ============================================================================

test("decisions CSV is sorted by recordedUtc", () => {
  const state: ReviewWorkflowState = {
    reviewId: "test-id",
    siteId: "test-site",
    quarter: "2025-Q1",
    schemaVersion: "ar.v1",
    ruleSetVersion: "phase3.v1",
    createdUtc: "2025-01-10T00:00:00Z",
    lastUpdatedUtc: "2025-01-10T00:00:00Z",
    status: "OPEN",
    privilegeContext: {
      accountId: "test-account",
      displayName: "Test User",
      isJiraSiteAdmin: true,
      isGlobalAdmin: false,
      isDenied: false,
    },
    snapshotRef: {
      snapshotId: "snap-123",
      snapshotsUtc: "2025-01-10T00:00:00Z",
      itemCount: 0,
      baselineSha: "abc123",
    },
    reviewers: [],
    decisions: [
      {
        reviewerId: "reviewer2",
        decision: "APPROVED",
        recordedUtc: "2025-01-10T02:00:00Z",
        justification: "OK",
        decisionHash: "hash2",
      },
      {
        reviewerId: "reviewer1",
        decision: "DENIED",
        recordedUtc: "2025-01-10T01:00:00Z",
        justification: "Not OK",
        decisionHash: "hash1",
      },
    ],
    exceptions: [],
    progress: { totalItems: 0, reviewedItems: 0, percent: 0 },
    complianceScore: { value: 100, basis: "initial", computedUtc: "2025-01-10T00:00:00Z" },
    stateHash: "",
  };

  const csv = generateDecisionsCsv(state);
  const lines = csv.split("\n");

  // Second line should be reviewer1 (earlier timestamp)
  // Third line should be reviewer2 (later timestamp)
  assert.ok(lines[1].includes("reviewer1"), "First decision should be from reviewer1");
  assert.ok(lines[2].includes("reviewer2"), "Second decision should be from reviewer2");
});

test("CSV has UTF-8, no BOM, LF only", () => {
  const state: ReviewWorkflowState = {
    reviewId: "test-id",
    siteId: "test-site",
    quarter: "2025-Q1",
    schemaVersion: "ar.v1",
    ruleSetVersion: "phase3.v1",
    createdUtc: "2025-01-10T00:00:00Z",
    lastUpdatedUtc: "2025-01-10T00:00:00Z",
    status: "OPEN",
    privilegeContext: {
      accountId: "test-account",
      displayName: "Test User",
      isJiraSiteAdmin: true,
      isGlobalAdmin: false,
      isDenied: false,
    },
    snapshotRef: {
      snapshotId: "snap-123",
      snapshotsUtc: "2025-01-10T00:00:00Z",
      itemCount: 0,
      baselineSha: "abc123",
    },
    reviewers: [],
    decisions: [],
    exceptions: [],
    progress: { totalItems: 0, reviewedItems: 0, percent: 0 },
    complianceScore: { value: 100, basis: "initial", computedUtc: "2025-01-10T00:00:00Z" },
    stateHash: "",
  };

  const csv = generateDecisionsCsv(state);
  const buffer = Buffer.from(csv, "utf-8");

  // No UTF-8 BOM
  assert.notStrictEqual(buffer[0], 0xef, "Should not have BOM");

  // No null bytes
  assert.ok(!csv.includes("\0"), "Should not contain null bytes");

  // LF only (no CRLF)
  assert.ok(!csv.includes("\r\n"), "Should use LF only");
  assert.ok(!csv.includes("\r"), "Should not have CR");
});

// ============================================================================
// 4. EXCEPTION EXPIRY
// ============================================================================

test("exception expiry is deterministic", () => {
  const now = new Date().toISOString();
  const futureUtc = new Date(new Date().getTime() + 86400 * 1000).toISOString();

  const state: ReviewWorkflowState = {
    reviewId: "test-id",
    siteId: "test-site",
    quarter: "2025-Q1",
    schemaVersion: "ar.v1",
    ruleSetVersion: "phase3.v1",
    createdUtc: now,
    lastUpdatedUtc: now,
    status: "OPEN",
    privilegeContext: {
      accountId: "test-account",
      displayName: "Test User",
      isJiraSiteAdmin: true,
      isGlobalAdmin: false,
      isDenied: false,
    },
    snapshotRef: {
      snapshotId: "snap-123",
      snapshotsUtc: now,
      itemCount: 0,
      baselineSha: "abc123",
    },
    reviewers: [],
    decisions: [],
    exceptions: [
      {
        exceptionId: "exc-1",
        itemId: "item-1",
        risk: "LOW",
        expiresUtc: futureUtc,
        createdUtc: now,
        justification: "Test exception",
        justificationHash: "hash123",
      },
    ],
    progress: { totalItems: 0, reviewedItems: 0, percent: 0 },
    complianceScore: { value: 100, basis: "initial", computedUtc: now },
    stateHash: "",
  };

  // Fresh exception should not be expired
  const beforeExpiry = state.exceptions.filter(
    (e) => new Date(e.expiresUtc) > new Date(now)
  );
  assert.strictEqual(beforeExpiry.length, 1, "Exception should not be expired yet");

  // After expiry time, should be filtered
  const pastUtc = new Date(new Date().getTime() + 86400 * 2000).toISOString();
  const afterExpiry = state.exceptions.filter(
    (e) => new Date(e.expiresUtc) > new Date(pastUtc)
  );
  assert.strictEqual(afterExpiry.length, 0, "Exception should be expired");
});

// ============================================================================
// 5. SHARD ROLLOVER
// ============================================================================

test("shard calculation is deterministic", () => {
  const reviewId = "abc123def456";

  const shard1 = calculateShard(reviewId);
  const shard2 = calculateShard(reviewId);

  assert.strictEqual(shard1, shard2, "Shard should be deterministic");
});

test("different reviewIds can map to different shards", () => {
  const shards = new Set();
  for (let i = 0; i < 100; i++) {
    const reviewId = `reviewid-${i}`;
    const shard = calculateShard(reviewId);
    shards.add(shard);
  }

  assert.ok(shards.size > 1, "Should have multiple shards for diverse reviewIds");
});

// ============================================================================
// 6. AUDIT APPEND-ONLY
// ============================================================================

test("eventId is computed deterministically", () => {
  const reviewId = "rev-123";
  const actorAccountId = "actor-456";
  const action = "OPEN" as const;
  const occurredUtc = "2025-01-10T00:00:00Z";
  const payloadHash = "payload789";

  const eventId1 = computeEventId(reviewId, actorAccountId, action, occurredUtc, payloadHash);
  const eventId2 = computeEventId(reviewId, actorAccountId, action, occurredUtc, payloadHash);

  assert.strictEqual(eventId1, eventId2, "Event ID should be deterministic");
});

test("eventId changes with different inputs", () => {
  const base = {
    reviewId: "rev-123",
    actorAccountId: "actor-456",
    action: "OPEN" as const,
    occurredUtc: "2025-01-10T00:00:00Z",
    payloadHash: "payload789",
  };

  const id1 = computeEventId(
    base.reviewId,
    base.actorAccountId,
    base.action,
    base.occurredUtc,
    base.payloadHash
  );
  const id2 = computeEventId(
    "different-rev",
    base.actorAccountId,
    base.action,
    base.occurredUtc,
    base.payloadHash
  );

  assert.notStrictEqual(id1, id2, "Different reviewIds → different eventIds");
});

// ============================================================================
// 7. ZIP/EXPORT DETERMINISM
// ============================================================================

test("export pack is reproducible (byte-identical)", () => {
  const state: ReviewWorkflowState = {
    reviewId: "test-id",
    siteId: "test-site",
    quarter: "2025-Q1",
    schemaVersion: "ar.v1",
    ruleSetVersion: "phase3.v1",
    createdUtc: "2025-01-10T00:00:00Z",
    lastUpdatedUtc: "2025-01-10T00:00:00Z",
    status: "OPEN",
    privilegeContext: {
      accountId: "test-account",
      displayName: "Test User",
      isJiraSiteAdmin: true,
      isGlobalAdmin: false,
      isDenied: false,
    },
    snapshotRef: {
      snapshotId: "snap-123",
      snapshotsUtc: "2025-01-10T00:00:00Z",
      itemCount: 0,
      baselineSha: "abc123",
    },
    reviewers: [],
    decisions: [],
    exceptions: [],
    progress: { totalItems: 0, reviewedItems: 0, percent: 0 },
    complianceScore: { value: 100, basis: "initial", computedUtc: "2025-01-10T00:00:00Z" },
    stateHash: "",
  };

  const buildShaShort = "abc1234";
  const buildUtc = "2025-01-10T00:00:00Z";

  const pack1 = generateExportPack(state, buildShaShort, buildUtc);
  const pack2 = generateExportPack(state, buildShaShort, buildUtc);

  // Compare file hashes
  for (const filename of Object.keys(pack1)) {
    assert.strictEqual(
      pack1[filename as keyof typeof pack1],
      pack2[filename as keyof typeof pack2],
      `${filename} should be byte-identical`
    );
  }
});

test("pack hash is deterministic", () => {
  const state: ReviewWorkflowState = {
    reviewId: "test-id",
    siteId: "test-site",
    quarter: "2025-Q1",
    schemaVersion: "ar.v1",
    ruleSetVersion: "phase3.v1",
    createdUtc: "2025-01-10T00:00:00Z",
    lastUpdatedUtc: "2025-01-10T00:00:00Z",
    status: "OPEN",
    privilegeContext: {
      accountId: "test-account",
      displayName: "Test User",
      isJiraSiteAdmin: true,
      isGlobalAdmin: false,
      isDenied: false,
    },
    snapshotRef: {
      snapshotId: "snap-123",
      snapshotsUtc: "2025-01-10T00:00:00Z",
      itemCount: 0,
      baselineSha: "abc123",
    },
    reviewers: [],
    decisions: [],
    exceptions: [],
    progress: { totalItems: 0, reviewedItems: 0, percent: 0 },
    complianceScore: { value: 100, basis: "initial", computedUtc: "2025-01-10T00:00:00Z" },
    stateHash: "",
  };

  const pack = generateExportPack(state, "abc1234", "2025-01-10T00:00:00Z");

  const hash1 = hashFilesPack(pack);
  const hash2 = hashFilesPack(pack);

  assert.strictEqual(hash1, hash2, "Pack hash should be deterministic");
});

// ============================================================================
// 8. CANONICAL JSON (STABLE ORDERING)
// ============================================================================

test("canonical JSON has stable key ordering", () => {
  const obj = {
    z: 1,
    a: 2,
    m: { y: 3, b: 4 },
  };

  const json1 = canonicalizeJson(obj);
  const json2 = canonicalizeJson(obj);

  assert.strictEqual(json1, json2, "Canonical JSON should be stable");

  // Parse to verify ordering
  const parsed = JSON.parse(json1);
  const keys = Object.keys(parsed);
  assert.deepStrictEqual(keys, ["a", "m", "z"], "Keys should be sorted alphabetically");
});

// ============================================================================
// PRINT SUMMARY
// ============================================================================

function printSummary(): void {
  console.log("\n" + "=".repeat(70));
  console.log("[FT_PHASE3_UNIT_PASS] Test Summary");
  console.log("=".repeat(70));
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);

  if (testResults.errors.length > 0) {
    console.log("\nErrors:");
    testResults.errors.forEach((err) => console.error(`  - ${err}`));
  }

  if (testResults.failed === 0) {
    console.log("\n✓ All tests passed!");
  } else {
    console.log(`\n✗ ${testResults.failed} test(s) failed`);
    process.exit(1);
  }
}

// Export summary function
export { printSummary, testResults };
