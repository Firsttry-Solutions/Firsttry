/**
 * ReviewerResolver: Deterministic reviewer assignment
 *
 * Resolution logic (fail-closed):
 * 1. Load ReviewConfig from Forge Storage
 * 2. If reviewerAllowlist exists → use those accountIds (sorted)
 * 3. Else fallback: GET /rest/api/3/group/member with pagination
 * 4. If both empty or API fails → return empty array + marker [FT_REVIEW_NO_REVIEWERS]
 *
 * Pagination: maxResults=50, loop until isLast=true
 * Sorting: lexicographic on accountIds for determinism
 *
 * No Org Admin APIs used.
 * No Admin Hub APIs used.
 */

import { ReviewConfig } from "./types";
import { failClosed } from '../shared/failClosed';

/**
 * Result of reviewer resolution attempt
 */
export interface ReviewerResolutionResult {
  /** Resolved reviewer accountIds (always sorted) */
  reviewerIds: string[];
  
  /** Whether resolution succeeded */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
  
  /** Source of reviewers: "allowlist" | "fallback_group" | "none" */
  source: "allowlist" | "fallback_group" | "none";
  
  /** Audit marker */
  marker: string;
}

/**
 * Pagination constants
 */
const PAGINATION_MAX_RESULTS = 50;

export class ReviewerResolver {
  /**
   * Load ReviewConfig from Forge Storage
   * Uses storage key "access-review:config"
   */
  static async loadConfig(storage: any): Promise<ReviewConfig | null> {
    try {
      const config = await storage.get("access-review:config");
      return config || null;
    } catch (err) {
      throw failClosed('FT_REVIEWER_CONFIG_LOAD_ERROR', 'Cannot load reviewer config from storage', err);
    }
  }

  /**
   * Paginate through group members deterministically
   * Returns sorted accountIds (deduplicated)
   */
  private static async _paginateGroupMembers(
    groupName: string,
    jiraClient: any
  ): Promise<string[]> {
    console.log(`[FT_REVIEWER_RESOLVE_START] group=${groupName}`);
    
    const accountIdSet = new Set<string>();
    let startAt = 0;
    let isLast = false;
    let pageCount = 0;

    while (!isLast) {
      const url = `/rest/api/3/group/member?groupname=${encodeURIComponent(
        groupName
      )}&startAt=${startAt}&maxResults=${PAGINATION_MAX_RESULTS}`;

      console.log(
        `[FT_REVIEWER_RESOLVE_PAGE] startAt=${startAt} maxResults=${PAGINATION_MAX_RESULTS}`
      );

      let response: any;
      try {
        response = await jiraClient.asApp().requestJira(url);
      } catch (err: any) {
        if (err.status === 403 || err.status === 401) {
          console.error(
            `[FT_REVIEWER_RESOLVE_FAILED] HTTP ${err.status} - insufficient permissions`
          );
          throw new Error(
            `FT_REVIEWER_RESOLVE_FAILED: HTTP ${err.status} accessing group ${groupName}`
          );
        }
        throw err;
      }

      if (!response || !Array.isArray(response.values)) {
        throw new Error(
          `Invalid response structure from group API: ${JSON.stringify(
            response
          )}`
        );
      }

      // Extract accountIds from this page (add to Set for deduplication)
      const pageAccountIds = response.values
        .map((member: any) => member.accountId)
        .filter((id: any) => typeof id === "string" && id.length > 0);

      pageAccountIds.forEach(id => accountIdSet.add(id));

      console.log(
        `[FT_REVIEWER_RESOLVE_PAGE] fetched ${pageAccountIds.length} members, total unique=${accountIdSet.size}`
      );

      // Check if there are more pages
      isLast = response.isLast === true;
      if (!isLast) {
        startAt += PAGINATION_MAX_RESULTS;
      }
      pageCount++;
    }

    // Convert set to sorted array (lexicographic order)
    const allAccountIds = Array.from(accountIdSet).sort();

    console.log(
      `[FT_REVIEWER_RESOLVE_DONE] reviewers=${allAccountIds.length} pages=${pageCount}`
    );

    return allAccountIds;
  }

