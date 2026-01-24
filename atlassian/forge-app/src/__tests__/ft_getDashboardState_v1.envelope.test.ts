import { describe, it, expect } from "vitest";
import { FT_DASH_ENVELOPE_MARKER_V1, okEnvelope, hardErrorEnvelope, notAvailableEnvelope } from "../contracts/ft_dash_envelope_v1";

describe("ft_getDashboardState_v1 envelope contract", () => {
  it("must define the envelope marker constant", () => {
    expect(FT_DASH_ENVELOPE_MARKER_V1).toBe("FT_DASH_ENVELOPE_v1");
  });

  it("okEnvelope must include marker", () => {
    const data = { test: "value" };
    const env = okEnvelope(data);
    expect(env.marker).toBe(FT_DASH_ENVELOPE_MARKER_V1);
    expect(env.schemaVersion).toBe(1);
    expect(env.status).toBe("AVAILABLE");
    expect(env.data).toEqual(data);
    expect(env.error).toBeUndefined();
  });

  it("hardErrorEnvelope must include marker", () => {
    const env = hardErrorEnvelope("TEST_ERROR", "Test error message", { detail: "test" });
    expect(env.marker).toBe(FT_DASH_ENVELOPE_MARKER_V1);
    expect(env.schemaVersion).toBe(1);
    expect(env.status).toBe("HARD_ERROR");
    expect(env.data).toBeNull();
    expect(env.error?.code).toBe("TEST_ERROR");
    expect(env.error?.message).toBe("Test error message");
  });

  it("notAvailableEnvelope must include marker", () => {
    const env = notAvailableEnvelope("SNAPSHOT_MISSING", "Snapshot not found");
    expect(env.marker).toBe(FT_DASH_ENVELOPE_MARKER_V1);
    expect(env.schemaVersion).toBe(1);
    expect(env.status).toBe("NOT_AVAILABLE");
    expect(env.data).toBeNull();
    expect(env.error?.code).toBe("SNAPSHOT_MISSING");
  });
});
