/**
 * Unit Test: Contract Proof Webtrigger Handler
 * 
 * Tests the webtrigger response shape matches DashEnvelopeV1 contract
 * without needing a Forge runtime or actual HTTP invocation.
 * 
 * file: atlassian/forge-app/tests/p1_contract_proof_webtrigger.test.ts
 * run: npm test
 */

import { describe, it, expect } from "vitest";
import { run as contractProofHandler } from "../src/webtriggers/contract-proof";

describe("Contract Proof Webtrigger", () => {
  it("should return valid envelope structure", async () => {
    const req = {};
    const res = await contractProofHandler(req);

    // Webtrigger returns envelope directly (Forge serializes)
    expect(res).toBeDefined();
    expect(res.envelopeKind).toBeDefined();
    expect(res.ok).toBeDefined();
  });

  it("should return JSON with correct envelope structure", async () => {
    const req = {};
    const envelope = await contractProofHandler(req);

    // Direct envelope object (not wrapped)
    expect(envelope).toHaveProperty("envelopeKind");
    expect(envelope).toHaveProperty("envelopeVersion");
    expect(envelope).toHaveProperty("ok");
    expect(envelope).toHaveProperty("schemaVersion");
    expect(envelope).toHaveProperty("meta");
    expect(envelope).toHaveProperty("data");
  });

  it("should have correct marker and version", async () => {
    const req = {};
    const envelope = await contractProofHandler(req);

    // Contract: Specific values
    expect(envelope.envelopeKind).toBe("FT_DASH_ENVELOPE_V1");
    expect(envelope.envelopeVersion).toBe(1);
    expect(envelope.schemaVersion).toBe("v1"); // STRING, not numeric
  });

  it("should have ok as boolean", async () => {
    const req = {};
    const envelope = await contractProofHandler(req);

    // Contract: ok field type
    expect(typeof envelope.ok).toBe("boolean");
  });

  it("should have data when ok=true", async () => {
    const req = {};
    const envelope = await contractProofHandler(req);

    // Contract: ok=true => data exists
    if (envelope.ok === true) {
      expect(envelope.data).toBeDefined();
      expect(typeof envelope.data).toBe("object");
    }
  });

  it("should have meta with required fields", async () => {
    const req = {};
    const envelope = await contractProofHandler(req);

    // Contract: meta structure
    expect(envelope.meta).toBeDefined();
    expect(typeof envelope.meta).toBe("object");

    // At minimum, meta should have ts_utc for timestamp
    expect(envelope.meta.ts_utc).toBeDefined();
    expect(typeof envelope.meta.ts_utc).toBe("string");
  });

  it("should have meta fields with correct structure", async () => {
    const req = {};
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
    const req = {};
    const envelope = await contractProofHandler(req);

    const bodyStr = JSON.stringify(envelope).toLowerCase();

    // Proof should not contain tenant identifiers
    // (This is a basic sanity check; actual secrets validation is deeper)
    expect(bodyStr).not.toContain("tenant");
    expect(bodyStr).not.toContain("apikey");
  });

  it("should include proofName in data", async () => {
    const req = {};
    const envelope = await contractProofHandler(req);

    // The data object should identify itself as proof
    expect(envelope.data).toHaveProperty("proofName");
    expect(envelope.data.proofName).toBe("ft_contractProof_dashEnvelope_v1");
  });
});
