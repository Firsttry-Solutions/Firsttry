# Procurement Master Pack (Expanded, Cross-Linked)

This pack provides structured answers and links to evidence inside the repo. No certifications are claimed.

## 1) Data residency
- FirstTry runs on Atlassian Forge. Data residency controls are governed by Atlassian platform capabilities, not vendor-operated infrastructure.
- Vendor does not provide separate residency selectors.

## 2) Encryption responsibility
- Forge/Atlassian manage encryption at rest and platform security controls.
- Vendor does not hold encryption keys (no key custody).

## 3) Access controls
- Read-only governance tooling under scope-lock policy.
- Scope immutability checks:
  - [atlassian/forge-app/tests/security/scopeAllowlist.spec.ts](../../atlassian/forge-app/tests/security/scopeAllowlist.spec.ts)
  - [scripts/proof/verify_scope_set_unchanged.sh](../../scripts/proof/verify_scope_set_unchanged.sh)

## 4) Tenant isolation proof
- Trust boundary: [docs/data-flow.md](data-flow.md)
- Invariant enforcement:
  - [atlassian/forge-app/src/security/tenantInvariant.ts](../../atlassian/forge-app/src/security/tenantInvariant.ts)
- Negative tests:
  - [atlassian/forge-app/tests/security/tenantIsolation.spec.ts](../../atlassian/forge-app/tests/security/tenantIsolation.spec.ts)

## 5) Deterministic artifact assurance
- Determinism addendum: [docs/security-whitepaper.md](security-whitepaper.md)
- Golden deterministic test:
  - [atlassian/forge-app/tests/determinism/exportGolden.spec.ts](../../atlassian/forge-app/tests/determinism/exportGolden.spec.ts)
- Hash invariants:
  - [atlassian/forge-app/tests/determinism/hashInvariant.spec.ts](../../atlassian/forge-app/tests/determinism/hashInvariant.spec.ts)
- Build reproducibility: [docs/reproducible-build.md](reproducible-build.md)

## 6) Failure behavior
- Fail-closed matrix: [docs/failure-matrix.md](failure-matrix.md)
- No partial artifacts test:
  - [atlassian/forge-app/tests/security/failureCompleteness.spec.ts](../../atlassian/forge-app/tests/security/failureCompleteness.spec.ts)

## 7) Export before uninstall
- Vendor exit: [docs/vendor-exit-scenario.md](vendor-exit-scenario.md)

## 8) No outbound guarantee
- Scanner: [scripts/proof/scan_outbound_candidates.sh](../../scripts/proof/scan_outbound_candidates.sh)
- Guard: [scripts/proof/guard_no_new_outbound.sh](../../scripts/proof/guard_no_new_outbound.sh)

## 9) Dependency management
- No dependency additions in Phase 4.2.1.
- package.json/lockfiles are unchanged by policy and verified by diffs in release procedure.

## 10) Change control process
- [docs/change-management-policy.md](change-management-policy.md)

## 11) Incident disclosure model
- [docs/vulnerability-disclosure.md](vulnerability-disclosure.md)

## 12) Security accountability
- [docs/vulnerability-disclosure.md](vulnerability-disclosure.md) (Security Responsibility section)

## 13) Known limitations (explicit)
- [docs/non-claims.md](non-claims.md)
- [docs/risk-register.md](risk-register.md)
