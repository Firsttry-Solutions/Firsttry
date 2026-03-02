/**
 * Fake In-Memory Storage for Real-World Gates
 * 
 * Implements the same interface shape as Forge storage (@forge/api).
 * Enforces HARD LIMITS to validate that app code respects constraints.
 * 
 * NO EXTERNAL DEPENDENCIES: Pure TypeScript, deterministic, air-gapped.
 * 
 * LIMITS (fail-closed):
 * - Max key length: 200 characters
 * - Max value size: 240 KB (245,760 bytes)
 * - Max keys per tenant: 50,000
 * - Any violation => throw FT_REALWORLD_STORAGE_LIMIT error
 * 
 * INTERFACE (matches Forge storage):
 * - get(key: string): Promise<any>
 * - set(key: string, value: any, options?: { ttl?: number }): Promise<void>
 * - delete(key: string): Promise<void>
 * - query(): Promise<QueryBuilder>
 */

/**
 * Configuration constants
 */
const MAX_KEY_LENGTH = 200;
const MAX_VALUE_SIZE_BYTES = 245760; // 240 KB
const MAX_KEYS_PER_TENANT = 50000;

/**
 * Extract tenant key from storage key (format: tenantKey::logicalKey)
 */
function extractTenantKey(fullKey: string): string {
  const parts = fullKey.split('::');
  if (parts.length < 2) {
    return 'default'; // No tenant prefix, use default
  }
  return parts[0];
}

/**
 * Calculate size of JSON-serialized value in bytes
 */
function getValueSizeBytes(value: any): number {
  const json = JSON.stringify(value);
  return Buffer.from(json, 'utf-8').length;
}

/**
 * Count keys for a given tenant
 */
function countKeysForTenant(store: Map<string, any>, tenantKey: string): number {
  let count = 0;
  for (const key of store.keys()) {
    if (extractTenantKey(key) === tenantKey) {
      count++;
    }
  }
  return count;
}

/**
 * Fake storage implementation
 */
export class FakeStorage {
  private store: Map<string, any> = new Map();
  private stats = {
    gets: 0,
    sets: 0,
    deletes: 0,
    bytesWritten: 0,
    bytesRead: 0
  };

  /**
   * Get a value from storage
   */
  async get(key: string): Promise<any> {
    this.stats.gets++;
    const value = this.store.get(key);
    if (value !== undefined) {
      this.stats.bytesRead += getValueSizeBytes(value);
    }
    return value === undefined ? null : value;
  }

  /**
   * Set a value in storage (with limit enforcement)
   */
  async set(key: string, value: any, options?: { ttl?: number }): Promise<void> {
    // LIMIT: Max key length
    if (key.length > MAX_KEY_LENGTH) {
      throw new Error(
        `FT_REALWORLD_STORAGE_LIMIT: Key length ${key.length} exceeds max ${MAX_KEY_LENGTH} chars. Key: ${key.substring(0, 50)}...`
      );
    }

    // LIMIT: Max value size
    const valueSize = getValueSizeBytes(value);
    if (valueSize > MAX_VALUE_SIZE_BYTES) {
      throw new Error(
        `FT_REALWORLD_STORAGE_LIMIT: Value size ${valueSize} bytes exceeds max ${MAX_VALUE_SIZE_BYTES} bytes (240 KB). Key: ${key}`
      );
    }

    // LIMIT: Max keys per tenant
    const tenantKey = extractTenantKey(key);
    const existingCount = countKeysForTenant(this.store, tenantKey);
    const isNewKey = !this.store.has(key);
    
    if (isNewKey && existingCount >= MAX_KEYS_PER_TENANT) {
      throw new Error(
        `FT_REALWORLD_STORAGE_LIMIT: Tenant ${tenantKey} has ${existingCount} keys, exceeds max ${MAX_KEYS_PER_TENANT}. Key: ${key}`
      );
    }

    // Store value
    this.store.set(key, value);
    this.stats.sets++;
    this.stats.bytesWritten += valueSize;
  }

  /**
   * Delete a value from storage
   */
  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.stats.deletes++;
  }

  /**
   * Query builder (minimal implementation for testing)
   */
  async query(): Promise<QueryBuilder> {
    return new QueryBuilder(this.store);
  }

  /**
   * Get statistics for inspection
   */
  getStats() {
    return {
      ...this.stats,
      totalKeys: this.store.size
    };
  }

  /**
   * Get all keys (for testing isolation)
   */
  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Clear all data (for test cleanup)
   */
  clear(): void {
    this.store.clear();
    this.stats = {
      gets: 0,
      sets: 0,
      deletes: 0,
      bytesWritten: 0,
      bytesRead: 0
    };
  }
}

/**
 * Query builder (minimal implementation)
 */
class QueryBuilder {
  private store: Map<string, any>;
  private prefix?: string;
  private limitVal: number = 100;

  constructor(store: Map<string, any>) {
    this.store = store;
  }

  /**
   * Filter by key prefix
   */
  where(field: string, op: string, value: string): this {
    if (field === 'key' && op === 'startsWith') {
      this.prefix = value;
    }
    return this;
  }

  /**
   * Limit results
   */
  limit(n: number): this {
    this.limitVal = n;
    return this;
  }

  /**
   * Get all matching results
   */
  async getMany(): Promise<{ results: Array<{ key: string; value: any }> }> {
    const results: Array<{ key: string; value: any }> = [];
    
    for (const [key, value] of this.store.entries()) {
      if (this.prefix && !key.startsWith(this.prefix)) {
        continue;
      }
      results.push({ key, value });
      if (results.length >= this.limitVal) {
        break;
      }
    }
    
    return { results };
  }
}

/**
 * Create a fake storage instance
 */
export function createFakeStorage(): FakeStorage {
  return new FakeStorage();
}
