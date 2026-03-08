# FirstTry Privacy Policy

**Effective Date:** March 4, 2026  
**Last Updated:** March 4, 2026  
**Version:** 1.0

---

## 1. Introduction

Welcome to FirstTry. We respect your privacy and are committed to protecting your personal data.

**Who We Are:**
- **Data Controller:** FirstTry Inc.
- **Contact:** privacy@firsttry.solutions
- **Data Protection Officer (DPO):** dpo@firsttry.solutions

**What This Policy Covers:**
This Privacy Policy explains how FirstTry collects, uses, stores, and protects personal data when you use our FirstTry for Jira application ("Service").

**Legal Basis:**
This policy complies with:
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- Other applicable privacy laws

---

## 2. Data We Collect

### 2.1 Personal Data

FirstTry collects **minimal personal data**:

| Data Type | Examples | Source | Purpose |
|-----------|----------|--------|---------|
| **User Identifiers** | Atlassian Account ID (e.g., `aaid:123...`) | Forge Bridge API | Authentication, audit trail |
| **Jira Issue Metadata** | Issue keys (PROJ-123), summaries, status | Jira Cloud API | Display snapshots, evidence packs |
| **Timestamps** | Snapshot creation time | FirstTry app | Audit trail, auto-purge |
| **Configuration** | App settings, preferences | User input | App functionality |

**What We Do NOT Collect:**
- ❌ Email addresses (beyond Atlassian Account ID)
- ❌ Names
- ❌ IP addresses (handled by Atlassian, not FirstTry)
- ❌ Browser fingerprints
- ❌ Cookies (no tracking cookies)
- ❌ Issue descriptions or comments (only summaries)
- ❌ Attachments or files
- ❌ Usage analytics (no telemetry)

**Sensitive Data:** FirstTry does not collect sensitive personal data (health, biometric, financial, racial/ethnic origin, political opinions).

---

### 2.2 Data Collected Automatically

FirstTry **does not collect** analytics or tracking data. We do not use:
- Google Analytics
- Mixpanel
- Segment
- Other analytics providers

