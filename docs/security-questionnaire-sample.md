# Sample Security Questionnaire (Truthful, No Claims)

## Where is customer data stored?
- Tenant-scoped Forge storage and runtime only. No external vendor storage.
- See [docs/data-flow.md](data-flow.md) and [docs/storage-inventory.md](storage-inventory.md).

## Is data encrypted at rest?
- Encryption at rest is Forge/Atlassian managed. Vendor does not manage encryption keys.
- No signing/key custody is introduced by FirstTry.

## Does the app make outbound network calls?
- Policy: no outbound.
- Guarded by: [scripts/proof/guard_no_new_outbound.sh](../../scripts/proof/guard_no_new_outbound.sh) and [scripts/proof/scan_outbound_candidates.sh](../../scripts/proof/scan_outbound_candidates.sh).

## How is tenant isolation ensured?
- Forge tenant isolation plus internal invariant checks.
- Tests:
  - [atlassian/forge-app/tests/security/tenantIsolation.spec.ts](../../atlassian/forge-app/tests/security/tenantIsolation.spec.ts)
  - [atlassian/forge-app/src/security/tenantInvariant.ts](../../atlassian/forge-app/src/security/tenantInvariant.ts)

## Does the app write to Jira or mutate permissions?
- This hardening phase introduces no Jira write APIs.
- Read-only posture is documented; scope set is regression-guarded.

## How do you handle vulnerabilities?
- [docs/vulnerability-disclosure.md](vulnerability-disclosure.md)

## Can customers export data before uninstall?
- Where exports exist, they can be generated before uninstall.
- See [docs/vendor-exit-scenario.md](vendor-exit-scenario.md).

## Any compliance certifications?
- None claimed. See [docs/non-claims.md](non-claims.md).
