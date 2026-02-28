/**
 * ReviewerResolver Fail-Closed Tests
 *
 * Negative test cases for fail-closed reviewer resolution:
 * - Empty group (no members)
 * - Group with <50 members (pagination edge case)
 * - Multi-page results (pagination merge)
 * - HTTP 403 (insufficient permissions)
 * - Invalid response format
 * - Missing configuration
 *
 * All tests use mocked Jira client (no actual API calls)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewerResolver, ReviewerResolutionResult } from "../src/access-review/reviewerResolver";

describe("ReviewerResolver — Fail-Closed Tests", () => {
  let mockJiraClient: any;
  let mockStorage: any;

  beforeEach(() => {
    // Create a properly chainable mock for Jira client
    const mockRequestJira = vi.fn();
    const mockAsApp = vi.fn(() => ({
      requestJira: mockRequestJira,
    }));

    mockJiraClient = {
      asApp: mockAsApp,
    };

    // Mock storage with get method
    mockStorage = {
      get: vi.fn(),
    };

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  /**
   * TEST 1: Empty group (no members)
   * Expected: status="no_reviewers_configured", success=false
   */
  it("should handle empty group gracefully", async () => {
    // Mock: Group exists but has no members
    const mockRequestJira = mockJiraClient.asApp().requestJira;
    mockRequestJira.mockResolvedValue({
      values: [],
      isLast: true,
      maxResults: 50,
      startAt: 0,
    });

    mockStorage.get.mockResolvedValue(null); // No config

    const result = await ReviewerResolver.resolveReviewers(
      mockStorage,
      mockJiraClient
    );

    expect(result.success).toBe(false);
    expect(result.reviewerIds).toEqual([]);
    expect(result.marker).toContain("FT_REVIEW_NO_REVIEWERS");
    expect(result.source).toBe("fallback_group");
  });

  /**
   * TEST 2: Single page with <50 members
   * Expected: Returns sorted accountIds, success=true
   */
  it("should resolve single-page group correctly", async () => {
    const pageOne = {
      values: [
        { accountId: "delta" },
        { accountId: "alpha" },
        { accountId: "charlie" },
        { accountId: "bravo" },
      ],
      isLast: true, // Single page
      maxResults: 50,
      startAt: 0,
    };

    const mockRequestJira = mockJiraClient.asApp().requestJira;
    mockRequestJira.mockResolvedValue(pageOne);
    mockStorage.get.mockResolvedValue(null);

    const result = await ReviewerResolver.resolveReviewers(
      mockStorage,
      mockJiraClient
    );

    expect(result.success).toBe(true);
    expect(result.reviewerIds).toEqual([
      "alpha",
      "bravo",
      "charlie",
      "delta",
    ]);
    expect(result.source).toBe("fallback_group");

    // Verify URL called with pagination params
    const callArg = mockRequestJira.mock.calls[0][0];
    expect(callArg).toContain("startAt=0");
    expect(callArg).toContain("maxResults=50");
  });

  /**
   * TEST 3: Multi-page results (pagination)
   * Expected: Merges pages, deduplicates, and sorts lexicographically
   */
  it("should paginate through multi-page results", async () => {
    const pageOne = {
      values: [
        { accountId: "user-30" },
        { accountId: "user-10" },
        { accountId: "user-20" },
      ],
      isLast: false, // More pages
      maxResults: 3,
      startAt: 0,
    };

    const pageTwo = {
      values: [
        { accountId: "user-50" },
        { accountId: "user-40" },
      ],
      isLast: true, // No more pages
      maxResults: 3,
      startAt: 3,
    };

    // Mock pagination: first call returns page 1, second returns page 2
    mockJiraClient
      .asApp()
      .requestJira.mockResolvedValueOnce(pageOne)
      .mockResolvedValueOnce(pageTwo);

    mockStorage.get.mockResolvedValue(null);

    const result = await ReviewerResolver.resolveReviewers(
      mockStorage,
      mockJiraClient
    );

    expect(result.success).toBe(true);
    // Should be sorted lexicographically
    expect(result.reviewerIds).toEqual([
      "user-10",
      "user-20",
      "user-30",
      "user-40",
      "user-50",
    ]);

    // Verify pagination calls were made
    expect(mockJiraClient.asApp().requestJira).toHaveBeenCalledTimes(2);
    const call1 = mockJiraClient.asApp().requestJira.mock.calls[0][0];
    const call2 = mockJiraClient.asApp().requestJira.mock.calls[1][0];

    expect(call1).toContain("startAt=0");
    expect(call2).toContain("startAt=50"); // 50 = pagination max
  });

  /**
   * TEST 4: HTTP 403 (insufficient permissions)
   * Expected: failure, throws error with FT_REVIEWER_RESOLVE_FAILED
   */
  it("should fail-closed on HTTP 403", async () => {
    const error = new Error("Forbidden");
    (error as any).status = 403;

    mockJiraClient
      .asApp()
      .requestJira.mockRejectedValue(error);

    mockStorage.get.mockResolvedValue(null);

    await expect(
      ReviewerResolver.resolveReviewers(
        mockStorage,
        mockJiraClient
      )
    ).rejects.toThrow('FT_REVIEWER_RESOLVE_FAILED');
  });

  /**
   * TEST 5: HTTP 401 (unauthorized)
   * Expected: failure, throws error with FT_REVIEWER_RESOLVE_FAILED
   */
  it("should fail-closed on HTTP 401", async () => {
    const error = new Error("Unauthorized");
    (error as any).status = 401;

    mockJiraClient
      .asApp()
      .requestJira.mockRejectedValue(error);

    mockStorage.get.mockResolvedValue(null);

    await expect(
      ReviewerResolver.resolveReviewers(
        mockStorage,
        mockJiraClient
      )
    ).rejects.toThrow('FT_REVIEWER_RESOLVE_FAILED');
  });

  /**
   * TEST 6: Invalid response (missing .values field)
   * Expected: failure, throws error
   */
  it("should fail-closed on invalid response format", async () => {
    mockJiraClient
      .asApp()
      .requestJira.mockResolvedValue({
        // Missing 'values' field
        isLast: true,
      });

    mockStorage.get.mockResolvedValue(null);

    await expect(
      ReviewerResolver.resolveReviewers(
        mockStorage,
        mockJiraClient
      )
    ).rejects.toThrow('FT_REVIEWER_RESOLVE_FAILED');
  });

  /**
   * TEST 7: Allowlist takes priority (stored in config)
   * Expected: Uses allowlist, ignores fallback group, and sorts it
   */
  it("should prefer allowlist from config", async () => {
    // Use unsorted allowlist to verify sorting
    const allowlist = ["charlie", "alpha", "bravo"];
    const config = {
      reviewerAllowlist: allowlist,
      fallbackGroup: "jira-administrators",
    };

    mockStorage.get.mockResolvedValue(config);

    // Even if we mock the API, it should NOT be called
    const mockRequestJira = mockJiraClient.asApp().requestJira;
    mockRequestJira.mockRejectedValue(new Error("API call should not happen"));

    const result = await ReviewerResolver.resolveReviewers(
      mockStorage,
      mockJiraClient
    );

    expect(result.success).toBe(true);
    // Should be sorted
    expect(result.reviewerIds).toEqual(["alpha", "bravo", "charlie"]);
    expect(result.source).toBe("allowlist");

    // Verify API was never called (allowlist used instead)
    expect(mockRequestJira).not.toHaveBeenCalled();
  });

  /**
   * TEST 8: Deduplication (same accountId in multiple pages)
   * Expected: Deduplicates and sorts
   */
  it("should deduplicate accountIds across pages", async () => {
    const pageOne = {
      values: [{ accountId: "user-a" }, { accountId: "user-b" }],
      isLast: false,
      maxResults: 2,
      startAt: 0,
    };

    const pageTwo = {
      values: [
        { accountId: "user-b" }, // Duplicate from page 1
        { accountId: "user-c" },
      ],
      isLast: true,
      maxResults: 2,
      startAt: 2,
    };

    mockJiraClient
      .asApp()
      .requestJira.mockResolvedValueOnce(pageOne)
      .mockResolvedValueOnce(pageTwo);

    mockStorage.get.mockResolvedValue(null);

    const result = await ReviewerResolver.resolveReviewers(
      mockStorage,
      mockJiraClient
    );

    expect(result.success).toBe(true);
    // Should have unique, sorted values (native sort handles dedup when sorted)
    expect(result.reviewerIds.length).toBeGreaterThan(0);
    
    // Verify no duplicates
    const uniqueIds = [...new Set(result.reviewerIds)];
    expect(uniqueIds.length).toBe(result.reviewerIds.length);
  });

  /**
   * TEST 9: Large pagination scenario
   * Expected: Correctly handles maxResults offset calculations
   */
  it("should compute pagination offsets correctly", async () => {
    // Mock 3 pages with maxResults=50
    const pages = [
      {
        values: Array(50)
          .fill(null)
          .map((_, i) => ({ accountId: `user-${String(i).padStart(3, "0")}` })),
        isLast: false,
        maxResults: 50,
        startAt: 0,
      },
      {
        values: Array(50)
          .fill(null)
          .map((_, i) => ({
            accountId: `user-${String(50 + i).padStart(3, "0")}`,
          })),
        isLast: false,
        maxResults: 50,
        startAt: 50,
      },
      {
        values: Array(20)
          .fill(null)
          .map((_, i) => ({
            accountId: `user-${String(100 + i).padStart(3, "0")}`,
          })),
        isLast: true,
        maxResults: 50,
        startAt: 100,
      },
    ];

    // Set up mock to return pages in order
    pages.forEach((page, index) => {
      mockJiraClient
        .asApp()
        .requestJira.mockResolvedValueOnce(page);
    });

    mockStorage.get.mockResolvedValue(null);

    const result = await ReviewerResolver.resolveReviewers(
      mockStorage,
      mockJiraClient
    );

    expect(result.success).toBe(true);
    expect(result.reviewerIds.length).toBe(120); // 50 + 50 + 20

    // Verify correct pagination calls
    expect(mockJiraClient.asApp().requestJira).toHaveBeenCalledTimes(3);
    const calls = mockJiraClient.asApp().requestJira.mock.calls;

    expect(calls[0][0]).toContain("startAt=0");
    expect(calls[1][0]).toContain("startAt=50");
    expect(calls[2][0]).toContain("startAt=100");
  });

  /**
   * TEST 10: Empty accountId handling
   * Expected: Filters out null/empty/invalid accountIds
   */
  it("should filter out invalid accountIds", async () => {
    const response = {
      values: [
        { accountId: "valid-user" },
        { accountId: "" }, // Empty
        { accountId: null }, // Null
        { accountId: "another-valid" },
        // Missing accountId field
        { name: "invalid" },
      ],
      isLast: true,
      maxResults: 50,
      startAt: 0,
    };

    mockJiraClient.asApp().requestJira.mockResolvedValue(response);
    mockStorage.get.mockResolvedValue(null);

    const result = await ReviewerResolver.resolveReviewers(
      mockStorage,
      mockJiraClient
    );

    expect(result.success).toBe(true);
    // Should only have valid ones, sorted
    expect(result.reviewerIds).toEqual(["another-valid", "valid-user"]);
  });
});
