# FirstTry — Documentation Index

---

## � ENTERPRISE SECURITY DOCUMENTATION

**Looking for security, compliance, and procurement docs?** See **[procurement/ENTERPRISE_SECURITY_PACK_INDEX.md](procurement/ENTERPRISE_SECURITY_PACK_INDEX.md)** — comprehensive index for security diligence, control mapping, and evidence bundles.

---

## 🚀 START HERE (Choose Your Path)

### For Marketplace Submission & Compliance
→ **[trust/README.md](trust/README.md)** — Trust & Transparency Center (privacy, security, support)  
→ **[trust/privacy-policy.md](trust/privacy-policy.md)** — Privacy policy and data practices  
→ **[trust/security.md](trust/security.md)** — Security overview and controls  
→ **[trust/vulnerability-disclosure.md](trust/vulnerability-disclosure.md)** — How to report security issues

### For Enterprise Procurement/CISO
→ **[procurement/ENTERPRISE_SECURITY_PACK_INDEX.md](procurement/ENTERPRISE_SECURITY_PACK_INDEX.md)** — Master index for all security documentation  
→ **[procurement/SECURITY_QUESTIONNAIRE_MASTER.md](procurement/SECURITY_QUESTIONNAIRE_MASTER.md)** — Pre-answered vendor diligence questionnaire  
→ **[procurement/CONTROL_MAPPING_MATRIX.md](procurement/CONTROL_MAPPING_MATRIX.md)** — SOC2, ISO27k, CAIQ framework mappings  
→ **[trust/THREAT_MODEL.md](trust/THREAT_MODEL.md)** — STRIDE analysis with mitigations

### For Marketplace Reviewers  
→ **[trust/SECURITY_OVERVIEW.md](trust/SECURITY_OVERVIEW.md)** — Security posture and shared responsibility model  
→ **[trust/RESOLVER_INVENTORY.md](trust/RESOLVER_INVENTORY.md)** — Evidence of read-only operations (no mutations)  
→ **[operations/CI_CD_EVIDENCE.md](operations/CI_CD_EVIDENCE.md)** — Dependency scanning and evidence artifacts

### For Jira Admins (Implementation)
→ **[trust/CUSTOMER_RESPONSIBILITIES.md](trust/CUSTOMER_RESPONSIBILITIES.md)** — Your obligations and configuration steps  
→ **[trust/UNINSTALL_DELETION.md](trust/UNINSTALL_DELETION.md)** — Data deletion workflow and SLA

### For Security/Compliance Review
→ **[trust/SECURITY_OVERVIEW.md](trust/SECURITY_OVERVIEW.md)** — Security model and controls  
→ **[operations/INCIDENT_RESPONSE_PLAN.md](operations/INCIDENT_RESPONSE_PLAN.md)** — Incident handling procedures  
→ **[operations/SLA.md](operations/SLA.md)** — Support response SLAs (NO uptime guarantees)

---

## Key Documentation

**Core Docs**: [PRIVACY.md](PRIVACY.md), [TERMS.md](TERMS.md), [SECURITY.md](SECURITY.md), [SUPPORT.md](SUPPORT.md), [DATA_RETENTION.md](DATA_RETENTION.md)  
**Technical Docs**: [EXTERNAL_APIS.md](EXTERNAL_APIS.md), [SCOPES_JUSTIFICATION.md](SCOPES_JUSTIFICATION.md), [ARCHITECTURE_DIAGRAM.md](trust/stubs/ARCHITECTURE_DIAGRAM.md), [EVIDENCE_INTEGRITY.md](EVIDENCE_INTEGRITY.md), [EXPORT_FORMAT.md](EXPORT_FORMAT.md)  
**Operational Docs**: [UNINSTALL.md](UNINSTALL.md), [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md), [AUDIT_USAGE_GUIDE.md](trust/stubs/AUDIT_USAGE_GUIDE.md)

---

## ⚠️ Internal Engineering Documentation (Not Customer-Facing)

The following docs are **internal engineering/phase docs** and are **not required for customer approval or Marketplace review**. They document the development history and engineering decisions.

