/**
 * RUNTIME VERSION PROOF WEBTRIGGER - TOKEN-GATED
 *
 * This webtrigger provides a read-only HTTP endpoint that returns runtime proof
 * of the deployed release version, build SHA, and @forge/api shape.
 *
 * Security:
 * - Requires token via query param `token=...` OR header `x-ft-token`
 * - Compares to FT_RUNTIME_PROOF_TOKEN environment variable
 * - Returns 401 if token missing or mismatch
 * - NO customer data accessed
 * - Returns ONLY runtime metadata
 *
 * Manifest reference:
 *   function:
 *     - key: ft-runtime-proof-fn
 *       handler: webtriggers/runtime_proof.handler
 *   webtrigger:
 *     - key: ft-runtime-proof
 *       function: ft-runtime-proof-fn
 *
 * Usage (production):
 *   TOKEN="<env FT_RUNTIME_PROOF_TOKEN>"
 *   curl "https://<forge-url>/webtrigger/ft-runtime-proof?token=${TOKEN}"
 *   OR: curl -H "x-ft-token: ${TOKEN}" https://<forge-url>/webtrigger/ft-runtime-proof
 *
 * Expected response (HTTP 200):
 *   {
 *     "ok": true,
 *     "marker": "FT_RUNTIME_PROOF",
 *     "release": "2026.01.24.01",
 *     "buildSha": "30f3d24e",
 *     "env": "production",
 *     "tsUtc": "2026-01-24T17:15:42.123Z",
 *     "forgeApi": {
 *       "type": "object",
 *       "hasAsApp": true,
 *       "keys": ["key1", "key2", ...]
 *     }
 *   }
 *
 * Error response (HTTP 401):
 *   {
 *     "ok": false,
 *     "error": "unauthorized"
 *   }
 */

import api from "@forge/api";
import { FT_RELEASE_VERSION } from "../release/release_version";
import { FT_BUILD_SHA } from "../shared/backend_build_meta";

/**
 * HTTP Response helper
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
 * Get query param value
 */
function getQueryParam(req: any, paramName: string): string | null {
  if (!req || !req.queryParameters) {
    return null;
  }
  const value = req.queryParameters[paramName];
  if (Array.isArray(value)) {
    return value[0] || null;
  }
  return value || null;
}

/**
 * Get safe keys from object (first 20)
 */
function getSafeKeys(obj: any): string[] {
  if (!obj || typeof obj !== "object") {
    return [];
  }
  try {
    const keys = Object.keys(obj);
    return keys.slice(0, 20);
  } catch {
    return [];
  }
}

/**
 * Main handler
 */
export async function handler(req: any): Promise<any> {
  // Token authentication: query param OR header
  const tokenFromQuery = getQueryParam(req, "token");
  const tokenFromHeader = getHeader(req, "x-ft-token");
  const providedToken = tokenFromQuery || tokenFromHeader;

  const expectedToken = process.env.FT_RUNTIME_PROOF_TOKEN;

  // Fail closed: missing token or env var
  if (!providedToken || !expectedToken) {
    return jsonResponse(401, {
      ok: false,
      error: "unauthorized",
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (providedToken !== expectedToken) {
    return jsonResponse(401, {
      ok: false,
      error: "unauthorized",
    });
  }

  // Build @forge/api shape proof
  let apiShape = {
    type: typeof api,
    hasAsApp: false,
    keys: [] as string[],
  };

  try {
    apiShape = {
      type: typeof api,
      hasAsApp: typeof api?.asApp === "function",
      keys: getSafeKeys(api),
    };
  } catch {
    // Safe fallback
    apiShape = {
      type: "unknown",
      hasAsApp: false,
      keys: [],
    };
  }

  // Return runtime proof
  const proof = {
    ok: true,
    marker: "FT_RUNTIME_PROOF",
    release: FT_RELEASE_VERSION,
    buildSha: FT_BUILD_SHA,
    env: process.env.FORGE_ENV || "unknown",
    tsUtc: new Date().toISOString(),
    forgeApi: apiShape,
  };

  return jsonResponse(200, proof);
}
