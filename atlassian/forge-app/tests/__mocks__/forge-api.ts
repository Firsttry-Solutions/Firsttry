/**
 * Mock @forge/api module for testing
 * 
 * In production, @forge/api is provided by the Forge CLI runtime.
 * For testing, we provide a comprehensive mock that:
 * - Supports both ESM import and CJS require patterns
 * - Uses vi.fn() for all callable functions to support mocking
 * - Implements the Forge API surface used by tests
 */

import { vi } from 'vitest';

// Create mockable functions for all API operations
const createMockRequestJira = () => vi.fn().mockResolvedValue({
  status: 200,
  ok: true,
  json: async () => ({}),
});

const createMockFetch = () => vi.fn().mockResolvedValue({
  status: 200,
  ok: true,
  json: async () => ({}),
});

const createMockStorageFn = () => vi.fn().mockResolvedValue(undefined);

// Create the api object with chainable methods
export const api = {
  asUser: vi.fn(() => ({
    requestJira: createMockRequestJira(),
    fetch: createMockFetch(),
  })),
  asApp: vi.fn(() => ({
    requestJira: createMockRequestJira(),
    fetch: createMockFetch(),
  })),
  requestJira: createMockRequestJira(),
  fetch: createMockFetch(),
  storage: {
    get: createMockStorageFn(),
    set: createMockStorageFn(),
    delete: createMockStorageFn(),
  },
};

// Create the scheduled object for scheduled handlers
export const scheduled = {
  on: vi.fn(),
  run: vi.fn(),
};

// Create the storage object
export const storage = {
  get: createMockStorageFn(),
  set: createMockStorageFn(),
  delete: createMockStorageFn(),
};

// Helper to reset all mocks between tests
export function resetForgeApiMock() {
  vi.clearAllMocks();
  Object.values(api).forEach((fn) => {
    if (typeof fn === 'function' && fn.mockClear) {
      fn.mockClear();
    }
  });
  Object.values(scheduled).forEach((fn) => {
    if (typeof fn === 'function' && fn.mockClear) {
      fn.mockClear();
    }
  });
}

// Default export for ESM import { default } pattern
const defaultExport = { api, scheduled, storage };
export default defaultExport;

// CommonJS export for require() pattern
if (typeof module !== 'undefined' && module.exports) {
  module.exports = defaultExport;
  module.exports.api = api;
  module.exports.scheduled = scheduled;
  module.exports.storage = storage;
  module.exports.resetForgeApiMock = resetForgeApiMock;
}

