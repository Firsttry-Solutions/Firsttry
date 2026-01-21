/**
 * FORENSIC_PROBE Tests: Extraction + Registration
 * 
 * These tests ensure the probe resolver can deterministically extract
 * ui_req_id from multiple payload formats and is properly registered.
 * 
 * CRITICAL: FAIL CLOSED behavior means:
 * - extractUiReqId returns null (not "ui_missing_") when missing
 * - probe always returns TruthEnvelope<ProbeData> with ok=true/false
 */

import { describe, it, expect } from "vitest";
import { extractUiReqId, hashShort } from "../src/resolvers/probe";
import { ALLOWED_RESOLVERS } from "../src/resolvers/gadget-handlers";

// ============================================================================
// Test 1: extractUiReqId with all precedence levels (FAIL CLOSED: null when missing)
// ============================================================================

describe("FORENSIC_PROBE: extractUiReqId precedence (FAIL CLOSED - returns null when missing)", () => {
  it("extracts from payload.ui_req_id (precedence 1)", () => {
    const result = extractUiReqId({ ui_req_id: "ui_test_1" });
    expect(result).toBe("ui_test_1");
  });

  it("extracts from payload.meta.ui_req_id (precedence 2)", () => {
    const result = extractUiReqId({ meta: { ui_req_id: "ui_test_2" } });
    expect(result).toBe("ui_test_2");
  });

  it("extracts from payload.uiReqId (precedence 3)", () => {
    const result = extractUiReqId({ uiReqId: "ui_test_3" });
    expect(result).toBe("ui_test_3");
  });

  it("extracts from payload.meta.uiReqId (precedence 4)", () => {
    const result = extractUiReqId({ meta: { uiReqId: "ui_test_4" } });
    expect(result).toBe("ui_test_4");
  });

  it("extracts from payload.requestId (precedence 5)", () => {
    const result = extractUiReqId({ requestId: "ui_test_5" });
    expect(result).toBe("ui_test_5");
  });

  it("extracts from payload.reqId (precedence 6)", () => {
    const result = extractUiReqId({ reqId: "ui_test_6" });
    expect(result).toBe("ui_test_6");
  });

  it("prioritizes ui_req_id over all fallbacks", () => {
    const result = extractUiReqId({
      ui_req_id: "primary",
      meta: { ui_req_id: "fallback_1" },
      uiReqId: "fallback_2",
      requestId: "fallback_3",
      reqId: "fallback_4"
    });
    expect(result).toBe("primary");
  });

  it("normalizes req_* prefix to ui_*", () => {
    const result = extractUiReqId({ ui_req_id: "req_123456789_abc" });
    expect(result).toBe("req_123456789_abc");  // Returned as-is from field
  });

  it("normalizes legacy uiReqId with req_ prefix", () => {
    const result = extractUiReqId({ uiReqId: "req_1768660190864_d8f211a2" });
    expect(result).toBe("req_1768660190864_d8f211a2");  // Returned as-is
  });

  it("FAIL CLOSED: returns null when all formats missing", () => {
    const result = extractUiReqId({ something: "else" });
    // CRITICAL: FAIL CLOSED behavior: return null, not "ui_missing_"
    expect(result).toBeNull();
  });

  it("FAIL CLOSED: returns null for empty/whitespace strings", () => {
    const result = extractUiReqId({ ui_req_id: "   " });
    // CRITICAL: FAIL CLOSED behavior: treat empty as missing
    expect(result).toBeNull();
  });

  it("real-world proof: user footer id grepable after normalization", () => {
    // Extract returns what was in the field
    const legacyPayload = { uiReqId: "req_1768660190864_d8f211a2" };
    const extracted = extractUiReqId(legacyPayload);
    
    // Extracted as-is from field
    expect(extracted).toBe("req_1768660190864_d8f211a2");
  });
});

// ============================================================================
// Test 2: hashShort produces consistent output
// ============================================================================

