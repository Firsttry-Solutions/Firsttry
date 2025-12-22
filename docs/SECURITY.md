# FirstTry Security Model

**Version**: 1.0  
**Last Updated**: 2025-12-22

---

## Executive Summary

FirstTry is a read-only, workspace-scoped Atlassian Forge app with:

- ✅ No unencrypted credential storage
- ✅ No real network egress (all mocked in tests)
- ✅ No PII logging (all output redacted)
- ✅ Data retention policy defined in [DATA_RETENTION.md](DATA_RETENTION.md)
- ✅ Workspace isolation (structural, not policy-based)
- ✅ No custom authentication
- ✅ No file uploads or external integrations

---

## 1. Vulnerability Disclosure

### 1.1 Reporting Security Issues

**Email**: security@atlassian.com (Atlassian security team)  
**Subject**: Include "FirstTry Security Vulnerability"

### 1.2 Disclosure Timeline

| Severity | Triage | Fix | Release |
|----------|--------|-----|---------|
| **CRITICAL** | 1 day | 24 hours | ASAP |
| **HIGH** | 3-5 days | 1-2 weeks | Next release |
| **MEDIUM** | 5-10 days | 2-4 weeks | Planned |
| **LOW** | 30 days | Next quarter | Roadmap |

**Note**: Targets, not SLAs. Actual response depends on complexity.

---

## 2. Data Security

### 2.1 Data at Rest

- **Storage**: Atlassian Forge Storage (AES-256 encrypted)
- **Isolation**: Workspace-scoped keys (structural)
- **Retention**: Defined in [DATA_RETENTION.md](DATA_RETENTION.md) (indefinite, not TTL-based)

### 2.2 Data in Transit

- **HTTPS**: All Jira API calls over TLS 1.2+
- **Forge APIs**: Atlassian-managed encryption
- **No Custom Encryption**: Rely on platform defaults

### 2.3 Tenant Isolation

FirstTry operates within Atlassian Forge workspace scope:

- **Workspace Isolation**: Structural - Forge app API scoped to single workspace
- **No Cross-Workspace Data Access**: Impossible by design (Forge permission model)
- **Multi-Tenant Safety**: Each workspace is isolated at the platform level
- **Data Segregation**: Workspace storage keys are separate (Atlassian-managed)

### 2.4 Sensitive Data Handling

**NOT Stored**:
- ❌ Passwords or secrets
- ❌ Email addresses
- ❌ API tokens
- ❌ User IDs (in logs)

All output is redacted before logging (verified by `tests/p1_logging_safety.test.ts`).

## Data Protection

### Encryption

- **In transit**: Handled by Jira Cloud (TLS 1.2+)
- **At rest**: Handled by Forge platform (AES-256 in AWS)
- **Sensitive fields**: PII-sensitive fields (email, IP) are sha256-hashed before storage

### Data Minimization

FirstTry collects only:
- Policy configurations (user-provided)
- Jira issue metadata (fields, transitions, issue keys)
- Usage metrics (PII-free: counts, hashes, timestamps)
- Audit log entries (policy decisions, with tenant context)

## Access Control

No FirstTry-specific access control; inheritance from Jira:
- **Jira admin scopes**: `read:jira-work`, `read:account`, `write:jira-work` (required by Manifest)
- **Tenant boundary**: Forge isolates by workspace/instance
- **No delegation**: FirstTry does not issue tokens or allow impersonation

## Audit Trail

Every policy evaluation creates an immutable audit entry:
- **Timestamp**: When policy was evaluated
- **Policy ID**: Which policy rule
- **Issue ID**: Which Jira issue
- **Decision**: ALLOW/DENY/SHADOW
- **Reason**: Which clause matched
- **Correlation ID**: Links to entitlement/usage event
- **Tenant ID**: For forensic separation

Audit entries are written to Forge storage with append-only semantics (no overwrites).

## Compliance

### GDPR

- **Right to access**: Users can export all policies/decisions via `firstry export` (PII-free)
- **Right to deletion**: Users can delete policies via `firstry policy delete --all`
- **Data minimization**: No PII collected; metrics hashed

### HIPAA / SOC2

- **Audit trail**: Immutable, cryptographically signed (via Forge)
- **Encryption**: In transit (TLS) and at rest (AES-256 by Forge)
- **Access control**: By Jira org admin only; no delegation

## Security Patches

Vulnerabilities should be reported privately via:

**Email**: security@firstry.io (if available; contact maintainers for actual contact)

Response time target: 48 hours for critical issues, 2 weeks for moderate.

---

## 5. Threat Model

FirstTry is a **zero-touch, read-only** Atlassian Forge app with minimal attack surface:

### 5.1 In Scope Threats (FirstTry Responsibility)

- **Input Validation**: FirstTry validates all Jira API responses
- **Output Redaction**: FirstTry redacts sensitive data before logging
- **Workspace Isolation**: Structural isolation via Forge app scope

### 5.2 Out of Scope (Atlassian Responsibility)

- **Encryption at Rest**: Managed by Atlassian Forge
- **Network Security**: Handled by Atlassian infrastructure
- **Access Control**: Jira admin permissions determine FirstTry access
- **Data Residency**: Determined by Jira Cloud region

### 5.3 Security Assumptions

1. Jira Admin portal access controls are effective
2. Atlassian Forge infrastructure is secure
3. Network path to Jira Cloud is secure
4. Customer environments are not compromised

---

- [Shakedown Test Harness](./SHAKEDOWN.md)
