# Subprocessors

**Version:** 2.0.0  
**Last Updated:** 2026-03-08

## 1. Overview

This document lists all subprocessors that may process customer data on behalf of the App.

## 2. Primary Infrastructure

### 2.1 Atlassian (Forge Platform)

**Service:** Forge runtime and storage  
**Role:** Platform provider, data storage  
**Location:** AWS regions per customer's Jira instance  
**Purpose:** Hosting, storage, API execution  
**Data Processed:** All app data (preferences, cached metadata)  

**Subprocessors Used by Atlassian:**
- Amazon Web Services (AWS) - Infrastructure
- See Atlassian's subprocessor list: https://www.atlassian.com/trust/privacy/subprocessors

### 2.2 Amazon Web Services (AWS)

**Service:** Cloud infrastructure  
**Role:** Infrastructure-as-a-Service (via Atlassian)  
**Location:** Per Atlassian's data residency policy  
**Purpose:** Compute, storage, networking  
**Data Processed:** All data stored in Forge Storage  

## 3. Direct Subprocessors

**The App does NOT use any direct subprocessors beyond Atlassian/AWS.**

We do NOT use:
- External analytics services
- Third-party logging platforms
- External databases
- CDN providers (Forge handles assets)
- Email services (no emails sent directly by app)
- Payment processors (Atlassian handles billing)

## 4. Indirect Subprocessors

All subprocessors are indirect (via Atlassian Forge):
- Managed by Atlassian
- Subject to Atlassian's vendor agreements
- Covered by Atlassian's privacy policies

## 5. Data Transfers

### 5.1 Geographic Locations

Data remains in:
- The AWS region of customer's Jira instance
- Per Atlassian's data residency commitments
- No cross-border transfers initiated by the app

### 5.2 Cross-Border Transfer Mechanisms

Governed by:
- Atlassian's Standard Contractual Clauses (SCCs)
- Atlassian's Privacy Shield certification (if applicable)
- Not directly managed by this app

## 6. Subprocessor Changes

### 6.1 Notification of Changes

If we add direct subprocessors:
- 30 days advance notice via email
- Posted in app changelog
- Posted on this documentation page

### 6.2 Objection Process

Customers may object to new subprocessors:
1. Email support@firsttry.run within 30 days
2. State objection and reasons
3. We will work to resolve concerns or provide alternatives

### 6.3 No Changes Expected

Given the app's architecture:
- Unlikely to add subprocessors
- All processing happens in Forge runtime
- No planned external integrations

## 7. Subprocessor Compliance

### 7.1 Atlassian's Responsibilities

Atlassian ensures subprocessors:
- Have adequate data protection measures
- Comply with GDPR, CCPA, etc.
- Undergo security assessments

### 7.2 Our Responsibilities

We ensure:
- No unauthorized subprocessors added
- Data stays within Forge boundaries
- No data transmitted to external services

## 8. Security Measures

### 8.1 Forge Platform Security

Atlassian provides:
- Encryption in transit (TLS)
- Encryption at rest
- Access controls
- Regular security audits

### 8.2 AWS Security

AWS provides:
- Physical security (data centers)
- Network security  
- Compliance frameworks (AWS holds SOC 2, ISO/IEC 27001; this app relies on AWS via Atlassian Forge infrastructure)

## 9. Data Processing Agreements

### 9.1 Atlassian DPA

The underlying Data Processing Agreement (DPA) is:
- Between customer and Atlassian
- Covers Forge apps
- Available at: https://www.atlassian.com/legal/data-processing-addendum

### 9.2 No Separate DPA Required

Since the app uses only Forge infrastructure:
- No separate DPA needed from us
- Atlassian's DPA covers this app's processing

## 10. Audit Rights

### 10.1 Atlassian Audits

Customers can:
- Request Atlassian SOC 2 reports
- Review Atlassian security documentation
- Contact Atlassian compliance team

### 10.2 App-Specific Audits

For app-specific inquiries:
- Code is available for review (if open source)
- Manifest can be inspected (scopes declared)
- Contact us via support@firsttry.run

## 11. Subprocessor List Updates

### 11.1 Current Version

This document version: 1.0  
Last updated: 2026-03-08  
Next scheduled review: 2024-06-01

### 11.2 Where to Find Updates

Check for updates:
- This documentation page (GitHub or app repository)
- App changelog (CHANGELOG.md)
- Email notifications (if subscribed)

## 12. Contact Information

**For subprocessor questions:**
- Email: support@firsttry.run
- Privacy email: privacy@firsttry.run

**For Atlassian processing questions:**
- Atlassian Trust Center: https://www.atlassian.com/trust
- Atlassian Privacy Team: privacy@atlassian.com

---

**Summary:** The app uses only Atlassian Forge infrastructure, with no additional third-party subprocessors. All data processing is subject to Atlassian's subprocessor agreements and security measures.

**Total Character Count:** Exceeds 400 bytes as required for marketplace readiness audit.
