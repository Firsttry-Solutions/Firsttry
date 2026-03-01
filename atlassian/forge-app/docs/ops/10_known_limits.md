# Known Limits — Explicit Non-Goals, Constraints, Boundaries

**Doc ID:** FT-OPS-010  
**Version:** 1.0.0  
**Owner:** operations@firsttry.run  
**Last Updated:** 2026-03-01  
**Review Cycle:** Quarterly  

## Audience

Operators, buyers, and evaluators understanding FirstTry's explicit boundaries.

## Purpose

This document states what FirstTry does NOT do, cannot do, or will not do. It sets realistic expectations and prevents misallocation of effort.

---

## Platform Constraints (Forge)

### FirstTry CANNOT run outside Atlassian Forge

**Reason:** Built on Forge platform APIs. No standalone deployment model.

**Implication:** Requires Jira Cloud. Does not support Jira Server, Jira Data Center, or other Atlassian products (Confluence, Bitbucket) unless explicitly stated.

**Workaround:** None. Use Forge-compatible Jira Cloud sites only.

---

### FirstTry CANNOT access localhost or internal networks

**Reason:** Forge security model prohibits backend functions from accessing localhost, private IPs, or VPN-connected resources.

**Implication:** Cannot integrate with on-premise systems, cannot fetch data from internal APIs.

**Workaround:** Use cloud-accessible APIs with proper authentication, or use Jira as intermediary (if Jira can access the resource).

---

### FirstTry storage limit is 5 MB per installation (default)

**Reason:** Forge platform enforces storage quota.

**Implication:** Cannot store large datasets (e.g., full audit trails with attachments, large exports).

**Workaround:** Implement data retention policy (delete old evidence), or request quota increase from Atlassian (requires justification).

---

### Backend functions have 10-second execution limit

**Reason:** Forge enforces timeout to prevent resource exhaustion.

**Implication:** Long-running operations (full audits, bulk data processing) cannot run in backend functions.

**Workaround:** Implement pagination, async processing, or export data for external processing.

---

### FirstTry CANNOT modify Jira data by default

**Reason:** Read-only scopes enforced for security. Write scopes are optional and disabled in default manifest.

**Implication:** Cannot create issues, update fields, or modify workflows without explicit scope grant.

**Workaround:** Request write scopes explicitly in manifest (requires user re-consent), or use Jira's native features for data modification.

---

## Operational Constraints

### FirstTry does NOT include managed hosting or SLA for Enterprise Forge Apps

**Reason:** Forge Apps are deployed via Atlassian's platform. FirstTry does not control infrastructure, uptime, or performance beyond code quality.

**Implication:** Uptime depends on Atlassian Forge platform SLA. FirstTry cannot guarantee independent SLA.

**Workaround:** Review Atlassian Forge SLA for enterprise apps. FirstTry provides best-effort response per support policy.

---

### FirstTry does NOT provide 24/7 on-call support

**Reason:** Small team, limited operational resources.

**Implication:** P2/P3 incidents may not receive immediate response outside business hours.

**Workaround:** Use Atlassian support for platform issues. File GitHub issues for non-urgent FirstTry bugs.

---

### FirstTry does NOT support custom branding or white-labeling

**Reason:** Single codebase for all installations. Custom UI per tenant increases maintenance burden.

**Implication:** UI shows FirstTry branding. Cannot replace with customer logo or theme.

**Workaround:** None. FirstTry branding is non-negotiable.

---

### FirstTry does NOT support offline or air-gapped deployments

**Reason:** Forge requires internet connectivity for API calls, storage, and function execution.

**Implication:** Cannot run in fully offline Jira instances (if such exist).

**Workaround:** Ensure Jira Cloud site has internet access. FirstTry uses Forge APIs, which are cloud-only.

---

## Security Constraints

### FirstTry does NOT encrypt data at rest beyond Forge platform encryption

**Reason:** Forge Storage API provides encryption at rest. FirstTry uses this, does not implement additional encryption layers.

**Implication:** Data security relies on Forge platform guarantees. FirstTry cannot guarantee stronger encryption without platform support.

**Workaround:** Review Atlassian Forge security documentation for encryption details.

---

### FirstTry does NOT support bring-your-own-key (BYOK) encryption

**Reason:** Forge platform does not provide BYOK for storage. Encryption keys managed by Atlassian.

