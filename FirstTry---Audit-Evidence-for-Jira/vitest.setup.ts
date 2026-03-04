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

  // Create comprehensive mock storage object
  const createMockStorage = () => ({
    get: createMockStorageFn(),
    set: createMockStorageFn(),
    delete: createMockStorageFn(),
    getRecordCache: vi.fn().mockResolvedValue(undefined),
    setRecordCache: vi.fn().mockResolvedValue(undefined),
    deleteRecordCache: vi.fn().mockResolvedValue(undefined),
  });

  // API object with chainable methods
  const api = {
    asUser: vi.fn(() => ({
      requestJira: createMockRequestJira(),
      fetch: createMockFetch(),
      requestStorage: vi.fn((callback) => callback(createMockStorage())),
      ...createMockStorage(),
    })),
    asApp: vi.fn(() => ({
      requestJira: createMockRequestJira(),
      fetch: createMockFetch(),
      requestStorage: vi.fn((callback) => callback(createMockStorage())),
      ...createMockStorage(),
    })),
    requestJira: createMockRequestJira(),
    fetch: createMockFetch(),
    storage: createMockStorage(),
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
    default: api,
    api,
    scheduled,
    storage,
  };
});

// Helper for resetting all mocks between tests
export function resetAllMocks() {
  vi.clearAllMocks();
}
