# Enterprise Trust Matrix

**Version**: 1.0  
**Last Updated**: 2025-12-22  
**Purpose**: Validate FirstTry's security, privacy, and operational posture for enterprise deployment

---

## Executive Summary

| Dimension | Status | Risk | Evidence |
|-----------|--------|------|----------|
| **Privacy** | ✅ VERIFIED | None | [docs/PRIVACY.md](../docs/PRIVACY.md) |
| **Security** | ✅ VERIFIED | Low | [docs/SECURITY.md](../docs/SECURITY.md) |
| **Governance** | ⚠️ LIMITED | Medium | [docs/COMPLIANCE.md](../docs/COMPLIANCE.md) |
| **Reliability** | ⚠️ LIMITED | Medium | [docs/ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md) |
| **Operability** | ⚠️ LIMITED | Medium | [docs/ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md) |

---

## 1. Privacy Dimension ✅ VERIFIED

### Claims

| Claim | Evidence | Status |
|-------|----------|--------|
| **Only operational metadata collected** | [DATA_INVENTORY.md](../docs/DATA_INVENTORY.md), manifest.yml | ✅ VERIFIED |
| **No user tracking/analytics** | Code scan: zero tracking pixels, no GA/Segment/Amplitude | ✅ VERIFIED |
| **No data shared with third parties** | [SUBPROCESSORS.md](../docs/SUBPROCESSORS.md), manifest.yml (zero external APIs) | ✅ VERIFIED |
| **Data cleared on uninstall** | [DATA_RETENTION.md](../docs/DATA_RETENTION.md): Forge auto-purge | ✅ VERIFIED |
| **Cross-workspace isolation** | Forge storage auto-scoped by workspace; verified in tests | ✅ VERIFIED |

### Residual Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Workspace Admin Insider Risk** | Low | High | Workspace admin has inherent access; same as all Jira apps |
| **Forge Storage Compromise** | Very Low | High | Atlassian manages security; not in FirstTry's scope |

### Anticipated Enterprise Questions

- *"What data do you collect?"* → [DATA_INVENTORY.md](../docs/DATA_INVENTORY.md)
- *"Is data shared externally?"* → No. [SUBPROCESSORS.md](../docs/SUBPROCESSORS.md)
- *"Can I audit data deletion?"* → Workspace admin manages; Forge auto-purges on TTL
- *"Is there analytics tracking?"* → No. Code does not include tracking libraries

---

## 2. Security Dimension ✅ VERIFIED

### Claims

| Claim | Evidence | Status |
|-------|----------|--------|
| **No real network egress** | [shk_harness.mts](../atlassian/forge-app/tests/shakedown/shk_harness.mts) mocks all calls | ✅ VERIFIED |
| **Logs do not contain PII** | [p1_logging_safety.test.ts](../atlassian/forge-app/tests/p1_logging_safety.test.ts): 20 redaction tests | ✅ VERIFIED |
| **Read-only operations** | manifest.yml: read scopes only, no write | ✅ VERIFIED |
| **No hardcoded secrets** | Bandit scan + code review; none found | ✅ VERIFIED |
| **Vulnerability disclosure defined** | [SECURITY.md](../docs/SECURITY.md) | ✅ VERIFIED |

### Threat Model

**In Scope** (FirstTry responsible):
- Code injection (input validation required)
- Logging injection (PII redaction required)
- Denial of service (rate limiting if needed)

