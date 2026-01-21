/**
 * Unit Test: Contract Proof Webtrigger Handler - WITH TOKEN AUTHENTICATION
 * 
 * Tests the webtrigger response shape and token validation.
 * Verifies that:
 * - Missing token returns 401
 * - Wrong token returns 401
 * - Correct token returns 200 + valid envelope
 * 
 * file: atlassian/forge-app/tests/p1_contract_proof_webtrigger.test.ts
 * run: npm test
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { run as contractProofHandler } from "../src/webtriggers/contract-proof";

const TEST_TOKEN = "test-token-12345678901234567890";

describe("Contract Proof Webtrigger - Token Authentication", () => {
  beforeEach(() => {
    // Set test token in environment
    process.env.FT_CONTRACT_PROOF_TOKEN = TEST_TOKEN;
  });

  afterEach(() => {
    // Clean up
    delete process.env.FT_CONTRACT_PROOF_TOKEN;
  });

  // ===== TOKEN VALIDATION TESTS =====

  it("should return 401 when x-ft-proof-token header is missing", async () => {
    const req = {
      headers: {}
    };
    const res = await contractProofHandler(req);

    expect(res).toBeDefined();
    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe("UNAUTHORIZED");
    expect(res.error.message).toContain("x-ft-proof-token");
  });

  it("should return 401 when x-ft-proof-token is incorrect", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": "wrong-token"
      }
    };
    const res = await contractProofHandler(req);

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe("UNAUTHORIZED");
  });

  it("should return valid envelope when x-ft-proof-token is correct", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const envelope = await contractProofHandler(req);

    // Should return envelope, not error
    expect(envelope.ok).toBe(true);
    expect(envelope.envelopeKind).toBe("FT_DASH_ENVELOPE_V1");
  });

  it("should return 401 when FT_CONTRACT_PROOF_TOKEN env var is not set", async () => {
    delete process.env.FT_CONTRACT_PROOF_TOKEN;
    
    const req = {
      headers: {
        "x-ft-proof-token": "any-token"
      }
    };
    const res = await contractProofHandler(req);

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe("UNAUTHORIZED");
  });

  // ===== ENVELOPE CONTRACT TESTS (only with valid token) =====

  it("should return JSON with correct envelope structure", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const envelope = await contractProofHandler(req);

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
    const envelope = await contractProofHandler(req);

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
    const envelope = await contractProofHandler(req);

    // Contract: ok field type
    expect(typeof envelope.ok).toBe("boolean");
  });

  it("should have data when ok=true", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const envelope = await contractProofHandler(req);

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
    const envelope = await contractProofHandler(req);

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
    const envelope = await contractProofHandler(req);
    const { meta } = envelope;

    // Contract: meta fields (not strict - some may be null/undefined but must exist)
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
    const envelope = await contractProofHandler(req);

    const bodyStr = JSON.stringify(envelope).toLowerCase();

    // Proof should not contain tenant identifiers
    // (This is a basic sanity check; actual secrets validation is deeper)
    expect(bodyStr).not.toContain("tenant");
    expect(bodyStr).not.toContain("apikey");
  });

  it("should include proofName in data", async () => {
    const req = {
      headers: {
        "x-ft-proof-token": TEST_TOKEN
      }
    };
    const envelope = await contractProofHandler(req);

    // The data object should identify itself as proof
    expect(envelope.data).toHaveProperty("proofName");
    expect(envelope.data.proofName).toBe("ft_contractProof_dashEnvelope_v1");
  });
});
