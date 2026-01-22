/**
 * PRODUCTION CONTRACT PROOF WEBTRIGGER - WITH TOKEN AUTHENTICATION
 * 
 * This webtrigger provides a read-only, non-interactive HTTP endpoint
 * that returns the production envelope contract proof.
 * 
 * Security:
 * - Requires x-ft-proof-token header (from FT_CONTRACT_PROOF_TOKEN env var)
 * - Returns 401 if token missing or incorrect
 * - NO query parameters accepted
 * - NO request body processed
 * - Returns ONLY envelope structure (no tenant data)
 * - Logs [FT_CONTRACT_PROOF_WEBTRIGGER] marker (non-secret)
 * - HTTP 200 + application/json on success
 * 
 * Manifest reference:
 *   function:
 *     - key: ft-contract-proof
 *       handler: src/webtriggers/contract-proof.run
 *   webtrigger:
 *     - key: ft-contract-proof-trigger
 *       function: ft-contract-proof
 * 
 * Usage (production):
 *   TOKEN=$(cat /tmp/ft_proof_token.txt)
 *   curl -H "x-ft-proof-token: $TOKEN" https://<forge-url>/webtrigger/ft-contract-proof-trigger
 * 
 * Expected response (HTTP 200):
 *   {
 *     "envelopeKind": "FT_DASH_ENVELOPE_V1",
 *     "envelopeVersion": 1,
 *     "ok": true,
 *     "schemaVersion": "v1",
 *     "meta": {...},
 *     "data": {...}
 *   }
 * 
 * Error response (HTTP 401 if unauthorized):
 *   {
 *     "ok": false,
 *     "error": {
 *       "code": "UNAUTHORIZED",
 *       "message": "Missing or invalid x-ft-proof-token header"
 *     }
 *   }
 */

import { ft_contractProof_dashEnvelope_v1 } from "../gadget-resolver";

/**
 * HTTP Response wrapper - ensures Forge always gets proper serialized response
 * 
 * @param statusCode - HTTP status code (200, 401, 500)
 * @param payload - JSON-serializable payload object
 * @param extraHeaders - additional headers (optional)
 * @returns Forge-compatible HTTP response format
 */
function jsonResponse(
  statusCode: number,
  payload: unknown,
  extraHeaders?: Record<string, string>
): { statusCode: number; headers: Record<string, string>; body: string } {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

/**
 * Get header by name, case-insensitive
 * 
 * @param req - HTTP request with headers
 * @param nameLower - header name (lowercase for comparison)
 * @returns header value or null
 */
function getHeader(req: any, nameLower: string): string | null {
  if (!req || !req.headers) {
    return null;
  }

  const headers = req.headers;
  const headerKey = Object.keys(headers).find(
    (k) => k.toLowerCase() === nameLower.toLowerCase()
  );

  if (!headerKey) {
    return null;
  }

  const value = headers[headerKey];
  if (Array.isArray(value)) {
    return value[0] || null;
  }
  return value || null;
}

/**
 * Safe error payload - never includes secrets
 * 
 * @param err - error object
 * @returns safe payload for error response
 */
function safeErrorPayload(err: unknown): {
  error: string;
  message: string;
  errorName?: string;
  correlationId: string;
} {
  const correlationId = `cp_err_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;

  if (err instanceof Error) {
    return {
      error: "internal_error",
      message: err.message,
      errorName: err.name,
      correlationId,
    };
  }

  return {
    error: "internal_error",
    message: String(err),
    correlationId,
  };
}

/**
 * Token validation: Check x-ft-proof-token header
 * 
 * @param req - HTTP request with headers
 * @returns true if token is valid, false otherwise
 */
function validateToken(req: any): boolean {
  const expectedToken = process.env.FT_CONTRACT_PROOF_TOKEN;
  
  // No token configured - deny all
  if (!expectedToken || expectedToken.trim() === "") {
    console.log(
      JSON.stringify({
        marker: "FT_CONTRACT_PROOF_TOKEN_CHECK",
        status: "MISSING_ENV_CONFIG",
        ts: new Date().toISOString()
      })
    );
    return false;
  }

  // Get token from header (case-insensitive)
  const headerToken = getHeader(req, "x-ft-proof-token");
  
  if (!headerToken) {
    console.log(
      JSON.stringify({
        marker: "FT_CONTRACT_PROOF_TOKEN_CHECK",
        status: "MISSING_HEADER",
        ts: new Date().toISOString()
      })
    );
    return false;
  }

  // Constant-time comparison (prevent timing attacks)
  const match = headerToken === expectedToken;
  
  console.log(
    JSON.stringify({
      marker: "FT_CONTRACT_PROOF_TOKEN_CHECK",
      status: match ? "AUTHORIZED" : "INVALID_TOKEN",
      ts: new Date().toISOString()
    })
  );

  return match;
}


/**
 * Webtrigger handler: Returns production envelope contract proof
 * 
 * Requires valid x-ft-proof-token header for security.
 * 
 * Forge webtriggers require explicit response format: { statusCode, headers?, body? }
 * Unlike regular resolvers, errors are handled via response format, not exceptions.
 * 
 * @param req - HTTP request (webtrigger API)
 * @returns Response object
 */
export async function run(req: any) {
  const correlationId = `cp_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;

  // Step 0: Check environment configuration
  const expectedToken = process.env.FT_CONTRACT_PROOF_TOKEN;
  if (!expectedToken || expectedToken.trim() === "") {
    console.log(
      JSON.stringify({
        marker: "FT_CONTRACT_PROOF_WEBTRIGGER",
        status: "ENV_MISCONFIGURED",
        correlationId,
        ts: new Date().toISOString(),
      })
    );
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "misconfigured",
        message: "Webtrigger token not configured on server",
        correlationId,
      }),
    };
  }

  // Step 1: Validate token (non-negotiable security gate)
  if (!validateToken(req)) {
    return {
      statusCode: 401,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify({
        ok: false,
        error: "unauthorized",
        message: "Missing or invalid x-ft-proof-token header",
        correlationId,
      }),
    };
  }

  // Step 2: Generate proof (token is valid)
  try {
    const envelope = await ft_contractProof_dashEnvelope_v1({});

    // Step 3: Verify envelope is JSON-serializable
    try {
      JSON.stringify(envelope);
    } catch (serErr) {
      console.log(
        JSON.stringify({
          marker: "FT_CONTRACT_PROOF_WEBTRIGGER",
          status: "SERIALIZATION_FAILURE",
          error: String(serErr),
          correlationId,
          ts: new Date().toISOString(),
        })
      );
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "serialization_error",
          message: "Envelope not JSON-serializable",
          correlationId,
        }),
      };
    }

    // Log invocation marker (non-secret, token validation already logged)
    console.log(
      JSON.stringify({
        marker: "FT_CONTRACT_PROOF_WEBTRIGGER",
        status: "SUCCESS",
        correlationId,
        ts: new Date().toISOString(),
        envelopeKind: envelope.envelopeKind,
        schemaVersion: envelope.schemaVersion,
      })
    );

    // Return properly formatted response with 200 OK
    return {
      statusCode: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify(envelope),
    };
  } catch (error) {
    // On any error, return safe error response
    const errorPayload = safeErrorPayload(error);

    console.log(
      JSON.stringify({
        marker: "FT_CONTRACT_PROOF_WEBTRIGGER",
        status: "ERROR",
        correlationId,
        error: errorPayload,
        ts: new Date().toISOString(),
      })
    );

    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "webtrigger_failure",
        ...errorPayload,
      }),
    };
  }
}

