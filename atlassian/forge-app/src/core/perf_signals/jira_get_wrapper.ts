/**
 * JIRA GET REQUEST WRAPPER
 * 
 * Global instrumentation for all Jira GET requests.
 * Records:
 *  - durationMs (latency)
 *  - ok (boolean)
 *  - rate-limit headers (x-ratelimit-*, retry-after only)
 * 
 * Does NOT record:
 *  - URLs, query params, request bodies
 *  - response bodies
 *  - non-rate-limit headers
 * 
 * Throws immediately if method != GET.
 * MUST be used by ALL Jira GET calls in the app.
 */

export interface RequestRecord {
  durationMs: number;
  ok: boolean;
  rateLimitRemaining?: number;
  rateLimitLimit?: number;
  rateLimitResetEpochSeconds?: number;
  retryAfterSeconds?: number;
}

/**
 * Global in-memory buffer for request records (latest 500).
 * FIFO eviction.
 */
const requestRecordBuffer: RequestRecord[] = [];
const MAX_BUFFER_SIZE = 500;

/**
 * Parse rate limit headers (case-insensitive).
 * Returns an object with extracted values or empty object if none found.
 */
function parseRateLimitHeaders(headers: Record<string, any>): Partial<RequestRecord> {
  const result: Partial<RequestRecord> = {};

  if (!headers || typeof headers !== 'object') {
    return result;
  }

  // Normalize header keys to lowercase
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = String(value);
  }

  // x-ratelimit-remaining
  if ('x-ratelimit-remaining' in normalizedHeaders) {
    const val = parseInt(normalizedHeaders['x-ratelimit-remaining'], 10);
    if (!isNaN(val)) {
      result.rateLimitRemaining = val;
    }
  }

  // x-ratelimit-limit
  if ('x-ratelimit-limit' in normalizedHeaders) {
    const val = parseInt(normalizedHeaders['x-ratelimit-limit'], 10);
    if (!isNaN(val)) {
      result.rateLimitLimit = val;
    }
  }

  // x-ratelimit-reset (epoch seconds)
  if ('x-ratelimit-reset' in normalizedHeaders) {
    const val = parseInt(normalizedHeaders['x-ratelimit-reset'], 10);
    if (!isNaN(val)) {
      result.rateLimitResetEpochSeconds = val;
    }
  }

  // retry-after (used ONLY if x-ratelimit-* missing)
  if (!result.rateLimitResetEpochSeconds && 'retry-after' in normalizedHeaders) {
    const val = parseInt(normalizedHeaders['retry-after'], 10);
    if (!isNaN(val)) {
      result.retryAfterSeconds = val;
    }
  }

  return result;
}

/**
 * Record a request in the buffer.
 * FIFO eviction when exceeds MAX_BUFFER_SIZE.
 */
export function recordRequest(record: RequestRecord): void {
  requestRecordBuffer.push(record);
  if (requestRecordBuffer.length > MAX_BUFFER_SIZE) {
    requestRecordBuffer.shift();
  }
}

/**
 * Get all recorded requests (for snapshots).
 * Returns a copy to prevent external mutation.
 */
export function getRecordedRequests(): RequestRecord[] {
  return [...requestRecordBuffer];
}

/**
 * Clear recorded requests (for testing).
 */
export function clearRecordedRequests(): void {
  requestRecordBuffer.length = 0;
}

/**
 * Safe GET-only wrapper for Jira requests.
 * Wraps a requestJira-like function to instrument and enforce GET-only.
 * 
 * Usage:
 *   const wrappedRequestJira = wrapJiraGetForInstrumentation(api.asApp().requestJira);
 *   const response = await wrappedRequestJira(path, options);
 */
export function wrapJiraGetForInstrumentation(
  requestJiraFn: (path: string, options?: any) => Promise<any>
) {
  return async (path: string, options?: any): Promise<any> => {
    // Enforce GET-only
    const method = (options?.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      throw new Error('NON_GET_BLOCKED');
    }

    // Record timing
    const startMs = Date.now();
    let ok = false;
    let response: any = null;

    try {
      response = await requestJiraFn(path, { ...(options || {}), method: 'GET' });
      ok = response.ok !== false;
    } finally {
      const durationMs = Date.now() - startMs;

      // Extract rate limit headers
      const headerData = parseRateLimitHeaders(response?.headers || {});

      const record: RequestRecord = {
        durationMs,
        ok,
        ...headerData,
      };

      recordRequest(record);
    }

    if (!response) {
      throw new Error('JIRA_REQUEST_FAILED');
    }

    return response;
  };
}
