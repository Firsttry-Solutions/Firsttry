# Atlassian Marketplace Privacy & Data Questionnaire — Answer Key

This document defines the approved responses for Atlassian Marketplace privacy, data handling, and security questionnaires. Any change must be documented via a change request and approved by the security owner. Each answer must cite proof anchors in docs/SECURITY_SUMMARY.md and docs/PRIVACY.md.

---

**Version**: 1.0  
**Date Stamp**: 2026-01-13T00:00:00Z  
**Status**: Canonical, Deterministic, Non-Deviable  
**Reviewed**: Security Team  
**Last Updated**: 2026-01-13

---

## Overview

This document provides a single source of truth for all data handling and privacy questions posed by Atlassian Marketplace reviewers. Each answer includes:
1. **Answer**: YES or NO (unambiguous)
2. **1-Sentence Justification**: Concise reasoning
3. **Proof Anchor**: Reference to SECURITY_SUMMARY.md or PRIVACY.md with line numbers

---

## Questionnaire Responses

| # | Question | Answer | Justification | Proof Anchor |
|---|----------|--------|---------------|--------------|
| **1** | Does your app store any data? | **YES** | FirstTry stores governance policies, audit events, and snapshots in Atlassian Forge storage. | [SECURITY_SUMMARY.md:L47-L51](SECURITY_SUMMARY.md#L47-L51) |
| **2** | Does your app store personal data (PII)? | **NO** | FirstTry explicitly does not collect or store email addresses, user IDs, IP addresses, or any personally identifiable information; user identities are hashed for audit correlation. | [PRIVACY.md:L42-L58](PRIVACY.md#L42-L58) |
| **3** | Does your app send data outside Atlassian infrastructure? | **NO** | All data is processed and stored within Atlassian Forge platform; no external API calls or data transmission outside Atlassian infrastructure. | [SECURITY_SUMMARY.md:L26-L30](SECURITY_SUMMARY.md#L26-L30) |
| **4** | Does your app modify or delete Jira data? | **NO** | FirstTry operates exclusively with read-only Jira API scopes (`read:jira-work`); no write, delete, or state-modification operations are possible. | [SECURITY_SUMMARY.md:L31-L36](SECURITY_SUMMARY.md#L31-L36) |
| **5** | Does your app access user email addresses? | **NO** | FirstTry accesses only Jira issue metadata and assignee user keys (not email); email addresses are never collected or processed. | [PRIVACY.md:L42-L58](PRIVACY.md#L42-L58) |
| **6** | Does your app access user passwords or tokens? | **NO** | Authentication is delegated to Atlassian Forge; FirstTry never requests, stores, or processes passwords or API tokens. | [SECURITY_SUMMARY.md:L112-L116](SECURITY_SUMMARY.md#L112-L116) |
| **7** | Does your app support data deletion? | **YES** | Users can delete all FirstTry data by uninstalling the app (Atlassian-managed deletion) or by using `firstry policy delete --all` to remove policies; audit records remain for compliance but are immutable. | [PRIVACY.md:L98-L108](PRIVACY.md#L98-L108) |
| **8** | Does your app retain data indefinitely? | **YES** | FirstTry retains audit event data indefinitely (no automatic TTL); customers can request deletion via Atlassian support or uninstall the app. | [PRIVACY.md:L70-L75](PRIVACY.md#L70-L75) |
| **9** | Does your app perform real-time user behavior tracking? | **NO** | FirstTry does not track individual user behavior, user clicks, browsing patterns, or personal analytics; it only tracks policy evaluation decisions (aggregated, hashed). | [PRIVACY.md:L26-L33](PRIVACY.md#L26-L33) |
| **10** | Does your app send usage analytics to external services? | **NO** | All usage metrics remain within Atlassian Forge; no external analytics, SaaS telemetry, or third-party tracking systems are used. | [SECURITY_SUMMARY.md:L26-L30](SECURITY_SUMMARY.md#L26-L30) |
| **11** | Does your app implement encryption? | **YES** | Data encryption is provided by Atlassian Forge: AES-256 at rest (AWS-managed), TLS 1.2+ in transit (Jira Cloud to Forge). | [MARKETPLACE_LISTING.md:L157-L162](MARKETPLACE_LISTING.md#L157-L162) |
| **12** | Does your app support export of user data (GDPR right to portability)? | **YES** | Users can export all FirstTry data (policies, audit entries, usage summary) via `firstry export` in JSON format; export is PII-free (hashed identities). | [PRIVACY.md:L81-L93](PRIVACY.md#L81-L93) |
| **13** | Does your app allow users to modify their data? | **YES** | Users can modify policies directly using `firstry policy update <policy-id>`; modification timestamps are audited for compliance. | [PRIVACY.md:L94-L102](PRIVACY.md#L94-L102) |
| **14** | Does your app enforce scope restrictions at the manifest level? | **YES** | FirstTry declares only two scopes in Forge manifest: `storage:app` and `read:jira-work`; no write, admin, or user-access scopes are declared. | [SECURITY_SUMMARY.md:L22-L26](SECURITY_SUMMARY.md#L22-L26) |
| **15** | Does your app support tenant isolation (multi-workspace safety)? | **YES** | Forge storage enforces workspace-scoped isolation using cloudId-based key prefixing; cross-tenant data access is cryptographically prevented. | [SECURITY_SUMMARY.md:L47-L51](SECURITY_SUMMARY.md#L47-L51) |
| **16** | Does your app have customer support / security contact? | **YES** | Support is community-basis via repository GitHub issues; security issues can be reported to security@firstry.io (if available); response time: 30 days (GDPR requirement). | [PRIVACY.md:L139-L149](PRIVACY.md#L139-L149) |
| **17** | Does your app support GDPR compliance (right to access, rectification, deletion, restriction, portability)? | **YES** | All five GDPR user rights are implemented: access (`firstry export`), rectification (`policy update`), deletion (`policy delete`), restriction (`policy disable`), portability (`JSON export`). | [PRIVACY.md:L81-L115](PRIVACY.md#L81-L115) |
| **18** | Does your app support CCPA compliance (right to know, right to delete, right to opt-out)? | **YES** | CCPA rights are supported: right to know (`firstry export`), right to delete (`firstry policy delete`), right to opt-out (N/A; no advertising). | [PRIVACY.md:L119-L128](PRIVACY.md#L119-L128) |
| **19** | Does your app claim HIPAA compliance? | **NO** | FirstTry is NOT a HIPAA-compliant system; customers handling PHI (Protected Health Information) should not use FirstTry for regulated workflows. | [PRIVACY.md:L130-L138](PRIVACY.md#L130-L138) |
| **20** | Does your app use subprocessors or third-party services for data processing? | **YES** | Atlassian Forge is the sole subprocessor; Atlassian is SOC2/ISO27001 certified and processes all data on AWS infrastructure. | [PRIVACY.md:L153-L157](PRIVACY.md#L153-L157) |

---

## Critical Data Handling Facts

### What FirstTry Stores (YES, it stores data)

✅ Policy configurations (user-provided rules, name, description)  
✅ Audit event ledger (policy decisions, timestamps, correlation IDs)  
✅ Governance snapshots (metadata, status, compliance results)  
✅ Usage metrics (aggregated counts, hashed)  

**Proof**: [PRIVACY.md:L14-L33](PRIVACY.md#L14-L33)

### What FirstTry Does NOT Store (NO PII)

❌ User email addresses  
❌ User passwords or tokens  
❌ User IP addresses  
❌ Jira issue summaries or comments  
❌ User location or browser fingerprints  
❌ Team membership or org hierarchy  

**Proof**: [PRIVACY.md:L42-L58](PRIVACY.md#L42-L58)

### Data Deletion & Retention

- **On Uninstall**: All FirstTry data is deleted by Atlassian Forge (platform-managed)
- **Manual Deletion**: Users can delete individual policies or all policies using CLI
- **Audit Records**: Remain immutable for compliance; deleted policies archived but not restorable
- **Retention Period**: Indefinite (no FirstTry-enforced TTL); customers can request deletion via Atlassian support

**Proof**: [PRIVACY.md:L70-L115](PRIVACY.md#L70-L115)

### Data Security & Encryption

| Layer | Method | Details |
|-------|--------|---------|
| **At Rest** | AES-256 | AWS-managed, provided by Forge platform |
| **In Transit** | TLS 1.2+ | HTTPS between Jira Cloud and Forge |
| **Access Control** | Tenant-scoped keys | CloudId-based prefix prevents cross-tenant access |
| **Audit Trail** | Append-only, UUID-based | Immutable event log with cryptographic uniqueness |

**Proof**: [MARKETPLACE_LISTING.md:L157-L162](MARKETPLACE_LISTING.md#L157-L162)

---

## Negative Assertions (What FirstTry Does NOT Do)

### Read-Only Operations Only
**Claim**: FirstTry performs NO write operations on Jira data.  
**Proof**: Manifest restricts scopes to `storage:app` and `read:jira-work` (no write scopes declared). Validated by `reviewer_ready_gate.sh` Check 3C (write-surface ban). [SECURITY_SUMMARY.md:L31-L36](SECURITY_SUMMARY.md#L31-L36)

### No Custom Authentication
**Claim**: FirstTry does NOT implement custom authentication or authorization logic.  
**Proof**: All auth decisions delegated to Atlassian Forge; application receives pre-authenticated requests. [SECURITY_SUMMARY.md:L112-L116](SECURITY_SUMMARY.md#L112-L116)

### No Feature-Tier Gating
**Claim**: FirstTry does NOT provide feature-tier gating or entitlement enforcement.  
**Proof**: All security boundaries enforced through Forge manifest scopes; no license checks, tier evaluations, or entitlement logic. [MARKETPLACE_LISTING.md:L195-L198](MARKETPLACE_LISTING.md#L195-L198)

### No End-to-End Encryption for Custom Code
**Claim**: FirstTry does NOT provide custom end-to-end encryption (E2E encryption managed by Forge platform).  
**Proof**: Data encryption in transit/at rest managed by Atlassian Cloud/AWS; outside FirstTry application scope. [SECURITY_SUMMARY.md:L108-L111](SECURITY_SUMMARY.md#L108-L111)

### No Real-Time User Tracking
**Claim**: FirstTry does NOT perform real-time user behavior tracking or analytics.  
**Proof**: Usage metrics are aggregated and hashed; no individual user clicks, sessions, or browsing patterns tracked. [PRIVACY.md:L26-L33](PRIVACY.md#L26-L33)

### No External Data Transfer
**Claim**: FirstTry does NOT send data outside Atlassian infrastructure.  
**Proof**: No external API calls; all data remains within Forge platform (AWS). [SECURITY_SUMMARY.md:L26-L30](SECURITY_SUMMARY.md#L26-L30)

---

## Compliance Readiness

### GDPR (General Data Protection Regulation)
✅ **Legal Basis**: Legitimate interest (Jira workflow governance)  
✅ **Data Minimization**: Only governance/metadata; no PII  
✅ **Encryption**: In transit (TLS) + at rest (AES-256)  
✅ **Audit Trail**: Immutable policy decisions (UUID-based)  
✅ **User Rights**: All 5 rights implemented (access, rectify, delete, restrict, portability)  
✅ **Data Processing**: Atlassian Forge is certified DPA processor  
**Proof**: [PRIVACY.md:L112-L118](PRIVACY.md#L112-L118)

### CCPA (California Consumer Privacy Act)
✅ **Data Disclosure**: This privacy policy + questionnaire  
✅ **Right to Know**: `firstry export` provides all data  
✅ **Right to Delete**: `firstry policy delete` + uninstall  
✅ **Right to Opt-Out**: N/A (no advertising/data sale)  
✅ **Non-Discrimination**: No pricing based on privacy choices  
**Proof**: [PRIVACY.md:L119-L128](PRIVACY.md#L119-L128)

### SOC2 / ISO27001
✅ **Compliance Level**: Inherited from Atlassian Forge (not app-level certification)  
✅ **Audit Frequency**: Atlassian performs annual SOC2 audits  
✅ **Subprocessor**: Atlassian is sole subprocessor (SOC2/ISO27001 certified)  
**Proof**: [PRIVACY.md:L1-L5](PRIVACY.md#L1-L5) (disclaimer)

### HIPAA (Health Insurance Portability & Accountability Act)
❌ **HIPAA Compliance**: NOT SUPPORTED  
❌ **PHI Processing**: FirstTry is NOT HIPAA-compliant  
❌ **Regulated Workflows**: Do NOT use FirstTry for HIPAA-regulated data  
**Proof**: [PRIVACY.md:L130-L138](PRIVACY.md#L130-L138)

---

## Support & Escalation

### Support Model
**Type**: Community-basis (no SLA)  
**Channel**: GitHub repository issues  
**Response Time**: Best effort (no guaranteed SLA)  

### Security Issues
**Reporting**: security@firstry.io (if available; check README for current contact)  
**Response Time**: 30 days (GDPR requirement for data breach notification)  
**Escalation**: Contact Atlassian if FirstTry does not respond  

### Privacy Requests
**Data Subject Requests** (GDPR): email privacy@firstry.io  
**Response Time**: 30 days  
**Scope**: Right to access, rectification, deletion, restriction, portability  

**Proof**: [PRIVACY.md:L139-L151](PRIVACY.md#L139-L151)

---

## Canonical Version Statement

This answer key represents the **single source of truth** for all Marketplace questionnaire responses.

| Property | Value |
|----------|-------|
| **Version** | 1.0 |
| **Created** | 2026-01-13 |
| **Status** | Canonical, Deterministic, Non-Deviable |
| **Last Updated** | 2026-01-13 |
| **Review Date** | Q1 2026 |
| **Change Control** | All deviations require security@firstry.io approval + change request |
| **Consistency Verified** | YES (against SECURITY_SUMMARY.md, PRIVACY.md, MARKETPLACE_LISTING.md) |

### How to Use This Document

1. **For Marketplace Submission**: Copy answers from the table above directly into Marketplace form fields.
2. **For Security Audits**: Reference proof anchors to validate each claim against source documentation.
3. **For Updates**: If SECURITY_SUMMARY.md or PRIVACY.md changes, re-verify all answers and update proof anchors.
4. **For Deviations**: Any change to an answer must be:
   - Approved by security@firstry.io
   - Documented in a change request (commit message)
   - Updated in this file with new proof anchors
   - Validated by `bash tools/validate_docs.sh`

---

**END OF ANSWER KEY**

**Questions?** Contact security@firstry.io or review the source documentation:
- [docs/SECURITY_SUMMARY.md](SECURITY_SUMMARY.md)
- [docs/PRIVACY.md](PRIVACY.md)
- [docs/MARKETPLACE_LISTING.md](MARKETPLACE_LISTING.md)
