/**
 * Unit Test: Contract Proof Webtrigger Handler - TOKEN AUTHENTICATION + RESPONSE FORMAT
 * 
 * Tests the webtrigger token validation and response format.
 * Forge webtriggers return { statusCode, headers?, body? } format.
 * 
 * file: atlassian/forge-app/tests/p1_contract_proof_webtrigger.test.ts
 * run: npm test
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { run as contractProofHandler } from "../src/webtriggers/contract-proof";

const TEST_TOKEN = "test-token-12345678901234567890";

describe("Contract Proof Webtrigger - Token Authentication + Response Format", () => {
  beforeEach(() => {
    // Set test token in environment
    process.env.FT_CONTRACT_PROOF_TOKEN = TEST_TOKEN;
  });

  afterEach(() => {
    // Clean up
    delete process.env.FT_CONTRACT_PROOF_TOKEN;
  });

  // ===== RESPONSE FORMAT TESTS =====

  it("should return response object with statusCode", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);

    expect(response).toBeDefined();
    expect(typeof response).toBe("object");
    expect(response).toHaveProperty("statusCode");
    expect(typeof response.statusCode).toBe("number");
  });

  it("should return response with body as string", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);

    expect(response).toHaveProperty("body");
    expect(typeof response.body).toBe("string");
  });

  it("should have application/json content-type header", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);

    expect(response.headers).toBeDefined();
    expect(response.headers["content-type"]).toBe("application/json");
  });

  // ===== TOKEN VALIDATION TESTS =====

  it("should return 401 when x-ft-proof-token header is missing", async () => {
    const req = {
      headers: {}
    };
    const response = await contractProofHandler(req);

    expect(response.statusCode).toBe(401);
    const parsed = JSON.parse(response.body);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("unauthorized");
  });

  it("should return 401 when x-ft-proof-token is incorrect", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": "wrong-token"
      }
    };
    const response = await contractProofHandler(req);

    expect(response.statusCode).toBe(401);
    const parsed = JSON.parse(response.body);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("unauthorized");
  });

  it("should return 200 when x-ft-proof-token is correct", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);

    expect(response.statusCode).toBe(200);
    const envelope = JSON.parse(response.body);
    expect(envelope.ok).toBe(true);
    expect(envelope.envelopeKind).toBe("FT_DASH_ENVELOPE_V1");
  });

  it("should return 500 when FT_CONTRACT_PROOF_TOKEN env var is not configured", async () => {
    delete process.env.FT_CONTRACT_PROOF_TOKEN;
    
    const req = {
      headers: {
        "x-ft-proof-token": "any-token"
      }
    };
    const response = await contractProofHandler(req);

    expect(response.statusCode).toBe(500);
    const parsed = JSON.parse(response.body);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("misconfigured");
  });

  // ===== ENVELOPE CONTRACT TESTS (only with valid token) =====

  it("should return JSON with correct envelope structure on 200", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);
    expect(response.statusCode).toBe(200);

    const envelope = JSON.parse(response.body);

    // Contract: Envelope shape
    expect(envelope).toHaveProperty("envelopeKind");
    expect(envelope).toHaveProperty("envelopeVersion");
    expect(envelope).toHaveProperty("ok");
    expect(envelope).toHaveProperty("schemaVersion");
    expect(envelope).toHaveProperty("meta");
    expect(envelope).toHaveProperty("data");
  });

  it("should have correct marker and version", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);
    const envelope = JSON.parse(response.body);

    // Contract: Specific values
    expect(envelope.envelopeKind).toBe("FT_DASH_ENVELOPE_V1");
    expect(envelope.envelopeVersion).toBe(1);
    expect(envelope.schemaVersion).toBe("v1"); // STRING, not numeric
  });

  it("should have ok as boolean", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);
    const envelope = JSON.parse(response.body);

    // Contract: ok field type
    expect(typeof envelope.ok).toBe("boolean");
  });

  it("should have data when ok=true", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);
    const envelope = JSON.parse(response.body);

    // Contract: ok=true => data exists
    if (envelope.ok === true) {
      expect(envelope.data).toBeDefined();
      expect(typeof envelope.data).toBe("object");
    }
  });

  it("should have meta with required fields", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);
    const envelope = JSON.parse(response.body);

    // Contract: meta structure
    expect(envelope.meta).toBeDefined();
    expect(typeof envelope.meta).toBe("object");

    // At minimum, meta should have ts_utc for timestamp
    expect(envelope.meta.ts_utc).toBeDefined();
    expect(typeof envelope.meta.ts_utc).toBe("string");
  });

  it("should have meta fields with correct structure", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);
    const envelope = JSON.parse(response.body);
    const { meta } = envelope;

    // Contract: meta fields
    expect(meta).toHaveProperty("backend_build_sha");
    expect(meta).toHaveProperty("ui_build_sha");
    expect(meta).toHaveProperty("ui_req_id");
    expect(meta).toHaveProperty("probe_nonce");
    expect(meta).toHaveProperty("ts_utc");

    // ts_utc MUST be a valid timestamp string
    const timestamp = meta.ts_utc;
    expect(typeof timestamp).toBe("string");
    // Check it looks like ISO 8601
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should not include sensitive tenant data", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);
    const bodyStr = response.body.toLowerCase();

    // Proof should not contain tenant identifiers
    expect(bodyStr).not.toContain("tenant");
    expect(bodyStr).not.toContain("apikey");
  });

  it("should include proofName in data", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);
    const envelope = JSON.parse(response.body);

    // The data object should identify itself as proof
    expect(envelope.data).toHaveProperty("proofName");
    expect(envelope.data.proofName).toBe("ft_contractProof_dashEnvelope_v1");
  });

  // ===== SERIALIZATION TESTS =====

  it("should have body that is valid JSON", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const response = await contractProofHandler(req);

    // CRITICAL: JSON.parse must not throw
    let parsed: any;
    expect(() => {
      parsed = JSON.parse(response.body);
    }).not.toThrow();

    expect(typeof parsed).toBe("object");
  });

  it("should have correlationId in error responses", async () => {
    const req = {
      headers: {} // Missing token
    };
    const response = await contractProofHandler(req);
    const parsed = JSON.parse(response.body);

    if (response.statusCode !== 200) {
      expect(parsed.correlationId).toBeDefined();
      expect(typeof parsed.correlationId).toBe("string");
      // Format: cp_<timestamp>_<random>
      expect(parsed.correlationId).toMatch(/^cp_/);
    }
  });

  it("should handle case-insensitive header names", async () => {
    // Try with different case variations
    const testCases = [
      { "x-ft-proof-token": TEST_TOKEN },
      { "X-FT-PROOF-TOKEN": TEST_TOKEN },
      { "X-ft-Proof-Token": TEST_TOKEN }
    ];

    for (const headers of testCases) {
      const req = { headers };
      const response = await contractProofHandler(req);
      
      // Should succeed with any case
      expect(response.statusCode).toBe(200);
      const parsed = JSON.parse(response.body);
      expect(parsed.ok).toBe(true);
    }
  });
});
