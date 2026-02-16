# ADR 0001: Scope Allowlist and Regression Lock

## Context
Marketplace trust and enterprise procurement require explicit control over requested scopes. Scope creep increases risk.

## Decision
Lock the SET of scopes. Enforce with automated tests and a scope-set verification script.

## Consequences
- Prevents accidental scope additions/removals.
- Allows reordering without breaking enforcement.
- Forces intentional review for any scope set change.

## Alternatives Considered
- Manual review only (rejected: not deterministic).
- Order-sensitive comparison (rejected: false failures).

References:
- [atlassian/forge-app/tests/security/scopeAllowlist.spec.ts](../../atlassian/forge-app/tests/security/scopeAllowlist.spec.ts)
- [scripts/proof/verify_scope_set_unchanged.sh](../../scripts/proof/verify_scope_set_unchanged.sh)
