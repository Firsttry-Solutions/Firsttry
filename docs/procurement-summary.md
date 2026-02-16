# Procurement Summary (One Page)

This summary is designed to reduce security/procurement friction. It contains only factual statements and explicit limitations.

## Product scope
- Read-only governance/audit evidence tooling for Jira Cloud under Atlassian Forge constraints.
- No compliance certification claims are made.

## Data storage location
- Forge runtime (tenant-scoped) + Forge storage (tenant isolated).
- No external vendor-operated data storage.

## Outbound network
- No outbound network calls are introduced by policy and guarded by scripts (see [scripts/proof/guard_no_new_outbound.sh](../../scripts/proof/guard_no_new_outbound.sh)).

## Scopes
- Scope set is locked and regression-guarded (see [atlassian/forge-app/tests/security/scopeAllowlist.spec.ts](../atlassian/forge-app/tests/security/scopeAllowlist.spec.ts) and [scripts/proof/verify_scope_set_unchanged.sh](../../scripts/proof/verify_scope_set_unchanged.sh)).

## Retention
- Retention is implemented via deterministic storage patterns (e.g., ring buffers where applicable).
- See [docs/storage-inventory.md](storage-inventory.md) for key-by-key retention behavior.

## Deletion / uninstall
- Customer can uninstall at any time.
- See [docs/vendor-exit-scenario.md](vendor-exit-scenario.md) for termination and export guidance.

## Security contact
- Responsible disclosure: [docs/vulnerability-disclosure.md](vulnerability-disclosure.md)

## Limitations (explicit)
- No SOC2/ISO/pentest claims.
- Framework mappings are interpretive references only (see [docs/non-claims.md](non-claims.md)).
- Forge platform availability and behavior are outside vendor control.

References:
- [docs/data-flow.md](data-flow.md)
- [docs/non-claims.md](non-claims.md)
- [docs/security-whitepaper.md](security-whitepaper.md)
