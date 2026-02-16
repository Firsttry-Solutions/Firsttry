# Architecture Decision Records (ADR Index)

| ADR | Topic | Related Docs | Related Tests / Guards |
| --- | ----- | ------------ | ---------------------- |
| 0001 | Scope allowlist + regression lock | [docs/procurement-summary.md](../procurement-summary.md), [docs/non-claims.md](../non-claims.md) | [tests/security/scopeAllowlist.spec.ts](../../atlassian/forge-app/tests/security/scopeAllowlist.spec.ts), [scripts/proof/verify_scope_set_unchanged.sh](../../scripts/proof/verify_scope_set_unchanged.sh) |
| 0002 | Read-only architecture posture | [docs/data-flow.md](../data-flow.md), [docs/security-whitepaper.md](../security-whitepaper.md) | scope allowlist tests + outbound guard |
| 0003 | Deterministic exports + golden testing | [docs/reproducible-build.md](../reproducible-build.md), [docs/security-whitepaper.md](../security-whitepaper.md) | [tests/determinism/exportGolden.spec.ts](../../atlassian/forge-app/tests/determinism/exportGolden.spec.ts), [tests/determinism/hashInvariant.spec.ts](../../atlassian/forge-app/tests/determinism/hashInvariant.spec.ts) |
| 0004 | No outbound policy + regression guard | [docs/data-flow.md](../data-flow.md), [docs/procurement-master-pack.md](../procurement-master-pack.md) | [scripts/proof/guard_no_new_outbound.sh](../../scripts/proof/guard_no_new_outbound.sh), [scripts/proof/scan_outbound_candidates.sh](../../scripts/proof/scan_outbound_candidates.sh) |
