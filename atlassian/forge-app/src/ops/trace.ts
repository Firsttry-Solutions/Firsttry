/**
 * PHASE P3.1: CORRELATION ID TRACING
 *
 * Provides correlation ID generation and propagation for request tracing.
 * Every operation gets a unique, crypto-strong correlation ID that is:
 * - Attached to all audit events
 * - Attached to error responses
 * - Attached to metric events
 * - Used for incident diagnosis without exposing PII
 *
 * Non-negotiable:
 * - No timestamps (prevents guessing/replay)
 * - Crypto-strong randomness
 * - Deterministic format for parsing
 */

import crypto from 'crypto';

/**
 * Correlation ID format: hex-encoded 16 bytes of random data
 * Example: a1f2b3c4d5e6f7g8h9i0j1k2l3m4n5o6
 */
export type CorrelationId = string;

/**
 * Context bag for correlation ID and operationName
 * Passed through handler chains to ensure all events are correlated
 */
export interface TraceContext {
  correlationId: CorrelationId;
  operationName: string; // e.g. "snapshot_export", "drift_evaluation"
  startTimeMs: number; // For duration metrics
}

/**
 * Generate a new correlation ID
 * Uses crypto.randomBytes for strength (no timestamps)
 *
 * @returns 32-character hex string (16 bytes of randomness)
 */
export function newCorrelationId(): CorrelationId {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create a trace context for an operation
 * Should be called at the entry point of each major operation
 *
 * @param operationName - Human-readable operation name (e.g. "export_snapshot")
 * @returns TraceContext with fresh correlation ID
 */
export function createTraceContext(operationName: string): TraceContext {
  return {
    correlationId: newCorrelationId(),
    operationName,
    startTimeMs: Date.now(),
  };
}

/**
 * Compute duration in milliseconds from trace context start time
 *
 * @param ctx - TraceContext
 * @returns Duration in milliseconds
 */
export function getElapsedMs(ctx: TraceContext): number {
  return Date.now() - ctx.startTimeMs;
}

/**
 * Extract correlation ID from trace context or return the ID if string provided
 * Safe accessor that never returns undefined
 *
 * @param ctxOrId - TraceContext, CorrelationId string, or undefined
 * @returns Correlation ID, or new one if missing
 */
export function getOrCreateCorrelationId(ctxOrId?: TraceContext | CorrelationId): CorrelationId {
  if (typeof ctxOrId === 'string') {
    return ctxOrId;
  }
  if (ctxOrId && typeof ctxOrId === 'object' && 'correlationId' in ctxOrId) {
    return ctxOrId.correlationId;
  }
  return newCorrelationId();
}

/**
 * Format correlation ID for safe logging
 * Can be safely included in error messages and responses without redaction
 *
 * @param correlationId - CorrelationId
 * @returns Formatted string safe for user-facing messages
 */
export function formatCorrelationIdForUser(correlationId: CorrelationId): string {
  return `[${correlationId.substring(0, 8)}...]`;
}
