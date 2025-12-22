# FirstTry Privacy Policy

---
**COMPLIANCE DISCLAIMER**: Any references to SOC 2, ISO 27001, HIPAA, GDPR, or Cloud Fortified in this document refer to Atlassian's platform-level certifications, NOT independent app-level certifications. FirstTry Governance inherits security posture from the Atlassian Forge platform. See [docs/SECURITY.md](../atlassian/forge-app/docs/SECURITY.md) for explicit disclaimers.
---


**Version**: 1.0  
**Last Updated**: 2025-12-22  
**Audience**: Atlassian Workspace Admins, Marketplace Reviewers, Enterprise Security Teams

---

## Overview

FirstTry is an **automatic, zero-touch** Atlassian Forge app that analyzes Jira data to detect and report configuration drift. This document describes what data is collected, how it is used, and how it is protected.

**Key Principle**: FirstTry operates automatically with no setup steps. No user behavior tracking, analytics, or profiling.

**Data Control Model**: Customers remain the data controllers of their Jira data. FirstTry processes data solely within Atlassian Forge under the customer's Atlassian agreement.

## Data Collection

### What We Collect

**Policies** (user-provided):
- Policy name, description, enabled status
- Policy rules: conditions, actions, enforcement level
- User who created/modified each policy
- Timestamps of creation/modification

**Jira Metadata** (from Jira Cloud API):
- Issue keys, IDs, summaries, statuses
- Workflow transitions, custom field values
- Issue types, projects
- Assignee user keys (NOT email addresses or names)

**Usage Metrics** (aggregated, hashed):
- Count of policies evaluated per tenant (no PII)
- Count of exports per tenant (no PII)
- SHA256(user_id) for audit correlation (irreversible)
- Timestamps of usage (but not linked to individuals)

**Audit Events** (policy decisions):
- Policy ID, issue ID, decision (ALLOW/DENY/SHADOW)
- Matching clause, reason code
- Timestamp, tenant ID
- Correlation ID (not linked to user identity)

### What We Do NOT Collect

- User email addresses
- User IP addresses
- Jira user avatars or profile information
- Issue comments or descriptions (only metadata)
- Passwords or API tokens
- Team membership or organizational hierarchy
- User locations or browser fingerprints

## Data Retention

See [DATA_RETENTION.md](DATA_RETENTION.md) for authoritative retention policy.

**Key Facts**:
- FirstTry retains data indefinitely (no FirstTry-enforced TTL)
- Data deletion on uninstall is Atlassian-controlled
- Customers must manually request deletion from Atlassian if needed

## User Rights

### Right to Access (GDPR Article 15)

Users can export all FirstTry data via:
```
firstry export
```

Export includes:
- All policies (JSON format)
- All audit entries for your tenant (JSON format)
- Usage summary (JSON format)
- Correlation of policy ID to description (for DELETED policies)

Export is PII-free (user identities are hashed).

### Right to Rectification (GDPR Article 16)

Users can modify policies directly:
```
firstry policy update <policy-id> --rules <rules.json>
```

Modification timestamps are audited.

### Right to Deletion (GDPR Article 17)

Users can delete policies:
```
firstry policy delete <policy-id>
```

Or delete all:
```
firstry policy delete --all
```

Deletion is immutable; deleted policies are archived in audit trail but cannot be restored.

### Right to Restrict Processing (GDPR Article 18)

Users can disable policies without deleting them:
```
firstry policy update <policy-id> --disabled
```

Disabled policies are not evaluated.

### Right to Portability (GDPR Article 20)

Users can export their policies and audit trail in JSON format via `firstry export`, and import into other systems.

## Compliance

### GDPR (EU)

- ✅ Legal basis: Legitimate interest (Jira workflow governance)
- ✅ Data minimization: Only policy/metadata, no PII
- ✅ Encryption: In transit (TLS) and at rest (AES-256 by Forge)
- ✅ Audit trail: Immutable policy decisions
- ✅ User rights: All 5 rights implemented (access, rectification, deletion, restriction, portability)
- ✅ Data Processing: Performed by Atlassian Forge platform; FirstTry operates as processor within Forge

### CCPA (California)

- ✅ Data disclosure: This privacy policy
- ✅ Right to know: `firstry export` provides data
- ✅ Right to delete: `firstry policy delete` and audit anonymization
- ✅ Right to opt-out: N/A (no advertising/sale)
- ✅ Non-discrimination: No pricing based on privacy choices

### HIPAA (Health Insurance, if applicable)

FirstTry is NOT a HIPAA-compliant system. If you handle PHI (Protected Health Information):
- Do NOT use FirstTry for HIPAA-regulated workflows
- Do NOT store PHI in policy descriptions or Jira custom fields
- Contact your compliance officer before using FirstTry

## Privacy Shield / Data Transfers

FirstTry uses Atlassian Forge, which is based in the US. By using FirstTry, you agree to US data processing. If you are in the EU and require EU-only processing:
- Contact us: privacy@firstry.io (if available)
- Consider using Jira Cloud EU instead (Atlassian offers EU servers)

## Subprocessors

FirstTry has one subprocessor:
- **Atlassian Forge**: Provides infrastructure, encryption, storage, audit logs

Atlassian is a certified SOC2/ISO27001 provider.

## Contact Information

For privacy questions or data subject requests:
- **Privacy Officer**: privacy@firstry.io (if available; see README for contact details)
- **Response time**: 30 days (GDPR requirement)
- **Escalation**: Contact Atlassian if FirstTry does not respond

## Updates to This Policy

We may update this policy. If changes affect user rights, we will notify you via FirstTry CLI.

Last updated: 2024-01-01
