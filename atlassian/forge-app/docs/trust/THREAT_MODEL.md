# Threat Model

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## Overview

FirstTry threat model uses STRIDE framework to identify, categorize, and assess threats to the application and platform integration.

---

## STRIDE Analysis

| Threat | STRIDE | Mitigation | Residual Risk |
|--------|--------|-----------|----------------|
| **Scope Escalation** | Elevation of Privilege | Manifest.yml declares read-only scopes only; Forge enforces scope validation on requestJira() calls; CI gate blocks scope mutations | Low (platform-enforced) |
| **API Mutation (POST/PUT/DELETE)** | Tampering | Source code scans (resolver_scan.txt) verify no POST/PUT/DELETE used; CI gate blocks mutations | Low (code-verified, testable) |
| **Data Tampering in Storage** | Tampering | Ledger uses SHA256 hash chain; export archives signed with build identity; offline verification tools available | Low (cryptographically detected) |
| **Unauthorized Data Access** | Information Disclosure | Forge per-tenant isolation enforced by platform; no cross-tenant data access possible in scope | Low (platform-enforced) |
| **Data Exfiltration to External Service** | Information Disclosure | Zero egress audit (resolver_scan.txt); no external HTTP clients in production code | Low (code-verified) |
| **Export Archive Forgery** | Tampering | Deterministic ZIP build; git SHA + UI bundle hash embedded in manifest; signature verification available | Low (cryptographically detectable) |
| **Ledger Replay Attack** | Information Disclosure / Replay | Nonce + timestamp + hash chain prevent replay; monotonic timestamp enforcement | Low (cryptographically protected) |
| **Compromise of Development Infrastructure** | Tampering / Elevation | Git commit history immutable; signed tags recommended; 2FA on github.com/Firsttry-Solutions | Medium (depends on GitHub security) |
| **Dependency Vulnerability** | Tampering / Information Disclosure | npm audit enforced in CI; trivy scan in evidence; SBOM generated; SCA tools enabled | Low (monitored, tested) |
| **Forge Platform Outage** | Denial of Service | No mitigation available; FirstTry depends on Forge SLA; customers should export regularly | High (platform dependency) |
| **Jira API Rate Limiting** | Denial of Service | Forge handles rate-limit enforcement; app implements exponential backoff; optional retry logic | Medium (platform-dependent) |
| **Unauthorized Repository Access** | Tampering / Information Disclosure | GitHub repo is private; branch protection on main; code review required; audit logs available | Low (GitHub-enforced) |
| **Audit Ledger Deletion** | Repudiation | Forge Storage immutability at platform level; ledger is append-only; deletion requires uninstall | Low (platform-enforced) |
| **Tenant Isolation Bypass** | Information Disclosure | Forge platform guarantees per-tenant isolation; no application-level tenant confusion possible | Low (platform-enforced) |

---

## Threat Severity Rating

| Rating | Criteria | CVSS | Action |
|--------|----------|------|--------|
| **Critical** | Unmitigated, exploitable, disastrous impact | ≥9.0 | Immediate patch; escalate to Atlassian if platform issue |
| **High** | Significant impact; requires effort to exploit | 7.0–8.9 | Patch within 7 days; security advisory |
| **Medium** | Moderate impact; mitigations available | 4.0–6.9 | Patch within 30 days; document in release notes |
| **Low** | Minimal impact; unlikely to exploit | <4.0 | Patch in next regular release |

---

## Threat Elimination Rationale

### Why these threats are acceptable

1. **Forge Dependency (Unavailable)**: FirstTry does not own or operate hosting infrastructure. Acceptance: Platform SLA is known; customers can select alternative tools if risk-intolerant. Mitigation: Regular exports.

2. **Development Infrastructure**: GitHub account security is shared responsibility with GitHub's security controls. Acceptance: GitHub SOC2 Type II certified; code review mitigates. Mitigation: Signed commits; branch protection.

3. **Dependency Vulnerabilities (Ongoing)**: Dependencies update continuously; zero-day vulnerabilities may exist. Acceptance: Industry-standard SCA tools (npm audit, trivy) employed. Mitigation: CI gates fail on high-severity findings.

---

## Mitigations by Category

### Platform-Enforced (FirstTry cannot influence)
- Scope validation (Forge requestJira API)
- Per-tenant storage isolation (Forge Storage)
- Encryption at rest (Forge Storage AES-256)
- TLS in transit (Forge platform)
- Rate limiting and DDoS protection (Atlassian infrastructure)

### Code-Verified (evidence artifacts)
- No external HTTP clients (resolver_scan.txt)
- No POST/PUT/DELETE mutations (resolver_scan.txt)
- Deterministic exports (export tests)
- Immutable ledger (hash chain formula)
- No scope escalation (manifest.yml lock + CI gate)

### Customer-Controlled
- Selecting region (Atlassian site setup)
- Setting Jira permissions (RBAC)
- Exporting compliance evidence (regular schedules)
- Uninstalling app (data deletion trigger)

---

## Threat Monitoring

**Ongoing** (per CI/CD pipeline):
- Dependency scanning: npm audit run on each build
- Image scanning: trivy fs . (filesystem scan)
- SBOM generation: CycloneDX SBOM for transparency
- Code mutation detection: resolver_scan.txt verifies no POST/PUT/DELETE added
- Scope drift detection: manifest.yml immutability enforced

**Periodic** (annual review):
- Architectural review: Check for new threat vectors
- Control assessment: Verify mitigations still effective
- Dependency audit: npm ls for known CVEs
- Forge platform updates: Review for new Forge capabilities or risks

---

## References

- [ARCHITECTURE.md](ARCHITECTURE.md): System design and trust boundaries
- [SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md): Shared responsibility model
- [VULNERABILITY_DISCLOSURE_POLICY.md](VULNERABILITY_DISCLOSURE_POLICY.md): Incident reporting
- [docs/operations/INCIDENT_RESPONSE_PLAN.md](../operations/INCIDENT_RESPONSE_PLAN.md): Response procedures
