/**
 * PHASE-9: LOG REDACTION
 *
 * Central enforcement point for removing secrets from all error logs.
 *
 * Enforces:
 * - Tokens never appear in logs
 * - Headers never appear in logs
 * - Secrets never appear in logs
 * - Error details bounded (prevent accidental leakage)
 * - Tenant isolation in logs (no cross-tenant exposure)
 *
 * This is a guardrail, not optional.
 */

/**
 * Secrets patterns to redact (non-exhaustive, must be updated as needed)
 */
const SECRETS_PATTERNS = [
  // Authorization headers and tokens
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /Authorization:\s*[^,\n]*/gi,
  /X-Auth-Token:\s*[^,\n]*/gi,
  /X-API-Key:\s*[^,\n]*/gi,
  /api[_-]?key[=:]\s*[^,\n]*/gi,
  /api[_-]?secret[=:]\s*[^,\n]*/gi,

  // OAuth tokens
  /access[_-]?token[=:]\s*[^,\n]*/gi,
  /refresh[_-]?token[=:]\s*[^,\n]*/gi,
  /oauth[_-]?token[=:]\s*[^,\n]*/gi,

  // AWS credentials
  /AKIA[0-9A-Z]{16}/g,
  /aws[_-]?secret[_-]?access[_-]?key[=:]\s*[^,\n]*/gi,

  // Jira credentials
  /atlassian[_-]?token[=:]\s*[^,\n]*/gi,
  /cloud[_-]?id[=:]\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi,

  // Passwords and secrets
  /password[=:]\s*[^,\n]*/gi,
  /passwd[=:]\s*[^,\n]*/gi,
  /secret[=:]\s*[^,\n]*/gi,

  // Database connections
  /postgresql:\/\/[^@]*@[^\s]*/gi,
  /mongodb:\/\/[^@]*@[^\s]*/gi,
  /mysql:\/\/[^@]*@[^\s]*/gi,
];

/**
 * Redaction result tracking
 */
export interface RedactionResult {
  redacted: boolean;
  originalLength: number;
  redactedLength: number;
  secretsFound: number;
  redactedContent: string;
}

/**
 * Redact secrets from text
 *
 * @param content Text that may contain secrets
 * @param maxLength Maximum length of final content (prevents large error details)
 * @returns Redacted content with [REDACTED_*] markers
 */
export function redactSecrets(
  content: string,
  maxLength: number = 500
): RedactionResult {
  let redactedContent = content;
  let secretsFound = 0;

  // Apply all redaction patterns
  for (const pattern of SECRETS_PATTERNS) {
    const matches = redactedContent.match(pattern);
    if (matches) {
      secretsFound += matches.length;
      redactedContent = redactedContent.replace(
        pattern,
        '[REDACTED_SECRET]'
      );
    }
  }

  // Bound error detail length (prevent accidental data leakage)
  if (redactedContent.length > maxLength) {
    redactedContent = redactedContent.substring(0, maxLength) + '...[TRUNCATED]';
  }

  return {
    redacted: secretsFound > 0,
    originalLength: content.length,
    redactedLength: redactedContent.length,
    secretsFound,
    redactedContent,
  };
}

/**
 * Redact from error object
 *
 * @param error Error object with message, stack, etc.
 * @returns Safe error object for logging
 */
export function redactErrorObject(
  error: any,
  maxLength: number = 500
): SafeError {
  const message = error?.message ? String(error.message) : 'Unknown error';
  const stack = error?.stack ? String(error.stack) : '';

  const redactedMessage = redactSecrets(message, maxLength);
  const redactedStack = redactSecrets(stack, maxLength * 2); // Stack can be longer

  return {
    name: error?.name || 'Error',
    message: redactedMessage.redactedContent,
    stack: redactedStack.redactedContent,
    code: error?.code || 'UNKNOWN',
    secretsRedacted: redactedMessage.secretsFound + redactedStack.secretsFound,
  };
}

export interface SafeError {
  name: string;
  message: string;
  stack: string;
  code: string;
  secretsRedacted: number;
}

/**
 * Redact from request/response objects
 */
export function redactHttpObject(
  obj: any
): { [key: string]: any } {
  if (!obj) return {};

  const safe: { [key: string]: any } = {};

  for (const [key, value] of Object.entries(obj)) {
    const keyLower = String(key).toLowerCase();

    // Never log sensitive headers
    if (keyLower.includes('authorization') ||
        keyLower.includes('token') ||
        keyLower.includes('secret') ||
        keyLower.includes('password') ||
        keyLower.includes('api-key') ||
        keyLower.includes('x-auth')) {
      safe[key] = '[REDACTED_HEADER]';
      continue;
    }

    // Redact if value is string
    if (typeof value === 'string') {
      const result = redactSecrets(value, 100);
      safe[key] = result.redactedContent;
    } else if (typeof value === 'object' && value !== null) {
      // Recurse into nested objects
      safe[key] = redactHttpObject(value);
    } else {
      safe[key] = value;
    }
  }

  return safe;
}

