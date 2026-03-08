# Subprocessors and Data Processors

**App**: FirstTry Audit Evidence for Jira  
**Version**: 2.0.0  
**Last Updated**: 2026-02-10

---

## Overview

This document lists third-party subprocessors that process data on behalf of the FirstTry Audit Evidence for Jira app.

---

## Primary Data Processor

### Atlassian Corporation Plc

**Role**: Forge Platform Provider

**Services Provided**:
- Atlassian Forge runtime environment (Node.js sandbox)
- Forge platform storage (app-scoped storage)
- Jira Cloud REST API access
- Platform infrastructure and hosting

**Data Processed**:
- Governance snapshot metadata stored in Forge storage
- Install/upgrade timestamp markers
- Jira work data accessed via `read:jira-work` scope

**Data Location**: 
- Atlassian Forge infrastructure (managed by Atlassian)
- Data location subject to your Jira Cloud instance's region

**Applicable Terms**:
- [Atlassian Cloud Terms of Service](https://www.atlassian.com/legal/cloud-terms-of-service)
- [Atlassian Privacy Policy](https://www.atlassian.com/legal/privacy-policy)
- [Atlassian Data Processing Agreement (DPA)](https://www.atlassian.com/legal/data-processing-addendum)
- [Atlassian Forge Platform Terms](https://developer.atlassian.com/platform/forge/forge-platform-terms/)

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
- Repository network-surface scan (see [PRIVACY_POLICY.md](PRIVACY_POLICY.md) Section 6)
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
2. App version will increment (see [VERSIONING.md](VERSIONING.md))
3. Change documented in [CHANGELOG.md](CHANGELOG.md)
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

**Email**: `support@firsttry.solutions`  
**Response Time**: Acknowledged within 2 business days

See [SUPPORT.md](SUPPORT.md) for support request guidelines.

---

## Additional Resources

- [PRIVACY_POLICY.md](PRIVACY_POLICY.md) - Data handling and storage details
- [SECURITY.md](SECURITY.md) - Security posture and data security
- [README.md](README.md) - App capabilities and data access
- [Atlassian Trust Center](https://www.atlassian.com/trust) - Atlassian compliance and security

---

**Last Updated**: 2026-02-10  
**App Version**: 2.0.0  
**Subprocessor Count**: 1 (Atlassian Forge only)
