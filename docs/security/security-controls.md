# Security Controls — FirstTry Atlassian Forge App

**Last Updated**: January 5, 2026  
**Audience**: Enterprise Security Teams, CISO, Marketplace Reviewers

---

## Overview

FirstTry's security posture is provided through:

1. **Physical Controls** — Delegated to Atlassian (Forge infrastructure)
2. **Technical Controls** — Enforced by Forge runtime + FirstTry application code
3. **Administrative Controls** — Absence of admin/human access to app systems

This document maps security controls to their owner and implementation method.

---

## 1. Physical Security Controls (Atlassian-Managed)

FirstTry runs on Atlassian Forge, which is hosted on AWS or equivalent managed cloud infrastructure. Physical security is delegated entirely to Atlassian.

| Control | Owner | Implementation | Assurance |
|---------|-------|---|---|
| **Data center access control** | Atlassian | AWS physical security (locked facilities) | ✅ Delegated |
| **Environmental controls** | Atlassian | AWS HVAC, fire suppression, environmental monitoring | ✅ Delegated |
| **Backup & disaster recovery** | Atlassian | AWS multi-region replication, automated backups | ✅ Delegated |
| **Facility monitoring** | Atlassian | CCTV, access logs, 24/7 monitoring | ✅ Delegated |

**Responsibility**: Atlassian is responsible for physical infrastructure security. FirstTry inherits Atlassian's physical security posture (covered under Atlassian Cloud agreement, SOC 2, etc.).

**Verification**: Atlassian's infrastructure certifications:
- SOC 2 Type II (audit available under NDA)
- ISO 27001 (certification available)
- AWS Compliance (AWS shared responsibility model applies)

---

## 2. Technical Controls (Forge + FirstTry Implementation)

### 2.1 Encryption at Rest

| Control | Owner | Implementation | Status |
|---------|-------|---|---|
| **Storage encryption** | Atlassian Forge | AES-256 in AWS (Forge platform standard) | ✅ IMPLEMENTED |
| **Encryption key management** | Atlassian Forge | AWS KMS (Atlassian-managed keys) | ✅ IMPLEMENTED |
| **Storage isolation per workspace** | Atlassian Forge | Workspace-scoped storage namespace (Forge API) | ✅ IMPLEMENTED |

**Implementation Details**:
- FirstTry uses `@forge/api storage` to read/write governance metrics
- Atlassian Forge automatically encrypts all storage values
- FirstTry cannot access storage keys outside its workspace (Forge enforces via API)
- No FirstTry-specific encryption needed; platform default applies

**Verification**: `src/resolvers/governance_status.ts` lines 37-45 use Forge storage API (no direct database access)

---

### 2.2 Encryption in Transit

| Control | Owner | Implementation | Status |
|---------|-------|---|---|
| **HTTPS for Jira API calls** | Atlassian | TLS 1.2+ enforced | ✅ IMPLEMENTED |
| **HTTPS for Forge API calls** | Atlassian | TLS 1.2+ enforced | ✅ IMPLEMENTED |
| **No cleartext credentials in logs** | FirstTry | Log redaction (verified by tests) | ✅ IMPLEMENTED |

**Implementation Details**:
- FirstTry makes Jira API calls only via Atlassian @atlassian/jira-api-sdk (TLS built-in)
- FirstTry makes Forge storage calls only via @forge/api (TLS built-in)
- No FirstTry code creates unencrypted connections
- OAuth tokens are stored in Forge storage (encrypted by Forge)

**Verification**: 
- `src/resolvers/governance_status.ts` uses Atlassian SDKs (TLS enforced)
- `tests/p1_logging_safety.test.ts` verifies no tokens in logs

---

### 2.3 Authentication & Authorization

| Control | Owner | Implementation | Status |
|---------|-------|---|---|
| **Jira API authentication** | Atlassian | OAuth 2.0 (Forge handles token refresh) | ✅ IMPLEMENTED |
| **Workspace-scoped access** | Atlassian Forge | Forge API enforces single-workspace scope | ✅ IMPLEMENTED |
| **No API key/password exposure** | FirstTry | Tokens handled by Forge, not by FirstTry code | ✅ IMPLEMENTED |
| **No hardcoded credentials** | FirstTry | Zero hardcoded secrets in code/manifest | ✅ VERIFIED |

**Implementation Details**:
- FirstTry does not manage OAuth tokens; Atlassian Forge handles refresh automatically
- Workspace scope enforced by Forge runtime (no configuration needed)
- FirstTry only reads/writes Jira data within its workspace

