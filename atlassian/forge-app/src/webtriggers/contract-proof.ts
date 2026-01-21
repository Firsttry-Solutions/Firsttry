/**
 * PRODUCTION CONTRACT PROOF WEBTRIGGER
 * 
 * This webtrigger provides a read-only, non-interactive HTTP endpoint
 * that returns the production envelope contract proof.
 * 
 * - NO query parameters accepted
 * - NO request body processed
 * - Returns ONLY envelope structure (no tenant data)
 * - Logs [FT_CONTRACT_PROOF_WEBTRIGGER] marker
 * - HTTP 200 + application/json
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
 *   curl https://<forge-url>/webtrigger/ft-contract-proof-trigger
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
 */

import { ft_contractProof_dashEnvelope_v1 } from "../gadget-resolver";

/**
 * Webtrigger handler: Returns production envelope contract proof
 * 
 * Forge webtriggers use a simple response format:
 * - Return the JSON object directly (serialized to string)
 * - Forge will automatically serialize and set Content-Type
 * 
 * @param req - HTTP request (webtrigger API)
 * @returns Envelope object (Forge serializes to JSON)
 */
export async function run(req: any) {
  try {
    // No query params, no body parsing - just return the proof
    const envelope = await ft_contractProof_dashEnvelope_v1({});

    // Log invocation marker (non-secret)
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

    // Return error response
    return {
      ok: false,
      error: {
        code: "WEBTRIGGER_FAILURE",
        message: errorMessage.slice(0, 180)
      }
    };
  }
}