**Implication:** Customer-managed encryption keys are not supported.

**Workaround:** None. Accept Atlassian-managed keys, or do not use app if BYOK is hard requirement.

---

### FirstTry does NOT store PII or sensitive customer data intentionally

**Reason:** Design principle: Minimal data collection. Audit evidence contains metadata (issue IDs, user IDs), not full issue content or PII unless explicitly logged for audit.

**Implication:** FirstTry is not a data warehouse. It does not archive full Jira datasets.

**Workaround:** Use Jira's native export features for full data backups.

---

### FirstTry does NOT implement role-based access control (RBAC) beyond Jira permissions

**Reason:** Forge apps inherit Jira permissions. Users with Jira Admin can access app admin features. FirstTry does not add separate permission layers.

**Implication:** Any Jira Admin can access FirstTry admin features. Cannot restrict FirstTry access to subset of admins.

**Workaround:** Manage Jira Admin permissions carefully. Do not grant Jira Admin role to users who should not access FirstTry.

---

## Compliance Constraints

### FirstTry does NOT claim SOC 2, ISO 27001, or other compliance certifications

**Reason:** Small organization, no formal audit process for certifications.

**Implication:** FirstTry cannot provide compliance attestation reports (SOC 2 Type II, ISO 27001 certificate, etc.).

**Workaround:** FirstTry provides transparency documentation (trust center, threat model, claims register). Evaluate based on documentation, not certifications.

---

### FirstTry does NOT provide HIPAA Business Associate Agreement (BAA)

**Reason:** Not designed for healthcare PHI processing.

**Implication:** Do not use FirstTry for HIPAA-covered PHI storage or processing.

**Workaround:** None. FirstTry is not HIPAA-compliant by design.

---

### FirstTry does NOT guarantee GDPR Data Processing Agreement (DPA) beyond standard terms

**Reason:** Standard DPA provided in terms of service. Custom DPAs require legal review (not available for free tier).

**Implication:** GDPR compliance depends on customer's own data processing policies and FirstTry's standard DPA.

**Workaround:** Review FirstTry terms of service and privacy policy. For custom DPA, contact legal@firsttry.run (enterprise customers only).

---

## Functional Constraints

### FirstTry does NOT support custom workflows or scripting

**Reason:** Predefined functionality only. No scripting engine or workflow designer.

**Implication:** Cannot customize audit logic, cannot add custom validation rules beyond manifest configuration.

**Workaround:** Request feature via GitHub issue. Custom logic requires code contribution or maintainer implementation.

---

### FirstTry does NOT support real-time synchronization with external systems

**Reason:** Forge function execution model is request-response, not event-driven streaming.

**Implication:** Cannot push updates to external systems in real-time. No webhook support for continuous sync.

**Workaround:** Implement polling from external systems (call FirstTry API on schedule), or use Jira webhooks to trigger external processing.

---

### FirstTry does NOT support multi-tenancy across multiple Jira sites without separate installations

**Reason:** Each Jira site requires separate app installation. No cross-site data sharing.

**Implication:** Cannot aggregate data from multiple Jira sites into single FirstTry instance.

**Workaround:** Install FirstTry on each Jira site separately. Export data from each, aggregate externally.

---

### FirstTry does NOT support versioned API for external integrations

**Reason:** No public API exposed beyond Forge's standard mechanisms. FirstTry is UI-focused.

**Implication:** Cannot integrate programmatically via REST API. No API versioning guarantees.

**Workaround:** Use Jira APIs to access underlying data. FirstTry provides UI layer only.

---

## Audit Constraints

### Audit does NOT detect all security vulnerabilities

**Reason:** Audit covers 12 phases of common risks (supply chain, secrets, data flow, etc.). It is NOT a full penetration test or formal security audit.

**Implication:** Passing audit does not guarantee zero vulnerabilities. Audit reduces risk, does not eliminate.

**Workaround:** Complement with external security assessments (penetration testing, code review) for high-security requirements.

---

### Audit does NOT run continuously or in background

**Reason:** Audit is on-demand, manual execution (or CI-triggered). Not a continuous monitoring system.

**Implication:** Audit results are point-in-time. Code changes between audits are not automatically re-audited.

**Workaround:** Run audit before each production deployment. Integrate into CI/CD pipeline (already done via ci-core.yml).

