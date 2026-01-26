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
});
