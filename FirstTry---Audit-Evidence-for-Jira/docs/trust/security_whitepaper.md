# FirstTry Security Whitepaper

**Document Version:** 1.0  
**Last Updated:** March 4, 2026  
**Classification:** Public

## Executive Summary

FirstTry is an Atlassian Forge application that provides audit evidence and governance capabilities for Jira Cloud. This whitepaper describes the security architecture, data handling practices, threat model, and risk mitigation strategies employed by FirstTry.

**Key Security Properties:**
- **Read-only architecture:** No write permissions to Jira data
- **No external egress:** All operations confined to Atlassian infrastructure
- **Deterministic evidence:** Tamper-evident proof packs with SHA256 manifests
- **Offline verification:** Evidence can be validated without network access
- **Fail-closed design:** System defaults to secure state on error

---

## 1. System Architecture

### 1.1 Deployment Model

FirstTry runs as an **Atlassian Forge application** within the Atlassian Cloud infrastructure:

```
┌─────────────────────────────────────────────────────────┐
│          Atlassian Cloud (Jira)                          │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  FirstTry Forge App                              │   │
│  │                                                    │   │
│  │  ├─ Dashboard Gadget (Custom UI)                 │   │
│  │  ├─ Resolver Functions (Node.js 20.x)            │   │
│  │  ├─ Scheduled Triggers (drift monitor)           │   │
│  │  └─ Lifecycle Handlers (install/upgrade)         │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                                │
│                          ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Forge Storage (encrypted at rest)               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  Security Boundary: Atlassian-managed infrastructure     │
└─────────────────────────────────────────────────────────┘
```

**Key Characteristics:**
- **Hosted:** Runs entirely within Atlassian's infrastructure
- **Sandboxed:** Forge runtime isolates apps from each other
- **No SSH/shell access:** Code runs in managed Node.js runtime
- **Constrained:** Limited to Forge APIs (no arbitrary network calls)

### 1.2 Components

#### Dashboard Gadget
- **Technology:** Custom UI built with React + Vite
- **Rendering:** Client-side rendering within Jira dashboard
- **Communication:** Forge Bridge API (secure iframe messaging)
- **Data access:** Read-only via resolver functions

#### Resolver Functions
- **Runtime:** Node.js 20.x (managed by Atlassian)
- **Purpose:** Fetch snapshot data from Forge storage
- **Permissions:** `read:jira-work`, `storage:app`
- **Execution:** Serverless (cold start ~100-300ms)

#### Scheduled Triggers
- **Frequency:** Daily drift monitor, weekly snapshot
- **Purpose:** Background governance checks
- **Storage:** Results stored in Forge storage
- **Isolation:** No cross-tenant access

### 1.3 Data Flow

```
User Browser
    │
    ├──► Jira Dashboard (HTTPS)
    │         │
    │         ├──► FirstTry Gadget (Custom UI iframe)
    │         │         │
    │         │         └──► Forge Resolver (read-only query)
    │         │                   │
    │         │                   └──► Forge Storage (encrypted)
    │         │
    │         └──► Jira API (internal, Atlassian-managed)
    │
    └──► (No external egress - all data stays within Atlassian Cloud)
```

**Data never leaves Atlassian infrastructure.**

---

## 2. Security Controls

### 2.1 Access Control

#### Forge Permissions Model

FirstTry uses **least-privilege permissions**:

| Permission | Purpose | Scope |
|-----------|---------|-------|
| `read:jira-work` | Read Jira issues, projects, boards | Read-only, scoped to user's Jira access |
| `storage:app` | Store snapshot data | Encrypted Forge storage (per-installation) |

**No write permissions:**
- Cannot create/modify/delete Jira issues
- Cannot add users or change permissions  
- Cannot export data externally
- Cannot make arbitrary network calls

#### Authentication & Authorization

