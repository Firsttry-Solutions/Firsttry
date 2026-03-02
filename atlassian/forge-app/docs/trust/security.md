# Security Overview

**Last updated: 2026-03-02**

> This document provides a security overview for FirstTry. For comprehensive technical details, see **[SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md)** and **[THREAT_MODEL.md](THREAT_MODEL.md)**.

## Security controls

FirstTry implements defense-in-depth security:

- **Forge platform isolation**: Runs in Atlassian's sandboxed Forge environment
- **Read-only by default**: All Jira API access uses read-only scopes
- **Deterministic processing**: Reproducible outputs for audit trail integrity
- **Fail-closed architecture**: Any security violation terminates immediately

**Note:** External URL patterns detected in source code are used for input validation (see Outbound Egress section below for details).

## Data isolation

- **Per-tenant storage**: All data isolated using Forge tenant keys
- **No cross-tenant access**: Tenant context enforced at platform level
- **No shared state**: Each scan execution is isolated
- **Memory isolation**: Stateless functions prevent data leakage

See **[Access Scope & Permissions](access-scope-and-permissions.md)** for scope details.

## Encryption

Data in transit and at rest is protected by Atlassian Cloud / Forge platform controls (e.g., TLS in transit; platform-managed encryption at rest). This app does not implement custom cryptography.

- **In-transit**: All communication over TLS 1.2+ (enforced by Atlassian)
- **At-rest**: Forge storage encrypted by Atlassian platform
- **No encryption keys managed**: Fully delegated to Forge platform

## Logging

- **Audit trail**: All scan executions logged with timestamps
- **No PII in logs**: Logs contain only metadata (timestamps, entity counts)
- **Forge platform logs**: Managed by Atlassian, not accessible to FirstTry team
- **Customer-side logging**: Jira audit logs capture all API access

## Responsible disclosure

We follow coordinated vulnerability disclosure:

1. **Report security issues**: See [Vulnerability Disclosure](vulnerability-disclosure.md)
2. **90-day disclosure timeline**: Work with us to fix issues before public disclosure
3. **Safe harbor**: Good-faith testing will not result in legal action
4. **Recognition**: Hall of fame for security researchers (optional)

---

**For comprehensive technical details, see:**
- [SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md) - Full security architecture
- [THREAT_MODEL.md](THREAT_MODEL.md) - Threat analysis and mitigations
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture

<!-- BEGIN: GENERATED_FACTS -->
### Outbound Egress (Generated)

**Runtime external URL literals in src/:** 90

**Offline source scan (as of 2026-03-02):** Detected 90 external URL literal(s) in src/ (see evidence: /tmp/ft_marketplace_trustfacts_20260302T081657Z_19103/verifiers/01_scan/runtime_urls.txt).

**Classification:** URL literals found in src/resolvers/phase2_config.ts are input validation patterns (ALLOWED_WEBHOOK_ORIGINS), not actual egress endpoints. Actual external service URLs, if configured, are provided via environment/Forge storage, not hardcoded.

**Note:** This scan detects literal strings only. Dynamic URL construction or environment-based configuration is not detected.

### Security Contact (Generated)

**Security inquiries/reports:** security@firsttry.solutions

For vulnerability reports, see [Vulnerability Disclosure Policy](vulnerability-disclosure.md).
<!-- END: GENERATED_FACTS -->
