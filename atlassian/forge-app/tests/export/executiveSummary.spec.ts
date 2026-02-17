/**
 * Executive Summary Export Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateExecutiveSummaryHtml } from "../../src/export/executiveSummary";

const mockStorage: Map<string, any> = new Map();

vi.mock("@forge/api", () => ({
  storage: {
    get: (key: string) => Promise.resolve(mockStorage.get(key)),
    set: (key: string, value: any) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    },
  },
}));

describe("Executive Summary Export", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("should generate valid HTML", async () => {
    const html = await generateExecutiveSummaryHtml("test-tenant");

    expect(typeof html).toBe("string");
    expect(html.includes("<!DOCTYPE html>")).toBe(true);
    expect(html.includes("</html>")).toBe(true);
  });

  it("should include schema version in HTML", async () => {
    const html = await generateExecutiveSummaryHtml("test-tenant");

    expect(html).toContain("ft-executive-summary@1");
  });

  it("should include all required sections", async () => {
    const html = await generateExecutiveSummaryHtml("test-tenant");

    expect(html).toContain("Verification Status");
    expect(html).toContain("Risk Profile");
    expect(html).toContain("Storage & Lifecycle");
    expect(html).toContain("Snapshot Behavior");
    expect(html).toContain("What This Tool Does");
  });

  it("should include constraints disclosure", async () => {
    const html = await generateExecutiveSummaryHtml("test-tenant");

    expect(html).toContain("Does NOT create new scopes");
    expect(html).toContain("Does NOT make outbound network calls");
    expect(html).toContain("Does NOT write to Jira");
  });

  it("should include inline CSS only", async () => {
    const html = await generateExecutiveSummaryHtml("test-tenant");

    expect(html).toContain("<style>");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("<link");
  });

  it("should not include Date() in output", async () => {
    const html = await generateExecutiveSummaryHtml("test-tenant");

    // Check that dynamic Date is not in output (should use stored times only)
    const hasDateCall = html.includes("new Date()") || html.includes("Date.now()");
    expect(hasDateCall).toBe(false);
  });

  it("should display metrics from snapshot", async () => {
    const snapshot = {
      riskScore: 45,
      unresolvedDrifts: 2,
      shadowAdmins: 1,
      totalChanges: 100,
    };

    const html = await generateExecutiveSummaryHtml("test-tenant", snapshot);

    expect(html).toContain("45");
    expect(html).toContain("2");
    expect(html).toContain("1");
  });

  it("should include tenant hash (not full key)", async () => {
    const html = await generateExecutiveSummaryHtml("secret-tenant-key-12345");

    expect(html).toContain("Tenant Hash");
    expect(html).not.toContain("secret-tenant");
  });
});
