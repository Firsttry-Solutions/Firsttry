/**
 * ERROR ENVELOPE BUILDER
 * 
 * Factory function for creating ErrorEnvelopeV1
 * Ensures all required fields are set, no undefined values
 */

import {
  type ErrorEnvelopeV1,
  type ErrorCode,
  type InvocationMetaV1,
  type StorageProofV1,
  type StepTraceV1,
  validateErrorEnvelope,
} from '../shared/invocationEnvelope';

/**
 * Create an error envelope with all required fields
 * 
 * Requirements:
 * - All fields must be set (no undefined)
 * - meta.nowIso must be present
 * - trace must have at least one step
 * - errorCode must be from ErrorCode enum
 * 
 * @returns ErrorEnvelopeV1 ready for response
 * @throws Error if validation fails
 */
export function makeErrorEnvelope(args: {
  resolverName: string;
  stepId: string;
  errorCode: ErrorCode;
  message: string;
  meta: InvocationMetaV1;
  storage?: StorageProofV1 | null;
  trace: StepTraceV1[];
  details?: Record<string, unknown> | null;
}): ErrorEnvelopeV1 {
  const {
    resolverName,
    stepId,
    errorCode,
    message,
    meta,
    storage = null,
    trace,
    details = null,
  } = args;

  // Build envelope
  const envelope: ErrorEnvelopeV1 = {
    kind: 'ERROR',
    schemaVersion: '1',
    resolverName,
    stepId,
    errorCode,
    message,
    meta,
    storage: storage || null,
    trace: trace || [],
    details: details || null,
  };

  // Validate before returning
  const validationError = validateErrorEnvelope(envelope);
  if (validationError) {
    throw new Error(`Invalid error envelope: ${validationError}`);
  }

  return envelope;
}