**Atlassian Logs:** Forge platform (Atlassian) may log requests for operational purposes (30-day retention). These logs are subject to [Atlassian's Privacy Policy](https://www.atlassian.com/legal/privacy-policy).

---

## 3. How We Use Your Data

### 3.1 Purposes

| Purpose | Legal Basis (GDPR) | Data Used |
|---------|-------------------|-----------|
| **Display audit snapshots** | Legitimate interest | Issue keys, summaries, status |
| **Generate evidence packs** | Legitimate interest | Snapshot data, timestamps |
| **App functionality** | Contract (Terms of Service) | Configuration settings |
| **Security and fraud prevention** | Legitimate interest | Atlassian Account ID (audit logs) |
| **Compliance (GDPR/CCPA requests)** | Legal obligation | Data subject identity verification |

**Legitimate Interest:** We have a legitimate interest in providing audit evidence functionality. Data processing is necessary for our service, and your rights are not overridden (minimal data, read-only, short retention).

---

### 3.2 Data Sharing

FirstTry **does not share your data with third parties**, except:

1. **Atlassian (Forge Platform):** All data is stored in Atlassian Cloud infrastructure. Atlassian is our data processor. See [Subprocessors](../trust/subprocessors.md).
2. **Legal Obligations:** We may disclose data to comply with court orders, subpoenas, or legal process (with notice to you if legally permitted).
3. **Customer Consent:** With your explicit written permission.

**No Selling:** We **never sell** your personal data.

**No Marketing:** We do not use your data for marketing purposes.

---

## 4. Data Storage and Security

### 4.1 Storage Location

Data is stored in **Atlassian Cloud infrastructure**:

| Region | Datacenter Location | Selection |
|--------|---------------------|-----------|
| **US** | Virginia, Oregon | Customer-selected (Jira data residency) |
| **EU** | Frankfurt, Dublin | Customer-selected (Jira data residency) |
| **APAC** | Sydney | Customer-selected (Jira data residency) |

**Data Residency:** FirstTry inherits your Jira data residency configuration. To verify: Jira Admin → System → Atlassian Account → Data Residency.

---

### 4.2 Security Measures

| Security Control | Implementation |
|------------------|----------------|
| **Encryption at rest** | AES-256 (Forge Storage API) |
| **Encryption in transit** | TLS 1.3 (all API calls) |
| **Access control** | OAuth 2.0, least-privilege permissions (`read:jira-work`, `storage:app`) |
| **Network isolation** | No external egress (cannot exfiltrate data) |
| **Storage isolation** | Per-installation storage (tenant-scoped) |

**Security Whitepaper:** See [docs/trust/security_whitepaper.md](../trust/security_whitepaper.md) for details.

---

## 5. Data Retention

### 5.1 Retention Periods

| Data Type | Retention Period | Purge Mechanism |
|-----------|------------------|-----------------|
| **Issue snapshots** | **90 days** | Automated (daily cleanup trigger) |
| **Configuration** | Until uninstall | Automatic deletion on uninstall |
| **Evidence packs** | Ephemeral (in `/tmp`) | OS auto-purge |

**Rationale:** 90-day retention balances audit evidence needs with data minimization (GDPR Article 5(1)(e)).

**Data Retention Policy:** See [docs/trust/data_retention.md](../trust/data_retention.md).

---

### 5.2 Data Deletion

**Automatic Deletion:**
1. Snapshots older than 90 days: Auto-purged daily
2. Uninstall: All data deleted immediately (Forge Storage API guarantees deletion)

**Manual Deletion:**
- Dashboard: Click "Clear All Snapshots" button
- Email: Request deletion at privacy@firsttry.solutions (48-hour response)

**Verification:** Reinstalling the app shows empty state (no old data).

---

## 6. Your Rights (GDPR)

If you are in the **European Economic Area (EEA)** or **UK**, you have the following rights:

### 6.1 Right to Access (Article 15)

**Request:** Email privacy@firsttry.solutions

**Response Time:** 30 days

**We Will Provide:**
- Categories of data processed
- Purposes of processing
- Recipients (if any)
- Retention period
- Copy of your data (JSON format)

---

### 6.2 Right to Rectification (Article 16)

**How:** Modify snapshots in FirstTry dashboard or email privacy@firsttry.solutions

**Response Time:** Real-time (dashboard), 48 hours (email)

---

### 6.3 Right to Erasure / "Right to be Forgotten" (Article 17)

**How:** Uninstall app (immediate deletion) or email privacy@firsttry.solutions

**Response Time:** Immediate (uninstall), 48 hours (email)

**Limitations:** We may retain data if required by law (e.g., tax records).

---

### 6.4 Right to Data Portability (Article 20)

**How:** Generate evidence pack (includes all snapshots in machine-readable JSON)

**Command:** `bash tools/reviewer_demo/proof_pack/build_reviewer_proof_pack.sh`

**Format:** JSON (structured data, compatible with other systems)

---

### 6.5 Right to Object (Article 21)

**How:** Uninstall app or disable scheduled triggers

**Response Time:** Immediate

**Effect:** Processing stops immediately.

---

### 6.6 Right to Restriction (Article 18)

**How:** Email privacy@firsttry.solutions

**Response Time:** 48 hours

**Effect:** We will limit processing to storage only (no new snapshots).

---

### 6.7 Right to Withdraw Consent (Article 7(3))

**How:** Uninstall app

**Note:** FirstTry relies primarily on **legitimate interest** (not consent), but you can withdraw your use of the service anytime.

---

### 6.8 Right to Lodge a Complaint

If you believe we violated GDPR, you can lodge a complaint with your local supervisory authority:

- **EU:** [List of Data Protection Authorities](https://ec.europa.eu/justice/article-29/structure/data-protection-authorities/index_en.htm)
- **UK:** [Information Commissioner's Office (ICO)](https://ico.org.uk/)

---

## 7. Your Rights (CCPA — California Residents)

If you are a **California resident**, you have the following rights under CCPA:

### 7.1 Right to Know (Section 1798.100)

**Request:** Email privacy@firsttry.solutions

**Response Time:** 45 days

**We Will Disclose:**
- Categories of personal information collected
- Sources of data
- Purposes of collection
- Categories of third parties (if any)
- Specific pieces of personal information

---

### 7.2 Right to Delete (Section 1798.105)

**Request:** Uninstall app or email privacy@firsttry.solutions

**Response Time:** Immediate (uninstall), 48 hours (email)

**Verification:** We may request identity verification (Jira Cloud URL, installation ID).

---

### 7.3 Right to Opt-Out of Sale (Section 1798.120)

**Not Applicable:** FirstTry **does not sell** personal information.

**Notice:** "Do Not Sell My Personal Information" — FirstTry does not sell data, so no opt-out is needed.

---

### 7.4 Right to Non-Discrimination (Section 1798.125)

FirstTry will **not discriminate** against you for exercising CCPA rights:
- No service denial
- No price increase
- No reduced functionality

---

### 7.5 Authorized Agent

You may designate an authorized agent to make requests on your behalf:

**Requirements:**
- Written authorization from you
- Proof of agent's identity
- Verification of your identity

**Contact:** privacy@firsttry.solutions

---

## 8. Cross-Border Data Transfers

### 8.1 International Transfers

FirstTry data may be transferred internationally (based on your Jira data residency):

| Transfer | Mechanism | Safeguards |
|----------|-----------|------------|
| **US to EU** | Atlassian Standard Contractual Clauses (SCCs) | GDPR-compliant |
| **EU to US** | Atlassian Standard Contractual Clauses (SCCs) | GDPR-compliant |

**Atlassian DPA:** [https://www.atlassian.com/legal/data-processing-addendum](https://www.atlassian.com/legal/data-processing-addendum)

---

## 9. Children's Privacy

FirstTry **does not knowingly collect** data from children under 16 (GDPR) or 13 (COPPA).

**If We Learn:** We have inadvertently collected data from a child, we will delete it immediately.

**Parents/Guardians:** Email privacy@firsttry.solutions if you believe your child's data was collected.

---

## 10. Cookies and Tracking

### 10.1 Cookies

FirstTry **does not use cookies** for tracking or analytics.

**Atlassian Cookies:** Jira Cloud uses cookies for authentication (managed by Atlassian). See [Atlassian Cookie Policy](https://www.atlassian.com/legal/cookies).

### 10.2 Do Not Track (DNT)

FirstTry respects Do Not Track (DNT) browser signals, but since we do not track users, DNT has no effect.

---

## 11. Changes to This Policy

### 11.1 Notification

FirstTry will notify you of material changes to this Privacy Policy via:

1. **Email** to app administrators (30-day advance notice)
2. **In-app banner** in dashboard
3. **Updated document** in Trust Center (version history below)

### 11.2 Minor Changes

Non-material changes (typos, clarifications) may be made without notice. Check "Last Updated" date at top.

### 11.3 Continued Use

By continuing to use FirstTry after changes take effect, you accept the updated policy.

---

## 12. Third-Party Links

FirstTry documentation may contain links to third-party websites (e.g., Atlassian Trust Center):

**Disclaimer:** We are not responsible for third-party privacy practices. Review their privacy policies independently.

---

## 13. Business Transfers

If FirstTry is acquired, merged, or assets sold, your data may transfer to the new entity:

**Notice:** We will notify you via email (30-day notice) and provide opt-out option (uninstall app).

**Protections:** New entity must honor this Privacy Policy or obtain new consent.

---

## 14. Contact Information

### 14.1 Privacy Inquiries

- **Privacy Officer:** privacy@firsttry.solutions
- **Data Protection Officer (DPO):** dpo@firsttry.solutions
- **Response Time:** 48 hours

### 14.2 Data Subject Requests

To exercise your rights (access, deletion, portability, etc.):

1. Email privacy@firsttry.solutions with:
   - Request type (access, deletion, etc.)
   - Jira Cloud URL
   - Installation ID (if known)
   - Identity verification (we may request)
2. We will respond within **30 days** (GDPR) or **45 days** (CCPA)

### 14.3 Complaints

- **GDPR Complaints:** [EU Data Protection Authorities](https://ec.europa.eu/justice/article-29/structure/data-protection-authorities/index_en.htm)
- **CCPA Complaints:** [California Attorney General](https://oag.ca.gov/contact/consumer-complaint-against-business-or-company)

---

## 15. Legal Basis Summary

| Processing Activity | Personal Data | Legal Basis (GDPR) |
|---------------------|---------------|--------------------|
| Display snapshots | Issue keys, summaries, status | Legitimate interest |
| Audit trail | Atlassian Account ID, timestamps | Legitimate interest |
| Evidence pack generation | All snapshot data | Legitimate interest |
| App functionality | Configuration settings | Contract (Terms of Service) |
| Compliance (GDPR/CCPA requests) | Identity verification | Legal obligation |

---

## 16. Data Protection Impact Assessment (DPIA)

**DPIA Required?** No (GDPR Article 35)

**Rationale:**
- Read-only access (no high risk processing)
- Minimal personal data (no sensitive categories)
- Short retention (90 days)
- No profiling or automated decision-making
- Strong security controls (encryption, isolation)

**Risk Level:** Low

---

## 17. References

- [GDPR](https://gdpr.eu/)
- [CCPA](https://oag.ca.gov/privacy/ccpa)
- [Atlassian Privacy Policy](https://www.atlassian.com/legal/privacy-policy)
- [Atlassian DPA](https://www.atlassian.com/legal/data-processing-addendum)
- FirstTry Data Handling Policy: [docs/trust/data_handling.md](../trust/data_handling.md)
- FirstTry Data Retention Policy: [docs/trust/data_retention.md](../trust/data_retention.md)
- FirstTry Subprocessors: [docs/trust/subprocessors.md](../trust/subprocessors.md)

---

## 18. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-04 | Initial Privacy Policy |

---

**Privacy Officer:** FirstTry Privacy Team  
**Approved By:** Chief Privacy Officer  
**Next Review:** 2026-06-04 (quarterly)  
**Contact:** privacy@firsttry.solutions

---

**Your Privacy Matters to Us**
