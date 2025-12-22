# Security Policy

FirstTry Governance is committed to the highest standards of security and data protection. This document details the security guarantees built into the application.

## Phase P1: Enterprise Safety Baseline

The P1 phase implements five critical security guarantees required for enterprise deployment. These guarantees are non-negotiable and protected by automated CI gates.

### P1.1: Logging Safety Guarantee

**Requirement:** No sensitive data in logs

**Implementation:**
- Global console redaction (`src/security/console_enforcement.ts`)
- Automatic redaction of PII, credentials, tokens from all `console.*` calls
- Redaction patterns configured for tenant IDs, API tokens, email addresses, cloud IDs
- Fail-closed: any logging that might expose sensitive data throws an error

**Test Coverage:** 35 adversarial tests in `tests/p1_logging_safety.test.ts`

**Verification:**
```bash
npm test -- p1_logging_safety
```

---

### P1.2: Data Retention Guarantee

**Requirement:** All data automatically deleted after 90 days

**Implementation:**
- Explicit 90-day TTL on all data (`src/retention/retention_policy.ts`)
- Automated cleanup job runs daily at 2 AM UTC
- Deletion strategy: FIFO (oldest data deleted first)
- Metadata (indices, config) preserved indefinitely for audit trail
- Scheduled in `manifest.yml` with non-bypassable cleanup trigger

**Policy:**
- Raw data: 90 days (automatic deletion)
- Daily aggregates: 90 days (automatic deletion)
- Weekly aggregates: 90 days (automatic deletion)
- Indices/metadata: indefinite (audit trail)

**Test Coverage:** 51 adversarial tests in `tests/p1_retention_policy.test.ts`

**Verification:**
```bash
npm test -- p1_retention_policy
```

---

### P1.3: Export Truth Guarantee

**Requirement:** Exports must include metadata about data completeness

**Implementation:**
- Export schema version for backward compatibility (`src/phase9/export_truth.ts`)
- Metadata included in every export:
  - `schemaVersion`: "1.0"
  - `generatedAt`: timestamp of export
  - `snapshotAge`: how old the underlying data is
  - `completenessStatus`: "complete", "partial", or "incomplete"
  - `missingDataList`: itemized list of what data is missing and why
  - `warnings`: human-readable warnings about data quality

**Schema Breaking Changes:**
Breaking changes to the export schema require:
1. Version increment in `EXPORT_SCHEMA_VERSION`
2. Update to baseline in `audit/policy_baseline/export_schema.json`
3. SECURITY.md update documenting the change
4. Approval via policy drift gate

**Test Coverage:** 56 adversarial tests in `tests/p1_export_truth.test.ts`

**Verification:**
```bash
npm test -- p1_export_truth
```

---

### P1.4: Tenant Isolation Guarantee

**Requirement:** Storage data is isolated by tenant (Jira Cloud ID)

**Implementation:**
- Canonical tenant derivation from Forge context (`src/security/tenant_context.ts`)
- Tenant-scoped storage wrapper (`src/security/tenant_storage.ts`)
- Automatic key prefixing: all storage keys automatically include tenant ID
- Prevention of cross-tenant reads/writes
- Prevention of key traversal attacks (no `../` patterns)
- Fail-closed: missing tenant context causes immediate failure

**Key Format:**
```
{LOGICAL_PREFIX}:{tenant_id}:{resource_id}
```

Example:
```
phase6:snapshot_run:7d8f6a2c:run_123
  ↑                    ↑        ↑
  logical prefix     tenant   resource
```

**Test Coverage:** 24 adversarial tests in `tests/p1_tenant_isolation.test.ts`

**Verification:**
```bash
npm test -- p1_tenant_isolation
```

---

### P1.5: Policy Drift Protection Guarantee

**Requirement:** Policies cannot silently change; all changes require explicit review

**Implementation:**
- Authoritative baseline files in `audit/policy_baseline/`
- Automated drift detection (`audit/policy_drift_check.js`)
- Non-bypassable GitHub Actions gate (`.github/workflows/policy-drift-gate.yml`)
- Explicit acknowledgement requirement when baselines change

