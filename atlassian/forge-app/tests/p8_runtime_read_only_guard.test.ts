import { describe, it, expect } from "vitest";
import { assertReadOnlyRequest } from "../src/runtime_guards";

describe("P8 read-only guard (unit)", () => {
  it("allows GET", () => {
    expect(() => assertReadOnlyRequest("GET")).not.toThrow();
  });

  it("allows HEAD", () => {
    expect(() => assertReadOnlyRequest("HEAD")).not.toThrow();
  });

  it("blocks POST", () => {
    expect(() => assertReadOnlyRequest("POST")).toThrow(/read-only|READ_ONLY_GUARD/i);
  });

  it("blocks DELETE", () => {
    expect(() => assertReadOnlyRequest("DELETE")).toThrow(/read-only|READ_ONLY_GUARD/i);
  });
});