**Reference Only** — For FirstTry team and code reviewers only:  
[PHASE_P1_COMPLETE_SUMMARY.md](PHASE_P1_COMPLETE_SUMMARY.md), [PHASE_P1_DOCUMENTATION_INDEX.md](PHASE_P1_DOCUMENTATION_INDEX.md), [PHASE_P1_PROGRESS.md](PHASE_P1_PROGRESS.md), [PHASE_P1_4_TENANT_ISOLATION_COMPLETE.md](PHASE_P1_4_TENANT_ISOLATION_COMPLETE.md), [PHASE_P1_5_POLICY_DRIFT_COMPLETE.md](PHASE_P1_5_POLICY_DRIFT_COMPLETE.md), [PHASE_7_V2_SPEC.md](PHASE_7_V2_SPEC.md), [PHASE_7_V2_IMPLEMENTATION_PLAN.md](PHASE_7_V2_IMPLEMENTATION_PLAN.md), [PHASE_7_V2_TESTPLAN.md](PHASE_7_V2_TESTPLAN.md), [PHASE_9_5B_SPEC.md](PHASE_9_5B_SPEC.md), [PHASE_9_5B_DELIVERY.md](PHASE_9_5B_DELIVERY.md), [PHASE_9_5C_SPEC.md](PHASE_9_5C_SPEC.md), [PHASE_9_5C_DELIVERY.md](PHASE_9_5C_DELIVERY.md), [PHASE_9_5D_SPEC.md](PHASE_9_5D_SPEC.md), [PHASE_9_5D_DELIVERY.md](PHASE_9_5D_DELIVERY.md), [PHASE4_SEALED_SPEC.md](PHASE4_SEALED_SPEC.md), [PHASE5_AUDIT_EXPORT.md](PHASE5_AUDIT_EXPORT.md), [P4_P5_IMPLEMENTATION_SUMMARY.md](P4_P5_IMPLEMENTATION_SUMMARY.md), [P4_P5_COMPLETE_REFERENCE.md](P4_P5_COMPLETE_REFERENCE.md), [P5_PROCUREMENT_ACCELERATION.md](P5_PROCUREMENT_ACCELERATION.md), [HEARTBEAT_DELIVERABLES_INDEX.md](HEARTBEAT_DELIVERABLES_INDEX.md), [HEARTBEAT_INTEGRATION.md](HEARTBEAT_INTEGRATION.md), [HEARTBEAT_QUICK_REF.md](HEARTBEAT_QUICK_REF.md), [HEARTBEAT_TRUST_DASHBOARD.md](HEARTBEAT_TRUST_DASHBOARD.md), [HEARTBEAT_VERIFICATION.md](HEARTBEAT_VERIFICATION.md), [HEARTBEAT_DELIVERY_SUMMARY.md](HEARTBEAT_DELIVERY_SUMMARY.md), [PDF_REPORT_V2.md](trust/stubs/PDF_REPORT_V2.md), [RELEASE_PDF_REPORT_V2.md](trust/stubs/RELEASE_PDF_REPORT_V2.md), [MARKETPLACE_REVIEWER_NO_BACKFORTH_AUDIT.md](MARKETPLACE_REVIEWER_NO_BACKFORTH_AUDIT.md), [MARKETPLACE_SUBMISSION_INDEX.md](MARKETPLACE_SUBMISSION_INDEX.md)

**Internal References** (not customer-facing): [DATA_FLOW.md](DATA_FLOW.md), [EVIDENCE_MODEL.md](EVIDENCE_MODEL.md), [OUTPUT_CONTRACT.md](OUTPUT_CONTRACT.md), [OPERATIONAL_BEHAVIOR.md](OPERATIONAL_BEHAVIOR.md), [REGENERATION_GUARANTEES.md](REGENERATION_GUARANTEES.md), [RELIABILITY.md](RELIABILITY.md), [CHANGELOG.md](CHANGELOG.md)

What it does (factual)
- Collects Jira metadata and generates governance evidence, drift signals, and exportable reports. Data storage is tenant-scoped Forge Storage.

Where to view reports / outputs
- No admin UI is provided. All governance metrics are captured automatically via scheduled triggers. Reports are stored in tenant-scoped Forge Storage.

What runs automatically vs manual
- Scheduled functions defined in `manifest.yml` run automatically at the declared intervals (daily, weekly, fiveMinute, 12hours for token-refresh). See `manifest.yml` scheduledTrigger section.
- No manual actions are required.

Quickstart install steps (developer-facing)
1. Deploy or install the Forge app to your Jira Cloud site using the Forge CLI or Marketplace install flow.
2. Verify the app appears under Jira admin pages as "FirstTry Proof-of-Life Report".

Export steps (end-user)
- From the admin UI, open the Proof-of-Life / Reports page and use the Export action to download JSON or PDF of the latest report. (See `EXPORT_FORMAT.md` for schema details.)

Uninstall steps (summary)
- Uninstall the app from Jira admin. Forge Storage is not removed automatically; see `UNINSTALL.md` and `DATA_RETENTION.md` for deletion procedures.

Links
- Full documentation index: start from this file and follow links above.

---

## Contact

- **General inquiries**: contact@firsttry.run
- **Technical support**: support@firsttry.run
- **Security**: security.contact@firsttry.run
- **Privacy/Data requests**: privacy@firsttry.run
