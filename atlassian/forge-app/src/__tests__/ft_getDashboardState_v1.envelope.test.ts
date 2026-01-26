import { describe, it, expect } from "vitest";
import { FT_DASH_ENVELOPE_MARKER_V1, okEnvelope, hardErrorEnvelope, notAvailableEnvelope } from "../contracts/ft_dash_envelope_v1";

describe("ft_getDashboardState_v1 envelope contract", () => {
  it("must define the envelope marker constant", () => {
    expect(FT_DASH_ENVELOPE_MARKER_V1).toBe("FT_DASH_ENVELOPE_V1");
  });

  it("okEnvelope must include envelopeKind and schemaVersion='v1'", () => {
    const data = { test: "value" };
    const env = okEnvelope(data);
    expect(env.envelopeKind).toBe(FT_DASH_ENVELOPE_MARKER_V1);
    expect(env.schemaVersion).toBe('v1');
    expect(env.ok).toBe(true);
    expect(env.status).toBe("AVAILABLE");
    expect(env.data).toEqual(data);
    expect(env.error).toBeUndefined();
  });

  it("hardErrorEnvelope must include envelopeKind and schemaVersion='v1'", () => {
    const env = hardErrorEnvelope("TEST_ERROR", "Test error message", { detail: "test" });
    expect(env.envelopeKind).toBe(FT_DASH_ENVELOPE_MARKER_V1);
    expect(env.schemaVersion).toBe('v1');
    expect(env.ok).toBe(false);
    expect(env.status).toBe("HARD_ERROR");
    expect(env.data).toBeNull();
    expect(env.error?.code).toBe("TEST_ERROR");
    expect(env.error?.message).toBe("Test error message");
  });

  it("notAvailableEnvelope must include envelopeKind and schemaVersion='v1'", () => {
    const env = notAvailableEnvelope("SNAPSHOT_MISSING", "Snapshot not found");
    expect(env.envelopeKind).toBe(FT_DASH_ENVELOPE_MARKER_V1);
    expect(env.schemaVersion).toBe('v1');
    expect(env.ok).toBe(false);
    expect(env.status).toBe("NOT_AVAILABLE");
    expect(env.data).toBeNull();
    expect(env.error?.code).toBe("SNAPSHOT_MISSING");
  });

  it("JSON serialization must preserve all required fields", () => {
    const env = okEnvelope({ foo: "bar" });
    const json = JSON.stringify(env);
    const parsed = JSON.parse(json);
    expect(parsed.envelopeKind).toBe("FT_DASH_ENVELOPE_V1");
    expect(parsed.schemaVersion).toBe('v1');
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("AVAILABLE");
    expect(parsed.data).toEqual({ foo: "bar" });
  });

  it("status field must never be undefined", () => {
    const env1 = okEnvelope({});
    const env2 = hardErrorEnvelope("E", "M");
    const env3 = notAvailableEnvelope("E", "M");
    expect(env1.status).toBeDefined();
    expect(env1.status).not.toBe(undefined);
    expect(env2.status).toBeDefined();
    expect(env2.status).not.toBe(undefined);
    expect(env3.status).toBeDefined();
    expect(env3.status).not.toBe(undefined);
  });

  it("ok field must be a boolean and never undefined", () => {
    const env1 = okEnvelope({});
    const env2 = hardErrorEnvelope("E", "M");
    const env3 = notAvailableEnvelope("E", "M");
    expect(typeof env1.ok).toBe('boolean');
    expect(env1.ok).toBe(true);
    expect(typeof env2.ok).toBe('boolean');
    expect(env2.ok).toBe(false);
    expect(typeof env3.ok).toBe('boolean');
    expect(env3.ok).toBe(false);
  });

  it("ok=true must have data, ok=false must have error", () => {
    const okEnv = okEnvelope({ snapshot: "data" });
    const errorEnv = hardErrorEnvelope("CODE", "message", { detail: "info" });
    const naEnv = notAvailableEnvelope("CODE", "message");
    
    expect(okEnv.ok).toBe(true);
    expect('data' in okEnv).toBe(true);
    expect(okEnv.data).toBeDefined();
    
    expect(errorEnv.ok).toBe(false);
    expect('error' in errorEnv).toBe(true);
    expect(errorEnv.error).toBeDefined();
    
    expect(naEnv.ok).toBe(false);
    expect('error' in naEnv).toBe(true);
    expect(naEnv.error).toBeDefined();
  });

  it("status must be one of the three allowed values (AVAILABLE|NOT_AVAILABLE|HARD_ERROR)", () => {
    const validStatuses = ["AVAILABLE", "NOT_AVAILABLE", "HARD_ERROR"];
    
    const env1 = okEnvelope({});
    const env2 = notAvailableEnvelope("E", "M");
    const env3 = hardErrorEnvelope("E", "M");
    
    expect(validStatuses).toContain(env1.status);
    expect(validStatuses).toContain(env2.status);
    expect(validStatuses).toContain(env3.status);
  });

  it("status='AVAILABLE' must be paired with ok=true", () => {
    const env = okEnvelope({ test: 1 });
    expect(env.status).toBe("AVAILABLE");
    expect(env.ok).toBe(true);
  });

  it("status='NOT_AVAILABLE' must be paired with ok=false", () => {
    const env = notAvailableEnvelope("TEST", "test message");
    expect(env.status).toBe("NOT_AVAILABLE");
    expect(env.ok).toBe(false);
  });

  it("status='HARD_ERROR' must be paired with ok=false", () => {
    const env = hardErrorEnvelope("TEST", "test message");
    expect(env.status).toBe("HARD_ERROR");
    expect(env.ok).toBe(false);
  });

  it("status field must be a non-empty string (never null, undefined, or empty string)", () => {
    const env1 = okEnvelope({});
    const env2 = hardErrorEnvelope("E", "M");
    const env3 = notAvailableEnvelope("E", "M");
    
    expect(typeof env1.status).toBe('string');
    expect(env1.status.length).toBeGreaterThan(0);
    
    expect(typeof env2.status).toBe('string');
    expect(env2.status.length).toBeGreaterThan(0);
    
    expect(typeof env3.status).toBe('string');
    expect(env3.status.length).toBeGreaterThan(0);
  });

  it("cannot have both data and error keys in same envelope", () => {
    const okEnv = okEnvelope({ data: "value" });
    const errorEnv = hardErrorEnvelope("CODE", "msg");
    
    // Ok envelope should have data but no error
    expect('data' in okEnv).toBe(true);
    expect('error' in okEnv).toBe(false);
    
    // Error envelope should have error but no data
    expect('data' in errorEnv).toBe(false);
    expect('error' in errorEnv).toBe(true);
  });

  it("error field must have code and message when present", () => {
    const env = hardErrorEnvelope("TEST_CODE", "Test message", { x: 1 });
    expect(env.error).toBeDefined();
    expect(env.error?.code).toBe("TEST_CODE");
    expect(env.error?.message).toBe("Test message");
    expect(typeof env.error?.code).toBe('string');
    expect(typeof env.error?.message).toBe('string');
  });

  it("envelope must survive JSON round-trip with all fields intact", () => {
    const envelopes = [
      okEnvelope({ snapshot: "data", id: "123" }),
      hardErrorEnvelope("ERROR", "Error message", { detail: "extra" }),
      notAvailableEnvelope("NA", "Not available yet"),
    ];

    envelopes.forEach((original) => {
      const json = JSON.stringify(original);
      const restored = JSON.parse(json);
      
      expect(restored.envelopeKind).toBe("FT_DASH_ENVELOPE_V1");
      expect(restored.schemaVersion).toBe("v1");
      expect(restored.ok).toBe(original.ok);
      expect(restored.status).toBe(original.status);
      expect(restored.status).not.toBeUndefined();
      expect(restored.status).not.toBeNull();
    });
  });
});
