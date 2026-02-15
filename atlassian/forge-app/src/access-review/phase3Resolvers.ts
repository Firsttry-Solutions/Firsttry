/**
 * PHASE 3 SOR v1.1 - Forge Resolvers
 * Strict input validation, fail-closed, read-only (no Jira mutations)
 * Resolvers:
 * - ar.openReview
 * - ar.getReview  
 * - ar.recordDecision
 * - ar.addException
 * - ar.exportPack
 */

import {
  openQuarterlyReview,
  recordDecision,
  addException,
  expireExceptions,
  readAndVerifyState,
} from "./phase3Workflow";
import {
  generateExportPackWithPrivilege,
  verifyExportReproducibility,
  hashFilesPack,
} from "./reviewPack";
import { ReviewError, PrivilegeContext } from "./types";
import { validateSiteId, validateQuarter } from "./storageKeys";

// Mock storage for testing (in real Forge, use @forge/api storage)
const mockStorage: Record<string, any> = {};

const mockStorageApi = {
  get: async (key: string) => mockStorage[key] || null,
  set: async (key: string, value: unknown) => {
    mockStorage[key] = value;
  },
};

// ============================================================================
// ar.openReview
// ============================================================================

/**
 * Open a new quarterly access review
 * 
 * Input:
 * - siteId: string
 * - quarter: string (YYYY-Q#)
 * - reviewerAccountIds: string[]
 * - privilegeContext: PrivilegeContext
 * 
 * Output:
 * - reviewId: string
 * - status: "NEW" | "EXISTS"
 * - createdUtc: string
 */
export async function resolveArOpenReview(input: {
  siteId?: string;
  quarter?: string;
  reviewerAccountIds?: string[];
  privilegeContext?: PrivilegeContext;
}): Promise<{
  success: boolean;
  reviewId?: string;
  status?: "NEW" | "EXISTS";
  createdUtc?: string;
  error?: string;
  code?: string;
}> {
  try {
    // Strict validation
    if (!input.siteId) throw new ReviewError("INVALID_INPUT", "siteId required");
    if (!input.quarter) throw new ReviewError("INVALID_INPUT", "quarter required");
    if (!input.privilegeContext) {
      throw new ReviewError("INVALID_INPUT", "privilegeContext required");
    }

    validateSiteId(input.siteId);
    validateQuarter(input.quarter);

    const reviewerIds = input.reviewerAccountIds || [];

    // Open review (locks, acquires lock, etc)
    const result = await openQuarterlyReview(
      input.siteId,
      input.quarter,
      reviewerIds,
      input.privilegeContext,
      mockStorageApi
    );

    return {
      success: true,
      reviewId: result.reviewId,
      status: result.status,
      createdUtc: result.state.createdUtc,
    };
  } catch (err) {
    const error = err instanceof ReviewError ? err : (err as Error);
    return {
      success: false,
      error: error.message,
      code: err instanceof ReviewError ? err.code : "UNKNOWN",
    };
  }
}

// ============================================================================
// ar.getReview
// ============================================================================

/**
 * Get and verify review state
 * 
 * Input:
 * - siteId: string
 * - reviewId: string
 * 
 * Output:
 * - state: ReviewWorkflowState
 */
export async function resolveArGetReview(input: {
  siteId?: string;
  reviewId?: string;
}): Promise<{
  success: boolean;
  state?: any;
  error?: string;
  code?: string;
}> {
  try {
    if (!input.siteId) throw new ReviewError("INVALID_INPUT", "siteId required");
    if (!input.reviewId) throw new ReviewError("INVALID_INPUT", "reviewId required");

    validateSiteId(input.siteId);

    // Read and verify state hash
    const state = await readAndVerifyState(input.siteId, input.reviewId, mockStorageApi);

    return {
      success: true,
      state,
    };
  } catch (err) {
    const error = err instanceof ReviewError ? err : (err as Error);
    return {
      success: false,
      error: error.message,
      code: err instanceof ReviewError ? err.code : "UNKNOWN",
    };
  }
}

// ============================================================================
// ar.recordDecision
// ============================================================================

/**
 * Record a review decision
 * 
 * Input:
 * - siteId: string
 * - reviewId: string
 * - reviewerId: string
 * - decision: "APPROVED" | "DENIED" | "ABSTAIN"
 * - justification?: string
 * - privilegeContext: PrivilegeContext
 * 
 * Output:
 * - success: boolean
 * - recordedUtc?: string
 */
export async function resolveArRecordDecision(input: {
  siteId?: string;
  reviewId?: string;
  reviewerId?: string;
  decision?: string;
  justification?: string;
  privilegeContext?: PrivilegeContext;
}): Promise<{
  success: boolean;
  recordedUtc?: string;
  error?: string;
  code?: string;
}> {
  try {
    if (!input.siteId) throw new ReviewError("INVALID_INPUT", "siteId required");
    if (!input.reviewId) throw new ReviewError("INVALID_INPUT", "reviewId required");
    if (!input.reviewerId) throw new ReviewError("INVALID_INPUT", "reviewerId required");
    if (!input.decision) throw new ReviewError("INVALID_INPUT", "decision required");
    if (!input.privilegeContext) {
      throw new ReviewError("INVALID_INPUT", "privilegeContext required");
    }

    const decision = input.decision as "APPROVED" | "DENIED" | "ABSTAIN";

    validateSiteId(input.siteId);

    // Record decision
    const state = await recordDecision(
      input.siteId,
      input.reviewId,
      input.reviewerId,
      decision,
      input.justification,
      input.privilegeContext,
      mockStorageApi
    );

    return {
      success: true,
      recordedUtc: state.lastUpdatedUtc,
    };
  } catch (err) {
    const error = err instanceof ReviewError ? err : (err as Error);
    return {
      success: false,
      error: error.message,
      code: err instanceof ReviewError ? err.code : "UNKNOWN",
    };
  }
}

