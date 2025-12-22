# FirstTry Residual Risks & Known Gaps

**Version**: 1.0  
**Last Updated**: 2025-12-22  
**Status**: Acknowledged gaps that do not block marketplace approval; require ongoing monitoring

---

## Executive Summary

This document lists **known unknowns** and **platform dependencies** that FirstTry cannot resolve alone. These are NOT bugs; they are architectural constraints of the Atlassian Forge platform.

**Bottom Line**: FirstTry is marketplace-ready if customer understands that:
1. FirstTry is **platform-limited**, not feature-limited
2. Many security/compliance behaviors depend on **Atlassian**, not FirstTry
3. **Escalation path** is to Atlassian, not FirstTry support

---

## 1. Unknowns Explicitly Not Addressed

| Risk | Why Unknown | Mitigation | Escalation |
|---|---|---|---|
| **Atlassian Forge SLA uptime** | Atlassian does not publish SLA for public Forge | No uptime guarantee beyond Jira Cloud | Contact Atlassian support |
| **Forge platform CVE response time** | Atlassian does not commit to patch timeline | Assume 30-90 days based on Jira history | Monitor Atlassian security advisories |
| **Webhook delivery guarantees** | Forge webhooks are best-effort, not guaranteed | Must handle webhook loss gracefully | Design app for eventual consistency |
| **API rate limit exact values** | Jira Cloud API limits vary by plan & org | Test with your workspace's limits | Check Atlassian API docs for your plan |
| **Storage quota exact size** | Varies by Jira Cloud plan tier | Monitor your workspace usage | Atlassian docs specify limits per plan |
| **Jira Cloud deprecation notices** | Atlassian may deprecate fields/APIs | Must adapt to Jira schema changes | Monitor Jira Cloud release notes |
| **Data residency by region** | Controlled by Atlassian, not FirstTry | EU data stays in EU if Jira is EU | Confirm Jira Cloud region with admin |

---

## 2. Explicit Limitations (By Design)

### 2.1 Data Lifecycle (FirstTry Cannot Override)

| Limitation | Why | Workaround |
|---|---|---|
| **No custom data deletion before uninstall** | Forge storage lifecycle controlled by Atlassian | Request deletion from Atlassian if needed | 
| **No data export after uninstall** | Atlassian auto-purges on uninstall | Export data manually before uninstall |
| **No data migration to another Jira workspace** | Forge storage is workspace-scoped | Manual re-run in new workspace required |
| **No per-issue retention override** | FirstTry applies workspace-wide policy | Cannot selectively keep specific issues |
| **No encryption key rotation by app** | Atlassian manages encryption | Request key rotation from Atlassian if needed |

### 2.2 Geographic & Infrastructure (Atlassian Controlled)

| Limitation | Why | Customer Responsibility |
|---|---|---|
| **No data residency choice** | Jira Cloud region determines storage location | Choose Jira Cloud region (US or EU) during signup |
| **No on-premise deployment** | FirstTry is Forge-only | Evaluate on-premise alternatives if needed |
| **No backup to external storage** | Forge controls backup targets | Rely on Atlassian's backup policy |
| **No backup frequency control** | Atlassian defines backup schedule | Contact Atlassian if frequency is insufficient |
| **No disaster recovery to custom datacenter** | Atlassian manages DR | Rely on Atlassian's DR procedures |

### 2.3 Authentication & Authorization (Jira Controlled)

| Limitation | Why | Customer Responsibility |
|---|---|---|
| **No custom authentication schemes** | FirstTry trusts Jira OAuth only | Use Jira's native authentication (no SAML override by app) |
| **No role-based access control beyond Jira** | FirstTry respects Jira permissions | Manage access via Jira admin settings |
| **No service-account logins** | Jira Cloud doesn't support service accounts for Forge apps | Use user-based access; Jira doesn't offer machine accounts |
| **No audit trail beyond Jira's native logs** | FirstTry logs are app-level, not Jira-level | Review FirstTry logs in Forge; Jira audit separately |
| **No SSO integration separate from Jira** | FirstTry piggy-backs on Jira SSO | Configure SSO in Jira; FirstTry follows |

### 2.4 Update & Deployment (Atlassian Controlled)

| Limitation | Why | Customer Responsibility |
|---|---|---|
| **No opt-out from auto-updates** | Atlassian manages app versioning | Test updates in non-prod first |
| **No rollback to prior version** | Forge doesn't support version pinning | Report critical bugs immediately |
| **No staged rollout control** | Atlassian decides rollout schedule | Expect updates to roll out gradually |
| **No scheduled maintenance windows** | Forge deploys on its own schedule | Assume updates can happen anytime |

---

## 3. Dependencies That May Create Risk

### 3.1 What FirstTry Depends On (Outside FirstTry's Control)

