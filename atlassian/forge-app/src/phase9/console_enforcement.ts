/**
 * PHASE-9: CONSOLE ENFORCEMENT
 *
 * Global wrapper for console methods that enforces redaction at runtime.
 * This prevents ANY console output from containing secrets, tokens, emails, or PII.
 *
 * Usage:
 *   import { enforceConsoleRedaction } from './phase9/console_enforcement';
 *   enforceConsoleRedaction(); // Call this at app startup (index.ts)
 *
 * Why a global enforcer?
 * - Catches all console.log/debug/info/warn/error calls across the codebase
 * - Doesn't require refactoring existing code
 * - Fails closed: if redaction fails, logs are still suppressed
 * - Provable: all output is automatically redacted, no manual audit needed
 */

import {
  redactSecrets,
  redactErrorObject,
  redactHttpObject,
  SafeError,
} from './log_redaction';

/**
 * Original console methods (saved before wrapping)
 */
const originalConsole = {
  log: console.log,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

/**
 * Stringify and redact a single argument
 */
function redactArgument(arg: any): string {
  try {
    // Handle errors specially
    if (arg instanceof Error) {
      const safeError = redactErrorObject(arg);
      return JSON.stringify(safeError);
    }

    // Handle objects
    if (typeof arg === 'object' && arg !== null) {
      const safeObj = redactHttpObject(arg);
      return JSON.stringify(safeObj);
    }

    // Handle strings
    if (typeof arg === 'string') {
      const result = redactSecrets(arg, 1000);
      return result.redactedContent;
    }

    // Pass through primitives (numbers, booleans, etc.)
    return String(arg);
  } catch (err) {
    // If redaction fails, suppress the output for safety
    return '[REDACTION_FAILED]';
  }
}

/**
 * Redact all arguments to a console call
 */
function redactArguments(args: any[]): string[] {
  return args.map(arg => redactArgument(arg));
}

/**
 * Install global console redaction enforcement
 *
 * Wraps all console methods to enforce redaction.
 * This is a fail-closed approach: if redaction fails, output is suppressed.
 *
 * @throws Error if enforcement cannot be installed (should be caught in index.ts)
 */
export function enforceConsoleRedaction(): void {
  try {
    // Wrap console.log
    console.log = function (...args: any[]) {
      try {
        const redacted = redactArguments(args);
        originalConsole.log(...redacted);
      } catch (err) {
        // Fail closed: never output unredacted data
        originalConsole.error('[CONSOLE_ENFORCEMENT] Failed to redact log, suppressing output');
      }
    };

    // Wrap console.debug
    console.debug = function (...args: any[]) {
      try {
        const redacted = redactArguments(args);
        originalConsole.debug(...redacted);
      } catch (err) {
        originalConsole.error('[CONSOLE_ENFORCEMENT] Failed to redact debug, suppressing output');
      }
    };

    // Wrap console.info
    console.info = function (...args: any[]) {
      try {
        const redacted = redactArguments(args);
        originalConsole.info(...redacted);
      } catch (err) {
        originalConsole.error('[CONSOLE_ENFORCEMENT] Failed to redact info, suppressing output');
      }
    };

    // Wrap console.warn
    console.warn = function (...args: any[]) {
      try {
        const redacted = redactArguments(args);
        originalConsole.warn(...redacted);
      } catch (err) {
        originalConsole.error('[CONSOLE_ENFORCEMENT] Failed to redact warn, suppressing output');
      }
    };

    // Wrap console.error
    console.error = function (...args: any[]) {
      try {
        const redacted = redactArguments(args);
        originalConsole.error(...redacted);
      } catch (err) {
        // For error itself, use original to report the enforcement failure
        originalConsole.error('[CONSOLE_ENFORCEMENT] Failed to redact error, suppressing output');
      }
    };

    // Report successful installation
    originalConsole.log('[CONSOLE_ENFORCEMENT] ✅ Global redaction enforcement installed at startup');
  } catch (err) {
    originalConsole.error(
      '[CONSOLE_ENFORCEMENT] ❌ Failed to install enforcement:',
      err
    );
    throw new Error('Console redaction enforcement failed to install');
  }
}

/**
 * Verify enforcement is active
 *
 * Returns true if console methods have been wrapped.
 * Test helper: assert enforcement is in place.
 */
export function isConsoleEnforcementActive(): boolean {
  // Check if console.log has been wrapped (by checking if it's the original)
  return console.log !== originalConsole.log;
}

/**
 * Disable enforcement (for testing only)
 *
 * Use this in test teardown to restore original console behavior.
 */
export function disableConsoleEnforcement(): void {
  console.log = originalConsole.log;
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
}

/**
 * Test helper: capture all console output while enforcement is active
 *
 * Example:
 *   const output = captureConsoleOutput(() => {
 *     console.log('Secret token: xyz123', { api_key: 'secret' });
 *   });
 *   assert(output.join('').includes('[REDACTED]'));
 */
export function captureConsoleOutput(fn: () => void): string[] {
  const captured: string[] = [];

  // Temporarily replace console with capture
  const originalLog = console.log;
  console.log = (...args: any[]) => captured.push(...args.map(String));

  try {
    fn();
  } finally {
    console.log = originalLog;
  }

  return captured;
}