  /**
   * Resolve reviewer accountIds from config or fallback group
   *
   * Fail-closed: If no reviewers available, returns empty array + error marker
   */
  static async resolve(
    config: ReviewConfig | null,
    jiraClient: any
  ): Promise<ReviewerResolutionResult> {
    // Step 1: Check explicit allowlist (highest priority)
    if (config?.reviewerAllowlist && config.reviewerAllowlist.length > 0) {
      const sorted = [...config.reviewerAllowlist].sort();
      console.log(
        `[FT_REVIEWER_RESOLVE_ALLOWLIST_USED] ${sorted.length} reviewers from allowlist`
      );
      return {
        reviewerIds: sorted,
        success: true,
        source: "allowlist",
        marker: "[FT_REVIEWER_ALLOWLIST_RESOLVED]",
      };
    }

    // Step 2: Fallback to jira-administrators group
    const fallbackGroup = config?.fallbackGroup || "jira-administrators";
    console.log(
      `[FT_REVIEWER_RESOLVE_GROUP_USED] Attempting to resolve group: ${fallbackGroup}`
    );

    try {
      const accountIds = await this._paginateGroupMembers(
        fallbackGroup,
        jiraClient
      );

      if (accountIds.length === 0) {
        console.error(
          `[FT_REVIEW_NO_REVIEWERS] Group ${fallbackGroup} has no members`
        );
        return {
          reviewerIds: [],
          success: false,
          error: `Group '${fallbackGroup}' has no members`,
          source: "fallback_group",
          marker: "[FT_REVIEW_NO_REVIEWERS]",
        };
      }

      console.log(
        `[FT_REVIEWER_RESOLVE_DONE] ${accountIds.length} reviewers from group ${fallbackGroup}`
      );
      return {
        reviewerIds: accountIds,
        success: true,
        source: "fallback_group",
        marker: "[FT_REVIEWER_FALLBACK_RESOLVED]",
      };
    } catch (err) {
      throw failClosed('FT_REVIEWER_RESOLVE_FAILED', 'Cannot resolve reviewers from fallback group', err);
    }
  }

  /**
   * High-level: Load config + resolve reviewers
   * Fail-closed: Returns empty array if resolution fails
   */
  static async resolveReviewers(
    storage: any,
    jiraClient: any
  ): Promise<ReviewerResolutionResult> {
    console.log("[FT_REVIEWER_RESOLVE_START] Loading configuration...");
    
    const config = await this.loadConfig(storage);

    if (!config) {
      console.warn(
        `[FT_REVIEWER_CONFIG_MISSING] No config stored, will attempt fallback`
      );
    }

    const result = await this.resolve(config, jiraClient);

    if (!result.success) {
      console.error(
        `[FT_REVIEW_NO_REVIEWERS] Reviewer resolution failed: ${result.error}`
      );
    }

    return result;
  }

  /**
   * Store ReviewConfig in Forge Storage
   * Useful for admins configuring reviewer allowlist
   */
  static async storeConfig(
    storage: any,
    config: ReviewConfig
  ): Promise<void> {
    try {
      config.updatedAt = new Date().toISOString();
      await storage.set("access-review:config", config);
      console.log(
        `[FT_REVIEWER_CONFIG_STORED] Config updated with ${config.reviewerAllowlist?.length || 0} allowlist entries`
      );
    } catch (err) {
      console.error(`[FT_REVIEWER_CONFIG_STORE_ERROR] ${err}`);
      throw err;
    }
  }

  /**
   * Validate reviewer list (fail-closed)
   * Returns true only if reviewers list is non-empty
   */
  static validateReviewers(reviewers: string[]): boolean {
    if (!reviewers || reviewers.length === 0) {
      console.error(`[FT_REVIEWER_VALIDATION_FAILED] Empty reviewers list`);
      return false;
    }
    return true;
  }
}
