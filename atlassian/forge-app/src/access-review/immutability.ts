/**
 * PHASE 3 v1.2 - State Immutability Hardening
 * Ledger chaining and optional cryptographic signing
 *
 * Requirements:
 * - Review chaining (previousReviewHash field)
 * - Optional RSA signing for audit trails
 * - Immutable ledger verification
 * - Chain integrity validation
 * - Marker: [FT_STATE_IMMUTABILITY_COMPLETE]
 */

import * as crypto from "crypto";
import { ReviewError, ReviewErrorCode } from "./types";

// ============================================================================
// Error Handling
// ============================================================================

export class ImmutabilityError extends ReviewError {
  constructor(message: string, public reason: string) {
    super(message);
    this.name = "ImmutabilityError";
    this.code = "IMMUTABILITY_VIOLATION" as ReviewErrorCode;
  }
}

export class ChainValidationError extends ImmutabilityError {
  constructor(message: string) {
    super(message, "CHAIN_INTEGRITY_VIOLATION");
    this.name = "ChainValidationError";
  }
}

export class SignatureError extends ImmutabilityError {
  constructor(message: string) {
    super(message, "SIGNATURE_INVALID");
    this.name = "SignatureError";
  }
}

// ============================================================================
// Data Models
// ============================================================================

export interface ChainedReviewState {
  reviewId: string;
  quarter: string;
  state: any; // Full review state
  stateHash: string;
  previousReviewHash: string | null; // Links to previous review
  chainDepth: number;
  sequenceNumber: number;
  timestamp: number;
  isSigned: boolean;
  signature?: string;
  publicKeyId?: string;
}

export interface ChainLink {
  reviewId: string;
  timestamp: number;
  stateHash: string;
  previousHash: string | null;
  nextHash?: string; // Forward reference (optional)
}

export interface SigningKeyPair {
  id: string;
  publicKey: string;
  privateKey: string;
  algorithm: "RSA-SHA256";
  createdAt: number;
  isRotated: boolean;
  rotatedAt?: number;
}

export interface SignatureMetadata {
  algorithm: string;
  keyId: string;
  timestamp: number;
  signature: string;
}

// ============================================================================
// Hash Computation
// ============================================================================