| Dependency | What Could Go Wrong | Detection | Mitigation |
|---|---|---|---|
| **Jira Cloud API stability** | API field removes/changes/deprecates | Integration test failures | Monitor Jira release notes |
| **Webhook delivery** | Webhooks stop being delivered | No fresh data in FirstTry | Re-run policy scan manually |
| **Forge storage availability** | Cannot write/read from Forge storage | Errors in logs | Contact Atlassian support |
| **Atlassian account lock** | Customer's Jira Cloud org is locked | App becomes inaccessible | Work with Atlassian to unlock |
| **Jira license expires** | Jira Cloud org is de-provisioned | All data lost | Renew license before expiry |
| **Network partition** | Forge cannot reach Jira API | App timeouts/failures | Wait for network to heal; not app bug |

### 3.2 What FirstTry Risks (Inside FirstTry's Control)

| Risk | What Could Go Wrong | Detection | Mitigation |
|---|---|---|---|
| **Logging redaction failure** | PII accidentally logged | Code review + static scans | Tests catch PII patterns |
| **Unbounded data growth** | Storage quota exceeded | Error logs + storage monitoring | Monitor workspace size |
| **API rate limit hit** | Requests throttled/denied | Rate limit errors in logs | Implement backoff + retry |
| **Jira schema change breakage** | Code assumes field that was removed | Integration test failures | Update code for new schema |
| **Concurrency bug** | Two requests corrupt same data | Data inconsistency | Thread-safe storage access |

---

## 4. Marketplace Gaps (Known, Acknowledged)

### 4.1 What FirstTry Does NOT Provide

| Capability | Reason | Escalation |
|---|---|---|
| **On-premise deployment** | Forge is cloud-only | Evaluate alternative products |
| **Custom encryption** | Atlassian controls encryption | Contact Atlassian for key mgmt options |
| **Dedicated support SLA** | FirstTry is best-effort support app | Escalate to Atlassian support |
| **Data residency guarantee** | Locked to Jira Cloud region | Choose region carefully at signup |
| **SOC 2 report from FirstTry** | Atlassian's Forge is SOC 2, FirstTry runs on it | Use Atlassian's SOC 2 attestation |
| **HIPAA compliance** | Not designed for healthcare data | Evaluate HIPAA-certified alternatives |
| **Data backup to external storage** | Atlassian controls backups | Use Atlassian's backup export tools |
| **Data export on-demand** | Limited to what Jira API exposes | Manual JSON export from FirstTry possible |
| **SIEM integration** | FirstTry logs are application-level only | Use Jira's audit trail for SIEM |
| **Custom legal terms / DPA** | Atlassian terms govern platform | Contact Atlassian for custom terms |

### 4.2 Why These Are Not Blockers

**All gaps are due to Atlassian Forge architecture**, not FirstTry design flaws:

- If your org **requires on-premise**: Atlassian Forge is cloud-only; choose non-Forge solution
- If your org **requires custom encryption**: Atlassian doesn't offer key management; escalate to Atlassian
- If your org **requires HIPAA**: Atlassian Forge is not HIPAA-compliant; choose HIPAA alternative
- If your org **requires dedicated SLA**: Forge apps are best-effort; escalate to Atlassian if you need SLA

**FirstTry is marketplace-ready for all customers whose requirements fit Atlassian Forge constraints.**

---

## 5. Monitoring & Escalation

### 5.1 What to Monitor (Customer Responsibility)

| Signal | What to Check | Frequency | Action If Alert |
|---|---|---|---|
| **Workspace storage usage** | FirstTry storage in Jira Cloud admin | Weekly | Contact FirstTry if unexpectedly large |
| **API rate limit errors** | FirstTry app logs for rate limiting | Daily (if heavy use) | Back off request frequency |
| **Jira Cloud status page** | Atlassian status updates | Check if issues reported | Wait for Atlassian fix; not FirstTry issue |
| **Jira release notes** | Deprecated fields/APIs | Per release (monthly) | Notify FirstTry team if breaking change |
| **Atlassian security advisories** | CVEs in Jira Cloud | Subscribe to email | Escalate to Atlassian if FirstTry affected |
| **FirstTry app logs** | Error rates, timeouts | Weekly | Report patterns to FirstTry support |

### 5.2 Escalation Path

```
Customer Observation
    ↓
Is it FirstTry logic? (e.g., wrong policy detected)
    ├─ YES → Report to FirstTry support → FirstTry fixes code
    └─ NO → Is it Jira Cloud / Forge?
            ├─ YES → Escalate to Atlassian → Atlassian fixes platform
            └─ MAYBE → Check DOCS_TRUTH_SOURCES.md → Determine owner
```

### 5.3 Real Examples

