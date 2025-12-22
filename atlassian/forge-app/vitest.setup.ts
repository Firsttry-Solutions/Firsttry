/**
 * Vitest global setup file
 * 
 * Registers mocks for modules that are not available in the test environment
 * but are required by source code (like @forge/api which comes from Forge CLI).
 */

import { vi } from 'vitest';

// Mock @forge/api globally for all tests (supports both import and require)
vi.mock('@forge/api', () => {
  // Create mockable functions
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

  // API object with chainable methods
  const api = {
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

  // Scheduled object for scheduled handlers
  const scheduled = {
    on: vi.fn(),
    run: vi.fn(),
  };

  // Storage object
  const storage = {
    get: createMockStorageFn(),
    set: createMockStorageFn(),
    delete: createMockStorageFn(),
  };

  return {
    default: { api, scheduled, storage },
    api,
    scheduled,
    storage,
  };
});

// Helper for resetting all mocks between tests
export function resetAllMocks() {
  vi.clearAllMocks();
}
