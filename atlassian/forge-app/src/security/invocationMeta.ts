/**
 * INVOCATION META EXTRACTION
 * 
 * Safely extracts trace IDs, request IDs, and correlation IDs from Forge context.
 * NO invented values: missing data → null
 * NO assumptions about context structure: tries multiple paths
 */

import type { InvocationMetaV1 } from '../shared/invocationEnvelope';

/**
 * Build invocation metadata from Forge context and request
 * 
 * Requirements:
 * - nowIso: always set to current timestamp
 * - traceId/requestId/invocationId: best-effort extraction, null if not found
 * - uiReqId: pass-through from caller, null if not provided
 * 
 * @param ctx Forge resolver context object (may be undefined/null)
 * @param uiReqId UI request ID from payload (may be null)
 * @returns InvocationMetaV1 with all fields populated or null
 */
export function buildInvocationMeta(args: {
  ctx?: any;
  uiReqId?: string | null;
}): InvocationMetaV1 {
  const { ctx, uiReqId = null } = args;

  // Always set current timestamp
  const nowIso = new Date().toISOString();

  // Extract trace ID (try multiple paths)
  let traceId: string | null = null;
  if (ctx) {
    traceId =
      ctx.traceId ||
      ctx.trace?.id ||
      ctx.traceContext?.traceId ||
      ctx.context?.traceId ||
      ctx.context?.trace?.id ||
      (typeof ctx.getTraceId === 'function' ? ctx.getTraceId() : null) ||
      null;
  }

  // Extract request ID (try multiple paths)
  let requestId: string | null = null;
  if (ctx) {
    requestId =
      ctx.requestId ||
      ctx.request?.id ||
      ctx.requestContext?.requestId ||
      ctx.context?.requestId ||
      ctx.context?.request?.id ||
      (typeof ctx.getRequestId === 'function' ? ctx.getRequestId() : null) ||
      null;
  }

  // Extract invocation ID (try multiple paths)
  let invocationId: string | null = null;
  if (ctx) {
    invocationId =
      ctx.invocationId ||
      ctx.invocation?.id ||
      ctx.invocationContext?.invocationId ||
      ctx.context?.invocationId ||
      ctx.context?.invocation?.id ||
      (typeof ctx.getInvocationId === 'function' ? ctx.getInvocationId() : null) ||
      null;
  }

  return {
    traceId: traceId ? String(traceId) : null,
    requestId: requestId ? String(requestId) : null,
    invocationId: invocationId ? String(invocationId) : null,
    uiReqId: uiReqId ? String(uiReqId) : null,
    nowIso,
  };
}
