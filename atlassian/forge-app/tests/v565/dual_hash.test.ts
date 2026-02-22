import { describe, it, expect } from "vitest";
import { sha256Hex } from "../../src/crypto/dualHash";

describe("dualHash", () => {
  it("sha256Hex returns 64 hex chars", () => {
    const h = sha256Hex("x");
    expect(typeof h).toBe("string");
    expect(h.length).toBe(64);
  });

  it("sha256Hex is deterministic", () => {
    const a = sha256Hex("hello world");
    const b = sha256Hex("hello world");
    expect(a).toBe(b);
  });

  it("sha256Hex differs for different inputs", () => {
    const a = sha256Hex("a");
    const b = sha256Hex("b");
    expect(a).not.toBe(b);
  });
});
