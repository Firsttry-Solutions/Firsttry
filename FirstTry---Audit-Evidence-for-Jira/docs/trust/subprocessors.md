# FirstTry Subprocessors

**Version:** 2.14.0  
**Last Updated:** March 4, 2026  
**Status:** Active

## 1. Overview

This document lists all subprocessors (third-party service providers) that process customer data on behalf of FirstTry, in compliance with GDPR Article 28 requirements.

## 2. Definition

**Subprocessor**: Any third party engaged by FirstTry to process personal data on behalf of FirstTry customers.

**Processing**: Any operation performed on personal data, including collection, storage, retrieval, use, or transmission.

## 3. Subprocessor List

### 3.1 Primary Subprocessor

FirstTry has **ONE subprocessor**:

| Subprocessor | Service | Data Processed | Location | Compliance |
|--------------|---------|----------------|----------|------------|
| **Atlassian Pty Ltd** | Forge Platform Hosting | Jira issue metadata (keys, summaries, status), snapshot data, configuration | Global (customer-selected region: US, EU, APAC) | SOC 2 Type II, ISO 27001, GDPR, CCPA, HIPAA |

**Role:** Atlassian hosts FirstTry as a Forge application. All FirstTry data resides in Atlassian's infrastructure.

**Data Flow:**
```
FirstTry App (Forge Runtime)
    │
    ├─ Reads Jira data via Forge Bridge → Atlassian Jira Cloud
    └─ Stores snapshots via Forge Storage → Atlassian Storage Service
```

### 3.2 No Other Subprocessors

FirstTry **does not use**:

- ❌ Analytics providers (no Google Analytics, Mixpanel, Segment)
- ❌ CDNs for customer data (no Cloudflare, Fastly)
- ❌ External databases (no AWS RDS, MongoDB Atlas)
- ❌ Logging services (no Datadog, Splunk, Sentry)
- ❌ Support platforms (no Zendesk, Intercom)
- ❌ Payment processors (no Stripe, PayPal) — billing handled by Atlassian Marketplace

**Result:** Zero data sharing with third parties beyond Atlassian.

---

## 4. Atlassian Subprocessor Details

### 4.1 Data Processing Agreement

**Contract:** Atlassian Marketplace Developer Agreement (includes DPA)

**Key Terms:**
- Atlassian processes data only on FirstTry's instructions
- Confidentiality obligations on Atlassian personnel
- Security measures (SOC 2, ISO 27001)
- Data breach notification (within 72 hours)
- Deletion on termination (uninstall)

**Reference:** https://www.atlassian.com/legal/marketplace-developer-agreement

### 4.2 Data Residency

Atlassian stores data in customer-selected regions:

| Region | Datacenter Location | Certifications |
|--------|---------------------|----------------|
| **US** | Virginia (US-East), Oregon (US-West) | SOC 2, ISO 27001, FedRAMP (in progress) |
| **EU** | Frankfurt (Germany), Dublin (Ireland) | SOC 2, ISO 27001, GDPR |
| **APAC** | Sydney (Australia) | SOC 2, ISO 27001 |

**Customer Control:** Jira Admin → System → Atlassian Account → Data Residency

**FirstTry Behavior:** FirstTry inherits customer's Jira data residency configuration.

### 4.3 Security and Compliance

Atlassian maintains the following certifications:

- ✅ **SOC 2 Type II** (Security, Availability, Confidentiality)
- ✅ **ISO 27001** (Information Security Management)
- ✅ **ISO 27018** (Cloud Privacy)
- ✅ **GDPR** (EU Data Protection)
- ✅ **CCPA** (California Consumer Privacy Act)
- ✅ **HIPAA** (Health Insurance Portability and Accountability Act)
- ✅ **Cloud Security Alliance STAR** (Level 2)

**Audit Reports:** Available at https://www.atlassian.com/trust/compliance

### 4.4 Atlassian Sub-Subprocessors

Atlassian may use sub-subprocessors (e.g., AWS for infrastructure). For the complete list:

- **Atlassian Subprocessor List:** https://www.atlassian.com/legal/sub-processors

**Examples (as of 2026-03-04):**
- Amazon Web Services (AWS) — Infrastructure
- Cloudflare — CDN and DDoS protection
- PagerDuty — Incident management

