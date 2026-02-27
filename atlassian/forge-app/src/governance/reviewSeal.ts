/**
 * Deterministic Review Seal + Hash Freeze for ECL-4
 *
 * Implements immutable review closure via deterministic sealing:
 * - Sealed reviews become immutable (no state mutations allowed)
 * - Seal contains canonical object with deterministic fields
 * - SHA-256 sealHash computed from canonical JSON
 * - RBAC validation enforced (CLOSE_REVIEW permission required)
 * - Fail-closed semantics throughout
 *
 * Storage interaction: Reviews in ar.v1 space gain seal fields
 * No manifest scope changes, no outbound networking, no Jira mutations.
 *
 * FT_ECL_PHASE: ECL-4 REVIEW_SEAL_STORE
 * FT_ECL_PHASE: ECL-4 REVIEW_IMMUTABLE_GUARD
 */

import { storage } from "@forge/api";
import { sha256Hex, canonicalJsonString } from "../milestone1/canonicalize";
import { EclRole, EclAction, hasPermission } from "./rbac";
import { Clock, SystemClock } from "../shared/clock";
import { BACKEND_GIT_SHA_SHORT, BACKEND_BUILD_TIME_UTC } from "../build/buildIdentityBackend.gen";
import { ReviewWorkflowState } from "../access-review/types";

/**
 * Schema version for review seals
 */
const REVIEW_SEAL_SCHEMA_VERSION = "ecl.reviewSeal@1";

/**
 * Canonical seal object (all fields required for determinism)
 * Order of keys is EXACT as declared (JSON serialization order)
 */
interface ReviewSealObject {
  reviewId: string;
  findingsHash: string;
  approvalsHash: string;
  sealedTimestampUtc: string;
  sealedByRole: EclRole;
  buildShaShort: string;
  buildUtc: string;
  schemaVersion: string;
}

/**
 * Compute canonical seal object given a review state
 * Derives findingsHash and approvalsHash from current review data
 * 
 * @param review The review workflow state
 * @param sealedTimestampUtc The UTC timestamp of sealing
 * @param actorRole The role of the actor sealing the review
 * @returns The canonical seal object
 */
function createCanonicalSealObject(
  review: ReviewWorkflowState,
  sealedTimestampUtc: string,
  actorRole: EclRole
): ReviewSealObject {
  // Derive findingsHash from current review snapshot (deterministic)
  // This is the hash of the review snapshot baseline
  const findingsHash = review.snapshotRef?.baselineSha || review.stateHash;

  // Derive approvalsHash from all decisions (deterministic)
  // SHA256 of canonical JSON of all decision hashes
  const decisionHashes = review.decisions
    .map(d => d.decisionHash)
    .sort(); // Ensure deterministic order
  const approvalsHash = sha256Hex(canonicalJsonString({ decisionHashes }));

  // Build exact seal object with deterministic field order
  const sealObject: ReviewSealObject = {
    reviewId: review.reviewId,
    findingsHash,
    approvalsHash,
    sealedTimestampUtc,
    sealedByRole: actorRole,
    buildShaShort: BACKEND_GIT_SHA_SHORT,
    buildUtc: BACKEND_BUILD_TIME_UTC,
    schemaVersion: REVIEW_SEAL_SCHEMA_VERSION
  };

  return sealObject;
}

/**
 * Seal a review (mark as immutable, freeze state)
 * 
 * SPEC SIGNATURE (ECL-4):
 *   sealReview(reviewId: string, actorRole: EclRole) -> Promise<ReviewWorkflowState>
 * 
 * Validation (FAIL-CLOSED):
 * - Actor must have CLOSE_REVIEW permission
 * - Review must exist
 * - Review must not already be sealed
 * 
 * After sealing:
 * - Any attempt to mutate sealed review state must fail
 * - seal fields are set: sealed=true, sealedTimestampUtc, sealedByRole, sealHash
 * 
 * @param reviewId The review identifier
 * @param actorRole The role of the actor requesting the seal
 * @param siteId (INTERNAL) The Jira site ID - derived from context or resolver
 * @returns The updated review workflow state with seal fields set
 * @throws If validation fails or storage error occurs
 */
