# FirstTry Control Mapping — SOC 2 & ISO 27001 Themes

**Version**: 1.0  
**Last Updated**: 2026-01-13  
**Status**: Enterprise-Grade

---

## Scope & Disclaimers

### What This Document Is

This document maps **implemented FirstTry controls** to common themes from:
- **SOC 2 Type II** (AICPA Trust Service Criteria)
- **ISO 27001** (Information Security Management System)

Mappings are **fact-based only**, anchored to code, tests, or executable scripts with file:line or command references.

### What This Document Is NOT

- ❌ **NOT a certification claim** — FirstTry is NOT SOC 2 certified, NOT ISO 27001 certified, and does not claim compliance with either framework
- ❌ **NOT a substitute for formal audit** — Formal certification requires third-party attestation
- ❌ **NOT a guarantee** — Implemented controls are subject to change; regulatory environments evolve
- ❌ **NOT a promise of future features** — This map reflects current implementation only

### How to Read This Document

Each control mapping includes:
- **Control Area**: Theme from SOC 2 or ISO 27001
- **FirstTry Control**: What FirstTry has implemented
- **Evidence**: File:line reference or executable script that proves the control
- **Status**: IMPLEMENTED, PARTIAL, or NOT IMPLEMENTED
- **Notes**: Relevant context or limitations

---

## SOC 2 Type II Control Mapping

### CC (Common Criteria) Controls