**Verification**: 
- Manifest `atlassian/forge-app/manifest.yml` — No hardcoded secrets
- Code audit: No `.env`, no hardcoded tokens, no credential files

---

### 2.4 Network Security

| Control | Owner | Implementation | Status |
|---------|-------|---|---|
| **No external egress** | Atlassian Forge | Scope restriction (NO `external:fetch`) | ✅ IMPLEMENTED |
| **No inbound webhooks** | Atlassian Forge | No `webTrigger` module (manifest) | ✅ IMPLEMENTED |
| **Jira API communication only** | FirstTry + Atlassian | Manifest limits scope to read:jira-work | ✅ IMPLEMENTED |
| **No port scanning or enumeration** | Atlassian Forge | Forge sandbox prevents raw socket access | ✅ IMPLEMENTED |

**Implementation Details**:
- Manifest declares NO `external:fetch` scope (Forge prevents outbound HTTP)
- Manifest declares NO `webTrigger` module (Forge prevents inbound webhooks)
- FirstTry resolver only calls Jira APIs (GET only; no mutations)

**Verification**: 
- Manifest `atlassian/forge-app/manifest.yml` — No external scopes
- Code audit `05_static_scans/STATIC_SCAN_SUMMARY.md` — No external URLs

---

### 2.5 Data Protection (Application Level)

| Control | Owner | Implementation | Status |
|---------|-------|---|---|
| **No PII logging** | FirstTry | Log redaction + anonymization | ✅ IMPLEMENTED |
| **No email/user ID storage** | FirstTry | Application design (metadata only) | ✅ IMPLEMENTED |
| **User ID hashing** | FirstTry | SHA256 before storage (audit correlation only) | ✅ IMPLEMENTED |
| **Field value redaction** | FirstTry | Issue description/comment text not stored | ✅ IMPLEMENTED |

**Implementation Details**:
- `src/core/anonymizer.ts` — Hashes user IDs before any logging
- `src/resolvers/governance_status.ts` — Stores aggregated metrics only (no raw issue data)
- Tests verify: `tests/p1_logging_safety.test.ts` — No PII detected in log output

**Verification**: 
- Code inspection: No `console.log()` of user emails or IDs
- Test suite confirms anonymization logic

---

### 2.6 Code Security

| Control | Owner | Implementation | Status |
|---------|-------|---|---|
| **Dependency vulnerability scanning** | FirstTry + npm | npm audit in CI pipeline | ✅ IMPLEMENTED |
| **No unvetted npm packages** | FirstTry | Minimal dependencies, all Atlassian-official | ✅ IMPLEMENTED |
| **Input validation** | FirstTry | Jira API responses validated before storage | ✅ IMPLEMENTED |
| **No SQL injection risk** | FirstTry | Uses Atlassian APIs (not raw SQL) | ✅ IMPLEMENTED |
| **No XSS risk in dashboard** | FirstTry | React/JSX escaping + CSP headers from Forge | ✅ IMPLEMENTED |

**Implementation Details**:
- CI pipeline runs `npm audit` on every build (fails on high/critical vulnerabilities)
- Dependencies limited to: @forge/api, @atlassian/jira-api-sdk, React (official)
- No user input processed without validation

**Verification**: 
- `.github/workflows/` — npm audit step in CI
- `package.json` — All dependencies pinned to minor version (not latest)

---

## 3. Administrative Controls (Absence of Access)

### 3.1 Human Access Control

| Control | Owner | Implementation | Status |
|---------|-------|---|---|
| **No FirstTry backend admin access** | FirstTry Design | No admin panel, no SSH, no database access | ✅ N/A |
| **No customer data access by humans** | FirstTry Design | Resolver runs automatically; no manual ops | ✅ N/A |
| **No backup/restore procedures** | Atlassian | Handled by Forge infrastructure | ✅ N/A |
| **No credential escrow** | Atlassian | OAuth tokens managed by Forge | ✅ N/A |

**Rationale**: FirstTry is a fully automated app running on Atlassian Forge. No humans have direct access to:
- Jira data processed by FirstTry
- Forge storage contents
- OAuth credentials
- Resolver execution environment

---

### 3.2 Audit & Logging

| Control | Owner | Implementation | Status |
|---------|-------|---|---|
| **Jira action audit log** | Atlassian Jira | All API reads logged in Jira (admin audit) | ✅ DELEGATED |
| **Forge platform logs** | Atlassian Forge | Execution logs available to app admins | ✅ DELEGATED |
| **FirstTry debug logs** | FirstTry | Console logs (no PII; Forge retains) | ✅ IMPLEMENTED |