| Customer Says | Root Cause | Escalation |
|---|---|---|
| "FirstTry lost my data" | Jira admin didn't confirm data location; EU region not chosen | Escalate to Jira admin |
| "I can't export my data" | Jira API doesn't expose certain fields | Escalate to Atlassian API support |
| "FirstTry won't access my Jira" | Jira admin didn't grant FirstTry permission | Escalate to Jira admin |
| "FirstTry detected wrong policy" | Jira webhook didn't fire or arrived late | Check Jira webhook logs; escalate if needed |
| "Storage is full" | Workspace hit Atlassian quota limit | Check quota in Jira; request larger plan |
| "FirstTry is slow" | API rate limits being hit; too many requests | Reduce request frequency or request higher tier |

---

## 6. Acceptable Risk Boundaries

### 6.1 FirstTry Accepts This Risk

✅ **Acceptable**:
- Jira Cloud outages (Atlassian responsibility)
- Webhook delivery delays (Atlassian responsibility)
- API schema changes (Customer must test; Atlassian may deprecate)
- Encryption by Atlassian (We trust Atlassian)
- Storage lifecycle by Atlassian (Customer chooses region)
- Support SLA (Best effort; escalate to Atlassian if needed)

### 6.2 FirstTry Does NOT Accept This Risk

❌ **Unacceptable** (Would block marketplace approval):
- FirstTry logs PII (automatic fail; tests catch it)
- FirstTry makes undeclared network calls (automatic fail; tests catch it)
- FirstTry invents false certifications (automatic fail; docs validation catches it)
- FirstTry contradicts itself (automatic fail; consistency tests catch it)
- FirstTry lies about platform capabilities (automatic fail; truth hierarchy enforced)

---

## 7. Future Risk Reduction (Potential Improvements)

| Risk | Potential Mitigation | Feasibility | Timeline |
|---|---|---|---|
| **Webhook loss** | Implement periodic reconciliation scan | ✅ Medium effort | Q1 2026 |
| **Rate limit handling** | Smarter backoff + retry logic | ✅ Medium effort | Q1 2026 |
| **Schema change resilience** | Graceful degradation if fields missing | ✅ Medium effort | Q2 2026 |
| **Observability** | Better logging + metrics dashboards | ✅ Medium effort | Q2 2026 |
| **Data export** | Manual JSON export without Jira API | ✅ Low effort | Q1 2026 |
| **Custom documentation** | Org-specific compliance docs | ⚠️ High effort; must involve Atlassian | Q3 2026+ |
| **Enterprise SLA** | Paid support tier with response SLA | ⚠️ Requires business model change | Q2 2027+ |
| **On-premise version** | Port to Server/Data Center | ❌ Not feasible; Atlassian discontinuing Server | N/A |

---

## 8. What Will Never Be Resolved

| Limitation | Why | Acceptance |
|---|---|---|
| **On-premise deployment** | Atlassian discontinued Server; Forge is cloud-only | Accept Forge constraint or use non-Forge solution |
| **Custom encryption keys** | Forge platform doesn't expose key management | Trust Atlassian's encryption or use non-Forge solution |
| **HIPAA compliance** | Atlassian Forge is not HIPAA-certified | Use HIPAA-certified alternative |
| **FedRAMP approval** | Would require Atlassian to do FedRAMP; unlikely | Use FedRAMP-certified alternative |
| **Per-workspace SLA** | Forge apps share infrastructure; no per-app SLA | Escalate SLA needs to Atlassian |
| **Deterministic data deletion before uninstall** | Forge controls lifecycle; not app-controllable | Request feature from Atlassian |

---

## 9. Communication to Customers

### 9.1 What to Say When Gap Is Hit

**Customer**: "Can FirstTry guarantee my data is in the EU?"

**Correct Response**:
> "FirstTry stores data in Atlassian Forge, which uses your Jira Cloud region. If you signed up for EU region, your data stays in EU per Atlassian's commitment. FirstTry cannot override region choice—that's determined by your Jira Cloud setup. Please confirm your Jira Cloud region with your workspace admin."

**Incorrect Response** ❌:
> "Yes, FirstTry guarantees EU residency." (Lie; only Atlassian can guarantee)

### 9.2 What to Say When Escalation Is Needed

**Customer**: "Can I get a DPA from FirstTry?"

**Correct Response**:
> "FirstTry does not provide a standalone DPA because FirstTry operates on Atlassian Forge, which is governed by Atlassian Cloud terms. For DPA needs, contact Atlassian directly at security@atlassian.com. They can provide a DPA that covers Forge platform, which includes FirstTry."

**Incorrect Response** ❌:
> "Contact us for a DPA." (Sets false expectation)

---

## 10. Change Log

| Date | Entry |
|---|---|
| 2025-12-22 | v1.0 - Initial release: Documented all residual risks and known gaps |

---

## Related Documents

- [DOCS_TRUTH_SOURCES.md](DOCS_TRUTH_SOURCES.md) — Truth hierarchy for claims
- [PLATFORM_DEPENDENCIES.md](../docs/PLATFORM_DEPENDENCIES.md) — What FirstTry depends on
- [CREDIBILITY_HARDENING_REPORT.md](CREDIBILITY_HARDENING_REPORT.md) — Summary of all fixes
