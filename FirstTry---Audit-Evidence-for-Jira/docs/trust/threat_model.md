# FirstTry Threat Model

**Version:** 2.14.0  
**Last Updated:** March 4, 2026  
**Status:** Active

## 1. Overview

This document provides a comprehensive threat model for the FirstTry Forge application, identifying potential security threats, attack vectors, and mitigations.

## 2. System Description

**FirstTry** is an Atlassian Forge application providing audit evidence and governance capabilities for Jira Cloud.

**Key Properties:**
- Read-only permissions (`read:jira-work`, `storage:app`)
- No external network egress
- Runs within Atlassian's infrastructure
- Isolated per-installation storage

## 3. Assets

### 3.1 Data Assets

| Asset | Sensitivity | Owner | Protection |
|-------|-------------|-------|------------|
| Jira issue metadata | Medium | Customer | Read-only access, inherits Jira permissions |
| Snapshot data | Low | FirstTry | Encrypted Forge storage per-installation |
| User session | High | Atlassian | OAuth 2.0, managed by Forge Bridge |
| Configuration | Low | Customer | Encrypted storage, deleted on uninstall |

### 3.2 System Assets

| Asset | Value | Protection |
|-------|-------|------------|
| Forge app credentials | High | Managed by Atlassian, not exposed to app code |
| Source code | Medium | Private GitHub repository, access controlled |
| Evidence packs | Medium | SHA256 manifests, offline verification |

## 4. Trust Boundaries

### 4.1 Boundary Map

```
┌─────────────────────────────────────────────────────────┐
│  TRUST BOUNDARY 1: Atlassian Cloud (TRUSTED)            │
│                                                           │
│  ┌───────────

────────────────────────────────────┐  │
│  │  TRUST BOUNDARY 2: FirstTry App (TRUSTED)   │  │
│  │                                               │  │
│  │  ├─ Dashboard Gadget (Custom UI)            │  │
│  │  ├─ Resolver Functions                      │  │
│  │  └─ Forge Storage                           │  │
│  └───────────────────────────────────────────────┘  │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Jira Platform (TRUSTED)                          │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│  UNTRUSTED: User Browser                                 │
└─────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│  UNTRUSTED: External Internet (NO ACCESS)                │
└─────────────────────────────────────────────────────────┘
```

## 5. Threats

### 5.1 Data Exfiltration (STRIDE: Information Disclosure)

**Threat ID:** T1  
**Description:** Attacker attempts to export Jira data to external system.

**Attack Vectors:**
- Malicious code injected via dependency
- Compromised developer account
- Forge runtime vulnerability

**Impact:** High (customer data breach)  
**Likelihood:** Low

**Mitigations:**
1. No external network egress (enforced by Forge)
2. Marketplace audit scans for `fetch()`, `axios`, `http://`
3. Dependency vulnerability scanning (`npm audit`)
4. Code review required for all changes
5. Forge Marketplace security review

**Residual Risk:** Low

---

### 5.2 Privilege Escalation (STRIDE: Elevation of Privilege)

**Threat ID:** T2  
**Description:** User accesses Jira data beyond their authorized permissions.

**Attack Vectors:**
- Forge Bridge API misuse
- Resolver function bypassing Jira permissions
- Cross-tenant data access (storage isolation failure)

**Impact:** High (unauthorized access)  
**Likelihood:** Low

**Mitigations:**
1. Forge Bridge inherits user's Jira context automatically
2. Read-only permissions (cannot modify data)
3. Per-installation storage isolation (Forge platform)
4. No custom authentication (relies on Atlassian OAuth)

**Residual Risk:** Low

---

### 5.3 Code Injection (STRIDE: Tampering)

**Threat ID:** T3  
**Description:** Attacker injects malicious JavaScript via input fields.

**Attack Vectors:**
- XSS in Custom UI
- SQL injection in storage queries
- Command injection in resolver functions

**Impact:** Medium (session hijacking, data theft)  
**Likelihood:** Low

**Mitigations:**
1. React auto-escaping for all user input
2. Content Security Policy (CSP) enforced by Forge
3. No `eval()` or `Function()` constructors
4. Input validation on all user-provided data
5. Forge Storage API (no raw SQL)

**Residual Risk:** Low

---

### 5.4 Supply Chain Attack (STRIDE: Tampering)

**Threat ID:** T4  
**Description:** Malicious dependency introduced via npm packages.

**Attack Vectors:**
- Compromised npm package
- Typosquatting attack
- Dependency confusion

**Impact:** High (full app compromise)  
**Likelihood:** Medium

**Mitigations:**
1. Minimal dependencies (reduces attack surface)
2. `npm audit` in CI/CD pipeline
3. `package-lock.json` ensures reproducible builds
4. Dependency review for major updates
5. Forge Marketplace submission review