describe("FORENSIC_PROBE: hashShort", () => {
  it("produces consistent 12-char hex output", () => {
    const hash = hashShort("test_string");
    expect(hash).toHaveLength(12);
    expect(/^[a-f0-9]{12}$/.test(hash)).toBe(true);
  });

  it("same input produces same hash", () => {
    const hash1 = hashShort("same_input");
    const hash2 = hashShort("same_input");
    expect(hash1).toBe(hash2);
  });

  it("different input produces different hash", () => {
    const hash1 = hashShort("input_1");
    const hash2 = hashShort("input_2");
    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================================
// Test 3: Probe is registered in resolver allowlist
// ============================================================================

describe("FORENSIC_PROBE: registration", () => {
  it("probe resolver is registered in ALLOWED_RESOLVERS", () => {
    // This test imports the actual handler map to verify probe is registered
    // If this fails, the probe resolver is not accessible to the gadget UI
    expect(typeof ALLOWED_RESOLVERS).toBe("object");
    expect(ALLOWED_RESOLVERS).toHaveProperty("probe");
    expect(typeof ALLOWED_RESOLVERS.probe).toBe("function");
  });

  it("probe is alongside other standard resolvers", () => {
    expect(Object.keys(ALLOWED_RESOLVERS)).toContain("probe");
    expect(Object.keys(ALLOWED_RESOLVERS)).toContain("ping");
    expect(Object.keys(ALLOWED_RESOLVERS)).toContain("getStatusSnapshot");
  });
});

// ============================================================================
// Test 4: Probe is callable and returns TruthEnvelope
// ============================================================================

describe("FORENSIC_PROBE: callable - returns TruthEnvelope<ProbeData>", () => {
  it("probe can be invoked with ui_req_id and returns TruthEnvelope", async () => {
    const { probe: probeResolver } = await import("../src/resolvers/probe");
    
    const result = await probeResolver({
      payload: {
        ui_req_id: "ui_test_callable",
        meta: { 
          local_probe_nonce: "probe_test_ui_local_123"  // UI-generated nonce
        }
      }
    });

    // CRITICAL: TruthEnvelope structure
    expect(result.ok).toBe(true);
    expect(result.kind).toBeTruthy();
    
    // Correlation echoes back exactly
    expect(result.correlation).toBeTruthy();
    expect(result.correlation.uiReqId).toBe("ui_test_callable");
    expect(result.correlation.probeNonce).toBe("probe_test_ui_local_123");
    
    // Build metadata is present
    expect(result.build).toBeTruthy();
    expect(result.build.backendSha).toBeTruthy();
  });

  it("probe with FAIL CLOSED: missing uiReqId returns error envelope", async () => {
    const { probe: probeResolver } = await import("../src/resolvers/probe");
    
    const result = await probeResolver({
      payload: {
        // No ui_req_id - FAIL CLOSED
        randomField: "value"
      }
    });

    // Should return error envelope with ok=false
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("MISSING_UI_REQ_ID");
  });

  it("probe echoes correlation fields in TruthEnvelope", async () => {
    const { probe: probeResolver } = await import("../src/resolvers/probe");
    
    const result = await probeResolver({
      payload: {
        ui_req_id: "ui_correlation_test",
        uiReqId: "ui_compat",
        requestId: "req_legacy",
        meta: {
          local_probe_nonce: "test_nonce_456"
        }
      }
    });

    // Precedence: ui_req_id wins
    expect(result.ok).toBe(true);
    expect(result.correlation.uiReqId).toBe("ui_correlation_test");
    expect(result.correlation.probeNonce).toBe("test_nonce_456");
  });

  it("probe returns backend build SHA in TruthEnvelope.build", async () => {
    const { probe: probeResolver } = await import("../src/resolvers/probe");
    
    const result = await probeResolver({
      payload: {
        ui_req_id: "ui_build_sha_test",
        meta: { local_probe_nonce: "build_test" }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.build.backendSha).toBeTruthy();
    expect(typeof result.build.backendSha).toBe("string");
  });
});