**Note:** FirstTry does not control Atlassian's sub-subprocessors. Customers should review Atlassian's list directly.

---

## 5. Data Processing Details

### 5.1 What Data Atlassian Processes

| Data Category | Examples | Purpose | Retention |
|---------------|----------|---------|-----------|
| Jira Issue Metadata | Issue keys (PROJ-123), summaries, status | FirstTry dashboard display | 90 days (FirstTry retention) + Jira retention |
| Snapshot Data | Issue key, summary, status, snapshotTime | FirstTry audit trail | 90 days (auto-purge) |
| Configuration | App settings, preferences | FirstTry functionality | Until uninstall |
| User Session | Atlassian Account ID | Authentication (OAuth 2.0) | Session duration |

### 5.2 What Data Atlassian Does NOT Process

FirstTry **does not transmit** the following to Atlassian (or anyone):

- ❌ Issue descriptions or comments (only summaries)
- ❌ Attachments or files
- ❌ Email addresses (beyond Atlassian Account ID)
- ❌ IP addresses (handled by Atlassian, not FirstTry)
- ❌ Usage analytics (no telemetry)

---

## 6. GDPR Compliance (Article 28)

### 6.1 Controller-Processor Relationship

| Role | Entity | Responsibilities |
|------|--------|------------------|
| **Data Controller** | Jira Customer (e.g., Acme Corp) | Determines purposes and means of processing |
| **Data Processor** | FirstTry (SaaS Vendor) | Processes data on behalf of controller |
| **Sub-Processor** | Atlassian | Processes data on behalf of FirstTry |

### 6.2 Article 28 Requirements

| Requirement | FirstTry Compliance |
|-------------|---------------------|
| Written contract with subprocessor | ✅ Atlassian Marketplace Developer Agreement (includes DPA) |
| Subprocessor bound by same obligations | ✅ Atlassian DPA mirrors GDPR Article 28 |
| Customer authorization for subprocessors | ✅ This document provides notice; customer consent via app installation |
| Notification of subprocessor changes | ✅ Email notification (30-day notice); see Section 8 |
| Ongoing compliance monitoring | ✅ Annual review of Atlassian certifications |

---

## 7. Customer Rights

### 7.1 Objection to Subprocessors

Customers may **object to a subprocessor** within 30 days of notification:

**Process:**
1. Customer receives subprocessor change notification (email)
2. Customer emails privacy@firsttry.run with objection (within 30 days)
3. FirstTry evaluates objection (legitimate grounds under GDPR)
4. If objection sustained:
   - FirstTry removes subprocessor, OR
   - Customer may terminate agreement (uninstall app, full refund)

**Legitimate Grounds:** Security concerns, compliance conflicts, contractual prohibitions.

**Note:** For Atlassian (primary subprocessor), objection is not feasible as Forge apps must run on Atlassian infrastructure. Customer's remedy is to uninstall app.

### 7.2 Audit Rights

Customers may request evidence of subprocessor compliance:

**Available Evidence:**
- Atlassian SOC 2 reports (via Atlassian Trust Center)
- Atlassian ISO 27001 certificates (via Atlassian Trust Center)
- FirstTry security whitepaper (`docs/trust/security_whitepaper.md`)
- FirstTry data handling policy (`docs/trust/data_handling.md`)

**Request:** Email compliance@firsttry.run

---

## 8. Subprocessor Change Notification

### 8.1 Notification Process

If FirstTry adds or removes a subprocessor:

1. **Email Notification:** Sent to all app administrators (30-day advance notice)
2. **In-App Banner:** Dashboard notification
3. **Documentation Update:** This document updated with change log

### 8.2 Notification Template

**Subject:** FirstTry Subprocessor Change Notification

**Body:**
```
Dear FirstTry Customer,

We are writing to notify you of a change to our subprocessors:

CHANGE TYPE: [Addition / Removal / Replacement]

SUBPROCESSOR: [Name]
SERVICE: [Description]
DATA PROCESSED: [Types of data]
LOCATION: [Region]
COMPLIANCE: [Certifications]

EFFECTIVE DATE: [YYYY-MM-DD] (30 days from today)

OBJECTION RIGHTS:
If you have legitimate grounds to object (e.g., security concerns, compliance requirements), please email privacy@firsttry.run within 30 days. We will work with you to resolve concerns or facilitate app removal (with refund if applicable).

For more details, see our Subprocessor Policy:
https://github.com/firsttry/FirstTry---Audit-Evidence-for-Jira/blob/main/docs/trust/subprocessors.md

Questions? Contact support@firsttry.run

Regards,
FirstTry Privacy Team
```

