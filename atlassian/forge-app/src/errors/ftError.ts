/**
 * FirstTry Error Standardization
 *
 * All errors in export paths converted to FTError.
 * Ensures:
 * - Consistent error codes for UI + triage
 * - Safe messages (no internal details)
 * - Evidence ID linkage (director to /tmp/ logs)
 * - Bounded error context (details object, not stack)
 */

export interface FTErrorDetails {
  [key: string]: unknown;
}

/**
 * Standard FirstTry error with code, safe message, and optional context.
 */
export class FTError extends Error {
  readonly code: string;
  readonly safeMessage: string;
  readonly details?: FTErrorDetails;

  constructor(code: string, safeMessage: string, details?: FTErrorDetails) {
    super(safeMessage);
    this.name = "FTError";
    this.code = code;
    this.safeMessage = safeMessage;
    this.details = details;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, FTError.prototype);
  }

  /**
   * Generate evidence ID for user messaging.
   * Used in UI: "Error occurred. Evidence ID: ft_<timestamp>"
   */
  getEvidenceId(): string {
    return `ft_${Date.now()}`;
  }

  /**
   * Marker for logs (enables grep-based triage).
   */
  getMarker(): string {
    return `[FT_FAIL_CLOSED] code=${this.code}`;
  }

  toJSON(): object {
    return {
      code: this.code,
      safeMessage: this.safeMessage,
      details: this.details,
      evidenceId: this.getEvidenceId(),
    };
  }
}

/**
 * Factory: Fail-closed error for expected/handled failures.
 */
export function ftFailClosed(
  code: string,
  safeMessage: string,
  details?: FTErrorDetails
): FTError {
  return new FTError(code, safeMessage, details);
}

/**
 * Factory: Wrap unknown error into FTError.
 */
export function ftUnexpected(error: unknown, context?: string): FTError {
  const msg = error instanceof Error ? error.message : String(error);
  const details = {
    originalError: msg,
    ...(context && { context }),
  };
  return new FTError("FT_UNEXPECTED", "Unexpected error. Evidence ID will be provided.", details);
}

/**
 * Type guard: Check if error is FTError.
 */
export function isFTError(error: unknown): error is FTError {
  return error instanceof FTError;
}