- **User authentication:** Handled by Atlassian (OAuth 2.0)
- **Session management:** Forge Bridge manages user context
- **Authorization:** Inherits Jira's permission model (user sees only what they're allowed to see)
- **API tokens:** Not used (Forge runtime provides authenticated context)

### 2.2 Data Protection

#### Data at Rest

**Forge Storage:**
- **Encryption:** AES-256 encryption at rest (managed by Atlassian)
- **Isolation:** Per-installation storage (tenants cannot access each other's data)
- **Backup:** Managed by Atlassian (no customer action required)
- **Location:** Stored in Atlassian datacenters (regional compliance available)

**Data stored:**
- Snapshot metadata (timestamps, run IDs)
- Governance status (drift detected, checks passed/failed)
- Configuration (feature flags, opt-in settings)

**Data NOT stored:**
- Jira issue content (read on-demand only)
- User PII beyond Jira account ID
- Credentials or API tokens
- External system data

#### Data in Transit

- **HTTPS/TLS 1.3:** All communication encrypted
- **Certificate pinning:** Forge runtime enforces Atlassian certificate trust
- **No plaintext:** Credentials never transmitted in clear text

### 2.3 Network Security

#### Egress Controls

FirstTry has **zero external network egress**:

- **No `fetch()` calls** to external domains
- **No axios/http libraries** for external APIs
- **No webhooks** to external systems
- **No DNS queries** to external hosts

**Allowed communication:**
- Forge APIs (internal to Atlassian)
- `requestJira` API (internal Jira REST calls)
- Forge Storage API (internal)

**Verification:**
See `tools/marketplace_audit/run_marketplace_readiness_v2.sh` for automated egress scanning.

#### Ingress Controls

- **No public endpoints:** App is not directly accessible from internet
- **No webhook listeners:** App does not expose HTTP endpoints
- **Custom UI only:** User interaction via Jira dashboard gadget

### 2.4 Code Integrity

#### Supply Chain Security

- **Dependencies:** Minimal dependencies (React, Forge APIs)
- **Lockfiles:** `package-lock.json` ensures reproducible builds
- **Vulnerability scanning:** `npm audit` run during CI/CD
- **Vite bundling:** UI bundle hashed and served via Forge CDN

#### Evidence Packs

**Tamper-evident proof system:**
- **SHA256 manifests:** All test artifacts hashed
- **Pack hash:** Manifest itself hashed for offline verification
- **Canonical JSON:** Deterministic output (sorted keys)
- **Offline verification:** No network required to validate evidence

**Reviewer E2E Evidence Pack:**
- Location: `tools/reviewer_e2e/proof_pack/`
- Builder: `build_reviewer_proof_pack.sh`
- Verifier: `verify_reviewer_proof_pack.sh`
- Documentation: `docs/reviewer/REVIEWER_E2E_PROOF_PACK.md`

---

## 3. Threat Model

### 3.1 Trust Boundary

```
┌─────────────────────────────────────────────────────────┐
│  TRUST BOUNDARY: Atlassian Cloud Infrastructure         │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  FirstTry App (TRUSTED)                           │  │
│  │  - Read-only Jira access                          │  │
│  │  - Isolated Forge storage                         │  │
│  │  - No external egress                             │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Jira Platform (TRUSTED)                          │  │
│  │  - User authentication                            │  │
│  │  - Permission enforcement                         │  │
│  │  - Data storage                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  UNTRUSTED: External Internet                            │
│                                                           │
│  - No communication allowed                              │
│  - No data exfiltration possible                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Threat Scenarios

#### T1: Data Exfiltration
**Threat:** Attacker attempts to export Jira data to external system.

**Mitigation:**
- No external network egress (enforced by Forge runtime)
- No `fetch()` calls to external domains
- Marketplace audit scans for unauthorized network calls
- Code review required for manifest changes

**Residual Risk:** Low (Forge runtime blocks external calls)

#### T2: Privilege Escalation
**Threat:** User attempts to access data beyond their Jira permissions.

**Mitigation:**
- Forge bridge inherits user's Jira context
- No custom authentication (relies on Atlassian OAuth)
- Read-only permissions (cannot modify Jira data)
- Jira platform enforces authorization

**Residual Risk:** Low (inherits Jira's security model)

#### T3: Code Injection
**Threat:** Attacker injects malicious code via input fields.

**Mitigation:**
- React's XSS protection (auto-escaping)
- No `eval()` or `Function()` constructors used
- Content Security Policy (CSP) enforced by Forge
- Input validation on all user-provided data

**Residual Risk:** Low (React + CSP protections)

#### T4: Supply Chain Attack
**Threat:** Malicious dependency introduced via npm packages.

**Mitigation:**
- Minimal dependencies (reduces attack surface)
- `npm audit` in CI/CD
- Lockfiles prevent unexpected updates
- Forge Marketplace review process

**Residual Risk:** Medium (requires ongoing monitoring)

#### T5: Data Tampering
**Threat:** Attacker modifies evidence packs to hide test failures.

**Mitigation:**
- SHA256 manifests detect file modifications
- Pack hash verifies manifest integrity
- Offline verification (no network required)
- Deterministic output (reproducible hashes)

**Residual Risk:** Low (cryptographic verification)

### 3.3 Attack Surface

| Component | Exposure | Attack Vector | Mitigation |
|-----------|----------|---------------|------------|
| Dashboard Gadget | User browser | XSS, CSRF | React auto-escaping, CSP, Forge iframe sandbox |
| Resolver Functions | Forge runtime | Code injection | Input validation, no `eval()` |
| Forge Storage | Forge API | Unauthorized read | Per-installation isolation |
| Scheduled Triggers | Forge runtime | Resource exhaustion | Timeout limits, rate limiting |

**Minimal attack surface:** No public endpoints, no direct internet access.

---

## 4. Compliance & Certifications

### 4.1 Atlassian Forge Security

FirstTry inherits Atlassian's security posture:

- **SOC 2 Type II:** Atlassian Cloud is SOC 2 certified
- **ISO 27001:** Information security management
- **GDPR:** EU data protection compliance
- **CCPA:** California privacy compliance
- **HIPAA:** Healthcare data protection (Atlassian)

**Reference:** [Atlassian Trust Center](https://www.atlassian.com/trust)

### 4.2 FirstTry-Specific Controls

| Control Family | Implementation | Evidence |
|----------------|----------------|----------|
| Access Control | Least-privilege Forge permissions | `manifest.yml` (scopes) |
| Data Protection | Encrypted storage, no external egress | Marketplace audit scan |
| Code Integrity | Evidence packs with SHA256 manifests | `tools/reviewer_e2e/proof_pack/` |
| Change Management | Git history, PR reviews | GitHub commits |
| Incident Response | Responsible disclosure policy | `docs/trust/responsible_disclosure.md` |

**SOC 2 Mapping:** See `docs/trust/soc2/SOC2_CONTROL_MAPPING.md`

---

## 5. Data Handling

### 5.1 Data We Process

| Data Type | Purpose | Retention | Deletion |
|-----------|---------|-----------|----------|
| Jira issue metadata | Governance checks | Read on-demand (not stored) | N/A (not stored) |
| Snapshot status | Dashboard display | 90 days (configurable) | Auto-purge or manual delete |
| User account ID | Audit logging | 90 days | Auto-purge |
| Configuration | Feature flags | Until app uninstall | Deleted on uninstall |

**We do NOT process:**
- Issue descriptions or comments (only metadata)
- Attachments or files
- User PII beyond account ID
- External system data

### 5.2 Data Retention Policy

- **Snapshot data:** Retained for 90 days (default), then auto-purged
- **Logs:** Forge platform logs retained per Atlassian policy (typically 7-30 days)
- **Configuration:** Deleted when app uninstalled
- **Evidence packs:** Generated on-demand, stored in `/tmp` (ephemeral)

**Data deletion on uninstall:**
- Forge storage automatically deleted when app uninstalled
- No residual data in Jira
- User can manually purge data via Jira settings

### 5.3 Subprocessors

FirstTry uses **no third-party subprocessors**. All processing occurs within Atlassian's infrastructure.

**Atlassian infrastructure:**
- Hosts: AWS (primary), others (backup)
- Regions: US, EU, APAC (customer-selectable)
- Compliance: SOC 2, ISO 27001, GDPR, HIPAA

**Reference:** [Atlassian Subprocessors](https://www.atlassian.com/legal/sub-processors)

---

## 6. Incident Response

### 6.1 Security Incident Classification

| Severity | Description | Response Time |
|----------|-------------|---------------|
| **Critical** | Data breach, unauthorized access | < 1 hour |
| **High** | Service disruption, potential vulnerability | < 4 hours |
| **Medium** | Degraded performance, non-critical issue | < 24 hours |
| **Low** | Cosmetic issue, feature request | < 7 days |

### 6.2 Incident Response Process

1. **Detection:** Monitoring, user reports, security research
2. **Triage:** Assess severity, assign owner
3. **Containment:** Disable affected features if necessary
4. **Investigation:** Root cause analysis, evidence collection
5. **Remediation:** Fix deployment, verification
6. **Communication:** Notify affected customers
7. **Post-mortem:** Document lessons learned

### 6.3 Responsible Disclosure

**Security vulnerabilities:** Report to [security@firsttry.io](mailto:security@firsttry.io)

**Response commitment:**
- Acknowledgment within 24 hours
- Triage within 72 hours
- Fix deployment within 30 days (critical issues: 7 days)
- Public disclosure coordinated with researcher

**Reference:** `docs/trust/responsible_disclosure.md`

---

## 7. Security Testing

### 7.1 Automated Testing

**Reviewer E2E Evidence Pack:**
- **Purpose:** Prove gadget renders correctly in Jira
- **Frequency:** Every deployment
- **Evidence:** Tamper-evident proof pack with SHA256 manifest
- **Verification:** Offline validation (no network required)

**Marketplace Audit:**
- **Purpose:** Scan for write scopes, external egress, missing docs
- **Frequency:** Pre-release
- **Tool:** `tools/marketplace_audit/run_marketplace_readiness_v2.sh`

### 7.2 Manual Testing

- **Code review:** Required for all changes
- **Security review:** Required for permission changes
- **Penetration testing:** Annually (via Atlassian Marketplace review)

### 7.3 Vulnerability Management

- **Dependency scanning:** `npm audit` in CI/CD
- **SAST:** Static analysis (ESLint, TypeScript compiler)
- **DAST:** Dynamic testing (Playwright E2E tests)
- **Patch management:** Dependencies updated monthly

---

## 8. Contact Information

### Security Contact
- **Email:** security@firsttry.io
- **PGP Key:** Available on request
- **Response Time:** 24 hours

### Support Contact
- **Email:** support@firsttry.io
- **Documentation:** `docs/support/SUPPORT_SLA.md`
- **Response Time:** See SLA

### Legal Contact
- **Email:** legal@firsttry.io
- **Privacy Policy:** `docs/legal/PRIVACY_POLICY.md`
- **Terms of Service:** `docs/legal/TERMS_OF_SERVICE.md`

---

## 9. Document Control

### Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-04 | Initial release | FirstTry Security Team |

### Review Schedule

- **Frequency:** Quarterly
- **Next Review:** 2026-06-04
- **Owner:** Security Team

### Distribution

- **Classification:** Public
- **Availability:** GitHub repository, Trust Center
- **Audience:** Enterprise buyers, security reviewers, Atlassian Marketplace

---

**End of Security Whitepaper**