**Out of Scope** (Atlassian/Jira responsible):
- Forge runtime compromise (managed by Atlassian)
- Jira instance compromise (managed by Jira admin)
- Authentication bypass (Jira's responsibility)

### Residual Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Code Injection via Issue Fields** | Low | Medium | Input validation in analyzers; future hardening |
| **Dependency Vulnerability** | Medium | Medium | Dependabot, monthly audits, prompt patching |
| **Type Safety Gaps** | Low | Low | TypeScript strict mode enabled |

### Anticipated Enterprise Questions

- *"What's the vulnerability disclosure process?"* → [SECURITY.md](../docs/SECURITY.md#vulnerability-disclosure)
- *"Do you test for OWASP Top 10?"* → Partially (input validation, redaction); full coverage UNKNOWN
- *"Can we do a security assessment?"* → Contact: security@atlassian.com

---

## 3. Governance Dimension ⚠️ LIMITED

### Claims

| Claim | Evidence | Status |
|-------|----------|--------|
| **Terms of Service provided** | [TERMS.md](../docs/TERMS.md) | ✅ VERIFIED |
| **Data Processing Agreement** | UNKNOWN - Not provided | ⚠️ LIMITATION |
| **SLA defined** | UNKNOWN - No SLA | ⚠️ LIMITATION |
| **HIPAA compliant** | No. [COMPLIANCE.md](../docs/COMPLIANCE.md) declares not compliant | ✅ VERIFIED |
| **SOC 2 Type II certified** | No. [COMPLIANCE.md](../docs/COMPLIANCE.md) declares not certified | ✅ VERIFIED |

### Governance Limitations

**FirstTry is NOT**:
- ❌ SOC 2 Type II certified
- ❌ ISO 27001 certified
- ❌ HIPAA compliant
- ❌ PCI DSS compliant
- ❌ FedRAMP authorized

**Can be used by**:
- ✅ General enterprises (no regulated data)
- ✅ SaaS companies (no health/payment data)
- ✅ Organizations with basic data governance needs

**Should NOT be used by**:
- ❌ Healthcare (HIPAA required)
- ❌ Finance (PCI DSS required)
- ❌ Government (FedRAMP required)

### Residual Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Regulatory Non-Compliance** | Medium | High | Document excluded verticals in Marketplace listing |
| **Data Processing Questions** | High | Medium | Provide DPA template; user must negotiate |
| **SLA Disputes** | Medium | Low | Clear "best effort only" in Terms |

### Anticipated Enterprise Questions

- *"Do you have SOC 2?"* → No. [COMPLIANCE.md](../docs/COMPLIANCE.md)
- *"Can you sign a DPA?"* → Case-by-case; contact security@atlassian.com
- *"What's your uptime SLA?"* → No SLA. [ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md)
- *"Can this be used for [healthcare/finance/government]?"* → No. See [COMPLIANCE.md](../docs/COMPLIANCE.md)

---

## 4. Reliability Dimension ⚠️ LIMITED

### Claims

| Claim | Evidence | Status |
|-------|----------|--------|
| **Deterministic behavior** | [SHK_FINAL_REPORT.md](../SHK_FINAL_REPORT.md): 10-run determinism 100% | ✅ VERIFIED |
| **No data loss** | Forge storage handles durability; FirstTry has no purge logic | ⚠️ PARTIAL (Atlassian manages) |
| **Uptime guaranteed** | No. [ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md) | ✅ VERIFIED |
| **Performance benchmarked** | UNKNOWN - No benchmarks provided | ⚠️ LIMITATION |
| **Scaling limits known** | UNKNOWN - No load testing | ⚠️ LIMITATION |

### Reliability Limitations

**FirstTry guarantees**:
- ✅ Deterministic reporting (same inputs → same outputs)
- ✅ Workspace isolation (data not leaked to other workspaces)
- ✅ Degradation disclosure (features disabled if upstream API fails)

**FirstTry does NOT guarantee**:
- ❌ Uptime (no SLA, community project)
- ❌ Performance targets (no benchmarks)
- ❌ Scaling capacity (limited testing)
- ❌ Data availability (Forge manages, not FirstTry)

### Performance Profile

| Metric | Status | Evidence |
|--------|--------|----------|
| **Latency** | UNKNOWN | [ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md#limitations) |
| **Throughput** | UNKNOWN | No benchmark data |
| **Max Concurrent Users** | UNKNOWN | Limited by Forge quotas |
| **Database Size Limits** | Inherited from Forge | [DATA_RETENTION.md](../docs/DATA_RETENTION.md) |

### Residual Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Slow Query Performance** | Medium | Medium | No query optimization; blocking data access |
| **Storage Quota Exceeded** | Low | High | Forge enforces quotas; warn user in docs |
| **Cascade Failures** | Low | High | Degradation handling implemented |

### Anticipated Enterprise Questions

- *"What's your uptime SLA?"* → No SLA. [ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md)
- *"What's the max workspace size?"* → Inherit Forge limits; no specific FirstTry limit
- *"How long do queries take?"* → UNKNOWN; see [ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md#limitations)
- *"Can you scale to 10,000 issues?"* → Untested. See [ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md#known-limitations)

---

## 5. Operability Dimension ⚠️ LIMITED

### Claims

| Claim | Evidence | Status |
|-------|----------|--------|
| **Incident response process defined** | [INCIDENT_RESPONSE.md](../docs/INCIDENT_RESPONSE.md) | ✅ VERIFIED |
| **24/7 support available** | No. [SUPPORT.md](../docs/SUPPORT.md) | ✅ VERIFIED |
| **Single point of failure risk** | High (single engineer). Documented. | ✅ VERIFIED |
| **Feature roadmap published** | UNKNOWN - No roadmap | ⚠️ LIMITATION |
| **Long-term support commitment** | Limited. See [ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md) | ⚠️ LIMITATION |

### Operability Limitations

**FirstTry provides**:
- ✅ Best-effort incident response (triage 1-5d, fix ASAP, release ~2-4w)
- ✅ Community support (GitHub Issues, email)
- ✅ Transparency (degradation detection in code)

**FirstTry does NOT provide**:
- ❌ 24/7 on-call support (single engineer)
- ❌ Dedicated account management
- ❌ Custom feature development
- ❌ Long-term support guarantees beyond 1 major version

### Support Boundaries

| Question Type | Support Level |
|---------------|----------------|
| Bug reports | ✅ Yes (best-effort) |
| Feature requests | ⚠️ Community voting |
| Custom integration | ❌ No (read-only tool) |
| Performance tuning | ❌ No (inherent limitations) |
| Data recovery | ❌ No (Jira admin manages) |

### Residual Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Single Engineer Dependency** | High | High | Document team size in [ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md) |
| **Slow Bug Fix Turnaround** | Medium | Medium | Document expected timelines in [SUPPORT.md](../docs/SUPPORT.md) |
| **Feature Stagnation** | Medium | Low | Community input welcome; no obligation |
| **Abandoned Project Risk** | Low | High | Atlassian maintains public registry; can fork if needed |

### Anticipated Enterprise Questions

- *"Who do we call if it breaks?"* → Contact security@atlassian.com; best-effort response
- *"What's your support hours?"* → Community-driven; no guaranteed hours
- *"Can you add [feature] for us?"* → Not offered; community feature requests welcome
- *"How long will you maintain this?"* → See [ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md#long-term-support)

---

## Trust Assessment Summary

### For Low-Risk Deployments ✅ RECOMMENDED

- General enterprises (non-regulated data)
- Teams < 500 people
- Non-critical workflow (supplemental reports)
- Internal use only

### For Medium-Risk Deployments ⚠️ WITH CAUTION

- Larger enterprises (1000+ people)
- Some reliance on data quality
- Need procurement documentation
- Recommend: Legal review, security assessment

### For High-Risk Deployments ❌ NOT RECOMMENDED

- Healthcare, finance, government (regulated data)
- Critical workflows
- High-availability requirements
- Compliance requirements (SOC 2, HIPAA, etc.)

---

## Recommended Enterprise Safeguards

1. **Deploy in non-prod first** — Verify compatibility with your Jira setup
2. **Assign data owner** — Who manages data access and retention?
3. **Document acceptable use** — Legal/compliance sign-off required
4. **Plan for discontinuation** — What if FirstTry is abandoned? Have exit strategy.
5. **Monitor performance** — Track query times, storage usage in your environment
6. **Review quarterly** — Verify security updates, compliance posture, team status

---

**Matrix Version**: 1.0  
**Next Review**: Upon major version release or significant architectural change  
**Last Updated**: 2025-12-22