**Implementation Details**:
- Jira Cloud tracks all app API calls in workspace audit log (Atlassian responsibility)
- FirstTry logs resolver execution (errors, metrics) to Forge logs
- App admins can view Forge logs via Atlassian CLI (`forge logs`)

**Verification**: No PII in logs (verified by test suite)

---

### 3.3 Incident Response

| Control | Owner | Implementation | Status |
|---------|-------|---|---|
| **Security event reporting** | FirstTry | contact@firsttry.run for vulnerabilities | ✅ IMPLEMENTED |
| **Vulnerability disclosure policy** | FirstTry | See `docs/SECURITY.md` | ✅ IMPLEMENTED |
| **Data breach notification** | Atlassian | Covered under Atlassian Cloud agreement | ✅ DELEGATED |

**Timeline**:
- CRITICAL vulnerabilities: Fix within 24 hours; release ASAP
- HIGH: Fix within 1-2 weeks
- MEDIUM/LOW: Fix in next planned release

---

## 4. Control Summary Matrix

| Category | Control | Owner | Status | Notes |
|----------|---------|-------|--------|-------|
| **Physical** | Data center access | Atlassian | ✅ | Delegated to Atlassian/AWS |
| **Physical** | Backup & DR | Atlassian | ✅ | AWS multi-region |
| **Technical** | Encryption at rest | Atlassian Forge | ✅ | AES-256 |
| **Technical** | Encryption in transit | Atlassian + TLS | ✅ | TLS 1.2+ |
| **Technical** | Authentication | Atlassian OAuth | ✅ | Forge handles tokens |
| **Technical** | Authorization | Atlassian Forge | ✅ | Workspace scope enforced |
| **Technical** | Network isolation | Atlassian Forge | ✅ | No external:fetch scope |
| **Technical** | PII protection | FirstTry code | ✅ | No PII logged/stored |
| **Technical** | Dependency security | FirstTry CI | ✅ | npm audit required |
| **Administrative** | Human access control | FirstTry design | ✅ | N/A (fully automated) |
| **Administrative** | Audit logging | Atlassian + FirstTry | ✅ | Jira audit + Forge logs |
| **Administrative** | Incident response | FirstTry | ✅ | Security contact provided |

---

## 5. Residual Risk Assessment

| Risk | Severity | Mitigation | Residual |
|------|----------|-----------|----------|
| **Forge platform compromise** | Medium | Attestation to Atlassian's security practices | ⚠️ **INHERITED** |
| **Jira Cloud compromise** | Medium | Attestation to Atlassian's security practices | ⚠️ **INHERITED** |
| **AWS infrastructure breach** | Low | Atlassian's SOC 2 & ISO 27001 certifications | ⚠️ **INHERITED** |
| **npm supply chain attack** | Low | Minimal dependencies; npm audit in CI | ✅ **MITIGATED** |
| **OAuth token theft** | Low | Tokens managed by Forge (not by FirstTry) | ✅ **MITIGATED** |
| **Data exfiltration** | Low | No external:fetch scope (Forge enforces) | ✅ **ELIMINATED** |
| **Data mutation** | Low | No write scopes (Forge enforces) | ✅ **ELIMINATED** |

---

## 6. Control Testing & Verification

### Automated Testing
- ✅ `npm audit` in CI (dependency vulnerability scanning)
- ✅ Unit tests verify no PII in logs (`tests/p1_logging_safety.test.ts`)
- ✅ Static analysis confirms no external URLs or write methods

### Code Audit
- ✅ Manifest audit: No unauthorized scopes
- ✅ Resolver audit: GET-only, no mutations
- ✅ Storage audit: Workspace-scoped keys only

### Attestation
- ✅ Atlassian Forge platform (SOC 2, ISO 27001, AWS Compliance)
- ✅ Jira Cloud security posture (covered under Jira Cloud agreement)

---

## 7. Contact for Security Questions

**Security Email**: contact@firsttry.run  
**Subject**: Include "Security Question" or "Vulnerability Report"

---

## Attestation Statement

FirstTry's security controls are implemented as described in this document as of January 5, 2026.

- ✅ **Physical controls delegated to Atlassian**: Verified by infrastructure choice (Forge)
- ✅ **Technical controls implemented**: Verified by code audit and manifest review
- ✅ **Administrative controls in place**: Verified by design (no human access)

---

## Changes to This Document

Security control details are updated when:
- FirstTry adds new scopes or functionality
- Atlassian changes Forge platform security characteristics or capabilities
- Vulnerabilities are discovered and fixed

Last reviewed: January 5, 2026
