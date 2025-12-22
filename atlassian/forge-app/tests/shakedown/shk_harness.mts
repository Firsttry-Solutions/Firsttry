/**
 * SHK HARNESS: Enterprise-Grade Shakedown Test Infrastructure
 *
 * Provides deterministic simulation environment for FirstTry:
 * - Frozen time (Date.now() mocked)
 * - Seeded PRNG for all randomness
 * - Simulated Forge storage (tenant-scoped)
 * - Fixture-based Jira API serving
 * - Output normalization and digesting
 * - Deterministic failure injection
 *
 * All shakedown tests must use this harness.
 */

import crypto from 'crypto';

/**
 * Configuration for a shakedown run
 */
export interface ShakdownConfig {
  seed: number;
  startTime: number; // Unix ms
  tenantKey: string;
  cloudId: string;
  runId: string;
}

/**
 * Deterministic PRNG seeded by config
 */
export class DeterministicRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed ^ 0x9e3779b97f4a7c15; // XOR with golden ratio
  }

  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >> 7;
    this.state ^= this.state << 17;
    return (this.state >>> 0) / 0x100000000;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  nextId(prefix: string): string {
    return `${prefix}-${this.nextInt(999999999).toString().padStart(9, '0')}`;
  }
}

/**
 * Global frozen time context
 */
export interface FrozenTime {
  currentTime: number;
  advance(ms: number): void;
  reset(time: number): void;
}

export function createFrozenTime(startTime: number): FrozenTimeInterface {
  return {
    currentTime: startTime,
    now(): number {
      return this.currentTime;
    },
    advance(ms: number) {
      this.currentTime += ms;
    },
    reset(time: number) {
      this.currentTime = time;
    },
  };
}

/**
 * Simulated Forge storage (tenant-scoped, in-memory)
 */
export interface StorageAdapter {
  set(key: string, value: any): Promise<void>;
  get(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  remove(key: string): Promise<void>; // Alias for delete
  list(prefix: string): Promise<{ key: string; value: any }[]>;
  clear(): void;
}

export function createStorageAdapter(): StorageAdapter {
  const storage = new Map<string, any>();

  return {
    async set(key: string, value: any): Promise<void> {
      storage.set(key, JSON.parse(JSON.stringify(value))); // Deep copy
    },
    async get(key: string): Promise<any> {
      const val = storage.get(key);
      return val ? JSON.parse(JSON.stringify(val)) : undefined;
    },
    async delete(key: string): Promise<void> {
      storage.delete(key);
    },
    async remove(key: string): Promise<void> {
      storage.delete(key);
    },
    async list(prefix: string): Promise<{ key: string; value: any }[]> {
      return Array.from(storage.entries())
        .filter(([k]) => k.startsWith(prefix))
        .map(([key, value]) => ({ key, value: JSON.parse(JSON.stringify(value)) }));
    },
    clear() {
      storage.clear();
    },
  };
}

/**
 * Jira API fixture server (deterministic request/response)
 */
export interface JiraFixture {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, any>;
  response: any;
  statusCode?: number;
  error?: string;
}

export interface JiraApiAdapter {
  serve(method: string, path: string, query?: Record<string, any>): Promise<any>;
  addFixture(fixture: JiraFixture): void;
  clearFixtures(): void;
}

export function createJiraApiAdapter(): JiraApiAdapterFull {
  const fixtures: JiraFixture[] = [];
  const fixtureData: Record<string, any> = {};

  return {
    async serve(method: string, path: string, query?: Record<string, any>): Promise<any> {
      const fixture = fixtures.find((f) => f.method === method && f.path === path);
      if (!fixture) {
        throw new Error(`No fixture for ${method} ${path}`);
      }
      if (fixture.error) {
        const err = new Error(fixture.error);
        (err as any).statusCode = fixture.statusCode || 500;
        throw err;
      }
      return fixture.response;
    },
    addFixture(fixture: JiraFixture) {
      fixtures.push(fixture);
    },
    clearFixtures() {
      fixtures.length = 0;
    },
    async getIssue(key: string): Promise<any> {
      return { key, id: key.split('-')[1], status: 'OPEN', assignee: 'user_1' };
    },
    async searchIssues(jql: string): Promise<any[]> {
      return [
        { key: 'PROJ-1', id: '10000', status: 'OPEN', jql: true },
        { key: 'PROJ-2', id: '10001', status: 'IN_PROGRESS', jql: true },
      ];
    },
    async getTransitions(issueId: string): Promise<any[]> {
      return [
        { name: 'Start Progress', id: '11' },
        { name: 'Close', id: '21' },
      ];
    },
    async loadFixture(filename: string): Promise<any[]> {
      // Return appropriate fixture based on filename
      const fixtures: Record<string, any> = {
        'jira_normal_dataset.json': [
          { key: 'PROJ-1', id: '10000', status: 'IN_PROGRESS' },
          { key: 'PROJ-2', id: '10001', status: 'OPEN' },
          { key: 'PROJ-3', id: '10002', status: 'DONE' },
        ],
        'jira_large_dataset.json': [
          { key: 'PROJ-10000', id: '100000', status: 'OPEN' },
        ],
        'jira_missing_fields.json': [
          { key: 'PROJ-200', id: '10200', status: 'OPEN', customFields: { priority: 'High' } },
          { key: 'PROJ-201', id: '10201', status: 'IN_PROGRESS', customFields: { unknownField: 'value' } },
        ],
        'jira_pagination_partial.json': [
          { key: 'PROJ-300', id: '10300', status: 'OPEN' },
        ],
      };
      return fixtures[filename] || [];
    },
    async getMetadata(filename: string): Promise<any> {
      const metadata: Record<string, any> = {
        'jira_normal_dataset.json': { total: 5, returnedCount: 5, isLastPage: true, pageSize: 50 },
        'jira_large_dataset.json': { total: 10000, returnedCount: 1, isLastPage: false, pageSize: 1, nextPageUrl: '?start=1' },
        'jira_pagination_partial.json': { total: 100, returnedCount: 1, isLastPage: false, pageSize: 1, nextPageUrl: '?start=1' },
      };
      return metadata[filename] || { isLastPage: true };
    },
  };
}

/**
 * Output normalization for deterministic hashing
 */
export interface NormalizedOutput {
  timestamp: number;
  runId: string;
  scenarios: Record<string, any>;
  logs: string[];
  errors: { scenario: string; error: string }[];
}

export function normalizeOutput(
  rawOutput: any,
  runId: string,
  time: number,
): NormalizedOutput {
  // Remove nondeterministic UUIDs, timestamps, etc.
  const redactUuids = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(redactUuids);
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v)) {
        result[k] = '[UUID]';
      } else if (typeof v === 'number' && k.includes('time')) {
        result[k] = '[TIME]';
      } else {
        result[k] = redactUuids(v);
      }
    }
    return result;
  };

  return {
    timestamp: time,
    runId,
    scenarios: redactUuids(rawOutput.scenarios || {}),
    logs: rawOutput.logs || [],
    errors: rawOutput.errors || [],
  };
}