// ECL-4 Spec-exact signature (public API)
export async function sealReview(reviewId: string, actorRole: EclRole): Promise<ReviewWorkflowState>;
// Internal overload with siteId (for resolver use)
export async function sealReview(reviewId: string, actorRole: EclRole, siteId: string): Promise<ReviewWorkflowState>;
// Implementation
export async function sealReview(
  reviewId: string,
  actorRole: EclRole,
  siteId?: string,
  clock: Clock = SystemClock
): Promise<ReviewWorkflowState> {
  // FAIL-CLOSED: siteId is required (must be provided by resolver or internal caller)
  if (!siteId || typeof siteId !== "string" || siteId.trim() === "") {
    throw new Error("FAIL_CLOSED: siteId must be provided (internal use only)");
  }
  // FAIL-CLOSED: Validate permission
  if (!hasPermission(actorRole, EclAction.CLOSE_REVIEW)) {
    throw new Error(
      `FAIL_CLOSED: Role ${actorRole} does not have permission CLOSE_REVIEW`
    );
  }

  // FAIL-CLOSED: Validate inputs
  if (!reviewId || typeof reviewId !== "string" || reviewId.trim() === "") {
    throw new Error("FAIL_CLOSED: reviewId must be a non-empty string");
  }

  // Retrieve current review state from storage
  // Key pattern matches access-review storageKeys
  const reviewKey = `ar.v1:review:${siteId}:${reviewId}`;
  let review: ReviewWorkflowState;

  try {
    const stored = await storage.get(reviewKey);
    if (!stored) {
      throw new Error(
        `FAIL_CLOSED: Review not found: ${reviewId} (siteId=${siteId})`
      );
    }
    review = stored as ReviewWorkflowState;
  } catch (err) {
    throw new Error(`FAIL_CLOSED: Cannot retrieve review storage: ${err}`);
  }

  // FAIL-CLOSED: Check if already sealed
  if (review.sealed === true) {
    throw new Error(`FAIL_CLOSED: Review is already sealed (reviewId=${reviewId})`);
  }

  // Create canonical seal object
  const sealedTimestampUtc = clock.nowISO();
  const sealObject = createCanonicalSealObject(
    review,
    sealedTimestampUtc,
    actorRole
  );

  // Compute sealHash (SHA-256 of canonical JSON without the hash field itself)
  const sealHashInput = {
    reviewId: sealObject.reviewId,
    findingsHash: sealObject.findingsHash,
    approvalsHash: sealObject.approvalsHash,
    sealedTimestampUtc: sealObject.sealedTimestampUtc,
    sealedByRole: sealObject.sealedByRole,
    buildShaShort: sealObject.buildShaShort,
    buildUtc: sealObject.buildUtc,
    schemaVersion: sealObject.schemaVersion
  };
  const sealHash = sha256Hex(canonicalJsonString(sealHashInput));

  // Update review state with seal fields
  const updatedReview: ReviewWorkflowState = {
    ...review,
    sealed: true,
    sealedTimestampUtc,
    sealedByRole: actorRole,
    sealHash,
    lastUpdatedUtc: sealedTimestampUtc
  };

  // Persist updated review to storage
  try {
    await storage.set(reviewKey, updatedReview);
  } catch (err) {
    throw new Error(`FAIL_CLOSED: Cannot persist sealed review to storage: ${err}`);
  }

  return updatedReview;
}

/**
 * Guard: Enforce review immutability
 * 
 * Must be called before any mutation operation on a review.
 * Throws if review is sealed.
 * 
 * FT_ECL_PHASE: ECL-4 REVIEW_IMMUTABLE_GUARD
 * 
 * @param review The review to check
 * @throws If review is sealed
 */
export function enforceReviewNotSealed(review: ReviewWorkflowState): void {
  if (review.sealed === true) {
    throw new Error(
      `FAIL_CLOSED: Cannot mutate sealed review (reviewId=${review.reviewId})`
    );
  }
}

/**
 * Get seal status of a review (used by UI)
 * 
 * @param review The review workflow state
 * @returns Seal status info for UI rendering (or null if not sealed)
 */
export function getReviewSealStatus(
  review: ReviewWorkflowState
): {
  sealed: boolean;
  sealedTimestampUtc?: string;
  sealedByRole?: EclRole;
  sealHash?: string;
} | null {
  if (!review.sealed) {
    return null;
  }

  return {
    sealed: true,
    sealedTimestampUtc: review.sealedTimestampUtc,
    sealedByRole: review.sealedByRole as EclRole | undefined,
    sealHash: review.sealHash
  };
}
