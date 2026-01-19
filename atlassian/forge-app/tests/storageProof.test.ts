import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkStorageProof } from '../src/security/storageProof';

// Mock @forge/api
vi.mock('@forge/api', () => ({
  storage: {
    get: vi.fn(),
  },
}));

import { storage } from '@forge/api';

describe('checkStorageProof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return EMPTY when all keys missing', async () => {
    vi.mocked(storage.get).mockResolvedValue(null);

    const proof = await checkStorageProof({
      keysToCheck: ['key1', 'key2'],
    });

    expect(proof.state).toBe('EMPTY');
    expect(proof.proof).toBe('MISSING_ALL');
    expect(proof.keysChecked).toEqual(['key1', 'key2']);
    expect(proof.errors).toEqual([]);
  });

  it('should return EXISTS when any key found', async () => {
    vi.mocked(storage.get).mockImplementation((key: string) => {
      if (key === 'key2') {
        return Promise.resolve({ data: 'found' });
      }
      return Promise.resolve(null);
    });

    const proof = await checkStorageProof({
      keysToCheck: ['key1', 'key2', 'key3'],
    });

    expect(proof.state).toBe('EXISTS');
    expect(proof.proof).toContain('FOUND');
    expect(proof.proof).toContain('key2');
    expect(proof.errors).toEqual([]);
  });

  it('should return UNKNOWN when errors occur and no keys found', async () => {
    vi.mocked(storage.get).mockRejectedValue(new Error('Storage error'));

    const proof = await checkStorageProof({
      keysToCheck: ['key1'],
    });

    expect(proof.state).toBe('UNKNOWN');
    expect(proof.errors.length).toBeGreaterThan(0);
  });

  it('should return UNKNOWN when no keys provided', async () => {
    const proof = await checkStorageProof({
      keysToCheck: [],
    });

    expect(proof.state).toBe('UNKNOWN');
    expect(proof.keysChecked).toEqual([]);
  });

  it('should always set checkedAtIso', async () => {
    vi.mocked(storage.get).mockResolvedValue(null);

    const before = new Date().toISOString();
    const proof = await checkStorageProof({
      keysToCheck: ['key1'],
    });
    const after = new Date().toISOString();

    expect(proof.checkedAtIso).toBeTruthy();
    expect(proof.checkedAtIso >= before).toBe(true);
    expect(proof.checkedAtIso <= after).toBe(true);
  });

  it('should include key names in proof string when found', async () => {
    vi.mocked(storage.get).mockImplementation((key: string) => {
      if (key === 'snapshots/latest') {
        return Promise.resolve({ snapshot: 'data' });
      }
      return Promise.resolve(null);
    });

    const proof = await checkStorageProof({
      keysToCheck: ['snapshots/latest', 'snapshots/backup'],
    });

    expect(proof.proof).toContain('snapshots/latest');
  });
});
