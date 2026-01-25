import { describe, it, expect } from "vitest";
import { FT_DASH_ENVELOPE_MARKER_V1, okEnvelope, hardErrorEnvelope, notAvailableEnvelope } from "../contracts/ft_dash_envelope_v1";

describe("ft_getDashboardState_v1 envelope contract", () => {
  it("must define the envelope marker constant", () => {
    expect(FT_DASH_ENVELOPE_MARKER_V1).toBe("FT_DASH_ENVELOPE_V1");
  });

  it("okEnvelope must include envelopeKind", () => {
    const data = { test: "value" };
    const env = okEnvelope(data);
    expect(env.envelopeKind).toBe(FT_DASH_ENVELOPE_MARKER_V1);
    expect(env.schemaVersion).toBe(1);
    expect(env.status).toBe("AVAILABLE");
    expect(env.data).toEqual(data);
    expect(env.error).toBeUndefined();
  });

  it("hardErrorEnvelope must include envelopeKind", () => {
    const env = hardErrorEnvelope("TEST_ERROR", "Test error message", { detail: "test" });
    expect(env.envelopeKind).toBe(FT_DASH_ENVELOPE_MARKER_V1);
    expect(env.schemaVersion).toBe(1);
    expect(env.status).toBe("HARD_ERROR");
    expect(env.data).toBeNull();
    expect(env.error?.code).toBe("TEST_ERROR");
    expect(env.error?.message).toBe("Test error message");
  });

  it("notAvailableEnvelope must include envelopeKind", () => {
    const env = notAvailableEnvelope("SNAPSHOT_MISSING", "Snapshot not found");
    expect(env.envelopeKind).toBe(FT_DASH_ENVELOPE_MARKER_V1);
    expect(env.schemaVersion).toBe(1);
    expect(env.status).toBe("NOT_AVAILABLE");
    expect(env.data).toBeNull();
    expect(env.error?.code).toBe("SNAPSHOT_MISSING");
  });

  it("JSON serialization must preserve all required fields", () => {
    const env = okEnvelope({ foo: "bar" });
    const json = JSON.stringify(env);
    const parsed = JSON.parse(json);
    expect(parsed.envelopeKind).toBe("FT_DASH_ENVELOPE_V1");
    expect(parsed.schemaVersion).toBe(1);
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
});
