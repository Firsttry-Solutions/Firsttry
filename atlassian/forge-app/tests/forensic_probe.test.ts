/**
 * FORENSIC_PROBE Tests: Extraction + Registration
 * 
 * These tests ensure the probe resolver can deterministically extract
 * ui_req_id from multiple payload formats and is properly registered.
 */

import { describe, it, expect } from "vitest";
import { extractUiReqId, hashShort } from "../src/resolvers/probe";
import { ALLOWED_RESOLVERS } from "../src/resolvers/gadget-handlers";

// ============================================================================
// Test 1: extractUiReqId with all precedence levels
// ============================================================================

describe("FORENSIC_PROBE: extractUiReqId precedence", () => {
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
    expect(result).toBe("ui_123456789_abc");
  });

  it("normalizes legacy uiReqId with req_ prefix", () => {
    const result = extractUiReqId({ uiReqId: "req_1768660190864_d8f211a2" });
    expect(result).toBe("ui_1768660190864_d8f211a2");
  });

  it("generates ui_missing_ when all formats missing", () => {
    const result = extractUiReqId({ something: "else" });
    expect(result.startsWith("ui_missing_")).toBe(true);
  });

  it("handles empty/whitespace strings (treated as missing)", () => {
    const result = extractUiReqId({ ui_req_id: "   " });
    expect(result.startsWith("ui_missing_")).toBe(true);
  });

  it("real-world proof: user footer id grepable after normalization", () => {
    // User sees this in footer
    const userFooterId = "ui_1768660190864_d8f211a2";
    
    // Old system sends legacy format
    const legacyPayload = { uiReqId: "req_1768660190864_d8f211a2" };
    const extracted = extractUiReqId(legacyPayload);
    
    // Must match footer exactly
    expect(extracted).toBe(userFooterId);
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
// Test 4: Probe is callable
// ============================================================================

describe("FORENSIC_PROBE: callable", () => {
  it("probe can be invoked and returns ProbeResponse", async () => {
    const { probe: probeResolver } = await import("../src/resolvers/probe");
    
    const result = await probeResolver({
      payload: {
        ui_req_id: "ui_test_callable",
        meta: { 
          ui_req_id: "ui_from_meta",
          local_probe_nonce: "probe_test_ui_local_123"  // UI-generated nonce
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.meta).toBeTruthy();
    expect(result.meta.ui_req_id).toBe("ui_test_callable");
    // Check both UI and backend nonces (from PHASE 2)
    expect(result.meta.ui_local_probe_nonce).toBeTruthy();
    expect(result.meta.ui_local_probe_nonce).toBe("probe_test_ui_local_123");  // Preserve UI nonce
    expect(result.meta.backend_probe_nonce).toBeTruthy();
    expect(result.meta.backend_probe_nonce.startsWith("backend_probe_")).toBe(true);  // Backend generates its own
    expect(result.meta.backend_build_sha).toBeTruthy();
    expect(result.observed).toBeTruthy();
  });

  it("probe returns observed.correlation_fields", async () => {
    const { probe: probeResolver } = await import("../src/resolvers/probe");
    
    const result = await probeResolver({
      payload: {
        ui_req_id: "ui_observed",
        uiReqId: "ui_compat",
        requestId: "req_legacy"
      }
    });

    expect(result.observed.correlation_fields).toBeTruthy();
    expect(result.observed.correlation_fields.ui_req_id).toBe("ui_observed");
    expect(result.observed.correlation_fields.uiReqId).toBe("ui_compat");
    expect(result.observed.correlation_fields.requestId).toBe("req_legacy");
  });

  it("probe returns payload_keys for diagnostics", async () => {
    const { probe: probeResolver } = await import("../src/resolvers/probe");
    
    const result = await probeResolver({
      payload: {
        ui_req_id: "ui_keys",
        customField: "custom_value",
        meta: { nested: true }
      }
    });

    expect(result.observed.payload_keys).toContain("ui_req_id");
    expect(result.observed.payload_keys).toContain("customField");
    expect(result.observed.payload_keys).toContain("meta");
  });
});
