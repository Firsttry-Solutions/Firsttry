# Security Documentation

**App Name**: FirstTry Governance - Atlassian Dual-Layer Integration  
**Last Updated**: 2025-12-22  
**Classification**: Security Disclosure (Truth-Only)  

---

## Security Model

### Platform Trust Boundary

This Forge app delegates **all** security enforcement to the Atlassian Forge platform:

1. **Authentication**: Forge runtime provides identity (no app-level auth)
2. **Authorization**: Manifest scopes enforced by Forge (read-only Jira access)
3. **Network Isolation**: Forge sandbox prevents arbitrary outbound calls
4. **Storage Encryption**: Forge Storage API handles encryption at rest
5. **Tenant Isolation**: cloudId-scoped storage enforced by Forge

**App Responsibility**: Application logic only (no security primitives implemented)

**Platform Responsibility**: All security controls (authentication, encryption, isolation)

---

## Threat Model

### Threats MITIGATED by Forge Platform

✅ **Cross-Tenant Data Leakage**: Forge enforces cloudId-scoped storage  
✅ **Unauthorized API Access**: Forge enforces manifest scopes  
✅ **Man-in-the-Middle**: Forge handles TLS for all network requests  
✅ **Data Exfiltration**: Network sandbox prevents external egress  
✅ **Credential Theft**: No credentials stored in app code or storage  

### Threats NOT MITIGATED (Out of Scope)

❌ **Jira Admin Abuse**: Jira admins have full access to app data (by design)  
❌ **Forge Platform Vulnerabilities**: Trust delegated to Atlassian  
❌ **Phishing**: User authentication is Atlassian's responsibility  
❌ **DDoS**: Platform-level concern (Atlassian infrastructure)  
❌ **Insider Threats**: No app-level audit trail of Forge platform actions  

---

## Security Features

### What This App DOES

1. **Read-Only Jira Access**: No write/modify/delete operations on Jira data
2. **Zero External Egress**: No outbound network calls to third parties (see [EXTERNAL_APIS.md](EXTERNAL_APIS.md))
3. **Disclosure Envelopes**: Transparent reporting of missing/incomplete data
4. **Tenant Isolation by Design**: All storage keys include cloudId prefix

### What This App DOES NOT DO

- **No Encryption**: Relies entirely on Forge Storage API encryption
- **No Authentication**: Delegates to Forge/Atlassian SSO
- **No Audit Logging**: Platform-level logs only (not accessible to app)
- **No Secret Management**: No API keys, tokens, or credentials managed

---

## Responsible Disclosure

### Reporting Security Vulnerabilities

**DO NOT** open public GitHub issues for security vulnerabilities.

**Contact Method**: GitHub Security Advisory  
**URL**: https://github.com/Global-domination/Firstry/security/advisories/new  

**Expected Response**:
- **Acknowledgment**: Best effort within 7 days
- **Investigation**: UNKNOWN timeframe
- **Fix Timeline**: UNKNOWN (depends on severity and maintainer availability)
- **Disclosure Coordination**: Will coordinate with reporter before public disclosure

**No Bug Bounty Program**

---

## Known Security Limitations

### 1. PII Logging

**Status**: UNKNOWN

Static scans show logging statements in src/. Runtime behavior requires verification.

**Mitigation**: See GAP-1 tests ([gap1_pii_logging.test.ts](../tests/credibility/gap1_pii_logging.test.ts)) for PII detection patterns.

### Logging and PII handling (clarification)

- App-level logging: The repository does not implement a centralized app-level audit log. Static scans find logging statements in `src/` but the behavior and retention of logs in production are not documented.
- PII in logs: The code and `DATA_RETENTION.md` assert that PII is not stored (no email addresses, account names). However, static scans may find logging statements; reviewers should assume PII-in-logs is UNKNOWN until runtime review. See tests `gap1_pii_logging.test.ts` for detection coverage.
- Log retention: Not documented (UNKNOWN). Additions to `SECURITY.md` or operations runbook should specify log retention and redaction policies.

### 2. Storage Quota Behavior

**Status**: PLATFORM-DEPENDENT

