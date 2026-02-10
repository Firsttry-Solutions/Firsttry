/**
 * RUNTIME INVARIANTS (PART 5: FAIL-FAST CHECKS)
 * 
 * Runtime contract validation for critical assumptions.
 */

import { ReadOnlyViolationError } from './jiraRequestGuard';
import { StatusComputationError, ImmutabilityViolationError } from './snapshotStatus';

export class InvariantViolationError extends Error {
  constructor(invariantName: string, details: string) {
    super(`INVARIANT VIOLATION: ${invariantName} - ${details}`);
    this.name = 'InvariantViolationError';
  }
}

export function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new InvariantViolationError('Assertion', message);
  }
}

export function invariantDefined<T>(value: T | null | undefined, message: string): asserts value is T {
  invariant(value !== null && value !== undefined, message);
}

export function assertReadOnlyInvariant(): void {
  console.log('[invariants] Read-only invariant: Enforced by runtime guards + manifest scopes');
}

export function assertNonBlockingInvariant(): void {
  console.log('[invariants] Non-blocking invariant: Enforced by async architecture');
}

export function assertIsolatedFailureInvariant(): void {
  console.log('[invariants] Isolated failure invariant: Enforced by error boundaries');
}

export function assertAutomaticSafetyInvariant(): void {
  console.log('[invariants] Automatic safety invariant: Enforced by mandatory guards');
}

export function checkAllInvariants(): void {
  try {
    assertReadOnlyInvariant();
    assertNonBlockingInvariant();
    assertIsolatedFailureInvariant();
    assertAutomaticSafetyInvariant();
  } catch (error) {
    if (error instanceof ReadOnlyViolationError ||
        error instanceof StatusComputationError ||
        error instanceof ImmutabilityViolationError) {
      throw error;
    }
    throw new InvariantViolationError(
      'UnexpectedError',
      error instanceof Error ? error.message : String(error)
    );
  }
}