// ============================================================================
// ar.addException
// ============================================================================

/**
 * Add exception to review
 * 
 * Input:
 * - siteId: string
 * - reviewId: string
 * - itemId: string
 * - risk: "LOW" | "MEDIUM" | "HIGH"
 * - expiresUtc: string (ISO 8601)
 * - justification: string (max 2000 chars)
 * - privilegeContext: PrivilegeContext
 * 
 * Output:
 * - success: boolean
 * - exceptionId?: string
 */
export async function resolveArAddException(input: {
  siteId?: string;
  reviewId?: string;
  itemId?: string;
  risk?: string;
  expiresUtc?: string;
  justification?: string;
  privilegeContext?: PrivilegeContext;
}): Promise<{
  success: boolean;
  exceptionId?: string;
  error?: string;
  code?: string;
}> {
  try {
    if (!input.siteId) throw new ReviewError("INVALID_INPUT", "siteId required");
    if (!input.reviewId) throw new ReviewError("INVALID_INPUT", "reviewId required");
    if (!input.itemId) throw new ReviewError("INVALID_INPUT", "itemId required");
    if (!input.risk) throw new ReviewError("INVALID_INPUT", "risk required");
    if (!input.expiresUtc) throw new ReviewError("INVALID_INPUT", "expiresUtc required");
    if (!input.justification) {
      throw new ReviewError("INVALID_INPUT", "justification required");
    }
    if (!input.privilegeContext) {
      throw new ReviewError("INVALID_INPUT", "privilegeContext required");
    }

    const risk = input.risk as "LOW" | "MEDIUM" | "HIGH";

    validateSiteId(input.siteId);

    // Add exception
    const state = await addException(
      input.siteId,
      input.reviewId,
      input.itemId,
      risk,
      input.expiresUtc,
      input.justification,
      input.privilegeContext,
      mockStorageApi
    );

    // Find the just-added exception
    const newException = state.exceptions[state.exceptions.length - 1];

    return {
      success: true,
      exceptionId: newException?.exceptionId,
    };
  } catch (err) {
    const error = err instanceof ReviewError ? err : (err as Error);
    return {
      success: false,
      error: error.message,
      code: err instanceof ReviewError ? err.code : "UNKNOWN",
    };
  }
}

// ============================================================================
// ar.exportPack
// ============================================================================

/**
 * Export review as deterministic pack (folder format)
 * 
 * Input:
 * - siteId: string
 * - reviewId: string
 * - buildShaShort: string
 * - buildUtc: string
 * - privilegeContext: PrivilegeContext
 * 
 * Output:
 * - success: boolean
 * - pack?: { manifest.json, state.json, decisions.csv, exceptions.csv, verify.js }
 * - packHash?: string
 * - exportedUtc?: string
 */
export async function resolveArExportPack(input: {
  siteId?: string;
  reviewId?: string;
  buildShaShort?: string;
  buildUtc?: string;
  privilegeContext?: PrivilegeContext;
}): Promise<{
  success: boolean;
  pack?: Record<string, string>;
  packHash?: string;
  exportedUtc?: string;
  error?: string;
  code?: string;
}> {
  try {
    if (!input.siteId) throw new ReviewError("INVALID_INPUT", "siteId required");
    if (!input.reviewId) throw new ReviewError("INVALID_INPUT", "reviewId required");
    if (!input.buildShaShort) {
      throw new ReviewError("INVALID_INPUT", "buildShaShort required");
    }
    if (!input.buildUtc) throw new ReviewError("INVALID_INPUT", "buildUtc required");
    if (!input.privilegeContext) {
      throw new ReviewError("INVALID_INPUT", "privilegeContext required");
    }

    validateSiteId(input.siteId);

    // Get and verify state
    const state = await readAndVerifyState(input.siteId, input.reviewId, mockStorageApi);

    // Generate export pack with privilege check
    const pack = generateExportPackWithPrivilege(
      state,
      input.buildShaShort,
      input.buildUtc,
      input.privilegeContext
    );

    // Compute pack hash (all files combined)
    const packHash = hashFilesPack(pack);

    return {
      success: true,
      pack: pack as Record<string, string>,
      packHash,
      exportedUtc: new Date().toISOString(),
    };
  } catch (err) {
    const error = err instanceof ReviewError ? err : (err as Error);
    return {
      success: false,
      error: error.message,
      code: err instanceof ReviewError ? err.code : "UNKNOWN",
    };
  }
}

// ============================================================================
// RESOLVER REGISTRATION
// ============================================================================

export const resolvers = {
  "ar.openReview": resolveArOpenReview,
  "ar.getReview": resolveArGetReview,
  "ar.recordDecision": resolveArRecordDecision,
  "ar.addException": resolveArAddException,
  "ar.exportPack": resolveArExportPack,
};

/**
 * Invoke resolver by name
 */
export async function invokeResolver(
  resolverName: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const resolver = (resolvers as Record<string, Function>)[resolverName];
  if (!resolver) {
    return {
      success: false,
      error: `Unknown resolver: ${resolverName}`,
      code: "UNKNOWN_RESOLVER",
    };
  }

  try {
    return await resolver(input);
  } catch (err) {
    return {
      success: false,
      error: String(err),
      code: "RESOLVER_ERROR",
    };
  }
}