**Residual Risk:** Medium (requires ongoing monitoring)

---

### 5.5 Evidence Tampering (STRIDE: Tampering)

**Threat ID:** T5  
**Description:** Attacker modifies evidence packs to hide test failures.

**Attack Vectors:**
- File modification after generation
- Manifest manipulation
- Hash collision attack

**Impact:** Medium (false evidence of compliance)  
**Likelihood:** Low

**Mitigations:**
1. SHA256 manifest of all files
2. Pack hash (SHA256 of manifest)
3. Offline verification (recompute hashes)
4. Canonical JSON (deterministic output)
5. Evidence packs stored in `/tmp` (ephemeral)

**Residual Risk:** Low

---

### 5.6 Denial of Service (STRIDE: Denial of Service)

**Threat ID:** T6  
**Description:** Attacker exhausts Forge resources to disrupt service.

**Attack Vectors:**
- Scheduled trigger abuse (infinite loops)
- Large storage writes
- Excessive resolver calls

**Impact:** Medium (service unavailability)  
**Likelihood:** Low

**Mitigations:**
1. Forge runtime timeout limits (60 seconds max)
2. Storage quota limits (Forge platform)
3. Rate limiting (Forge platform)
4. Scheduled triggers limited to daily/weekly

**Residual Risk:** Low

---

### 5.7 Cross-Site Request Forgery (STRIDE: Spoofing)

**Threat ID:** T7  
**Description:** Attacker tricks user into making unintended requests.

**Attack Vectors:**
- Malicious link clicked by user
- Embedded iframe on external site

**Impact:** Low (read-only app, no state changes)  
**Likelihood:** Low

**Mitigations:**
1. Forge Bridge CSRF protection
2. Read-only permissions (no destructive actions)
3. Custom UI runs in Jira iframe (same-origin policy)

**Residual Risk:** Very Low

---

## 6. Threat Summary

| Threat ID | Threat | Impact | Likelihood | Residual Risk |
|-----------|--------|--------|------------|---------------|
| T1 | Data Exfiltration | High | Low | Low |
| T2 | Privilege Escalation | High | Low | Low |
| T3 | Code Injection | Medium | Low | Low |
| T4 | Supply Chain Attack | High | Medium | Medium |
| T5 | Evidence Tampering | Medium | Low | Low |
| T6 | Denial of Service | Medium | Low | Low |
| T7 | CSRF | Low | Low | Very Low |

**Overall Risk Posture:** Low

---

## 7. Security Requirements

### 7.1 Functional Requirements

| Requirement | Priority | Implementation |
|-------------|----------|----------------|
| FR-1: Read-only Jira access | Critical | Manifest scopes: `read:jira-work` only |
| FR-2: No external egress | Critical | No `fetch()` to external domains |
| FR-3: Encrypted storage | High | Forge Storage API (AES-256) |
| FR-4: Tamper-evident evidence | High | SHA256 manifests + pack hash |
| FR-5: Offline verification | Medium | Verifier script (`verify_reviewer_proof_pack.sh`) |

### 7.2 Non-Functional Requirements

| Requirement | Priority | Implementation |
|-------------|----------|----------------|
| NFR-1: Performance | Medium | Resolver < 500ms response time |
| NFR-2: Availability | High | Inherits Atlassian SLA (99.9%) |
| NFR-3: Scalability | Medium | Serverless (automatic scaling) |
| NFR-4: Auditability | High | Evidence packs with full forensics |

## 8. Assumptions

1. **Atlassian infrastructure is trusted:** FirstTry inherits Atlassian's security posture (SOC 2, ISO 27001)
2. **Forge runtime is secure:** Atlassian maintains Forge platform security
3. **User browsers are not compromised:** XSS protections assume benign browser
4. **Network is encrypted:** HTTPS/TLS enforced by Atlassian
5. **Dependencies are reviewed:** npm packages undergo basic security review

## 9. Out of Scope

The following threats are **not** in scope for this threat model:

- **Physical security:** Atlassian datacenter security
- **Network security:** Atlassian network infrastructure
- **DDoS attacks:** Handled by Atlassian CDN/WAF
- **Insider threats:** Atlassian employee access
- **Social engineering:** User account compromise

These are addressed by Atlassian's security program.

## 10. References

- [Atlassian Trust Center](https://www.atlassian.com/trust)
- [Forge Security](https://developer.atlassian.com/platform/forge/security/)
- [STRIDE Threat Modeling](https://docs.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats)
- FirstTry Security Whitepaper: `docs/trust/security_whitepaper.md`

---

**Threat Model Owner:** FirstTry Security Team  
**Next Review:** 2026-06-04
