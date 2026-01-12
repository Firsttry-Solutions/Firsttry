/**
 * Safe Logger Wrapper
 * Wraps console methods to sanitize PII before logging
 */

import { sanitize, sanitizeObject, sanitizeError } from './pii_sanitizer';

export const safeLog = {
  log: (...args: any[]) => {
    const sanitized = args.map((arg) =>
      typeof arg === 'string' ? sanitize(arg) : sanitizeObject(arg)
    );
    console.log(...sanitized);
  },

  error: (...args: any[]) => {
    const sanitized = args.map((arg) => {
      if (arg instanceof Error) {
        return sanitizeError(arg);
      }
      return typeof arg === 'string' ? sanitize(arg) : sanitizeObject(arg);
    });
    console.error(...sanitized);
  },

  warn: (...args: any[]) => {
    const sanitized = args.map((arg) =>
      typeof arg === 'string' ? sanitize(arg) : sanitizeObject(arg)
    );
    console.warn(...sanitized);
  },

  debug: (...args: any[]) => {
    const sanitized = args.map((arg) =>
      typeof arg === 'string' ? sanitize(arg) : sanitizeObject(arg)
    );
    if (console.debug) {
      console.debug(...sanitized);
    }
  },
};