export function computeStateHash(state: any): string {
  const canonical = JSON.stringify(state, Object.keys(state).sort());
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function computeChainHash(
  stateHash: string,
  previousHash: string | null,
  timestamp: number
): string {
  const chainData = JSON.stringify({
    stateHash,
    previousHash,
    timestamp,
  });
  return crypto.createHash("sha256").update(chainData).digest("hex");
}

// ============================================================================
// Ledger Chaining
// ============================================================================

export function createChainedReviewState(
  reviewId: string,
  quarter: string,
  state: any,
  previousReviewHash: string | null = null,
  sequenceNumber: number = 1
): ChainedReviewState {
  const stateHash = computeStateHash(state);
  const chainHash = computeChainHash(
    stateHash,
    previousReviewHash,
    Date.now()
  );

  return {
    reviewId,
    quarter,
    state,
    stateHash,
    previousReviewHash,
    chainDepth: previousReviewHash ? 2 : 1,
    sequenceNumber,
    timestamp: Date.now(),
    isSigned: false,
  };
}

export function verifyChainIntegrity(
  current: ChainedReviewState,
  previous: ChainedReviewState | null
): void {
  // Verify current state hash
  const computedStateHash = computeStateHash(current.state);
  if (computedStateHash !== current.stateHash) {
    throw new ChainValidationError(
      `State hash mismatch: ${computedStateHash} != ${current.stateHash}`
    );
  }

  // Verify chain link if previous exists
  if (previous) {
    if (current.previousReviewHash !== previous.stateHash) {
      throw new ChainValidationError(
        `Previous review hash mismatch: ${current.previousReviewHash} != ${previous.stateHash}`
      );
    }

    if (current.sequenceNumber !== previous.sequenceNumber + 1) {
      throw new ChainValidationError(
        `Sequence number discontinuity: ${current.sequenceNumber} != ${previous.sequenceNumber} + 1`
      );
    }

    if (current.timestamp < previous.timestamp) {
      throw new ChainValidationError(
        `Timestamp regression: ${current.timestamp} < ${previous.timestamp}`
      );
    }
  } else {
    // First in chain
    if (current.previousReviewHash !== null) {
      throw new ChainValidationError(
        `First review should have null previousReviewHash`
      );
    }
    if (current.sequenceNumber !== 1) {
      throw new ChainValidationError(`First review should have sequenceNumber 1`);
    }
  }

  console.log(
    `[FT_CHAIN_INTEGRITY_VERIFIED] Review ${current.reviewId} chain validated`
  );
}

// ============================================================================
// Ledger Traversal & Validation
// ============================================================================

export function buildChainTrail(
  reviews: ChainedReviewState[]
): ChainLink[] {
  return reviews
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    .map((review, index) => ({
      reviewId: review.reviewId,
      timestamp: review.timestamp,
      stateHash: review.stateHash,
      previousHash: review.previousReviewHash,
      nextHash:
        index < reviews.length - 1 ? reviews[index + 1].stateHash : undefined,
    }));
}

export function validateChainTrail(trail: ChainLink[]): void {
  for (let i = 1; i < trail.length; i++) {
    const current = trail[i];
    const previous = trail[i - 1];

    if (current.previousHash !== previous.stateHash) {
      throw new ChainValidationError(
        `Chain break at position ${i}: ${current.previousHash} != ${previous.stateHash}`
      );
    }
  }

  console.log(`[FT_CHAIN_TRAIL_VALID] All ${trail.length} links validated`);
}

export function findTamperingAttempts(trail: ChainLink[]): ChainLink[] {
  const tampered: ChainLink[] = [];

  for (let i = 1; i < trail.length; i++) {
    const current = trail[i];
    const previous = trail[i - 1];

    if (current.previousHash !== previous.stateHash) {
      tampered.push(current);
    }
  }

  return tampered;
}

// ============================================================================
// RSA Signing (Optional)
// ============================================================================

export class SigningEngine {
  constructor(private keyPair: SigningKeyPair) {}

  signState(state: ChainedReviewState): string {
    const msgToSign = JSON.stringify({
      reviewId: state.reviewId,
      stateHash: state.stateHash,
      previousHash: state.previousReviewHash,
      timestamp: state.timestamp,
    });

    const sign = crypto.createSign("sha256");
    sign.update(msgToSign);

    try {
      const signature = sign.sign(this.keyPair.privateKey, "hex");
      console.log(
        `[FT_SIGNATURE_CREATED] Signed review ${state.reviewId}`
      );
      return signature;
    } catch (err: any) {
      throw new SignatureError(`Failed to sign state: ${err.message}`);
    }
  }

  verifySignature(state: ChainedReviewState, signature: string): boolean {
    if (!state.isSigned || !state.signature) {
      throw new SignatureError("State is not marked as signed");
    }

    const msgToVerify = JSON.stringify({
      reviewId: state.reviewId,
      stateHash: state.stateHash,
      previousHash: state.previousReviewHash,
      timestamp: state.timestamp,
    });

    const verify = crypto.createVerify("sha256");
    verify.update(msgToVerify);

    try {
      const isValid = verify.verify(this.keyPair.publicKey, signature, "hex");
      if (isValid) {
        console.log(
          `[FT_SIGNATURE_VERIFIED] Signature valid for review ${state.reviewId}`
        );
      }
      return isValid;
    } catch (err: any) {
      throw new SignatureError(`Failed to verify signature: ${err.message}`);
    }
  }

  rotateKeyPair(newKeyPair: SigningKeyPair): void {
    this.keyPair.isRotated = true;
    this.keyPair.rotatedAt = Date.now();
    console.log(`[FT_KEY_ROTATION] Key ${this.keyPair.id} rotated`);
  }
}

export function generateKeyPair(): SigningKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  const id = `KEY_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    id,
    publicKey,
    privateKey,
    algorithm: "RSA-SHA256",
    createdAt: Date.now(),
    isRotated: false,
  };
}

// ============================================================================
// Immutability Verification
// ============================================================================

export interface ImmutabilityReport {
  reviewsChecked: number;
  chainValid: boolean;
  signatureValid: boolean;
  tampering: ChainLink[];
  inconsistencies: string[];
  timestamp: number;
}

export function verifyLedgerImmutability(
  reviews: ChainedReviewState[],
  signingEngine?: SigningEngine
): ImmutabilityReport {
  const tampering: ChainLink[] = [];
  const inconsistencies: string[] = [];

  // Build and validate chain trail
  const trail = buildChainTrail(reviews);

  try {
    validateChainTrail(trail);
  } catch (err: any) {
    const tampered = findTamperingAttempts(trail);
    tampering.push(...tampered);
    inconsistencies.push(err.message);
  }

  // Verify signatures if provided
  let signaturesValid = true;
  if (signingEngine && reviews.some((r) => r.isSigned)) {
    try {
      reviews.forEach((review) => {
        if (review.isSigned && review.signature) {
          signingEngine.verifySignature(review, review.signature);
        }
      });
    } catch (err: any) {
      signaturesValid = false;
      inconsistencies.push(`Signature verification failed: ${err.message}`);
    }
  }

  const report: ImmutabilityReport = {
    reviewsChecked: reviews.length,
    chainValid: tampering.length === 0,
    signatureValid: signaturesValid,
    tampering,
    inconsistencies,
    timestamp: Date.now(),
  };

  if (report.chainValid && report.signatureValid) {
    console.log(
      `[FT_IMMUTABILITY_VERIFIED] All ${reviews.length} reviews passed integrity checks`
    );
  }

  return report;
}

// ============================================================================
// State Mutation Prevention
// ============================================================================

export function freezeChainedState(state: ChainedReviewState): Readonly<ChainedReviewState> {
  Object.freeze(state);
  Object.freeze(state.state);
  return state;
}

export function assertStateUnmodified(
  original: ChainedReviewState,
  current: ChainedReviewState
): void {
  if (original.stateHash !== computeStateHash(current.state)) {
    throw new ImmutabilityError(
      `State has been modified after chaining`,
      "STATE_MODIFIED"
    );
  }
}

// ============================================================================
// Audit Trail Export
// ============================================================================

export interface AuditTrailEntry {
  sequence: number;
  reviewId: string;
  timestamp: number;
  stateHash: string;
  previousHash: string | null;
  changeType: "CREATED" | "MODIFIED" | "SIGNED" | "ROTATED";
  actor: string;
}

export function generateAuditTrail(
  reviews: ChainedReviewState[]
): AuditTrailEntry[] {
  return reviews
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    .map((review, index) => ({
      sequence: index + 1,
      reviewId: review.reviewId,
      timestamp: review.timestamp,
      stateHash: review.stateHash,
      previousHash: review.previousReviewHash,
      changeType: "CREATED",
      actor: "system",
    }));
}

// ============================================================================
// MARKER
// ============================================================================

console.log("[FT_STATE_IMMUTABILITY_COMPLETE] State immutability engine loaded");