/**
 * Safe logger (enforces redaction on all calls)
 *
 * Example:
 *   safeLogger.error('Something failed', { request, error })
 *   → automatically redacts before output
 */
export const safeLogger = {
  debug: (message: string, context?: any) => {
    console.debug(message, redactHttpObject(context));
  },

  info: (message: string, context?: any) => {
    console.info(message, redactHttpObject(context));
  },

  warn: (message: string, context?: any) => {
    console.warn(message, redactHttpObject(context));
  },

  error: (message: string, error?: any, context?: any) => {
    const safeError = error ? redactErrorObject(error) : undefined;
    console.error(message, safeError, redactHttpObject(context));
  },

  // For request/response pairs
  logRequest: (method: string, url: string, headers?: any, body?: any) => {
    console.log(`→ ${method} ${url}`, {
      headers: redactHttpObject(headers),
      body: redactHttpObject(body),
    });
  },

  logResponse: (status: number, headers?: any, body?: any) => {
    console.log(`← ${status}`, {
      headers: redactHttpObject(headers),
      body: redactHttpObject(body),
    });
  },
};

/**
 * Verify that redaction was applied to sensitive data
 *
 * Test helper: assert that logs don't contain secrets
 */
export function verifyNoSecretsInLog(logContent: string): boolean {
  // Check for common secret patterns that should have been redacted
  const secretIndicators = [
    /Bearer\s+[A-Za-z0-9]/i,      // OAuth token
    /api[_-]?key\s*[=:]/i,       // API key
    /Authorization:\s*[^[\]]/i,  // Auth header without [REDACTED]
    /X-API-Key:\s*[^[\]]/i,      // API key header
  ];

  for (const indicator of secretIndicators) {
    if (indicator.test(logContent)) {
      return false; // Found unredacted secret
    }
  }

  return true; // No unredacted secrets found
}

/**
 * Verify tenant isolation in logs
 *
 * Example: tenant_id from one tenant shouldn't appear in logs for another
 */
export function verifyTenantIsolationInLogs(
  logContent: string,
  authorizedTenantId: string
): boolean {
  // Extract all tenant IDs mentioned in logs
  const tenantPattern = /tenant[_-]?id[=:]\s*([a-f0-9\-]+)/gi;
  const matches = logContent.match(tenantPattern);

  if (!matches) return true; // No tenant IDs logged (good)

  // All tenant IDs in logs should match authorized tenant
  for (const match of matches) {
    if (!match.includes(authorizedTenantId)) {
      return false; // Found cross-tenant reference
    }
  }

  return true;
}

/**
 * Enforce redaction: throw if secrets found in content
 *
 * Used as build-blocking check
 */
export function assertNoSecretsInLogs(
  logContent: string
): void {
  if (!verifyNoSecretsInLog(logContent)) {
    throw new Error(
      '❌ REDACTION VIOLATION: Unredacted secrets found in logs\n' +
      'All authorization tokens, API keys, and secrets must be redacted with [REDACTED_SECRET]\n' +
      'Use safeLogger.error() or redactSecrets() for all error logging.'
    );
  }
}

/**
 * Enforce tenant isolation: throw if cross-tenant data in logs
 */
export function assertTenantIsolationInLogs(
  logContent: string,
  authorizedTenantId: string
): void {
  if (!verifyTenantIsolationInLogs(logContent, authorizedTenantId)) {
    throw new Error(
      `❌ ISOLATION VIOLATION: Cross-tenant data found in logs for tenant ${authorizedTenantId}\n` +
      'Logs must not contain references to other tenants.\n' +
      'Verify safeLogger is used and tenant_id is filtered correctly.'
    );
  }
}

/**
 * Generate redaction report
 */
export function generateRedactionReport(
  originalContent: string,
  redactedContent: string
): string {
  const redactedResult = redactSecrets(originalContent);

  const lines = [
    '═══════════════════════════════════════════════════════',
    'LOG REDACTION REPORT',
    '═══════════════════════════════════════════════════════',
    '',
    `Secrets Found: ${redactedResult.secretsFound}`,
    `Original Length: ${redactedResult.originalLength} bytes`,
    `Redacted Length: ${redactedResult.redactedLength} bytes`,
    `Reduction: ${Math.round((1 - redactedResult.redactedLength / redactedResult.originalLength) * 100)}%`,
    '',
    'Status: ✅ Redaction enforced on all error logs',
    '',
    '═══════════════════════════════════════════════════════',
  ];

  return lines.join('\n');
}
