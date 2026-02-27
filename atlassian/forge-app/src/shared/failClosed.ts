/**
 * failClosed.ts
 *
 * Fail-closed error handling semantics for enterprise audit compliance.
 * 
 * PRINCIPLE:
 * In security-critical and governance-critical paths (export, evidence, canonical),
 * failures MUST propagate loudly. Silent failures (catch+log, return null, return [])
 * mask data integrity issues and violate F100 audit requirements.
 * 
 * USE CASES:
 * - Replace: catch (err) { console.error(err); return null; }
 * - With:    catch (err) { throw failClosed('FT_MODULE_FAILURE', 'operation failed', err); }
 * 
 * CONTRACT:
 * - Always throws (never returns)
 * - Preserves original error as .cause (safe for structured logging)
 * - Uses deterministic error codes (no UUIDs, no timestamps)
 * - Zero external dependencies
 */

/**
 * FailClosedError — Custom error for explicit fail-closed semantics.
 * 
 * Fields:
 * - code: Machine-readable error code (e.g., 'FT_EXPORT_PACK_GENERATION_FAILED')
 * - message: Human-readable error message
 * - cause: Original error (if available) attached for debugging
 * 
 * Example:
 *   try {
 *     const result = await dangerousOperation();
 *   } catch (err) {
 *     throw failClosed('FT_DANGEROUS_OP_FAILED', 'Cannot proceed with export', err);
 *   }
 */
export class FailClosedError extends Error {
  public readonly code: string;
  public readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    // Construct message with code prefix for traceability
    super(`[${code}] ${message}`);
    this.name = 'FailClosedError';
    this.code = code;
    this.cause = cause;

    // Preserve stack trace (V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FailClosedError);
    }
  }
}

/**
 * failClosed — Fail-closed helper that always throws FailClosedError.
 * 
 * NEVER RETURNS. This function signature uses `never` return type to enforce
 * that all call sites understand this function terminates execution.
 * 
 * @param code - Machine-readable error code (uppercase snake_case, e.g., 'FT_EXPORT_FAILED')
 * @param message - Human-readable error description
 * @param cause - Original error (optional) to preserve stack trace and context
 * @throws {FailClosedError} Always throws
 * 
 * Example:
 *   try {
 *     await storage.get(key);
 *   } catch (err) {
 *     throw failClosed('FT_STORAGE_READ_FAILED', `Cannot read key ${key}`, err);
 *   }
 */
export function failClosed(code: string, message: string, cause?: unknown): never {
  throw new FailClosedError(code, message, cause);
}

/**
 * assertNever — TypeScript exhaustiveness check helper.
 * 
 * Use in switch statements to ensure all cases are handled at compile time.
 * If reached at runtime, throws FailClosedError.
 * 
 * Example:
 *   type Status = 'success' | 'error';
 *   function handle(status: Status) {
 *     switch (status) {
 *       case 'success': return 'ok';
 *       case 'error': return 'fail';
 *       default: return assertNever(status);
 *     }
 *   }
 * 
 * @param x - Value that should never be reached
 * @throws {FailClosedError} Always throws if called
 */
export function assertNever(x: never): never {
  throw failClosed(
    'FT_UNREACHABLE_CODE',
    `Unreachable code executed with unexpected value: ${JSON.stringify(x)}`
  );
}