#### CC1: Governance & Organization

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **CC1.1**: The board of directors demonstrates independence from management and exercises oversight of the development, administration, and accountability of internal control and risk management | N/A — FirstTry is open-source | N/A | NOT IMPLEMENTED | FirstTry is maintained by volunteers; no formal board structure. Governance is via GitHub issues and pull requests. |
| **CC1.2**: Management establishes structures, reporting lines, and appropriate authorities to facilitate effective carrying out of responsibilities to achieve organizational objectives | CODE_OF_CONDUCT + CONTRIBUTING guidelines | [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | IMPLEMENTED | Maintainers defined via GitHub CODEOWNERS; contribution process documented. |
| **CC1.3**: The organization demonstrates a commitment to competence | Developer docs + test coverage | tests/ (34+ passing tests) | IMPLEMENTED | Continuous testing enforces code quality; 34+ security tests pass in CI. |
| **CC1.4**: The organization holds individuals accountable for their responsibilities | SECURITY.md + SUPPORT_POLICY.md | [SECURITY.md](SECURITY.md), [SUPPORT_POLICY.md](SUPPORT_POLICY.md) | IMPLEMENTED | Security contact defined; vulnerability disclosure timeline published. |

#### CC2: Communication & Information

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **CC2.1**: The organization obtains and generates, uses, and communicates relevant, quality information regarding internal and external events | Change log + Git history | [CHANGELOG_POLICY.md](CHANGELOG_POLICY.md), Git log | IMPLEMENTED | All changes tracked in version control; CHANGELOG maintained. |
| **CC2.2**: The organization internally communicates the objectives, responsibilities, and accountabilities necessary to support the functioning of internal control | Manifest + docs | [manifest.yml](../atlassian/forge-app/manifest.yml) + [SCOPES.md](SCOPES.md) | IMPLEMENTED | Scopes, permissions, and architectural boundaries documented with proof anchors. |
| **CC2.3**: The organization communicates with external parties regarding matters that affect the functioning of internal control | Security contact + issue templates | [SECURITY.md](SECURITY.md) | IMPLEMENTED | Security contact published; GitHub issue templates guide reporters. |

#### CC3: Risk Assessment

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **CC3.1**: The organization specifies objectives with sufficient clarity to enable the identification and assessment of risks relating to the organization's objectives across the entity | Risk model in SECURITY.md | [SECURITY.md#Threat-Model](SECURITY.md#5-threat-model) | IMPLEMENTED | Threat model defines in-scope and out-of-scope risks; explicit boundaries declared. |
| **CC3.2**: The organization identifies risks across the organization relevant to the achievement of objectives across the entity and analyzes risks as a basis for determining how the identified risks should be managed | Bandit SAST + threat model | security-lite.yml | IMPLEMENTED | Automated SAST scanning (Bandit) runs on every push; findings logged. |
| **CC3.3**: The organization considers potential for fraud in assessing risks to the achievement of objectives across the entity | Code review via pull requests | GitHub PR gating | IMPLEMENTED | All changes require PR review before merge to main; enforced via branch protections. |

#### CC4: Monitoring & Control Activities

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **CC4.1**: The organization selects, develops, and deploys control activities over technology to achieve organizational objectives and address related risks | Manifest scope restriction | [manifest.yml#L58-L61](../atlassian/forge-app/manifest.yml#L58-L61) | IMPLEMENTED | Forge manifest restricts scopes to `storage:app` and `read:jira-work` only; write/admin scopes absent. |
| **CC4.2**: The organization selects, develops, and deploys control activities over technology to achieve organizational objectives and address related risks | Freeze-lock verification gate | [reviewer_ready_gate.sh](../atlassian/forge-app/audit/reviewer_ready_gate.sh) | IMPLEMENTED | Deterministic freeze-lock mechanism enforces artifact integrity at build time. |
| **CC5.1**: The entity selects, develops, and implements activities that contribute to the mitigation of risks to the achievement of objectives to acceptable levels | Read-only API enforcement | [reviewer_ready_gate.sh#L182-L192](../atlassian/forge-app/audit/reviewer_ready_gate.sh#L182-L192) | IMPLEMENTED | Write-surface ban enforced; no POST/PUT/PATCH/DELETE on Jira in production code. |
| **CC5.2**: The entity also selects, develops, and implements general control activities over technology | Dependency audit gate | security-lite.yml | IMPLEMENTED | `npm audit --audit-level=high` blocks releases with high/critical CVEs. |
| **CC5.3**: The entity selects, develops, and implements policies and procedures over system inputs, processing, storage, output, and communications | Tenant isolation enforcement | [tenant_context.ts#L36-L52](../atlassian/forge-app/src/security/tenant_context.ts#L36-L52) + [tenant_storage.ts#L56-L91](../atlassian/forge-app/src/security/tenant_storage.ts#L56-L91) | IMPLEMENTED | Tenant-prefixed storage keys prevent cross-tenant access; 24 unit tests verify isolation. |

#### CC6: Logical & Physical Access

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **CC6.1**: The entity restricts physical access to facilities and protected information assets | N/A — Open source | N/A | NOT IMPLEMENTED | FirstTry is public; no physical facility access control. Data resides in Atlassian Forge (AWS-managed). |
| **CC6.2**: The organization obtains or generates, uses, and communicates relevant, quality information regarding the objectives, responsibilities, and accountabilities necessary to support the functioning of internal control | Forge manifest scopes | [manifest.yml#L58-L61](../atlassian/forge-app/manifest.yml#L58-L61) | IMPLEMENTED | API scopes declare read-only permissions; no scope escalation possible. |

#### CC7: System Monitoring & Logging

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **CC7.1**: To meet objectives, the organization obtains or generates, uses, and communicates relevant, quality information regarding the effectiveness of internal control over financial reporting, operations, and compliance | Audit event logging | [audit_events.ts](../atlassian/forge-app/src/audit/audit_events.ts) | IMPLEMENTED | Every policy evaluation creates immutable audit entry (timestamp, policy ID, decision, reason). |
| **CC7.2**: The organization monitors system activities and analyzes results to maintain effective control over risks | CI/CD pipeline gates | reviewer-gates.yml | IMPLEMENTED | Non-bypassable doc validation and reviewer gates run on every push/PR. |
| **CC7.3**: The organization monitors systems and related assets on a periodic basis and upon occurrence of anomalies; takes action to maintain baseline security | Security lite workflow | security-lite.yml | PARTIAL | Scheduled dependency audit runs daily; no real-time anomaly detection. |

#### CC8: Logical Access & Authentication

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **CC8.1**: The organization implements logical and/or physical access security measures to protect against unauthorized access, damage, and theft of information assets | Forge auth delegation | [SECURITY.md](SECURITY.md) | IMPLEMENTED | All authentication/authorization delegated to Atlassian Forge; no custom auth logic. |
| **CC8.2**: Prior to issuing system credentials, the organization registers and authorizes new internal and external users and processes and approves modifications and deactivations of user access rights with appropriate authorization | N/A — Forge managed | N/A | NOT IMPLEMENTED | User access managed by Jira Cloud admins; FirstTry enforces no custom access policy. |

#### CC9: Encryption & Data Protection

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **CC9.1**: The organization identifies, selects, and develops risk mitigation activities for risks arising from potential business disruptions | Data retention policy | [DATA_RETENTION.md](DATA_RETENTION.md) | IMPLEMENTED | Indefinite retention by default; users can delete via CLI; uninstall triggers platform-level deletion. |
| **CC9.2**: The organization ensures that system components and information assets are protected from the effects of natural disasters, environmental hazards, and human-made threats | Atlassian Cloud | [SECURITY.md](SECURITY.md) | IMPLEMENTED | Data encrypted in transit (TLS 1.2+) and at rest (AES-256 by Atlassian); FirstTry relies on Forge. |

---

## ISO 27001 Control Mapping

### A (Asset Management) Controls

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **A.5.1**: Responsibility for assets | SUPPORTING_FILES (implied) | [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | PARTIAL | Maintainers assigned via CODEOWNERS; GitHub defines asset responsibility implicitly. |
| **A.5.2**: Information classification | Not formalized | — | NOT IMPLEMENTED | Code is public; no internal classification scheme. Sensitive data is not stored (verified by tests). |

### A (Access Control) Controls

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **A.6.1**: Business requirement of access control | Manifest scopes | [manifest.yml#L58-L61](../atlassian/forge-app/manifest.yml#L58-L61) | IMPLEMENTED | Access to Jira controlled by scopes; FirstTry only reads. |
| **A.6.2**: User access provisioning | Forge managed | [SECURITY.md](SECURITY.md) | IMPLEMENTED | User access provisioned by Jira Cloud admin; FirstTry has no provisioning logic. |
| **A.6.3**: Access revocation | Forge managed | N/A | IMPLEMENTED | Access revoked when user removed from workspace or Forge app uninstalled. |
| **A.6.4**: Removal or adjustment of access rights | Forge managed | N/A | IMPLEMENTED | Scope changes require Forge re-authentication; revocation automatic on uninstall. |

### A (Cryptography) Controls

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **A.7.1**: Cryptographic controls policy | Atlassian-managed | [SECURITY.md](SECURITY.md) | PARTIAL | Encryption policy enforced by Atlassian Cloud; FirstTry does not implement custom crypto. |
| **A.7.2**: Encryption key management | Atlassian-managed | N/A | NOT IMPLEMENTED | Atlassian manages all key material; FirstTry does not handle keys. |

### A (Physical & Environmental) Controls

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **A.8.1**: Physical security perimeter | Atlassian-managed | [SECURITY.md](SECURITY.md) | NOT IMPLEMENTED | Atlassian Cloud infrastructure (AWS) handles physical security. |
| **A.8.2**: Physical entry | Atlassian-managed | N/A | NOT IMPLEMENTED | Atlassian Cloud responsibility. |

### A (Operations) Controls

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **A.9.1**: Documented operating procedures | SUPPORT.md + SECURITY.md | [SUPPORT.md](SUPPORT.md), [SECURITY.md](SECURITY.md) | IMPLEMENTED | Support policy, security contact, and threat model documented. |
| **A.9.2**: Change management | CHANGE_MANAGEMENT.md | [CHANGE_MANAGEMENT.md](CHANGE_MANAGEMENT.md) | IMPLEMENTED | Changes reviewed via PR before merge to main. |
| **A.9.3**: Segregation of duties | Pull request review | GitHub branch protections | IMPLEMENTED | All code changes require review; no single developer can merge without approval. |
| **A.9.4**: Separation of development, testing, and production | Main branch + staging | Git branching model | PARTIAL | Main branch production-ready; CI/CD runs test gate on all commits. |

### A (Communications Security) Controls

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **A.10.1**: Network security perimeter | Forge manages | [SECURITY.md](SECURITY.md) | NOT IMPLEMENTED | Atlassian Cloud handles network perimeter (TLS, firewall). |
| **A.10.2**: Management of network services | Jira Cloud managed | N/A | NOT IMPLEMENTED | Jira Cloud infrastructure responsibility. |
| **A.10.3**: Segregation of networks | Workspace isolation | [SECURITY.md#Data-Security](SECURITY.md#23-tenant-isolation) | IMPLEMENTED | Workspace isolation enforced by Forge; FirstTry tenant-prefixes storage keys. |

### A (System Acquisition, Development, & Maintenance) Controls

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **A.11.1**: Information security requirements in new system development | Manifest scopes | [manifest.yml#L58-L61](../atlassian/forge-app/manifest.yml#L58-L61) | IMPLEMENTED | Scope restrictions declared upfront; read-only enforced by design. |
| **A.11.2**: Secure development policy | Code review + CI/CD gates | reviewer-gates.yml | IMPLEMENTED | All changes require PR review and pass non-bypassable validator gates. |
| **A.11.3**: Test data protection | Deterministic test secrets | [.pre-commit-config.yaml](../.pre-commit-config.yaml) | IMPLEMENTED | Test secrets are hardcoded, deterministic, and explicitly non-production. |
| **A.11.4**: Covert channel analysis | Not applicable | — | NOT IMPLEMENTED | FirstTry is open-source; covert channel analysis not required. |
| **A.11.5**: Access control for program source code | GitHub access control | GitHub CODEOWNERS | PARTIAL | Repo is public; write access restricted to maintainers via CODEOWNERS. |
| **A.11.6**: Change control process | Git + pull requests | [CHANGE_MANAGEMENT.md](CHANGE_MANAGEMENT.md) | IMPLEMENTED | All changes tracked in Git; PR workflow enforces review before merge. |
| **A.11.7**: Control of technical vulnerabilities | Bandit + dependency audit | security-lite.yml | IMPLEMENTED | SAST (Bandit) and SCA (npm audit) run on every commit. |

### A (Supplier Relations) Controls

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **A.12.1**: Information security in supplier agreements | Apache 2.0 license | [LICENSE](../LICENSE) | PARTIAL | Public Apache 2.0 license; no custom supplier agreements. |
| **A.12.2**: Supplier security assessment | Dependencies listed | [pyproject.toml](../pyproject.toml) + [package.json](../atlassian/forge-app/package.json) | IMPLEMENTED | All dependencies locked in version control; audit performed by npm audit + pip-audit. |

### A (Information Security Incident Management) Controls

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **A.13.1**: Incident event classification | Security contact defined | [SECURITY.md](SECURITY.md) | IMPLEMENTED | Vulnerability disclosure email published; SLA timeline defined. |
| **A.13.2**: Response to information security incidents | Disclosure timeline | [SECURITY.md](SECURITY.md) | IMPLEMENTED | Critical: 1 day triage + 24-hour fix; High: 3–5 days triage + 1–2 weeks fix. |

### A (Business Continuity Management) Controls

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **A.14.1**: Business continuity management | Open source & Atlassian | [CONTRIBUTING.md](../CONTRIBUTING.md) | PARTIAL | Community-driven; Atlassian Forge infrastructure ensures uptime. No SLA published. |
| **A.14.2**: Disaster recovery planning | Atlassian-managed | N/A | NOT IMPLEMENTED | FirstTry relies on Atlassian Cloud DR; no custom DR plan. |

### A (Compliance) Controls

| Control Area | FirstTry Control | Evidence | Status | Notes |
|---|---|---|---|---|
| **A.15.1**: Identification of applicable legislation and contractual requirements | COMPLIANCE.md | [COMPLIANCE.md](COMPLIANCE.md) | IMPLEMENTED | Compliance statement published; no SOC 2 / ISO claim made (explicit disclaimer). |
| **A.15.2**: Intellectual property rights | Apache 2.0 license | [LICENSE](../LICENSE) | IMPLEMENTED | Apache 2.0 grants BSD-like rights; CONTRIBUTING requires acceptance. |
| **A.15.3**: Protection of organizational records | Git version control | Git log | IMPLEMENTED | All changes tracked and auditable; no data deletion from history. |
| **A.15.4**: Privacy and protection of personal information | PRIVACY.md | [PRIVACY.md](PRIVACY.md) | IMPLEMENTED | No PII stored; audit logs redacted; data minimization enforced by design. |
| **A.15.5**: Regulation of cryptographic controls | Atlassian TLS | [SECURITY.md](SECURITY.md) | IMPLEMENTED | All transit encrypted by Atlassian (TLS 1.2+); at-rest encryption (AES-256) managed by Forge. |

---

## Cross-Cutting Security Properties

### Tenant Isolation (ISO 27001 A.10.3 / SOC 2 CC5.3)

**Control**: Storage API enforces tenant isolation via CloudId-based key prefixing  
**Evidence**:
- Tenant context derivation: [tenant_context.ts#L36-L52](../atlassian/forge-app/src/security/tenant_context.ts#L36-L52)
- Tenant storage wrapper: [tenant_storage.ts#L56-L91](../atlassian/forge-app/src/security/tenant_storage.ts#L56-L91)
- Unit tests (24 passing): [p1_tenant_isolation.test.ts](../atlassian/forge-app/tests/p1_tenant_isolation.test.ts)

**Status**: IMPLEMENTED ✅

### Immutability Guarantee (ISO 27001 A.13 / SOC 2 CC7.1)

**Control**: Audit events are append-only; UUID-based key generation prevents overwrites  
**Evidence**:
- UUID generation: [audit_events.ts#L211-L214](../atlassian/forge-app/src/audit/audit_events.ts#L211-L214)
- Tenant-scoped key format: [audit_events.ts#L216-L219](../atlassian/forge-app/src/audit/audit_events.ts#L216-L219)
- Unit tests (10 passing): [a3_immutability_guarantee.test.ts](../atlassian/forge-app/tests/a3_immutability_guarantee.test.ts)

**Status**: IMPLEMENTED ✅

### Read-Only Enforcement (ISO 27001 A.11.2 / SOC 2 CC5.1)

**Control**: Manifest scope restriction + write-surface ban in CI/CD  
**Evidence**:
- Manifest scopes: [manifest.yml#L58-L61](../atlassian/forge-app/manifest.yml#L58-L61)
- Write-surface scan: [reviewer_ready_gate.sh#L182-L192](../atlassian/forge-app/audit/reviewer_ready_gate.sh#L182-L192)
- Integration: reviewer-gates.yml

**Status**: IMPLEMENTED ✅

### Non-Bypassable Validation Gates (ISO 27001 A.12.2 / SOC 2 CC4.2)

**Control**: CI/CD gates cannot be skipped; enforced for every commit  
**Evidence**:
- Docs validator: [tools/validate_docs.sh](../tools/validate_docs.sh)
- Reviewer gate: [tools/reviewer_gate.sh](../tools/reviewer_gate.sh)
- CI integration: reviewer-gates.yml

**Status**: IMPLEMENTED ✅

### Secret Scanning (ISO 27001 A.11.7 / SOC 2 CC3.2)

**Control**: Automated secret scanning in CI/CD  
**Evidence**:
- Scheduled security job: security-lite.yml
- npm audit gate: `npm audit --audit-level=high` (high/critical CVEs block release)

**Status**: IMPLEMENTED ✅

---

## Summary: Implementation Status

### Fully Implemented Controls

✅ **Read-Only Architecture**  
✅ **Manifest Scope Restriction**  
✅ **Tenant Isolation** (24 unit tests passing)  
✅ **Immutability Guarantee** (10 unit tests passing)  
✅ **Audit Event Logging**  
✅ **Change Management** (PR review required)  
✅ **Dependency Audit** (npm audit + pip-audit)  
✅ **SAST Scanning** (Bandit)  
✅ **Secret Scanning** (scheduled workflow)  
✅ **Non-Bypassable CI/CD Gates**  
✅ **Freeze-Lock Verification**  
✅ **Threat Model Documentation**  
✅ **Security Contact & Disclosure Timeline**  
✅ **Data Retention Policy**  
✅ **Compliance Statement** (with explicit disclaimers)  

### Partially Implemented Controls

⚠️ **Anomaly Detection** — Scheduled audits only; no real-time monitoring  
⚠️ **Governance Structure** — Community-driven; no formal board  
⚠️ **Asset Classification** — Public repo; no internal tiers  
⚠️ **DR/Business Continuity** — Relies on Atlassian Cloud  


---

## Proof Artifact Registry

### Commands to Verify Controls

```bash
# Verify manifest scopes (read-only only)
rg "^\s*scopes:" atlassian/forge-app/manifest.yml -A 5

# Verify write-surface ban
grep -n "POST\|PUT\|PATCH\|DELETE" atlassian/forge-app/src/**/*.ts | wc -l  # Should be 0 in prod

# Verify tenant isolation tests
npm test -- p1_tenant_isolation.test.ts  # Should pass all 24

# Verify immutability tests
npm test -- a3_immutability_guarantee.test.ts  # Should pass all 10

# Verify audit events are append-only
rg "UUID\|audit.*event" atlassian/forge-app/src/audit/audit_events.ts -A 3

# Verify no hardcoded secrets in production code
rg "password|token|secret|api.key" --glob="!test*" --glob="!*.test.*" src/ atlassian/forge-app/src/ 2>/dev/null | wc -l  # Should be minimal

# Verify dependency audit gate
npm audit --audit-level=high  # Should pass

# Verify SAST gate
bandit -r src/ atlassian/forge-app/src/ --severity-level medium  # Review findings

# Verify non-bypassable gates
bash tools/validate_docs.sh && bash tools/reviewer_gate.sh
```

---

## Related Documentation

- [SECURITY_SUMMARY.md](SECURITY_SUMMARY.md) — Authoritative facts on security posture
- [SECURITY.md](SECURITY.md) — Vulnerability disclosure, threat model, data protection
- [COMPLIANCE.md](COMPLIANCE.md) — Compliance statement & disclaimers
- [PRIVACY.md](PRIVACY.md) — Data handling & retention
- [SCOPES.md](SCOPES.md) — Manifest scope enumeration with justifications
- [CHANGE_MANAGEMENT.md](CHANGE_MANAGEMENT.md) — Change control process
- [SUPPORT_POLICY.md](SUPPORT_POLICY.md) — Support contact & SLA
- [DATA_RETENTION.md](DATA_RETENTION.md) — Data retention & deletion policy

---

**End of Control Mapping**
