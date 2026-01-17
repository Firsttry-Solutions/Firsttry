/**
 * BACKBONE LAYER 0: HANDLER-LEVEL CORRELATION + TRACE ENFORCEMENT TESTS
 * 
 * CRITICAL CONTRACT:
 * 1. All errors MUST include error.trace_id_stable (never empty)
 * 2. All responses MUST include meta with ui_req_id, backend_build_sha, now_iso
 * 3. All resolver invocations MUST log RESOLVER_ENTER, RESOLVER_OK or RESOLVER_ERR
 * 4. ui_req_id MUST be extractable from multiple payload formats
 * 
 * If any test fails, the correlation contract is broken and gadget logs won't be grepable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handler,
  extractUiReqId,
  metaBase,
  ensureTraceOnError
} from "../src/resolvers/gadget-handlers";

// ============================================================================
// PART 1: ui_req_id EXTRACTION TESTS
// ============================================================================

describe("Layer 0: ui_req_id extraction", () => {
  it("extracts ui_req_id from payload.ui_req_id", () => {
    const payload = { ui_req_id: "ui_test_123" };
    expect(extractUiReqId(payload)).toBe("ui_test_123");
  });

  it("extracts ui_req_id from payload.meta.ui_req_id (fallback 1)", () => {
    const payload = { meta: { ui_req_id: "ui_from_meta" } };
    expect(extractUiReqId(payload)).toBe("ui_from_meta");
  });

  it("extracts ui_req_id from payload.uiReqId (fallback 2, legacy)", () => {
    const payload = { uiReqId: "req_legacy_456" };
    expect(extractUiReqId(payload)).toBe("req_legacy_456");
  });

  it("extracts ui_req_id from payload.requestId (fallback 3, legacy)", () => {
    const payload = { requestId: "request_789" };
    expect(extractUiReqId(payload)).toBe("request_789");
  });

  it("returns null if no ui_req_id found", () => {
    const payload = { something: "else" };
    expect(extractUiReqId(payload)).toBeNull();
  });

  it("prioritizes payload.ui_req_id over other formats", () => {
    const payload = {
      ui_req_id: "primary",
      meta: { ui_req_id: "fallback1" },
      uiReqId: "fallback2",
      requestId: "fallback3"
    };
    expect(extractUiReqId(payload)).toBe("primary");
  });
});

// ============================================================================
// PART 2: META BASE STRUCTURE TESTS
// ============================================================================

describe("Layer 0: metaBase structure", () => {
  it("creates meta with ui_req_id, backend_build_sha, now_iso", () => {
    const meta = metaBase("ui_test_meta");
    
    expect(meta.ui_req_id).toBe("ui_test_meta");
    expect(typeof meta.backend_build_sha).toBe("string");
    expect(typeof meta.now_iso).toBe("string");
  });

  it("accepts null ui_req_id", () => {
    const meta = metaBase(null);
    
    expect(meta.ui_req_id).toBeNull();
    expect(typeof meta.backend_build_sha).toBe("string");
    expect(typeof meta.now_iso).toBe("string");
  });

  it("now_iso is valid ISO timestamp", () => {
    const meta = metaBase("ui_test");
    const parsed = new Date(meta.now_iso);
    expect(parsed.getTime()).toBeLessThanOrEqual(Date.now());
    expect(parsed.getTime()).toBeGreaterThan(Date.now() - 1000); // within 1 second
  });
});

// ============================================================================
// PART 3: ERROR TRACE ENFORCEMENT TESTS
// ============================================================================

describe("Layer 0: ensureTraceOnError - error responses", () => {
  it("generates trace_id_stable if missing from ok:false response", () => {
    const res = {
      ok: false,
      error: { code: "TEST_ERROR", message: "Test" }
    };
    
    const normalized = ensureTraceOnError(res, "test-resolver", "ui_test_1");
    
    expect(normalized.ok).toBe(false);
    expect(normalized.error.trace_id_stable).toBeTruthy();
    expect(normalized.error.trace_id_stable.length).toBeGreaterThan(0);
  });

  it("preserves existing trace_id_stable", () => {
    const existingTrace = "my_stable_trace_id";
    const res = {
      ok: false,
      error: { code: "TEST_ERROR", message: "Test", trace_id_stable: existingTrace }
    };
    
    const normalized = ensureTraceOnError(res, "test-resolver", "ui_test_2");
    
    expect(normalized.error.trace_id_stable).toBe(existingTrace);
  });

  it("sets default error.code if missing", () => {
    const res = {
      ok: false,
      error: { message: "Test" }
    };
    
    const normalized = ensureTraceOnError(res, "test-resolver", "ui_test_3");
    
    expect(normalized.error.code).toBe("RESOLVER_UNHANDLED_EXCEPTION");
  });

  it("sets default error.message if missing", () => {
    const res = {
      ok: false,
      error: { code: "TEST" }
    };
    
    const normalized = ensureTraceOnError(res, "test-resolver", "ui_test_4");
    
    expect(normalized.error.message).toBe("Resolver failed");
  });

  it("replaces empty string trace_id_stable", () => {
    const res = {
      ok: false,
      error: { code: "TEST", message: "Test", trace_id_stable: "   " }
    };
    
    const normalized = ensureTraceOnError(res, "test-resolver", "ui_test_5");
    
    expect(normalized.error.trace_id_stable.trim()).not.toBe("");
    expect(normalized.error.trace_id_stable).toContain("trace_test-resolver");
  });

  it("includes ui_req_id in generated trace_id_stable", () => {
    const res = {
      ok: false,
      error: { code: "TEST", message: "Test" }
    };
    
    const normalized = ensureTraceOnError(res, "test-resolver", "ui_test_123");
    
    expect(normalized.error.trace_id_stable).toContain("ui_test_123");
  });

  it("handles null ui_req_id in trace generation", () => {
    const res = {
      ok: false,
      error: { code: "TEST", message: "Test" }
    };
    
    const normalized = ensureTraceOnError(res, "test-resolver", null);
    
    expect(normalized.error.trace_id_stable).toBeTruthy();
    expect(normalized.error.trace_id_stable).toContain("no_ui_req_id");
  });

  it("ensures meta exists on error response", () => {
    const res = {
      ok: false,
      error: { code: "TEST", message: "Test" }
    };
    
    const normalized = ensureTraceOnError(res, "test-resolver", "ui_test_6");
    
    expect(normalized.meta).toBeTruthy();
    expect(normalized.meta.ui_req_id).toBe("ui_test_6");
    expect(typeof normalized.meta.backend_build_sha).toBe("string");
    expect(typeof normalized.meta.now_iso).toBe("string");
  });

  it("merges existing meta with base meta", () => {
    const res = {
      ok: false,
      error: { code: "TEST", message: "Test" },
      meta: { custom_field: "custom_value" }
    };
    
    const normalized = ensureTraceOnError(res, "test-resolver", "ui_test_7");
    
    expect(normalized.meta.ui_req_id).toBe("ui_test_7");
    expect(normalized.meta.custom_field).toBe("custom_value");
  });
});

describe("Layer 0: ensureTraceOnError - success responses", () => {
  it("ensures meta exists on ok:true response", () => {
    const res = {
      ok: true,
      data: { something: "value" }
    };
    
    const normalized = ensureTraceOnError(res, "test-resolver", "ui_test_8");
    
    expect(normalized.ok).toBe(true);
    expect(normalized.meta).toBeTruthy();
    expect(normalized.meta.ui_req_id).toBe("ui_test_8");
  });

  it("returns valid meta for null response", () => {
    const normalized = ensureTraceOnError(null, "test-resolver", "ui_test_9");
    
    expect(normalized.ok).toBe(true);
    expect(normalized.meta.ui_req_id).toBe("ui_test_9");
  });
});

// ============================================================================
// PART 4: HANDLER INTEGRATION TESTS
// ============================================================================

describe("Layer 0: handler - correlation enforcement", () => {
  let consoleLogs: string[] = [];
  
  beforeEach(() => {
    consoleLogs = [];
    vi.spyOn(console, "log").mockImplementation((msg: any) => {
      if (typeof msg === "string" && msg.includes("marker")) {
        consoleLogs.push(msg);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs RESOLVER_ENTER with ui_req_id", async () => {
    await handler({
      payload: {
        resolverName: "ping",
        ui_req_id: "ui_test_enter_1"
      }
    });

    const enterLog = consoleLogs.find(log => log.includes("RESOLVER_ENTER"));
    expect(enterLog).toBeTruthy();
    expect(enterLog).toContain("ui_test_enter_1");
    expect(enterLog).toContain("ping");
  });

  it("logs RESOLVER_OK when resolver succeeds", async () => {
    await handler({
      payload: {
        resolverName: "ping",
        ui_req_id: "ui_test_ok_1"
      }
    });

    const okLog = consoleLogs.find(log => log.includes("RESOLVER_OK"));
    expect(okLog).toBeTruthy();
    expect(okLog).toContain("ui_test_ok_1");
  });

  it("logs RESOLVER_ERR with trace_id_stable when resolver fails", async () => {
    // Call with invalid resolver to trigger error path
    const result = await handler({
      payload: {
        resolverName: "invalid_resolver",
        ui_req_id: "ui_test_err_1"
      }
    });

    const errLog = consoleLogs.find(log => log.includes("RESOLVER_ERR"));
    expect(errLog).toBeTruthy();
    expect(errLog).toContain("ui_test_err_1");
    expect(errLog).toContain("trace_id_stable");
    
    // Verify response has trace
    expect(result.ok).toBe(false);
    expect(result.error.trace_id_stable).toBeTruthy();
  });

  it("normalizes all responses to include meta", async () => {
    const result = await handler({
      payload: {
        resolverName: "ping",
        ui_req_id: "ui_test_meta_1"
      }
    });

    expect(result.meta).toBeTruthy();
    expect(result.meta.ui_req_id).toBe("ui_test_meta_1");
    expect(typeof result.meta.backend_build_sha).toBe("string");
    expect(typeof result.meta.now_iso).toBe("string");
  });

  it("extracts ui_req_id from multiple payload formats", async () => {
    // Format 1: payload.ui_req_id
    const result1 = await handler({
      payload: {
        resolverName: "ping",
        ui_req_id: "ui_format_1"
      }
    });
    expect(result1.meta.ui_req_id).toBe("ui_format_1");

    // Format 2: payload.uiReqId (legacy)
    const result2 = await handler({
      payload: {
        resolverName: "ping",
        uiReqId: "ui_format_2"
      }
    });
    expect(result2.meta.ui_req_id).toBe("ui_format_2");
  });
});

// ============================================================================
// PART 5: PING RESOLVER COMPLIANCE TESTS
// ============================================================================

describe("Layer 0: ping resolver compliance", () => {
  it("ping returns ok:true with meta.ui_req_id", async () => {
    const result = await handler({
      payload: {
        resolverName: "ping",
        ui_req_id: "ui_ping_ok"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.meta).toBeTruthy();
    expect(result.meta.ui_req_id).toBe("ui_ping_ok");
    expect(result.meta.backend_build_sha).toBeTruthy();
    expect(result.meta.now_iso).toBeTruthy();
  });

  it("handler normalizes ping responses with meta", async () => {
    const result = await handler({
      payload: {
        resolverName: "ping",
        ui_req_id: "ui_ping_normalize"
      }
    });

    expect(result.meta).toBeTruthy();
    expect(result.meta.ui_req_id).toBe("ui_ping_normalize");
  });
});

// ============================================================================
// PART 6: DETERMINISTIC GREPPING TESTS
// ============================================================================

describe("Layer 0: logs are grepable with ui_req_id", () => {
  let consoleLogs: string[] = [];
  
  beforeEach(() => {
    consoleLogs = [];
    vi.spyOn(console, "log").mockImplementation((msg: any) => {
      consoleLogs.push(String(msg));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ping invocation logs are grepable by ui_req_id", async () => {
    const ui_req_id = "ui_grep_test_123";
    
    await handler({
      payload: {
        resolverName: "ping",
        ui_req_id
      }
    });

    // All logs should contain either RESOLVER_ENTER, RESOLVER_OK, or PING markers
    const relevantLogs = consoleLogs.filter(log => 
      log.includes(ui_req_id) && 
      (log.includes("RESOLVER") || log.includes("PING"))
    );

    expect(relevantLogs.length).toBeGreaterThan(0);
    
    // Should have at least RESOLVER_ENTER and RESOLVER_OK
    const hasEnter = relevantLogs.some(log => log.includes("RESOLVER_ENTER"));
    const hasOk = relevantLogs.some(log => log.includes("RESOLVER_OK"));
    
    expect(hasEnter).toBe(true);
    expect(hasOk).toBe(true);
  });

  it("error invocation logs include trace_id_stable and ui_req_id", async () => {
    const ui_req_id = "ui_error_grep_456";
    
    const result = await handler({
      payload: {
        resolverName: "invalid_resolver",
        ui_req_id
      }
    });

    // Response must have trace_id_stable
    expect(result.error.trace_id_stable).toBeTruthy();

    // Logs should be grepable by ui_req_id
    const uiLogs = consoleLogs.filter(log => log.includes(ui_req_id));
    expect(uiLogs.length).toBeGreaterThan(0);

    // At least one log should mention the trace
    const hasTrace = uiLogs.some(log => log.includes("trace_id_stable"));
    expect(hasTrace).toBe(true);
  });
});
