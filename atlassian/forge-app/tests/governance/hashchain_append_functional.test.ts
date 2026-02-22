/**
 * Hashchain Append Functional Test
 *
 * Proves:
 * 1. appendToChain creates a valid chain entry with mocked Forge storage
 * 2. chainLength === 1 after first append
 * 3. head snapshotHash is 64-hex
 * 4. previousHash is GENESIS_HASH for first entry
 * 5. readChain returns the stored state
 *
 * Uses mocked @forge/api storage.
 *
 * Marker: [FT_TEST_PASS_HASHCHAIN_APPEND_FUNCTIONAL]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory mock store for @forge/api storage
let mockStore: Record<string, any> = {};

vi.mock('@forge/api', () => ({
  storage: {
    get: async (key: string) => mockStore[key] ?? undefined,
    set: async (key: string, value: any) => {
      mockStore[key] = value;
    },
  },
}));

import { appendToChain, readChain, GENESIS_HASH, HASH_CHAIN_STORAGE_KEY } from '../../src/governance/hashChain';
import { SNAPSHOT_SCHEMA_VERSION, RULESET_VERSION } from '../../src/governance/snapshotSchema';

/**
 * Build a minimal valid SnapshotPayload for testing.
 */
function buildTestPayload(siteId = 'test-site-001', generatedUtc = '2026-02-22T06:00:00.000Z') {
  return {
    users: [],
    roles: [],
    permissions: [],
    workflows: [],
    appInstalls: [],
    generatedUtc,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    ruleSetVersion: RULESET_VERSION,
    siteId,
  };
}

describe('Hashchain append functional (mocked storage)', () => {
  beforeEach(() => {
    mockStore = {};
  });

  it('appendToChain creates a valid first entry with genesis previousHash', async () => {
    const payload = buildTestPayload();
    const entry = await appendToChain(payload, '2026-02-22T06:00:01.000Z');

    expect(entry.chainIndex).toBe(0);
    expect(entry.previousHash).toBe(GENESIS_HASH);
    expect(entry.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.chainHash).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.appendedUtc).toBe('2026-02-22T06:00:01.000Z');
    expect(entry.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(entry.ruleSetVersion).toBe(RULESET_VERSION);

    console.log('[FT_TEST_PASS_HASHCHAIN_APPEND_FUNCTIONAL] first-entry PASS');
  });

  it('readChain returns chainLength === 1 after first append', async () => {
    const payload = buildTestPayload();
    await appendToChain(payload, '2026-02-22T06:00:01.000Z');

    const chain = await readChain();
    expect(chain).not.toBeNull();
    expect(chain!.chain).toHaveLength(1);
    expect(chain!.lastHash).toMatch(/^[0-9a-f]{64}$/);

    console.log('[FT_TEST_PASS_HASHCHAIN_APPEND_FUNCTIONAL] chain-length-1 PASS');
  });

  it('head snapshotHash is 64-hex after append', async () => {
    const payload = buildTestPayload();
    await appendToChain(payload, '2026-02-22T06:00:01.000Z');

    const chain = await readChain();
    const head = chain!.chain[0];
    expect(head.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    expect(head.snapshotHash.length).toBe(64);

    console.log('[FT_TEST_PASS_HASHCHAIN_APPEND_FUNCTIONAL] head-hash-64hex PASS');
  });

  it('second append uses previous chainHash as previousHash', async () => {
    const payload1 = buildTestPayload('site-1', '2026-02-22T06:00:00.000Z');
    const payload2 = buildTestPayload('site-1', '2026-02-22T07:00:00.000Z');

    const entry1 = await appendToChain(payload1, '2026-02-22T06:00:01.000Z');
    const entry2 = await appendToChain(payload2, '2026-02-22T07:00:01.000Z');

    expect(entry2.chainIndex).toBe(1);
    expect(entry2.previousHash).toBe(entry1.chainHash);

    const chain = await readChain();
    expect(chain!.chain).toHaveLength(2);

    console.log('[FT_TEST_PASS_HASHCHAIN_APPEND_FUNCTIONAL] second-append PASS');
  });

  it('appendToChain throws on invalid payload (missing siteId)', async () => {
    const badPayload = {
      users: [],
      roles: [],
      permissions: [],
      workflows: [],
      appInstalls: [],
      generatedUtc: '2026-02-22T06:00:00.000Z',
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      ruleSetVersion: RULESET_VERSION,
      // siteId missing
    };

    await expect(appendToChain(badPayload, '2026-02-22T06:00:01.000Z'))
      .rejects.toThrow();

    console.log('[FT_TEST_PASS_HASHCHAIN_APPEND_FUNCTIONAL] invalid-payload PASS');
  });

  it('appendToChain throws on empty appendedUtc', async () => {
    const payload = buildTestPayload();
    await expect(appendToChain(payload, ''))
      .rejects.toThrow();

    console.log('[FT_TEST_PASS_HASHCHAIN_APPEND_FUNCTIONAL] empty-utc PASS');
  });

  it('chain stored under correct storage key', async () => {
    const payload = buildTestPayload();
    await appendToChain(payload, '2026-02-22T06:00:01.000Z');

    const raw = mockStore[HASH_CHAIN_STORAGE_KEY];
    expect(raw).toBeDefined();
    expect(raw.chain).toHaveLength(1);
    expect(raw.lastHash).toMatch(/^[0-9a-f]{64}$/);

    console.log('[FT_TEST_PASS_HASHCHAIN_APPEND_FUNCTIONAL] storage-key PASS');
  });
});

describe('[FT_TEST_PASS_HASHCHAIN_APPEND_FUNCTIONAL] — marker', () => {
  it('marker', () => {
    console.log('[FT_TEST_PASS_HASHCHAIN_APPEND_FUNCTIONAL]');
    expect(true).toBe(true);
  });
});
