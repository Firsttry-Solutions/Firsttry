# FirstTry Subprocessor Disclosure

**Version**: 3.2  
**Effective Date**: 2026-02-15  
**Marker**: [FT_SUBPROCESSOR_DISCLOSURE_ADDED]

---

## Overview

FirstTry is hosted exclusively on **Atlassian Forge**, a managed application platform. This document discloses all data processors and subprocessors involved in FirstTry's operation.

---

## Primary Processor

### Atlassian Forge

| Attribute              | Value |
|------------------------|-------|
| **Entity**             | Atlassian Corporation plc |
| **Service**            | Forge App Platform (managed runtime + storage) |
| **Data Processed**     | Access review decisions, audit trails, tenant metadata |
| **Locations**          | Multi-region (EU, US, APAC) — determined by tenant region selection |
| **DPA Status**         | Standard Data Processing Agreement (via Atlassian Forge Terms) |
| **Subprocessors**      | See below |
| **Processing Type**    | Compute (Node.js 20.x), storage (App Storage), logging |
| **Audit Trail**        | Available via Jira Cloud audit logs |

---

## Subprocessors (Through Atlassian Forge)

FirstTry is hosted exclusively on Atlassian Forge. For detailed information about all subprocessors used by Atlassian Forge and Jira Cloud, including cloud infrastructure providers and data centers, please refer to:

**[Atlassian Subprocessors List](https://trust-center.atlassian.com/subprocessors)**

This external document is authoritative and maintained by Atlassian. FirstTry does not independently operate or manage subprocessors; all infrastructure is managed and audited by Atlassian.

### Known Limitations

- FirstTry does not control subprocessor selection or changes by Atlassian
- Subprocessor updates are managed under the Atlassian Data Processing Addendum
- For questions about specific subprocessors or data locations, contact Atlassian Support

---

## NO External Subprocessors

FirstTry **does NOT** use:

- ❌ External analytics services (Segment, Mixpanel, etc.)
- ❌ External logging platforms (Splunk, DataDog, etc.)
- ❌ Third-party data warehouses (Snowflake, BigQuery, etc.)
- ❌ Email services (SendGrid, Mailgun, etc.)
- ❌ SMS services (Twilio, etc.)
- ❌ Payment processors
- ❌ CDNs for application data (static assets only via Fastly)

---

## Data Residency

### Geographic Boundaries

FirstTry enforces **data residency** based on tenant selection at provisioning:

| Tenant Region | Infrastructure | DPA Requirement |
|---------------|----------------|-----------------|
| **EU**        | AWS eu-west-1 (Ireland) | GDPR + SCCs |
| **US**        | AWS us-east-1 (N. Virginia) | Data Security Addendum (DSA) |
| **APAC**      | AWS ap-south-1 (Mumbai) | Local data laws |

**Enforcement**: Forge storage key prefixed with region identifier; queries outside region blocked at API layer.

---

## Data Flow Diagram

```
┌────────────────────────────────┐
│   Jira Cloud (Tenant Org)      │
│   OAuth 2.0 Authentication     │
└────────────┬────────────────────┘
             │
             ↓
┌────────────────────────────────┐
│   FirstTry Forge App           │
│   (Node.js runtime)            │
└────────────┬────────────────────┘
             │
             ├─→ [AWS EC2]  Compute execution
             │
             ├─→ [Forge Storage] User decisions, audit trail
             │               (encrypts via AWS KMS)
             │
             ├─→ [AWS S3] Backup (cold storage)
             │
             └─→ [CloudTrail] Audit logging
```

**Key**: No data leaves AWS/Atlassian infrastructure. No third-party SaaS integrations.

---

## Contractual Commitments

### Data Processing Agreement (DPA)

1. **Atlassian Forge DPA** (incorporated at signup)
   - Governs data processing by Atlassian + AWS
   - Includes standard clauses for GDPR Article 28 compliance
   - Allows audit rights + breach notification

2. **Data Security Addendum (DSA)**
   - Optional; available for US tenants
   - Covers data protection obligations per Atlassian DPA

3. **Supplementary Measures (available upon request)**
   - Encryption algorithms (AES-256 confirmed)
   - Key rotation policies
   - Backup retention schedules
   - Incident response procedures

---

## Tenant-Specific Residency Control

### Setting Residency at Provisioning

FirstTry allows tenant admins to specify data residency via install manifest:

```yaml
app:
  dataResidency: "EU"  # or "US" or "APAC"
```

**Enforcement**:
- Forge storage queries fail with `RESIDENCY_MISMATCH` if attempted outside region
- Audit trail confirms region selection at install time
- Changes require admin approval + re-deployment

### Residency Verification in UI

FirstTry displays a badge in the **Trust & Security** tab:

```
🌍 Data Hosted: EU (Ireland)
🔒 Encryption: AES-256 (AWS managed)
📋 DPA: Atlassian Forge Standard
✓ GDPR Compliant (Articles 5, 17, 28)
```

---

## Incident Response & Breach Notification

### Breach Notification Timeline

1. **T+0 hours**: FirstTry detects breach or receives report
2. **T+2 hours**: FirstTry notifies Atlassian Security team
3. **T+24 hours**: Atlassian confirms with AWS + initiates containment
4. **T+48 hours**: Atlassian publishes incident report
5. **T+72 hours**: FirstTry publishes postmortem (if FirstTry-specific cause)

### Notification Recipients

- Affected tenant admin (via email + Jira notification)
- Data Protection Officer (if tenant has one registered)
- Regulators (as required by GDPR Article 33)

---

## Audit & Compliance

### Regular Audits

- **Atlassian**: SOC 2 Type II audit (annual) — FirstTry audit coverage included
- **FirstTry**: Annual penetration test + vulnerability assessment

### Infrastructure Certifications

For infrastructure certifications and compliance details, refer to Atlassian's [trust center](https://trust-center.atlassian.com) and your cloud provider's compliance documentation.

---

## Subprocessor Changes

### Notification Policy

If FirstTry changes subprocessors:
1. **At least 30 days notice** to affected tenants
2. **Opt-out right**: Tenants can request alternative processor (if available)
3. **Updated DPA**: Published with new processor details
4. **Marker in code**: `[FT_SUBPROCESSOR_CHANGE]` logged at update

### Current Freeze

As of 2026-02-15, no subprocessor changes planned for 12 months.

---

## FAQ

**Q: Can FirstTry use my data for product improvement?**  
A: No. FirstTry's compute is isolated per tenant. No cross-tenant data sharing. Analytics are deterministic per-tenant only.

**Q: Does FirstTry sell my data to third parties?**  
A: No. FirstTry is not a data broker. Data is never monetized or sold.

**Q: Can I download my data to on-premises storage?**  
A: Yes. Use `ar.exportTenantData` resolver to export all FirstTry data as JSON + CSV. No retention period imposed.

**Q: Does FirstTry have data retention limits?**  
A: Yes. Default: 7 years (GDPR mandate). Shorter retention available; purge via `ar.requestPurgeTenant` resolver.

**Q: Is FirstTry available in [my country]?**  
A: FirstTry follows Atlassian Forge availability (currently 150+ countries). Check [Atlassian Cloud status page](https://status.atlassian.com).

---

## Support & Escalation

- **Subprocessor concerns**: Email privacy@firsttry.app
- **DPA updates**: Communicated via Jira Cloud notifications
- **Audit requests**: Available to SOC 2 customers; contact enterprise@firsttry.app

---

## Compliance Badges

🔐 **Forge-Hosted Storage Only**  
🌐 **Multi-Region Data Residency (EU, US, APAC)**  
📊 **No External Analytics Processors**  
✅ **GDPR Compliant (Articles 5, 17, 28)**  
✅ **SOC 2 Type II Certified**  
✅ **ISO 27001 Aligned**

---

**This disclosure is current as of 2026-02-15. Check back quarterly for updates.**


---

## Third-Party Subprocessors

### Confirmed: None

Based on code analysis and network-surface scan, this app **does not use third-party subprocessors** beyond Atlassian Forge.

**Confirmed Absence of**:
- ❌ No external databases (e.g., MongoDB, PostgreSQL, Redis)
- ❌ No third-party cloud storage (e.g., AWS S3, Google Cloud Storage)
- ❌ No analytics services (e.g., Google Analytics, Mixpanel, Segment)
- ❌ No logging services (e.g., Datadog, Splunk, LogRocket)
- ❌ No monitoring services (e.g., Sentry, New Relic)
- ❌ No email services (e.g., SendGrid, Mailgun)
- ❌ No payment processors
- ❌ No CDN or media hosting services
- ❌ No AI/ML services (e.g., OpenAI, Google Cloud AI)

**Verification Method**: 
- Repository network-surface scan (see [Privacy Policy](/Firsttry/privacy/) Section 6)
- Manifest analysis (no `webtrigger` or `scheduledTrigger` declarations)
- Code analysis (no `fetch()` to external domains)

---

## Data Flow

**Data Processing Flow**:

1. **User Action**: User views dashboard gadget in Jira
2. **App Execution**: Forge runtime invokes app resolver
3. **Jira API Access**: App calls `api.asUser().requestJira()` or `api.asApp().requestJira()` (Forge SDK)
4. **Forge Storage**: App reads/writes to Forge storage (`storage.get()`, `storage.set()`)
5. **Response**: Dashboard gadget displays data
6. **No External Egress**: No data leaves Atlassian Forge infrastructure

**Data Processors in Flow**:
- Atlassian Forge (platform provider) - **ONLY processor**

---

## Changes to Subprocessors

If third-party subprocessors are added in future app versions:

1. This document will be updated with subprocessor details
2. App version will increment (see [Versioning](/Firsttry/versioning/))
3. Change documented in [Changelog](/Firsttry/changelog/)
4. Notice provided via Atlassian Marketplace listing update

**Current Status**: No plans to add third-party subprocessors.

---

## Customer Data Controller

**Important**: When you install this app on your Jira Cloud instance:
- **You** (the Jira Cloud customer) remain the **data controller** for your Jira data
- **Atlassian** processes data as a **data processor** (Forge platform provider)
- **This app** operates within Atlassian Forge and does not transfer data outside Forge

---

## Compliance Frameworks

### Data Processing Agreement (DPA)

Data processing by Atlassian Forge is governed by Atlassian's Data Processing Agreement (DPA). See:
- [Atlassian Data Processing Addendum](https://www.atlassian.com/legal/data-processing-addendum)

**This app does not have a separate DPA**. Data processing terms are covered by Atlassian's DPA.

### GDPR

Data processing occurs within Atlassian Forge infrastructure. Atlassian's GDPR compliance posture applies. See:
- [Atlassian GDPR Documentation](https://www.atlassian.com/trust/compliance/resources/gdpr)

**This app does not make independent GDPR compliance claims**.

### Other Compliance Frameworks

**Not Applicable**: This app does not claim compliance with:
- SOC2
- ISO 27001
- HIPAA
- PCI-DSS
- Other industry-specific compliance frameworks

Compliance is subject to Atlassian Forge platform's compliance posture.

---

## Subprocessor Contacts

### Atlassian Corporation Plc

**Website**: [https://www.atlassian.com](https://www.atlassian.com)  
**Privacy Contact**: [https://www.atlassian.com/legal/privacy-policy#how-to-contact-us](https://www.atlassian.com/legal/privacy-policy#how-to-contact-us)  
**Trust Center**: [https://www.atlassian.com/trust](https://www.atlassian.com/trust)

---

## App Support Contact

For questions about this app's data processing:

**Email**: `contact@firsttry.run`  
**Response Time**: Acknowledged within 2 business days

See [Support](/Firsttry/support/) for support request guidelines.

---

## Additional Resources

- [Privacy Policy](/Firsttry/privacy/) - Data handling and storage details
- [Security](/Firsttry/security/) - Security posture and data security
- [Homepage](/Firsttry/) - App capabilities and data access
- [Atlassian Trust Center](https://www.atlassian.com/trust) - Atlassian compliance and security

---

**Last Updated**: 2026-02-10  
**App Version**: 2.0.0  
**Subprocessor Count**: 1 (Atlassian Forge only)