/**
 * Compute SHA-256 digest of normalized output
 */
export function computeDigest(output: NormalizedOutput): string {
  const normalized = JSON.stringify(output, null, 0); // Compact JSON
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * FrozenTime interface with now() and advance() methods
 */
export interface FrozenTimeInterface extends FrozenTime {
  now(): number;
}

/**
 * Jira API methods
 */
export interface JiraApiAdapterFull extends JiraApiAdapter {
  getIssue(key: string): Promise<any>;
  searchIssues(jql: string): Promise<any[]>;
  getTransitions(issueId: string): Promise<any[]>;
  loadFixture(filename: string): Promise<any[]>;
  getMetadata(filename: string): Promise<any>;
}

/**
 * Failure injector interface
 */
export interface FailureInjector {
  injectApiError(type: string, options?: Record<string, any>): void;
  injectStorageError(type: string): void;
  shouldInjectError(requestIndex?: number): boolean;
  reset(): void;
}

/**
 * Complete shakedown context
 */
export interface ShakdownContext {
  config: ShakdownConfig;
  rng: DeterministicRNG;
  time: FrozenTimeInterface;
  storage: StorageAdapter;
  jira: JiraApiAdapterFull;
  failures: FailureInjector;
  output: NormalizedOutput;
  addLog(msg: string): void;
  addError(scenario: string, error: string): void;
  addScenarioResult(scenarioId: string, passed: boolean, result: any): void;
  createStorageAdapter(tenantId: string): Promise<StorageAdapter>;
  validatePolicy(policy: any): Promise<boolean>;
}

export function createShakdownContext(config: ShakdownConfig = defaultConfig()): ShakdownContext {
  const rng = new DeterministicRNG(config.seed);
  const time = createFrozenTime(config.startTime);
  const storage = createStorageAdapter();

  let apiErrorActive = false;
  let apiErrorType = '';
  let affectedRequests: number[] = [];
  let requestCounter = 0;
  let storageErrorActive = false;

  const output: NormalizedOutput = {
    timestamp: config.startTime,
    runId: config.runId,
    scenarios: {},
    logs: [],
    errors: [],
  };

  const failures: FailureInjector = {
    injectApiError(type: string, options?: Record<string, any>): void {
      apiErrorActive = true;
      apiErrorType = type;
      affectedRequests = options?.affectRequests || [0]; // Default: first request
      requestCounter = 0; // Reset counter
    },
    injectStorageError(type: string): void {
      storageErrorActive = true;
    },
    shouldInjectError(requestIndex?: number): boolean {
      if (!apiErrorActive) return false;
      if (requestIndex === undefined) return true; // Default: inject error
      return affectedRequests.includes(requestIndex);
    },
    reset(): void {
      apiErrorActive = false;
      apiErrorType = '';
      affectedRequests = [];
      requestCounter = 0;
      storageErrorActive = false;
    },
  };

  // Create jira adapter AFTER failures so it can check error state
  const jira: JiraApiAdapterFull = {
    async serve(method: string, path: string, query?: Record<string, any>): Promise<any> {
      if (apiErrorActive && failures.shouldInjectError(requestCounter)) {
        const err = new Error(`API error: ${apiErrorType}`);
        (err as any).code = apiErrorType;
        (err as any).statusCode = apiErrorType === 'RATE_LIMITED' ? 429 : 500;
        requestCounter++;
        throw err;
      }
      requestCounter++;
      const fixtures: Record<string, any> = {};
      const fixture = Object.entries(fixtures).find(([k]) => k.includes(method + path));
      if (!fixture) {
        throw new Error(`No fixture for ${method} ${path}`);
      }
      return fixture[1];
    },
    addFixture() {
      // No-op for deterministic tests
    },
    clearFixtures() {
      // No-op for deterministic tests
    },
    async getIssue(key: string): Promise<any> {
      if (apiErrorActive && failures.shouldInjectError(requestCounter)) {
        const err = new Error(`API error: ${apiErrorType}`);
        (err as any).code = apiErrorType;
        (err as any).statusCode = apiErrorType === 'RATE_LIMITED' ? 429 : 500;
        requestCounter++;
        throw err;
      }
      requestCounter++;
      return { key, id: key.split('-')[1], status: 'OPEN', assignee: 'user_1' };
    },
    async searchIssues(jql: string): Promise<any[]> {
      if (apiErrorActive && failures.shouldInjectError(requestCounter)) {
        const err = new Error(`API error: ${apiErrorType}`);
        (err as any).code = apiErrorType;
        (err as any).statusCode = apiErrorType === 'RATE_LIMITED' ? 429 : 500;
        requestCounter++;
        throw err;
      }
      requestCounter++;
      return [
        { key: 'PROJ-1', id: '10000', status: 'OPEN', jql: true },
        { key: 'PROJ-2', id: '10001', status: 'IN_PROGRESS', jql: true },
      ];
    },
    async getTransitions(issueId: string): Promise<any[]> {
      if (apiErrorActive && failures.shouldInjectError(requestCounter)) {
        const err = new Error(`API error: ${apiErrorType}`);
        (err as any).code = apiErrorType;
        (err as any).statusCode = apiErrorType === 'RATE_LIMITED' ? 429 : 500;
        requestCounter++;
        throw err;
      }
      requestCounter++;
      return [
        { name: 'Start Progress', id: '11' },
        { name: 'Close', id: '21' },
      ];
    },
    async loadFixture(filename: string): Promise<any[]> {
      if (apiErrorActive && failures.shouldInjectError(requestCounter)) {
        const err = new Error(`API error: ${apiErrorType}`);
        (err as any).code = apiErrorType;
        (err as any).statusCode = apiErrorType === 'RATE_LIMITED' ? 429 : 500;
        requestCounter++;
        throw err;
      }
      requestCounter++;
      const fixtures: Record<string, any> = {
        'jira_normal_dataset.json': [
          { key: 'PROJ-1', id: '10000', status: 'IN_PROGRESS' },
          { key: 'PROJ-2', id: '10001', status: 'OPEN' },
          { key: 'PROJ-3', id: '10002', status: 'DONE' },
        ],
        'jira_large_dataset.json': [
          { key: 'PROJ-10000', id: '100000', status: 'OPEN' },
        ],
        'jira_missing_fields.json': [
          { key: 'PROJ-200', id: '10200', status: 'OPEN', customFields: { priority: 'High' } },
          { key: 'PROJ-201', id: '10201', status: 'IN_PROGRESS', customFields: { unknownField: 'value' } },
        ],
        'jira_pagination_partial.json': [
          { key: 'PROJ-300', id: '10300', status: 'OPEN' },
        ],
      };
      return fixtures[filename] || [];
    },
    async getMetadata(filename: string): Promise<any> {
      if (apiErrorActive && failures.shouldInjectError(requestCounter)) {
        const err = new Error(`API error: ${apiErrorType}`);
        (err as any).code = apiErrorType;
        (err as any).statusCode = apiErrorType === 'RATE_LIMITED' ? 429 : 500;
        requestCounter++;
        throw err;
      }
      requestCounter++;
      const metadata: Record<string, any> = {
        'jira_normal_dataset.json': { total: 5, returnedCount: 5, isLastPage: true, pageSize: 50 },
        'jira_large_dataset.json': { total: 10000, returnedCount: 1, isLastPage: false, pageSize: 1, nextPageUrl: '?start=1' },
        'jira_pagination_partial.json': { total: 100, returnedCount: 1, isLastPage: false, pageSize: 1, nextPageUrl: '?start=1' },
      };
      return metadata[filename] || { isLastPage: true };
    },
  };

  return {
    config,
    rng,
    time: time as FrozenTimeInterface,
    storage,
    jira,
    failures,
    output,
    addLog(msg: string) {
      output.logs.push(msg);
    },
    addError(scenario: string, error: string) {
      output.errors.push({ scenario, error });
    },
    addScenarioResult(scenarioId: string, passed: boolean, result: any) {
      output.scenarios[scenarioId] = { passed, ...result };
    },
    async createStorageAdapter(tenantId: string): Promise<StorageAdapter> {
      // Create tenant-scoped storage
      const tenantStorage = new Map<string, any>();
      return {
        async set(key: string, value: any): Promise<void> {
          tenantStorage.set(`${tenantId}:${key}`, JSON.parse(JSON.stringify(value)));
        },
        async get(key: string): Promise<any> {
          const val = tenantStorage.get(`${tenantId}:${key}`);
          return val ? JSON.parse(JSON.stringify(val)) : undefined;
        },
        async delete(key: string): Promise<void> {
          tenantStorage.delete(`${tenantId}:${key}`);
        },
        async remove(key: string): Promise<void> {
          tenantStorage.delete(`${tenantId}:${key}`);
        },
        async list(prefix: string): Promise<{ key: string; value: any }[]> {
          return Array.from(tenantStorage.entries())
            .filter(([k]) => k.includes(prefix))
            .map(([key, value]) => ({
              key: key.replace(`${tenantId}:`, ''),
              value: JSON.parse(JSON.stringify(value)),
            }));
        },
        clear() {
          tenantStorage.clear();
        },
      };
    },
    async validatePolicy(policy: any): Promise<boolean> {
      // Basic policy validation
      if (!policy.id || !policy.rules) return false;
      if (Array.isArray(policy.rules)) {
        return policy.rules.every((r) => r.condition && r.action);
      }
      return typeof policy.rules === 'string';
    },
  };
}

export function defaultConfig(): ShakdownConfig {
  return {
    seed: 42,
    startTime: new Date('2023-12-22T00:00:00Z').getTime(),
    tenantKey: 'test-tenant',
    cloudId: 'test-cloud',
    runId: 'shk-run-deterministic', // Deterministic, not random
  };
}

/**
 * Standard shakedown run
 */
export interface ShakdownRun {
  digest: string;
  output: NormalizedOutput;
  errors: string[];
}

export async function runShakedown(
  config: ShakdownConfig,
  scenarios: (ctx: ShakdownContext) => Promise<void>,
): Promise<ShakdownRun> {
  const ctx = createShakdownContext(config);
  const errors: string[] = [];

  try {
    await scenarios(ctx);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const normalized = normalizeOutput(ctx.output, config.runId, ctx.time.currentTime);
  const digest = computeDigest(normalized);

  return {
    digest,
    output: normalized,
    errors,
  };
}

/**
 * Deterministic failure injection
 */
export interface FailureSpec {
  scenario: string;
  type: 'rate_limit' | 'server_error' | 'permission_denied' | 'storage_write_fail' | 'schema_drift';
  delay?: number; // ms to advance time
}

export function createFailureInjector(
  time: FrozenTime,
  storage: StorageAdapter,
  jira: JiraApiAdapter,
) {
  return {
    async inject(spec: FailureSpec): Promise<void> {
      if (spec.delay) {
        time.advance(spec.delay);
      }

      switch (spec.type) {
        case 'rate_limit':
          // Jira returns 429
          const err429 = new Error('Too Many Requests');
          (err429 as any).statusCode = 429;
          throw err429;

        case 'server_error':
          const err500 = new Error('Internal Server Error');
          (err500 as any).statusCode = 500;
          throw err500;

        case 'permission_denied':
          const err403 = new Error('Forbidden');
          (err403 as any).statusCode = 403;
          throw err403;

        case 'storage_write_fail':
          // Simulate storage write failure
          throw new Error('Storage write failed');

        case 'schema_drift':
          // Return response with missing expected fields
          return; // Handled by fixture setup
      }
    },
  };
}
