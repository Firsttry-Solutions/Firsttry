# Security Policy

## Supported Versions
Security patches apply to the latest public release of FirstTry.

## Reporting a Vulnerability
Send security reports to:
security@firsttry.dev

We will acknowledge receipt within 24 hours and provide updates within 72 hours.

## Disclosure
We follow responsible disclosure. Please do not publicly disclose issues before coordinating with us.

Thank you for helping keep FirstTry secure.
# Security Policy

## Supported Versions

Only the latest released version of FirstTry receives security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security issue, **please do not open a public GitHub issue.**

Instead, email us directly at:
- **security@firsttry.dev** (preferred)
- **arnab.security@gmail.com** (alternate)

### What to Include

When reporting a vulnerability, please include:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

- **Acknowledgment:** Within 48 hours
- **Initial Assessment:** Within 5 business days
- **Resolution Timeline:** Provided in initial assessment

### Disclosure Policy

We follow responsible disclosure:
1. You report the issue privately
2. We work on a fix
3. We release the fix
4. We publicly disclose the issue (crediting you, if desired)

Thank you for helping keep FirstTry secure!

## Tenant Isolation Guarantee (Phase P1.4)

### Overview

FirstTry enforces strict tenant isolation at all data boundaries. Each Jira Cloud installation operates in a completely isolated namespace. No tenant can read, write, or export data from another tenant, even if attempting to spoof tenant identifiers.

### Tenant Identity

**Canonical Identifier:** Jira Cloud site ID (`cloudId`)
- Derived from Forge runtime context (not user input, query params, or request body)
- Immutable and platform-controlled
- Deterministically mapped to a storage key prefix: `cloud:${cloudId}`

**Isolation Boundary:** All data is prefixed with tenant key
- Format: `${tenantKey}::${logicalKey}`
- Example: `cloud:abc123::snapshot:run:12345`
- Prevents accidental or intentional cross-tenant access

### Enforcement Points

#### 1. Tenant Context Derivation (src/security/tenant_context.ts)
- **Function:** `deriveTenantContext(forgeContext)`
- **Behavior:** Extracts cloudId from Forge platform context
- **Fail-Closed:** Throws `TenantContextError` if context missing/invalid
- **Guarantee:** Tenant ID cannot be spoofed or overridden

#### 2. Storage Layer Wrapper (src/security/tenant_storage.ts)
- **Function:** All storage operations use `tenantStorageGet`, `tenantStorageSet`, `tenantStorageDelete`
- **Behavior:** Automatically prefixes all keys with tenant scope
- **Validation:** Rejects pre-prefixed keys, traversal attempts (..), reserved prefixes
- **Fail-Closed:** Throws error if `TenantContext` missing
- **Non-Bypassable:** Direct access to Forge storage.get/set requires prior tenant scoping

#### 3. Export Boundary Enforcement (src/phase9/export_truth.ts)
- **Requirement:** Export handlers must pass `TenantContext`
- **Behavior:** Only reads and exports tenant-scoped storage keys
- **Validation:** Metadata includes tenant fingerprint (for audit trail)
- **Guarantee:** Exports contain only current tenant's data

### Testing & Validation

**Test Suite:** `tests/p1_tenant_isolation.test.ts` (24 tests)

**Adversarial Tests Validate:**
1. ✅ `test_cross_tenant_read_is_blocked` — Tenant B cannot read Tenant A data with same key name
2. ✅ `test_cross_tenant_write_does_not_corrupt_other_tenant` — Writes are isolated; no data corruption
3. ✅ `test_tenant_id_spoofing_fails` — Spoofed cloudId creates isolated namespace, not privilege escalation
4. ✅ `test_storage_rejects_prefixed_keys` — Pre-prefixed keys, traversal patterns, reserved prefixes rejected
5. ✅ `test_export_cannot_access_other_tenant_data` — Exports respect tenant context
6. ✅ `test_missing_tenant_context_fails_closed` — Missing context blocks all storage operations

**Run Tests:**
```bash
npm test -- tests/p1_tenant_isolation.test.ts
npm test -- tests/p1_*.test.ts  # All P1 requirements (142 tests)
```

### Security Properties

| Property | Guarantee | Evidence |
|----------|-----------|----------|
| **Isolation** | No cross-tenant reads | Test: `test_cross_tenant_read_is_blocked` |
| **Data Integrity** | No cross-tenant writes | Test: `test_cross_tenant_write_does_not_corrupt_other_tenant` |
| **Spoofing Resistance** | cloudId cannot be overridden | Test: `test_tenant_id_spoofing_fails` |
| **Boundary Enforcement** | All keys are tenant-prefixed | Test: `test_storage_rejects_prefixed_keys` |
| **Export Safety** | Exports are tenant-scoped | Test: `test_export_cannot_access_other_tenant_data` |
| **Fail-Closed** | Missing context blocks execution | Test: `test_missing_tenant_context_fails_closed` |

### Error Handling

**TenantContextError:** Thrown when tenant context is missing or invalid
- Caught at handler entry points
- Returns safe error response to client
- Prevents fallback to shared or default tenant

**Storage Exceptions:** All tenant storage operations throw if context invalid
- No retry with different context
- Propagates to caller for handling

### Limitations & Future Work

1. **Prefix Query Limitation:** Forge storage API doesn't support prefix queries; callers must use documented key patterns for list operations
2. **Multi-Install Support:** Currently `installationId` optional; future: enforce per-installation isolation if required
3. **Audit Logging:** Tenant ID included in P1.3 export metadata; cross-tenant access attempts not separately logged (could be added)

### References

- **Implementation:** `src/security/tenant_context.ts`, `src/security/tenant_storage.ts`
- **Tests:** `tests/p1_tenant_isolation.test.ts`
- **Related Requirements:** P1.1 (Logging Safety), P1.2 (Retention), P1.3 (Export Truth), P1.5 (Policy Drift)
