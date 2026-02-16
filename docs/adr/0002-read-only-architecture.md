# ADR 0002: Read-Only Architecture Posture

## Context
Enterprise buyers prefer tools that do not mutate system state unless explicitly required and controlled.

## Decision
Maintain a read-only posture for the app under hard constraints. No new Jira write/mutation APIs are introduced for Phase 4.2.1.

## Consequences
- Reduced risk surface.
- Some remediation workflows remain out of scope.
- Clear boundary improves procurement acceptance.

## Alternatives Considered
- Add write APIs for auto-remediation (rejected: marketplace/procurement risk; outside constraints).

References:
- [docs/data-flow.md](../data-flow.md)
- [docs/non-claims.md](../non-claims.md)
