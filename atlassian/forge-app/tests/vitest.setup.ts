import { vi } from "vitest";

vi.mock("@forge/api", () => ({
  default: {
    asUser: vi.fn(() => ({ storage: { get: vi.fn(), set: vi.fn(), delete: vi.fn() } })),
    asApp: vi.fn(() => ({ storage: { get: vi.fn(), set: vi.fn(), delete: vi.fn() } })),
  },
}));
