# Security Overview (Mirror)

<!-- BEGIN: GENERATED -->
**Purpose**: This file mirrors security information from the repository root for GitHub Pages linkability.

**Policy**: GitHub Pages sites serve only from `docs/` tree. Links to `../SECURITY.md` escape the docs directory and break offline.

---

## Repository Security Policy

> # Security Policy
> 
> ---
> **COMPLIANCE DISCLAIMER**: Any references to SOC 2, ISO 27001, HIPAA, GDPR, or Cloud Fortified in this document refer to Atlassian's platform-level certifications, NOT independent app-level certifications. FirstTry - Audit Evidence Snapshot for Jira inherits security posture from the Atlassian Forge platform. See the full security documentation in `docs/` for explicit disclaimers and detailed architecture.
> ---
> 
> 
> FirstTry - Audit Evidence Snapshot for Jira is committed to the highest standards of security and data protection. This document details the security guarantees built into the application.
> 
> ## Phase P1: Enterprise Safety Baseline
> 
> The P1 phase implements five critical security guarantees required for enterprise deployment. These guarantees are non-negotiable and protected by automated CI gates.
> 
> ### P1.1: Logging Safety Guarantee
> 
> **Requirement:** No sensitive data in logs
> 
> **Implementation:**
> - Global console redaction (`src/security/console_enforcement.ts`)
> - Automatic redaction of PII, credentials, tokens from all `console.*` calls
> - Redaction patterns configured for tenant IDs, API tokens, email addresses, cloud IDs
> - Fail-closed: any logging that might expose sensitive data throws an error
> 
> **Test Coverage:** 35 adversarial tests in `tests/p1_logging_safety.test.ts`
> 
> **Verification:**
> ```bash
> npm test -- p1_logging_safety
> ```
> 
> ---
> 
> ### P1.2: Data Retention Guarantee
> 
> **Requirement:** All data automatically deleted after 90 days
> 
> **Implementation:**
> - Explicit 90-day TTL on all data (`src/retention/retention_policy.ts`)
> - Automated cleanup job runs daily at 2 AM UTC
> - Deletion strategy: FIFO (oldest data deleted first)
> - Metadata (indices, config) preserved indefinitely for audit trail
> - Scheduled in `manifest.yml` with non-bypassable cleanup trigger
> 
> **Policy:**
> - Raw data: 90 days (automatic deletion)
> - Daily aggregates: 90 days (automatic deletion)
> - Weekly aggregates: 90 days (automatic deletion)
> - Indices/metadata: indefinite (audit trail)
> 
> **Test Coverage:** 51 adversarial tests in `tests/p1_retention_policy.test.ts`
> 
> **Verification:**
> ```bash
> npm test -- p1_retention_policy
> ```
> 
> ---
> 
> ### P1.3: Export Truth Guarantee
> 
> **Requirement:** Exports must include metadata about data completeness
> 
> **Implementation:**
> - Export schema version for backward compatibility (`src/phase9/export_truth.ts`)
> - Metadata included in every export:
>   - `schemaVersion`: "1.0"
>   - `generatedAt`: timestamp of export
>   - `snapshotAge`: how old the underlying data is
>   - `completenessStatus`: "complete", "partial", or "incomplete"
>   - `missingDataList`: itemized list of what data is missing and why
>   - `warnings`: human-readable warnings about data quality
> 
> **Schema Breaking Changes:**
> Breaking changes to the export schema require:
> 1. Version increment in `EXPORT_SCHEMA_VERSION`
> 2. Update to baseline in `audit/policy_baseline/export_schema.json`
> 3. SECURITY.md update documenting the change
> 4. Approval via policy drift gate
> 
> **Test Coverage:** 56 adversarial tests in `tests/p1_export_truth.test.ts`
> 
> **Verification:**
> ```bash
> npm test -- p1_export_truth
> ```
> 
> ---
> 
> ### P1.4: Tenant Isolation Guarantee
> 
> **Requirement:** Storage data is isolated by tenant (Jira Cloud ID)
> 
> **Implementation:**
> - Canonical tenant derivation from Forge context (`src/security/tenant_context.ts`)
> - Tenant-scoped storage wrapper (`src/security/tenant_storage.ts`)
> - Automatic key prefixing: all storage keys automatically include tenant ID
> - Prevention of cross-tenant reads/writes
> - Prevention of key traversal attacks (no `../` patterns)
> - Fail-closed: missing tenant context causes immediate failure
> 

_(Excerpt from repository SECURITY.md)_

For detailed security architecture within the application, see:
- [Security Overview](../SECURITY_OVERVIEW.md)
- [Threat Model](../THREAT_MODEL.md)
- [Access Scope & Permissions](../access-scope-and-permissions.md)

<!-- END: GENERATED -->
