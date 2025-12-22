/**
 * PHASE P3.2: ERROR TAXONOMY & CLASSIFICATION
 *
 * Classifies errors into actionable categories for support and diagnostics.
 * Every error must be classified so:
 * - Support can understand severity and scope
 * - Operators can diagnose issues (PII-free)
 * - Metrics can track error patterns
 * - Incidents can be correlated
 *
 * Error classes:
 * - AUTHZ: Permission/authentication/tenant context failures
 * - VALIDATION: Input validation, schema violations
 * - DEPENDENCY: Forge API, Jira API, external service failures
 * - STORAGE: Storage read/write failures
 * - INVARIANT: Internal contract violation (should never happen)
 * - UNKNOWN: Unclassified errors
 *
 * Non-negotiable:
 * - safeMessage never contains PII
 * - Maps known error types from P1/P2
 * - Unknown errors become UNKNOWN with generic message
 * - correlationId always attached
 */

import { CorrelationId } from './trace';
import { TenantContextError } from '../security/tenant_context';
import { ExportBlockedError } from '../output/output_contract';

/**
 * Error classification enum
 */
export type ErrorClass =
  | 'AUTHZ'      // Permission/authentication/tenant failures
  | 'VALIDATION' // Input validation, schema errors
  | 'DEPENDENCY' // External service failures (Forge, Jira, API)
  | 'STORAGE'    // Storage/database failures
  | 'INVARIANT'  // Internal contract violation
  | 'UNKNOWN';   // Unclassified

/**
 * Classified error with safe messaging
 * Safe to include in HTTP responses and user-facing messages
 */
export class ClassifiedError extends Error {
  readonly errorClass: ErrorClass;
  readonly correlationId: CorrelationId;
  readonly safeMessage: string;
  readonly cause?: Error;

  constructor(
    errorClass: ErrorClass,
    correlationId: CorrelationId,
    safeMessage: string,
    cause?: Error
  ) {
    super(safeMessage);
    this.name = 'ClassifiedError';
    this.errorClass = errorClass;
    this.correlationId = correlationId;
    this.safeMessage = safeMessage;
    this.cause = cause;
  }

  /**
   * Safe JSON serialization for HTTP responses
   */
  toJSON() {
    return {
      error: this.errorClass,
      message: this.safeMessage,
      correlationId: this.correlationId,
    };
  }
}

/**
 * Classify an error into actionable category
 * Maps known error types from P1/P2 modules
 *
 * @param err - Error to classify
 * @param correlationId - Correlation ID for this operation
 * @returns ClassifiedError with mapping applied
 */
export function classifyError(
  err: unknown,
  correlationId: CorrelationId
): ClassifiedError {
  // Handle null/undefined
  if (!err) {
    return new ClassifiedError(
      'UNKNOWN',
      correlationId,
      'An unexpected error occurred. See correlationId for diagnosis.'
    );
  }

  // Handle Error objects
  if (err instanceof Error) {
    // P1.4: Tenant context errors
    if (err instanceof TenantContextError) {
      return new ClassifiedError(
        'AUTHZ',
        correlationId,
        'Tenant authentication failed. Please verify your Jira Cloud site access.',
        err
      );
    }

    // P2: Export blocked errors
    if (err instanceof ExportBlockedError) {
      return new ClassifiedError(
        'VALIDATION',
        correlationId,
        `Output is ${err.validityStatus}. Please review quality checks and try again.`,
        err
      );
    }

    // Generic storage errors (from @forge/api)
    if (
      err.name === 'StorageError' ||
      err.message?.includes('storage') ||
      err.message?.includes('Storage')
    ) {
      return new ClassifiedError(
        'STORAGE',
        correlationId,
        'Unable to access data storage. Please try again in a moment.',
        err
      );
    }

    // Generic API errors (from @forge/api)
    if (
      err.name === 'ApiError' ||
      err.message?.includes('API') ||
      err.message?.includes('api') ||
      err.message?.includes('403') ||
      err.message?.includes('401')
    ) {
      return new ClassifiedError(
        'DEPENDENCY',
        correlationId,
        'Unable to communicate with Jira Cloud. Please try again in a moment.',
        err
      );
    }

    // Validation/constraint errors
    if (
      err.name === 'ValidationError' ||
      err.message?.includes('invalid') ||
      err.message?.includes('Invalid') ||
      err.message?.includes('required')
    ) {
      return new ClassifiedError(
        'VALIDATION',
        correlationId,
        'Invalid input or configuration. Please review and try again.',
        err
      );
    }

    // Invariant/assertion errors
    if (
      err.name === 'AssertionError' ||
      err.message?.includes('invariant') ||
      err.message?.includes('Invariant')
    ) {
      return new ClassifiedError(
        'INVARIANT',
        correlationId,
        'Internal consistency check failed. Please contact support with correlationId.',
        err
      );
    }

    // Default: unknown error with generic message
    return new ClassifiedError(
      'UNKNOWN',
      correlationId,
      'An unexpected error occurred. See correlationId for diagnosis.',
      err
    );
  }

  // Handle string errors
  if (typeof err === 'string') {
    return new ClassifiedError(
      'UNKNOWN',
      correlationId,
      'An unexpected error occurred. See correlationId for diagnosis.'
    );
  }

  // Handle anything else
  return new ClassifiedError(
    'UNKNOWN',
    correlationId,
    'An unexpected error occurred. See correlationId for diagnosis.'
  );
}

/**
 * Type guard to check if error is ClassifiedError
 */
export function isClassifiedError(err: unknown): err is ClassifiedError {
  return err instanceof ClassifiedError;
}

/**
 * Safe error response for HTTP handlers
 * Never exposes raw error messages to client
 */
export function errorResponse(classified: ClassifiedError, statusCode: number = 500) {
  return {
    statusCode,
    body: JSON.stringify(classified.toJSON()),
    headers: {
      'Content-Type': 'application/json',
    },
  };
}
