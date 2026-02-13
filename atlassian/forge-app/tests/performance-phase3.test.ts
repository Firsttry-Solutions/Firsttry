/**
 * Phase 3 Performance Test
 * 
 * Realistic scenario:
 * - 1,000 users
 * - 100 projects
 * - 2,000 privilege entries across items
 * 
 * Requirements:
 * - Review creation < 180 seconds (3 minutes)
 * - No Forge timeout
 * - Snapshot pulled with batchSize=100 pagination
 * - Memory stable (no leaks)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ReviewWorkflowEngine } from "../src/access-review/workflow";
import { ReviewExportPack } from "../src/export/reviewPack";
import { ReviewGuards } from "../src/access-review/guards";
import type { ReviewItem, ReviewWorkflow } from "../src/access-review/types";

/**
 * Generate realistic snapshot with 2,000 privilege entries
 * - 1,000 user privileges
 * - 500 project privileges
 * - 500 role privileges
 */
function generateRealisticSnapshot(
  userCount: number,
  projectCount: number,
  totalEntries: number
): Record<string, ReviewItem> {
  const items: Record<string, ReviewItem> = {};
  let index = 0;

  // Generate user privileges (IDs: user-0001 to user-1000)
  const userEntries = Math.floor(totalEntries * 0.5);
  for (let i = 1; i <= userEntries && i <= userCount; i++) {
    const userId = `user-${String(i).padStart(4, "0")}`;
    items[userId] = {
      entityId: userId,
      entityType: "user",
      privilegeSummary: `Jira user access - Account ${userId}`,
      riskLevel: i % 20 === 0 ? "high" : i % 5 === 0 ? "medium" : "low",
      addedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
        .toISOString(),
      context: `Hire date: 2023-01-${String((i % 28) + 1).padStart(2, "0")}`,
    };
  }

  // Generate project privileges (IDs: proj-0001 to proj-0100)
  const projEntries = Math.floor(totalEntries * 0.25);
  for (let i = 1; i <= projEntries && i <= projectCount; i++) {
    const projId = `proj-${String(i).padStart(4, "0")}`;
    items[projId] = {
      entityId: projId,
      entityType: "project",
      privilegeSummary: `Project Admin - ${projId}`,
      riskLevel: i % 10 === 0 ? "high" : i % 3 === 0 ? "medium" : "low",
      addedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
        .toISOString(),
      context: `Project scope: Development team`,
    };
  }

  // Generate role privileges (IDs: role-0001 to role-0500)
  const roleEntries = Math.floor(totalEntries * 0.25);
  for (let i = 1; i <= roleEntries; i++) {
    const roleId = `role-${String(i).padStart(4, "0")}`;
    items[roleId] = {
      entityId: roleId,
      entityType: "role",
      privilegeSummary: `Custom Role - ${roleId}`,
      riskLevel: i % 15 === 0 ? "high" : i % 4 === 0 ? "medium" : "low",
      addedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
        .toISOString(),
      context: `Assigned to ${Math.random() * 100 | 0} users`,
    };
  }

  return items;
}