### 8.3 Emergency Changes

In rare cases (security incident, vendor bankruptcy), we may change subprocessors without 30-day notice:

- **Notification:** Within 24 hours of change
- **Justification:** Explanation of emergency
- **Customer Rights:** Objection rights still apply (retroactively)

---

## 9. Subprocessor Security Requirements

### 9.1 Mandatory Requirements

All subprocessors must meet the following baseline:

| Requirement | Verification |
|-------------|--------------|
| SOC 2 Type II or equivalent | Annual audit report review |
| GDPR compliance (for EU data) | DPA with Standard Contractual Clauses |
| Encryption at rest (AES-256) | Technical documentation |
| Encryption in transit (TLS 1.3) | SSL Labs test or equivalent |
| Incident response plan | Policy review |
| Data breach notification (72 hours) | Contractual commitment |

**Atlassian Status:** ✅ Meets all requirements

### 9.2 Preferred Certifications

While not mandatory, we prefer subprocessors with:

- ISO 27001 (Information Security)
- ISO 27018 (Cloud Privacy)
- ISO 27701 (Privacy Information Management)
- CSA STAR (Cloud Security Alliance)
- FedRAMP (for US government customers)

**Atlassian Status:** ✅ Holds ISO 27001, ISO 27018, CSA STAR

---

## 10. Monitoring and Review

### 10.1 Annual Review

FirstTry conducts an annual review of all subprocessors:

**Checklist:**
- [ ] Verify certifications are current (SOC 2, ISO 27001)
- [ ] Review any security incidents (past 12 months)
- [ ] Assess compliance with DPA terms
- [ ] Check for subprocessor changes (Atlassian sub-subprocessors)
- [ ] Update this document if changes

**Responsible Party:** Compliance Officer

**Next Review:** 2027-03-04

### 10.2 Continuous Monitoring

FirstTry monitors subprocessor security continuously:

- **Atlassian Trust Center:** Check for security advisories
- **Status Page:** Monitor service availability (status.atlassian.com)
- **Security Advisories:** Subscribe to Atlassian security bulletins

**Escalation:** Security incidents reported by Atlassian trigger FirstTry incident response plan.

---

## 11. Termination and Data Deletion

### 11.1 Subprocessor Termination

If FirstTry terminates Atlassian as a subprocessor:

**Not Applicable:** FirstTry is a Forge app and cannot operate without Atlassian. Termination would require:
1. Migration to different platform (not Forge)
2. Complete app rewrite
3. Customer migration to new version

**Realistic Scenario:** Highly unlikely. FirstTry is architected for Forge.

### 11.2 Customer Termination

If a customer uninstalls FirstTry:

1. **Immediate:** All Forge Storage data deleted (Atlassian guarantees deletion)
2. **30 days:** Forge runtime logs purged (Atlassian retention)
3. **No residual data:** No backups, no archival (except customer-retained evidence packs)

**Verification:** Reinstalling app shows empty state (no old data).

---

## 12. Contact Information

For subprocessor inquiries:

- **Privacy Officer:** privacy@firsttry.run
- **Data Protection Officer:** dpo@firsttry.run
- **Compliance Officer:** compliance@firsttry.run

**Response Time:** Within 48 hours

---

## 13. References

- [GDPR Article 28](https://gdpr-info.eu/art-28-gdpr/) (Processor Obligations)
- [Atlassian Trust Center](https://www.atlassian.com/trust)
- [Atlassian Subprocessors](https://www.atlassian.com/legal/sub-processors)
- [Atlassian DPA](https://www.atlassian.com/legal/data-processing-addendum)
- FirstTry Data Handling Policy: `docs/trust/data_handling.md`

---

## 14. Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-04 | Initial version | First release |

---

**Policy Owner:** FirstTry Compliance Team  
**Next Review:** 2027-03-04  
**Version:** 2.14.0
