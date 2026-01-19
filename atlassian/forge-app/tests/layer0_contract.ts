/**
 * LAYER-0 CONTRACT COMPLIANCE TESTS
 * 
 * These tests MUST pass and MUST NOT be skipped.
 * They verify the core invariants of the ping/probe contract.
 */

import { describe, it, expect } from "vitest";
import {
  SCHEMA_VERSION,
  TruthEnvelope,
  PingData,
  ProbeData,
  normalizeUndefinedToNull,
  assertNoUndefinedFields,
  createErrorEnvelope,
  createSuccessEnvelope,
} from "../src/shared/truth_contract";

describe("Layer-0 Contract Compliance", () => {
  describe("TruthEnvelope structure", () => {
    it("should have schema version 1", () => {
      expect(SCHEMA_VERSION).toBe("1");
    });

    it("should create a valid success envelope for ping", () => {
      const envelope = createSuccessEnvelope<PingData>(
        "ping",
        "ui_req_123",
        null,
        { respondedAt: new Date().toISOString(), env: "production" },
        "backend_sha_abc",
        "ui_sha_xyz",
        "trace_123"
      );

      expect(envelope.ok).toBe(true);
      expect(envelope.kind).toBe("ping");
      expect(envelope.schemaVersion).toBe("1");
      expect(envelope.correlation.uiReqId).toBe("ui_req_123");
      expect(envelope.correlation.probeNonce).toBeNull();
      expect(envelope.data).not.toBeNull();
      expect(envelope.error).toBeNull();
    });

    it("should create a valid error envelope", () => {
      const envelope = createErrorEnvelope(
        "ping",
        "ui_req_123",
        null,
        "MISSING_UI_REQ_ID",
        "UI request ID is required",
        "backend_sha_abc",
        null,
        "trace_456"
      );

      expect(envelope.ok).toBe(false);
      expect(envelope.data).toBeNull();
      expect(envelope.error).not.toBeNull();
      expect(envelope.error!.code).toBe("MISSING_UI_REQ_ID");
      expect(envelope.correlation.uiReqId).toBe("ui_req_123");
    });

    it("should echo probe nonce in probe envelope", () => {
      const envelope = createSuccessEnvelope<ProbeData>(
        "probe",
        "ui_req_456",
        "probe_nonce_xyz",
        { executedAt: new Date().toISOString(), result: null },
        "backend_sha_def",
        "ui_sha_abc",
        "trace_789"
      );

      expect(envelope.correlation.probeNonce).toBe("probe_nonce_xyz");
    });
  });

  describe("normalizeUndefinedToNull", () => {
    it("should convert undefined to null at root level", () => {
      const obj = { a: undefined, b: 42 };
      const result = normalizeUndefinedToNull(obj);

      expect(result.a).toBeNull();
      expect(result.b).toBe(42);
    });

    it("should convert undefined nested in objects", () => {
      const obj = {
        level1: {
          level2: {
            value: undefined,
            other: "test",
          },
        },
      };
      const result = normalizeUndefinedToNull(obj);

      expect(result.level1.level2.value).toBeNull();
      expect(result.level1.level2.other).toBe("test");
    });

    it("should convert undefined in arrays", () => {
      const obj = {
        items: [undefined, "item1", { nested: undefined }],
      };
      const result = normalizeUndefinedToNull(obj);

      expect(result.items[0]).toBeNull();
      expect(result.items[1]).toBe("item1");
      expect(result.items[2].nested).toBeNull();
    });

    it("should handle null values without changing them", () => {
      const obj = { a: null, b: 42 };
      const result = normalizeUndefinedToNull(obj);

      expect(result.a).toBeNull();
      expect(result.b).toBe(42);
    });
  });

  describe("assertNoUndefinedFields", () => {
    it("should pass for object with no undefined fields", () => {
      const obj = {
        a: 42,
        b: "test",
        c: null,
        d: { nested: "value" },
      };

      expect(() => assertNoUndefinedFields(obj)).not.toThrow();
    });

    it("should throw for undefined at root level", () => {
      const obj = { a: undefined };

      expect(() => assertNoUndefinedFields(obj)).toThrow(
        /Undefined field at path: root\.a/
      );
    });

    it("should throw for undefined nested in objects", () => {
      const obj = { level1: { level2: { bad: undefined } } };

      expect(() => assertNoUndefinedFields(obj)).toThrow(
        /Undefined field at path: root\.level1\.level2\.bad/
      );
    });

    it("should throw for undefined in arrays", () => {
      const obj = { items: [undefined, "ok"] };

      expect(() => assertNoUndefinedFields(obj)).toThrow(
        /Undefined value at path: root\.items\[0\]/
      );
    });

    it("should pass for arrays with null", () => {
      const obj = { items: [null, "ok", { nested: null }] };

      expect(() => assertNoUndefinedFields(obj)).not.toThrow();
    });
  });

  describe("Contract invariants", () => {
    it("success envelope must have ok=true, error=null, data!=null", () => {
      const envelope = createSuccessEnvelope<PingData>(
        "ping",
        "ui_req_1",
        null,
        { respondedAt: new Date().toISOString() },
        "backend_sha",
        null,
        null
      );

      expect(envelope.ok).toBe(true);
      expect(envelope.error).toBeNull();
      expect(envelope.data).not.toBeNull();
    });

    it("error envelope must have ok=false, error!=null, data=null", () => {
      const envelope = createErrorEnvelope(
        "ping",
        "ui_req_1",
        null,
        "TEST_ERROR",
        "Test error message",
        "backend_sha",
        null,
        null
      );

      expect(envelope.ok).toBe(false);
      expect(envelope.error).not.toBeNull();
      expect(envelope.data).toBeNull();
    });

    it("envelope must not contain any undefined fields after normalization", () => {
      const envelope = createSuccessEnvelope<PingData>(
        "ping",
        "ui_req_1",
        undefined,
        { respondedAt: new Date().toISOString() },
        "backend_sha",
        undefined,
        undefined
      );

      const normalized = normalizeUndefinedToNull(envelope);

      expect(() => assertNoUndefinedFields(normalized)).not.toThrow();
    });

    it("uiReqId must be echoed back exactly as received", () => {
      const originalReqId = "ui_req_abc123_xyz";

      const envelope = createSuccessEnvelope<PingData>(
        "ping",
        originalReqId,
        null,
        { respondedAt: new Date().toISOString() },
        "backend_sha",
        null,
        null
      );

      expect(envelope.correlation.uiReqId).toBe(originalReqId);
    });

    it("probeNonce must be echoed back (or null if not provided)", () => {
      const nonce = "probe_nonce_test";

      const envelope = createSuccessEnvelope<ProbeData>(
        "probe",
        "ui_req_1",
        nonce,
        { executedAt: new Date().toISOString(), result: null },
        "backend_sha",
        null,
        null
      );

      expect(envelope.correlation.probeNonce).toBe(nonce);

      const envelopeNoNonce = createSuccessEnvelope<ProbeData>(
        "probe",
        "ui_req_1",
        null,
        { executedAt: new Date().toISOString(), result: null },
        "backend_sha",
        null,
        null
      );

      expect(envelopeNoNonce.correlation.probeNonce).toBeNull();
    });
  });
});
