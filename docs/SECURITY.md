# FirstTry Security Model

## Overview

FirstTry implements a zero-touch, tenant-isolated security model. No user configuration is required. Security controls are enforced automatically at the framework level.

## Threat Model

### In Scope

- **Unauthorized data access**: Tenant data is isolated; one tenant cannot access another's data
- **Policy injection**: Policies cannot be modified after creation; ruleset registry is immutable
- **Audit tampering**: All policy evaluations are logged with immutable audit trail
- **Jira API credential exposure**: API credentials are managed by Forge platform (no FirstTry involvement)

### Out of Scope

- **Jira Cloud compromises**: Jira itself is compromised (first-party Atlassian responsibility)
- **Forge platform infrastructure**: Forge container is compromised (Atlassian responsibility)
- **Network interception**: TLS/HTTPS handled by Jira Cloud and Forge platform

## Tenant Isolation

Each tenant's data (policies, entitlements, usage metrics) is stored in isolated Forge storage with the following properties:

- **Storage keys are tenant-scoped**: Forge storage automatically prefixes all keys with tenant ID
- **No cross-tenant lookup**: FirstTry never queries storage keys from other tenants
- **No shared caches**: All caches are per-tenant, cleared on tenant removal
- **Audit correlation**: All audit events include tenant context for forensic separation

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

## Related Policies

- [Privacy Policy](./PRIVACY.md)
- [Reliability SLAs](./RELIABILITY.md)
- [Shakedown Test Harness](./SHAKEDOWN.md)
