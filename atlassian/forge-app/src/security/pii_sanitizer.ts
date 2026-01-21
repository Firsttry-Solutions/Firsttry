/**
 * PII Sanitizer
 * Sanitizes sensitive personally identifiable information from logs, errors, and messages.
 * Handles: emails, account IDs, user names, tokens
 */

const PII_PATTERNS = {
  // Email: anything@domain.com
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Account ID: UUID format, 24-char Atlassian format, or 32-char hex
  accountId: /\b(?:[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}|[a-f0-9]{24}|[a-f0-9]{32})\b/gi,
  // JWT-like tokens
  token: /bearer\s+[A-Za-z0-9._-]+|token:\s*[A-Za-z0-9._-]+/gi,
};

/**
 * Sanitize sensitive data from a string value
 */
export function sanitize(value: string | unknown): string {
  if (typeof value !== 'string') {
    return String(value);
  }

  let sanitized = value;

  // Redact emails
  sanitized = sanitized.replace(
    PII_PATTERNS.email,
    '[EMAIL_REDACTED]'
  );

  // Redact account IDs
  sanitized = sanitized.replace(
    PII_PATTERNS.accountId,
    '[ACCOUNTID_REDACTED]'
  );

  // Redact tokens
  sanitized = sanitized.replace(
    PII_PATTERNS.token,
    '[TOKEN_REDACTED]'
  );

  return sanitized;
}

/**
 * Sanitize object values recursively (for error objects, data structures)
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      const value = sanitized[key];

      if (typeof value === 'string') {
        sanitized[key] = sanitize(value);
      } else if (
        typeof value === 'object' &&
        value !== null &&
        !(value instanceof Date) &&
        !(value instanceof Error)
      ) {
        sanitized[key] = sanitizeObject(value);
      }
    }
  }

  return sanitized as T;
}

/**
 * Sanitize error messages and stack traces
 */
export function sanitizeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      ...error,
      message: sanitize(error.message),
      stack: error.stack ? sanitize(error.stack) : undefined,
    };
  }

  if (typeof error === 'object' && error !== null) {
    return sanitizeObject(error as Record<string, any>);
  }

  return error;
}
