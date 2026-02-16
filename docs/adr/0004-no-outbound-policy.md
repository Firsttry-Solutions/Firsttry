# ADR 0004: No Outbound Network Policy and Regression Guard

## Context
Outbound network calls create data exfiltration risk and increase procurement friction.

## Decision
Enforce a "no outbound network" policy and block regressions via CI-safe diff-based guards.

## Consequences
- Stronger privacy posture.
- Integrations requiring outbound calls are explicitly out of scope under current constraints.

## Alternatives Considered
- Allow outbound with allowlist (rejected: higher procurement risk; outside constraints).

References:
- [scripts/proof/scan_outbound_candidates.sh](../../scripts/proof/scan_outbound_candidates.sh)
- [scripts/proof/guard_no_new_outbound.sh](../../scripts/proof/guard_no_new_outbound.sh)
- [docs/data-flow.md](../data-flow.md)