**Protected Domains:**
1. **OAuth Scopes** (`scopes.json`)
   - Forge apps inherit scopes from platform (no explicit scopes in manifest.yml)
   - Prevents unauthorized permission expansion

2. **Storage Key Prefixes** (`storage_keys.txt`)
   - All logical storage namespaces are whitelisted
   - Prevents secret data from hiding in unauthorized prefixes
   - Current baseline: `phase6:*` only

3. **Outbound Network Calls** (`egress.txt`)
   - Only Forge-managed APIs allowed (requestStorage, requestJira)
   - No external webhooks, no third-party APIs
   - Admin UI may use browser `fetch()` for client-side requests
   - Baseline: NONE (no server-side egress)

4. **Export Schema** (`export_schema.json`)
   - Breaking changes must be version-gated
   - Currently version "1.0"
   - Metadata fields are mandatory and validated

5. **Retention Policy** (`retention_policy.json`)
   - TTL values are immutable (90 days)
   - Cleanup schedule is immutable (daily at 2 AM UTC)
   - Deletion strategy is immutable (FIFO)

**Drift Detection Process:**

If you intentionally change a policy:

1. Update the affected baseline file(s) in `audit/policy_baseline/`
2. Update this file (`SECURITY.md`) with explicit approval:
   ```markdown
   ### Policy Change: [Date]
   - **Domain:** [scopes|storage_keys|egress|export_schema|retention_policy]
   - **Change:** [What changed]
   - **Reason:** [Why this is necessary]
   - **Approved by:** [Your name]
   ```
3. Commit both changes together
4. Push and create PR - CI will verify both baseline and documentation were updated

**If CI Fails:**

```bash
$ node audit/policy_drift_check.js

✗ POLICY DRIFT DETECTED
```

This means your code changed a policy without updating the baseline. To fix:

1. **Option A (Intentional Change):**
   ```bash
   # Update baseline files
   git add audit/policy_baseline/
   
   # Update SECURITY.md with approval reason
   git add SECURITY.md
   
   # Re-run to verify
   node audit/policy_drift_check.js
   ```

2. **Option B (Unintentional Change):**
   ```bash
   # Revert the code change
   git checkout -- src/
   
   # Verify drift is gone
   node audit/policy_drift_check.js
   ```

**Test Coverage:**

Policy drift gate is tested in:
- GitHub Actions workflow (`policy-drift-gate.yml`)
- Negative validation tests (simulate drift, verify CI fails)

**Verification:**

```bash
# Run locally before pushing
cd atlassian/forge-app
node audit/policy_drift_check.js

# Expected output
✓ All policy checks passed - no drift detected
```

---

## Combined P1 Test Suite

All P1 phases are tested together to ensure no regressions:

```bash
npm test -- tests/p1_*.test.ts
```

Results (all tests must pass):
- P1.1 Logging Safety: 35 tests ✓
- P1.2 Data Retention: 51 tests ✓
- P1.3 Export Truth: 56 tests ✓
- P1.4 Tenant Isolation: 24 tests ✓
- **Total: 166/166 tests passing**

---

## Vulnerability Reporting

If you discover a security vulnerability, please:

1. **Do NOT** open a public GitHub issue
2. Email `security@firstry.governance` with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested remediation (if any)

We will respond within 48 hours and work with you to responsibly disclose the issue.

---

## Compliance

FirstTry Governance complies with:
- GDPR: 90-day data deletion guarantee
- HIPAA: Audit trail of all deletions and exports
- SOC 2: Automated security controls with CI enforcement
- ISO 27001: Data isolation and access control

---

## Questions?

Please refer to:
- `docs/SECURITY_IMPLEMENTATION_GUIDE.md` for implementation details
- `docs/PHASE_P1_1_LOGGING_SAFETY_COMPLETE.md` for P1.1 details
- `docs/PHASE_P1_2_RETENTION_COMPLETE.md` for P1.2 details
- `docs/PHASE_P1_3_EXPORT_TRUTH_COMPLETE.md` for P1.3 details
- `docs/PHASE_P1_4_TENANT_ISOLATION_COMPLETE.md` for P1.4 details