Forge Storage API quota limits are undocumented by Atlassian.

**Risk**: Storage exhaustion may cause silent failures.

**Mitigation**: Disclosure envelopes include `missingDataList` on quota errors.

### 3. Concurrency Guarantees

**Status**: UNKNOWN

Idempotency design exists but concurrent execution not verified without Forge runtime.

**Mitigation**: See GAP-4 tests ([gap4_concurrency_idempotency.test.ts](../tests/credibility/gap4_concurrency_idempotency.test.ts)).

---

## Compliance & Certifications

### What This App DOES NOT CLAIM

❌ **NO SOC 2 Certification**  
❌ **NO ISO 27001 Certification**  
❌ **NO Cloud Fortified Status**  
❌ **NO GDPR Compliance Certification** (GDPR obligations delegated to Atlassian)  
❌ **NO HIPAA Compliance** (not designed for PHI)  

### Platform Compliance Inheritance

Atlassian Forge platform has its own compliance certifications. See:
- https://www.atlassian.com/trust/compliance

This app **inherits** Forge platform compliance posture but makes **no independent claims**.

---

## Data Security

### Data at Rest

**Encryption**: Provided by Forge Storage API  
**Algorithm**: UNKNOWN (Atlassian-controlled)  
**Key Management**: UNKNOWN (Atlassian-controlled)  

**App does NOT**:
- Implement encryption
- Manage encryption keys
- Control encryption algorithms

### Data in Transit

**TLS Version**: UNKNOWN (Forge platform-controlled)  
**Cipher Suites**: UNKNOWN (Forge platform-controlled)  
**Certificate Management**: Atlassian-controlled  

**App does NOT**:
- Terminate TLS
- Configure TLS settings
- Manage certificates

### Data Residency

**Storage Location**: UNKNOWN (Forge Storage API location)  
**Data Sovereignty**: Governed by customer's Atlassian Cloud region  

See [PLATFORM_DEPENDENCIES.md](PLATFORM_DEPENDENCIES.md) for Forge infrastructure details.

---

## Security Testing

### Static Analysis

✅ **Network Egress Scan**: Zero external calls (see [EXTERNAL_APIS.md](EXTERNAL_APIS.md))  
✅ **PII Detection Patterns**: Canonical patterns tested (email, accountId, JWT, secrets)  

### Dynamic Testing

⚠️ **UNKNOWN**: Full security testing requires Forge production runtime  

See [tests/credibility/](../tests/credibility/) for test infrastructure.

---

## Incident Response

For security incident handling, see [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md).

---

## Security Updates

**Update Mechanism**: Manual Forge app redeployment  
**Notification**: GitHub repository releases + security advisories  
**Customer Action Required**: Jira admins must approve Forge app updates  

**NO AUTOMATIC SECURITY PATCHING**

---

## Third-Party Dependencies

**Direct Dependencies**: ZERO (see [package.json](../package.json))  
**Platform Dependencies**: Forge runtime, Jira REST API (see [PLATFORM_DEPENDENCIES.md](PLATFORM_DEPENDENCIES.md))  

**Supply Chain Risk**: Limited to Forge platform trust.

---

## Audit Trail

**App-Level Logging**: UNKNOWN (no explicit audit log implementation)  
**Platform Logging**: Forge runtime logs (not accessible to app developers)  
**Customer Visibility**: Jira audit log records app actions (Atlassian-provided)  

**App does NOT provide**:
- Audit log export
- Log retention guarantees
- Log integrity verification

---

## Security Contacts

**Vulnerability Reports**: https://github.com/Global-domination/Firstry/security/advisories/new  
**General Security Questions**: https://github.com/Global-domination/Firstry/issues (public)  

**NO EMAIL SUPPORT**

---

## Disclaimer

This document describes security properties **as implemented**. No guarantees are provided.

Security is a shared responsibility:
- **Atlassian**: Platform security (auth, encryption, isolation)
- **App Maintainers**: Application logic security (read-only access, disclosure)
- **Customer**: Jira admin access control, data governance policies

See LICENSE for warranty disclaimer.