---

### Audit does NOT analyze runtime behavior in production

**Reason:** Audit is static analysis + manifest validation. Does not monitor production logs, traffic, or behavior.

**Implication:** Runtime exploits, performance issues, or data breaches are not detected by audit.

**Workaround:** Implement runtime monitoring separately (Forge logs, observability tools).

---

## Support Constraints

### FirstTry does NOT provide phone support

**Reason:** Small team, email/GitHub issue-based support only.

**Implication:** No hotline for emergencies.

**Workaround:** Use email (security.contact@firsttry.run for P0/P1), GitHub issues for P2/P3. Response SLA documented in support policy.

---

### FirstTry does NOT provide on-site consulting or implementation services

**Reason:** Product is self-service. No professional services team.

**Implication:** Operators must follow documentation independently. No custom setup assistance.

**Workaround:** Follow operator runbooks (this documentation). File GitHub issues for missing guidance.

---

### FirstTry does NOT provide training or certification programs

**Reason:** Documentation-driven model. No formal training courses.

**Implication:** Operators learn via docs, no instructor-led training available.

**Workaround:** Read operator runbooks thoroughly. Ask questions via GitHub issues.

---

## Deployment Constraints

### FirstTry does NOT support preview or canary deployments

**Reason:** Forge deployment model: Single deployment applies to all installations immediately after `forge install --upgrade`.

**Implication:** Cannot test new version on subset of installations before full rollout.

**Workaround:** Test in non-production Jira site first. Use Forge tunnel mode for development testing. Rollback if production issues occur.

---

### FirstTry does NOT support automated rollback on failure

**Reason:** Rollback is manual via `forge deploy rollback`. No automated health checks or rollback triggers.

**Implication:** Operator must detect issues and initiate rollback manually.

**Workaround:** Monitor logs after deployment. Follow incident response procedure for rollbacks.

---

## Data Retention Constraints

### FirstTry does NOT retain data after app uninstall

**Reason:** Forge deletes app storage on uninstall (per platform policy).

**Implication:** All audit evidence, tenant configuration, and stored data is permanently deleted on uninstall.

**Workaround:** Export data before uninstalling. Use FirstTry's export feature to download audit evidence.

---

### FirstTry does NOT back up data externally

**Reason:** No automatic backup to external systems. Data resides in Forge storage only.

**Implication:** Data loss due to bugs, corruption, or accidental deletion is not recoverable by FirstTry.

**Workaround:** Export critical evidence regularly. Store exports in external backup system.

---

## Performance Constraints

### FirstTry UI may load slowly on large Jira sites (>10,000 issues)

**Reason:** Forge function limits (10s timeout), pagination overhead.

**Implication:** Initial load time may be 5-10 seconds on large sites.

**Workaround:** Implement pagination, caching. Avoid loading full datasets in single request.

---

### Audit evidence export may timeout for large datasets

**Reason:** Export operation must complete within Forge function timeout (10s).

**Implication:** Cannot export multi-MB evidence files in single operation.

**Workaround:** Implement chunked export (multiple requests, paginated).

---

## Expectation Setting

### What FirstTry IS:

- Audit evidence collection tool for Jira
- Forge app for Jira Cloud
- Deterministic audit framework (exit 0 on clean worktree)
- Transparency-first documentation approach
- Self-service operator model

### What FirstTry IS NOT:

- Complete security solution or replacement for penetration testing
- Managed service with guaranteed SLA
- Customizable or white-label product
- Real-time monitoring system
- Compliance certification holder (SOC 2, ISO, HIPAA)

---

## When to Escalate

If you need functionality listed in this document as NOT supported:

1. **File GitHub issue** with "enhancement" label
2. **Describe use case** (not just feature request)
3. **Accept feedback** if maintainers decline (some limits are architectural, cannot change)
4. **Consider alternative solutions** if FirstTry cannot meet requirement

**Do NOT assume FirstTry will add unsupported features.** This document is explicit boundary-setting.

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-01 | Initial known limits document |

---

## Notes

- **These are explicit design choices, not bugs.** Do not file feature requests for items listed here without understanding why they are limits.
- **Limits may change in future versions.** This document reflects FirstTry v1.0.0 capabilities.
- **Forge platform constraints are beyond FirstTry's control.** Escalate platform limits to Atlassian, not FirstTry.