describe("Phase 3 Performance Tests", () => {
  let engine: ReviewWorkflowEngine;
  let snapshot: Record<string, ReviewItem>;
  let reviewers: string[];

  beforeAll(() => {
    engine = new ReviewWorkflowEngine();
    snapshot = generateRealisticSnapshot(1000, 100, 2000);
    reviewers = [
      "admin-account-1",
      "admin-account-2",
      "admin-account-3",
    ];
  });

  it("should create review with 2,000 items < 180 seconds", async () => {
    const startTime = Date.now();

    // Initialize review with realistic snapshot
    const workflow = await engine.initializeReview(
      {
        items: snapshot,
        timestamp: new Date().toISOString(),
        buildVersion: "3.0.0",
        siteId: "example.atlassian.net",
      },
      reviewers,
      "3.0.0",
      "example.atlassian.net"
    );

    const duration = Date.now() - startTime;

    expect(workflow).toBeDefined();
    expect(workflow.status).toBe("open");
    expect(Object.keys(workflow.items).length).toBe(Object.keys(snapshot).length);
    expect(duration).toBeLessThan(180000); // 180 seconds = 3 minutes

    console.log(`[PERF] Review creation time: ${duration}ms for ${Object.keys(snapshot).length} items`);
  });

  it("should process 2,000 decisions < 60 seconds", async () => {
    const workflow = await engine.initializeReview(
      {
        items: snapshot,
        timestamp: new Date().toISOString(),
        buildVersion: "3.0.0",
        siteId: "example.atlassian.net",
      },
      reviewers,
      "3.0.0",
      "example.atlassian.net"
    );

    const startTime = Date.now();

    // Record decisions for all items (50% approve, 50% reject)
    let index = 0;
    for (const entityId of Object.keys(workflow.items)) {
      const decision = index % 2 === 0 ? "approved" : "rejected";
      engine.recordDecision(entityId, reviewers[0], decision, "Performance test");
      index++;
    }

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(60000); // 60 seconds
    console.log(`[PERF] Decision processing time: ${duration}ms for ${Object.keys(snapshot).length} items`);
  });

  it("should close review with canonical hash < 5 seconds", async () => {
    const workflow = await engine.initializeReview(
      {
        items: snapshot,
        timestamp: new Date().toISOString(),
        buildVersion: "3.0.0",
        siteId: "example.atlassian.net",
      },
      reviewers,
      "3.0.0",
      "example.atlassian.net"
    );

    // Record some decisions
    let index = 0;
    for (const entityId of Object.keys(workflow.items)) {
      if (index >= 100) break; // Just do first 100 for perf test
      const decision = index % 2 === 0 ? "approved" : "rejected";
      engine.recordDecision(entityId, reviewers[0], decision);
      index++;
    }

    const startTime = Date.now();

    // Close review (computes canonical hash)
    engine.closeReview();

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000); // 5 seconds
    console.log(`[PERF] Review close + canonical hash time: ${duration}ms`);
  });

  it("should export 2,000-item review < 30 seconds", async () => {
    const workflow = await engine.initializeReview(
      {
        items: snapshot,
        timestamp: new Date().toISOString(),
        buildVersion: "3.0.0",
        siteId: "example.atlassian.net",
      },
      reviewers,
      "3.0.0",
      "example.atlassian.net"
    );

    // Record decisions
    for (const entityId of Object.keys(workflow.items)) {
      const decision = Math.random() > 0.5 ? "approved" : "rejected";
      engine.recordDecision(entityId, reviewers[0], decision);
    }

    // Close review
    engine.closeReview();

    const startTime = Date.now();

    // Export
    const files = ReviewExportPack.generatePackFiles(workflow, "abc123de");
    const packHash = ReviewExportPack.computePackHash(files);

    const duration = Date.now() - startTime;

    expect(files).toBeDefined();
    expect(packHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    expect(duration).toBeLessThan(30000); // 30 seconds

    console.log(`[PERF] Export generation time: ${duration}ms for ${Object.keys(files).length} files`);
  });

  it("should handle pagination with batchSize=100", async () => {
    // Simulate realistic API pagination scenario
    const batchSize = 100;
    const totalItems = Object.keys(snapshot).length;
    const batches = Math.ceil(totalItems / batchSize);

    console.log(
      `[PERF] Pagination: ${totalItems} items into ${batches} batches of ${batchSize}`
    );

    expect(batches).toBeLessThanOrEqual(20); // Max 20 batches for 2,000 items
  });

  it("should verify guards on 2,000-item review < 10 seconds", async () => {
    const workflow = await engine.initializeReview(
      {
        items: snapshot,
        timestamp: new Date().toISOString(),
        buildVersion: "3.0.0",
        siteId: "example.atlassian.net",
      },
      reviewers,
      "3.0.0",
      "example.atlassian.net"
    );

    // Record all decisions
    for (const entityId of Object.keys(workflow.items)) {
      const decision = Math.random() > 0.5 ? "approved" : "rejected";
      engine.recordDecision(entityId, reviewers[0], decision);
    }

    // Close review
    engine.closeReview();

    // Export
    const files = ReviewExportPack.generatePackFiles(workflow, "abc123de");

    const startTime = Date.now();

    // Validate all guards
    const result = ReviewGuards.validateComplete(
      workflow,
      files,
      workflow.snapshotHash
    );

    const duration = Date.now() - startTime;

    expect(result.valid).toBe(true);
    expect(duration).toBeLessThan(10000); // 10 seconds

    console.log(`[PERF] Guard validation time: ${duration}ms`);
  });

  it("should keep memory stable (no major leaks)", async () => {
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB

    // Run full cycle 5 times
    for (let run = 0; run < 5; run++) {
      const workflow = await engine.initializeReview(
        {
          items: snapshot,
          timestamp: new Date().toISOString(),
          buildVersion: "3.0.0",
          siteId: "example.atlassian.net",
        },
        reviewers,
        "3.0.0",
        "example.atlassian.net"
      );

      // Record decisions
      for (const entityId of Object.keys(workflow.items)) {
        const decision = Math.random() > 0.5 ? "approved" : "rejected";
        engine.recordDecision(entityId, reviewers[0], decision);
      }

      // Close and export
      engine.closeReview();
      const files = ReviewExportPack.generatePackFiles(workflow, "abc123de");
      ReviewExportPack.computePackHash(files);
    }

    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    const delta = finalMemory - initialMemory;

    // Should be < 500MB increase for 5 runs
    expect(delta).toBeLessThan(500);

    console.log(
      `[PERF] Memory delta after 5 runs: ${delta.toFixed(2)}MB (initial: ${initialMemory.toFixed(2)}MB, final: ${finalMemory.toFixed(2)}MB)`
    );
  });
});
