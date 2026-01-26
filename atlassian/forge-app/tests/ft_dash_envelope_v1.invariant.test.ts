import { describe, it, expect } from "vitest";
import {
  enforceDashEnvelopeV1Invariant,
  okEnvelope,
  hardErrorEnvelope,
  notAvailableEnvelope,
  FT_DASH_ENVELOPE_MARKER_V1,
} from "../src/contracts/ft_dash_envelope_v1";

describe("enforceDashEnvelopeV1Invariant - Resolver Boundary Guard", () => {
  it("INVARIANT 1: Missing status => HARD_ERROR with status='HARD_ERROR'", () => {
    const invalid = {
      envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
      schemaVersion: 'v1',
      ok: false,
      // status intentionally omitted
    };
    const result = enforceDashEnvelopeV1Invariant(invalid);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("STATUS_MISSING");
  });

  it("INVARIANT 2: status=undefined => HARD_ERROR with status='HARD_ERROR'", () => {
    const invalid = {
      envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
      schemaVersion: 'v1',
      ok: false,
      status: undefined,
    };
    const result = enforceDashEnvelopeV1Invariant(invalid);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("STATUS_MISSING");
  });

  it("INVARIANT 3: status=null => HARD_ERROR with status='HARD_ERROR'", () => {
    const invalid = {
      envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
      schemaVersion: 'v1',
      ok: false,
      status: null,
    };
    const result = enforceDashEnvelopeV1Invariant(invalid);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("STATUS_MISSING");
  });

  it("INVARIANT 4: Invalid status value => HARD_ERROR with status='HARD_ERROR'", () => {
    const invalid = {
      envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
      schemaVersion: 'v1',
      ok: false,
      status: "INVALID_STATUS",
    };
    const result = enforceDashEnvelopeV1Invariant(invalid);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("STATUS_INVALID_VALUE");
  });

  it("INVARIANT 5: ok=false with data present (mutual exclusivity) => HARD_ERROR", () => {
    const invalid = {
      envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
      schemaVersion: 'v1',
      ok: false,
      status: "HARD_ERROR" as const,
      data: { some: "data" },
      error: { code: "E", message: "M" },
    };
    const result = enforceDashEnvelopeV1Invariant(invalid);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("ERROR_WITH_DATA");
  });

  it("INVARIANT 6: ok=true with error present (mutual exclusivity) => HARD_ERROR", () => {
    const invalid = {
      envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
      schemaVersion: 'v1',
      ok: true,
      status: "AVAILABLE" as const,
      data: { some: "data" },
      error: { code: "E", message: "M" },
    };
    const result = enforceDashEnvelopeV1Invariant(invalid);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("DATA_ERROR_BOTH_PRESENT");
  });

  it("INVARIANT 7: ok=false without error field => HARD_ERROR", () => {
    const invalid = {
      envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
      schemaVersion: 'v1',
      ok: false,
      status: "HARD_ERROR" as const,
      // error missing
    };
    const result = enforceDashEnvelopeV1Invariant(invalid);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("ERROR_NO_ERROR_DETAIL");
  });

  it("INVARIANT 8: ok=true without data field => HARD_ERROR", () => {
    const invalid = {
      envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
      schemaVersion: 'v1',
      ok: true,
      status: "AVAILABLE" as const,
      // data missing
    };
    const result = enforceDashEnvelopeV1Invariant(invalid);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("SUCCESS_NO_DATA");
  });

  it("PASS: Valid okEnvelope passes through", () => {
    const valid = okEnvelope({ snapshot: "data" });
    const result = enforceDashEnvelopeV1Invariant(valid);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("AVAILABLE");
    expect(result.data).toEqual({ snapshot: "data" });
  });

  it("PASS: Valid hardErrorEnvelope passes through", () => {
    const valid = hardErrorEnvelope("CODE", "message");
    const result = enforceDashEnvelopeV1Invariant(valid);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("CODE");
  });

  it("PASS: Valid notAvailableEnvelope passes through", () => {
    const valid = notAvailableEnvelope("CODE", "message");
    const result = enforceDashEnvelopeV1Invariant(valid);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("NOT_AVAILABLE");
    expect(result.error?.code).toBe("CODE");
  });

  it("INVARIANT 9: null candidate => HARD_ERROR with status='HARD_ERROR'", () => {
    const result = enforceDashEnvelopeV1Invariant(null);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("CANDIDATE_INVALID_TYPE");
  });

  it("INVARIANT 10: undefined candidate => HARD_ERROR with status='HARD_ERROR'", () => {
    const result = enforceDashEnvelopeV1Invariant(undefined);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("CANDIDATE_INVALID_TYPE");
  });

  it("INVARIANT 11: non-object candidate => HARD_ERROR with status='HARD_ERROR'", () => {
    const result = enforceDashEnvelopeV1Invariant("string candidate");
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("CANDIDATE_INVALID_TYPE");
  });

  it("INVARIANT 12: ok field not boolean => HARD_ERROR", () => {
    const invalid = {
      envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
      schemaVersion: 'v1',
      ok: "true", // string, not boolean
      status: "AVAILABLE" as const,
      data: {},
    };
    const result = enforceDashEnvelopeV1Invariant(invalid);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("HARD_ERROR");
    expect(result.error?.code).toBe("OK_INVALID_TYPE");
  });

  it("INVARIANT 13: All three valid statuses are accepted when other fields correct", () => {
    const okEnv = okEnvelope({ data: "ok" });
    const naEnv = notAvailableEnvelope("CODE", "msg");
    const errEnv = hardErrorEnvelope("CODE", "msg");

    const result1 = enforceDashEnvelopeV1Invariant(okEnv);
    const result2 = enforceDashEnvelopeV1Invariant(naEnv);
    const result3 = enforceDashEnvelopeV1Invariant(errEnv);

    expect(result1.status).toBe("AVAILABLE");
    expect(result2.status).toBe("NOT_AVAILABLE");
    expect(result3.status).toBe("HARD_ERROR");
  });

  it("INVARIANT 14: Schema version 1 is normalized to 'v1'", () => {
    const envelope = {
      ...okEnvelope({ data: "test" }),
      schemaVersion: 1 as any, // set to number instead of string
    };
    const result = enforceDashEnvelopeV1Invariant(envelope);
    expect(result.schemaVersion).toBe('v1');
    expect(typeof result.schemaVersion).toBe('string');
  });

  it("FINAL GUARANTEE: Returned envelope ALWAYS has defined status", () => {
    const testCandidates = [
      null,
      undefined,
      { /* empty */ },
      { status: undefined },
      { status: null },
      { status: "INVALID" },
      okEnvelope({ data: "ok" }),
      hardErrorEnvelope("E", "M"),
      notAvailableEnvelope("E", "M"),
      { envelopeKind: "WRONG", status: "AVAILABLE" },
    ];

    testCandidates.forEach((candidate, index) => {
      const result = enforceDashEnvelopeV1Invariant(candidate);
      expect(result.status).toBeDefined();
      expect(result.status).not.toBeNull();
      expect(result.status).not.toBeUndefined();
      expect(typeof result.status).toBe('string');
      expect(result.status.length).toBeGreaterThan(0);
      expect(["AVAILABLE", "NOT_AVAILABLE", "HARD_ERROR"]).toContain(result.status);
    });
  });

  // ================================================================================
  // WIRE-LEVEL TESTS: Validate JSON serialization (not just in-memory types)
  // ================================================================================

  it("WIRE-LEVEL: okEnvelope serializes with status, WITHOUT error field in JSON", () => {
    const envelope = okEnvelope({ message: "ok" });
    const wire = JSON.parse(JSON.stringify(envelope));
    
    expect(wire).toHaveProperty("status");
    expect(wire.status).toBe("AVAILABLE");
    expect(wire.ok).toBe(true);
    expect(wire).toHaveProperty("data");
    // CRITICAL: error should NOT be in the wire
    expect(wire).not.toHaveProperty("error");
  });

  it("WIRE-LEVEL: hardErrorEnvelope serializes with status and error, WITHOUT data field in JSON", () => {
    const envelope = hardErrorEnvelope("CODE", "message");
    const wire = JSON.parse(JSON.stringify(envelope));
    
    expect(wire).toHaveProperty("status");
    expect(wire.status).toBe("HARD_ERROR");
    expect(wire.ok).toBe(false);
    expect(wire).toHaveProperty("error");
    expect(wire.error.code).toBe("CODE");
    // CRITICAL: data should NOT be in the wire
    expect(wire).not.toHaveProperty("data");
  });

  it("WIRE-LEVEL: notAvailableEnvelope serializes with status and error, WITHOUT data field in JSON", () => {
    const envelope = notAvailableEnvelope("UNAVAIL", "not available");
    const wire = JSON.parse(JSON.stringify(envelope));
    
    expect(wire).toHaveProperty("status");
    expect(wire.status).toBe("NOT_AVAILABLE");
    expect(wire.ok).toBe(false);
    expect(wire).toHaveProperty("error");
    // CRITICAL: data should NOT be in the wire
    expect(wire).not.toHaveProperty("data");
  });

  it("WIRE-LEVEL: Mutual exclusivity - ok=true means NO error in wire", () => {
    const candidates = [
      okEnvelope({ foo: "bar" }),
    ];

    candidates.forEach((envelope) => {
      const wireJson = JSON.stringify(envelope);
      const wire = JSON.parse(wireJson);
      
      if (wire.ok === true) {
        expect(wire).toHaveProperty("data");
        expect(wire).not.toHaveProperty("error");
      }
    });
  });

  it("WIRE-LEVEL: Mutual exclusivity - ok=false means NO data in wire", () => {
    const candidates = [
      hardErrorEnvelope("E", "M"),
      notAvailableEnvelope("E", "M"),
    ];

    candidates.forEach((envelope) => {
      const wireJson = JSON.stringify(envelope);
      const wire = JSON.parse(wireJson);
      
      if (wire.ok === false) {
        expect(wire).toHaveProperty("error");
        expect(wire).not.toHaveProperty("data");
      }
    });
  });

  it("WIRE-LEVEL: Exact UI observed bad case - ok=false with both data and error", () => {
    // This is what UI saw: { ok: false, data: {}, error: {...}, status: undefined }
    const badCandidate = {
      envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
      schemaVersion: 'v1',
      ok: false,
      data: {}, // VIOLATION: should not have data when ok=false
      error: { code: "ERR", message: "msg" },
      // NOTE: status intentionally missing to simulate UI bug
    };

    const corrected = enforceDashEnvelopeV1Invariant(badCandidate);
    const wire = JSON.parse(JSON.stringify(corrected));

    // After correction:
    expect(wire).toHaveProperty("status");
    expect(wire.status).toBe("HARD_ERROR");
    expect(wire.ok).toBe(false);
    expect(wire).toHaveProperty("error");
    // CRITICAL: data must NOT be in wire (should have been removed)
    expect(wire).not.toHaveProperty("data");
  });
});
