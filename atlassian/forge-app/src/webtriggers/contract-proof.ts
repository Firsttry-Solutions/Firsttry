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
  const headerToken = req.headers && req.headers["x-ft-proof-token"];
  
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
 * @param req - HTTP request (webtrigger API)
 * @returns Envelope object (Forge serializes to JSON) or error response
 */
export async function run(req: any) {
  try {
    // Step 1: Validate token (non-negotiable security gate)
    if (!validateToken(req)) {
      return {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid x-ft-proof-token header"
        }
      };
    }

    // Step 2: Generate proof (token is valid)
    const envelope = await ft_contractProof_dashEnvelope_v1({});

    // Log invocation marker (non-secret, token validation already logged)
    console.log(
      JSON.stringify({
        marker: "FT_CONTRACT_PROOF_WEBTRIGGER",
        ts: new Date().toISOString(),
        envelopeKind: envelope.envelopeKind,
        schemaVersion: envelope.schemaVersion
      })
    );

    // Return envelope directly (Forge serializes automatically)
    return envelope;
  } catch (error) {
    // On error, return error envelope
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.log(
      JSON.stringify({
        marker: "FT_CONTRACT_PROOF_WEBTRIGGER_ERROR",
        ts: new Date().toISOString(),
        error: errorMessage.slice(0, 180)
      })
    );

    return {
      ok: false,
      error: {
        code: "WEBTRIGGER_FAILURE",
        message: errorMessage.slice(0, 180)
      }
    };
  }
}
