# FirstTry Terms of Service

**Effective Date:** March 4, 2026  
**Last Updated:** March 4, 2026  
**Version:** 2.0.0

---

## 1. Agreement to Terms

By installing, accessing, or using FirstTry for Jira (" Service" "App"), you agree to be bound by these Terms of Service ("Terms").

**Who These Terms Bind:**
- **"We," "Us," "FirstTry":** FirstTry Inc., the service provider
- **"You," "Customer":** The organization or individual installing the App

**If You Do Not Agree:** Do not install or use the App.

---

## 2. Service Description

### 2.1 What FirstTry Does

FirstTry is an audit evidence dashboard for Jira Cloud that:
- Captures point-in-time snapshots of Jira issues (keys, summaries, status)
- Stores snapshots for up to 90 days (auto-purge)
- Generates tamper-evident evidence packs with SHA256 manifests
- Provides offline verification of evidence packs

**Deployment:** Atlassian Forge platform (SaaS)

### 2.2 What FirstTry Does NOT Do

- ❌ Modify Jira data (read-only permissions)
- ❌ Access external systems (no network egress)
- ❌ Store sensitive data (no PHI, PCI, or financial data)
- ❌ Provide legal advice (evidence packs are tools, not legal opinions)

---

## 3. License and Restrictions

### 3.1 License Grant

Subject to these Terms, FirstTry grants you a **non-exclusive, non-transferable, revocable license** to:
- Install the App on your Jira Cloud instance
- Use the App for audit evidence and governance purposes
- Export evidence packs for compliance audits

**Scope:** One license per Jira Cloud instance (site).

### 3.2 Restrictions

You **may not**:
- ❌ Reverse engineer, decompile, or disassemble the App
- ❌ Modify, adapt, or create derivative works
- ❌ Rent, lease, loan, resell, or sublicense the App
- ❌ Use the App for illegal purposes or to violate third-party rights
- ❌ Remove or alter copyright, trademark, or proprietary notices
- ❌ Use the App to compete with FirstTry (e.g., build a competing product)

### 3.3 Open Source Components

The App may include open source components (React, Forge UI Kit). These components are licensed under their respective licenses (MIT, Apache 2.0). See [package.json](../../package.json) for details.

---

## 4. Account and Access

### 4.1 Registration

To use FirstTry, you must:
- Have an active Jira Cloud subscription (provided by Atlassian)
- Install the App via Atlassian Marketplace
- Accept these Terms (click-through on installation)

**Admin Approval:** Installation requires Jira administrator approval.

### 4.2 Credentials

**Atlassian Account:** You use your existing Atlassian account to access FirstTry (via OAuth 2.0). FirstTry does not manage passwords.

**Security:** You are responsible for:
- Keeping your Atlassian account secure
- Notifying Atlassian of unauthorized access
- Compliance with Atlassian's Terms of Service

### 4.3 Account Termination

We may suspend or terminate your access if:
- You violate these Terms
- You engage in fraudulent or illegal activity
- Required by law (court order, regulatory directive)
- You fail to pay fees (if applicable)

**Notice:** 30-day notice for non-urgent terminations (immediate for security violations).

---

## 5. Fees and Payment

### 5.1 Pricing

**Current Model:** FirstTry may be offered as:
- Free tier (limited functionality)
- Paid tier (full functionality, pricing on Atlassian Marketplace)

**Atlassian Billing:** All payments are processed by Atlassian Marketplace. FirstTry does not handle payment directly.

### 5.2 Taxes

You are responsible for all taxes (sales, VAT, GST) except FirstTry income taxes.

### 5.3 Refunds

**Refund Policy:** Subject to Atlassian Marketplace refund policy (typically 30-day money-back guarantee for first purchase).

**Contact:** support@firsttry.run for refund requests (we will coordinate with Atlassian).

### 5.4 Changes to Pricing

We may change pricing with **30-day notice**. Existing subscriptions will renew at new price unless you cancel.

---

## 6. Data and Privacy

### 6.1 Data Processing

**Controller-Processor Relationship:**
- **You (Customer):** Data Controller (determines purposes and means)
- **FirstTry:** Data Processor (processes on your behalf)
- **Atlassian:** Sub-Processor (hosts Forge platform)

**Data Processing Agreement (DPA):** Available upon request at privacy@firsttry.run (incorporates Standard Contractual Clauses for GDPR compliance).

### 6.2 Privacy Policy

FirstTry's data handling practices are described in our [Privacy Policy](PRIVACY_POLICY.md).

**Key Points:**
- Minimal data collection (issue metadata only)
- 90-day retention (auto-purge)
- Zero subprocessors (except Atlassian)
- No selling of data

### 6.3 Customer Obligations

You represent and warrant that:
- You have authority to provide data to FirstTry
- You have obtained necessary consents from end users
- Your use complies with applicable privacy laws (GDPR, CCPA, etc.)

**Indemnification:** You will indemnify FirstTry for claims arising from your data privacy violations.

---

## 7. Intellectual Property

### 7.1 FirstTry IP

**Ownership:** FirstTry owns all rights, title, and interest in:
- The App (code, design, features)
- Documentation and Trust Center materials
- Trademarks ("FirstTry" name and logo)

**Feedback:** If you provide feedback or suggestions, FirstTry may use them without obligation or compensation.

### 7.2 Customer IP

**Ownership:** You own all rights to your Jira data.

**License to FirstTry:** You grant FirstTry a limited license to:
- Access your Jira data via Forge Bridge API (read-only)
- Store snapshots in Forge Storage (encrypted)
- Process data as necessary to provide the Service

**Termination:** This license terminates when you uninstall the App (all data deleted).

### 7.3 Evidence Packs

**Ownership:** Evidence packs generated by FirstTry are **your property**. You may use them for:
- Compliance audits
- Internal records
- External sharing (at your discretion)

**Attribution:** Please credit FirstTry when sharing evidence packs publicly (optional, but appreciated).

---

## 8. Warranties and Disclaimers

### 8.1 Service Warranty

FirstTry warrants that:
- The App will perform substantially as described
- We will use reasonable efforts to maintain 99.9% uptime (see [Support SLA](../support/SUPPORT_SLA.md))
- We will fix material defects within reasonable time

**Remedy:** If warranty breached, we will fix the issue or refund pro-rata fee (your sole remedy).

### 8.2 Disclaimers

TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED **"AS IS" and "AS AVAILABLE"** WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING:

- ❌ Merchantability
- ❌ Fitness for a particular purpose
- ❌ Non-infringement
- ❌ Accuracy or reliability
- ❌ Error-free or uninterrupted operation

**No Legal Advice:** FirstTry does not provide legal, accounting, or compliance advice. Evidence packs are tools; consult professionals for legal opinions.

**No Guarantee:** We do not guarantee that:
- The App will meet your requirements
- Evidence packs will be accepted by auditors or regulators
- The App is suitable for high-risk activities (medical, aviation, nuclear)

### 8.3 Atlassian Dependency

FirstTry depends on Atlassian Forge platform:

**Disclaimer:** FirstTry is not liable for:
- Atlassian platform outages
- Forge API changes that break the App
- Atlassian security breaches

**Your Remedy:** Pursue claims against Atlassian per their Terms of Service.

---

## 9. Limitation of Liability

### 9.1 Cap on Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, FIRSTTRY'S TOTAL LIABILITY FOR ALL CLAIMS ARISING FROM THESE TERMS OR THE APP SHALL NOT EXCEED THE **GREATER OF:**
1. **Fees paid by you in the 12 months preceding the claim**
2. **$100 USD**

### 9.2 Excluded Damages

FIRSTTRY SHALL NOT BE LIABLE FOR:
- ❌ Indirect, incidental, special, consequential, or punitive damages
- ❌ Loss of profits, revenue, data, or business opportunities
- ❌ Cost of substitute services
- ❌ Reputational harm

**Even If:** FirstTry was advised of the possibility of such damages.

### 9.3 Exceptions

The limitations above do not apply to:
- Gross negligence or willful misconduct
- Death or personal injury caused by FirstTry
- Fraud
- Violations of law that cannot be limited by contract

### 9.4 Allocation of Risk

These limitations reflect the agreed allocation of risk and the fees charged.

---

## 10. Indemnification

### 10.1 Customer Indemnification

You agree to indemnify, defend, and hold harmless FirstTry from claims arising from:
- Your violation of these Terms
- Your violation of laws or third-party rights
- Your data (infringement, privacy violations, etc.)
- Your use of the App (unauthorized use, misrepresentation)

**Exceptions:** You are not liable for claims arising solely from FirstTry's gross negligence or willful misconduct.

### 10.2 FirstTry Indemnification

FirstTry will indemnify you from claims that the App infringes third-party intellectual property rights:

**Conditions:**
- You notify FirstTry promptly
- You grant FirstTry control of defense
- You cooperate in defense

**Remedy:** FirstTry may:
- Defend the claim
- Obtain a license for you
- Modify the App to avoid infringement
- Terminate the App and refund pro-rata fees

**Exclusions:** No indemnification for:
- Your modifications to the App
- Use in combination with third-party products
- Violations of these Terms

---

## 11. Confidentiality

### 11.1 Confidential Information

**Definition:** Non-public information disclosed by one party to the other, including:
- Your Jira data (confidential to you)
- FirstTry source code and business information (confidential to FirstTry)

### 11.2 Obligations

Receiving party will:
- Keep information confidential
- Use only for purposes of these Terms
- Protect with same care as own confidential information (minimum: reasonable care)

### 11.3 Exceptions

Confidentiality does not apply to information that:
- Is publicly known (not through breach)
- Was known before disclosure
- Is independently developed
- Is legally compelled to be disclosed (court order, subpoena)

### 11.4 Breach

Breach of confidentiality may cause irreparable harm (monetary damages insufficient). Injunctive relief is available.

---

## 12. Support and Maintenance

### 12.1 Support

FirstTry provides email support per [Support SLA](../support/SUPPORT_SLA.md):

**Response Times:**
- P0 (Critical): 1 hour
- P1 (High): 4 hours
- P2 (Medium): 1 business day
- P3 (Low): 2 business days

**Contact:** support@firsttry.run

### 12.2 Updates

FirstTry may update the App to:
- Fix bugs
- Add features
- Improve security
- Comply with Atlassian Forge changes

**Notice:** Material changes announced via email or in-app banner (7-day notice for breaking changes).

**No Downtime:** Forge apps typically update without downtime.

---

## 13. Term and Termination

### 13.1 Term

These Terms begin when you install the App and continue until terminated.

### 13.2 Termination by You

You may terminate anytime by:
- Uninstalling the App (Jira Settings → Apps → Manage apps → FirstTry → Uninstall)
- Cancelling subscription (via Atlassian Marketplace)

**Effect:** All data deleted immediately (Forge Storage API guarantees deletion).

### 13.3 Termination by FirstTry

We may terminate if:
- You violate these Terms (30-day cure period for non-urgent breaches)
- Required by law
- Atlassian terminates Forge platform

**Refund:** Pro-rata refund for prepaid fees (if termination for convenience by FirstTry).

### 13.4 Survival

The following sections survive termination:
- Section 7 (Intellectual Property)
- Section 8 (Disclaimers)
- Section 9 (Limitation of Liability)
- Section 10 (Indemnification)
- Section 11 (Confidentiality)
- Section 15 (Dispute Resolution)

---

## 14. Changes to Terms

### 14.1 Notification

FirstTry may modify these Terms with **30-day advance notice** via:
- Email to administrators
- In-app banner
- Updated document in Trust Center

### 14.2 Acceptance

**Continued Use:** By continuing to use the App after changes take effect, you accept the updated Terms.

**Objection:** If you do not agree, uninstall the App within 30 days (pro-rata refund provided).

### 14.3 Material Changes

Material changes (e.g., pricing increases, limitation of liability changes) require explicit acceptance (click-through on next login).

---

## 15. Dispute Resolution

### 15.1 Governing Law

These Terms are governed by the laws of **California, USA** (without regard to conflict of laws principles).

**For Customers Outside US:** Local consumer protection laws may apply.

### 15.2 Informal Resolution

**Before Legal Action:** You agree to contact support@firsttry.run and attempt good-faith resolution for 30 days.

### 15.3 Arbitration (US Customers)

**Binding Arbitration:** Disputes will be resolved by binding arbitration (American Arbitration Association, AAA) under AAA Commercial Arbitration Rules:

- **Location:** San Francisco, CA or your location (arbitrator's discretion)
- **Language:** English
- **Costs:** Each party pays own costs (filing fees split if < $10,000 claim)
- **Class Action Waiver:** No class arbitration (individual claims only)

**Opt-Out:** You may opt out within 30 days of accepting these Terms by emailing legal@firsttry.run.

**Small Claims:** You may bring claims in small claims court (if eligible).

### 15.4 Jurisdiction (Non-US Customers)

For customers outside the US (who opt out of arbitration or where arbitration is unenforceable):

**Exclusive Jurisdiction:** Courts of San Francisco County, California, USA.

**Exception:** You may bring claims in your local jurisdiction for consumer protection violations.

---

## 16. General Provisions

### 16.1 Entire Agreement

These Terms, together with the Privacy Policy and Support SLA, constitute the entire agreement (supersedes prior agreements).

### 16.2 Assignment

**You:** May not assign these Terms without FirstTry consent.

**FirstTry:** May assign to an affiliate or in connection with merger/acquisition (with 30-day notice).

### 16.3 Force Majeure

Neither party is liable for delays caused by events beyond reasonable control (natural disasters, war, strikes, pandemics, government actions, Atlassian outages).

### 16.4 Waiver

Failure to enforce a provision is not a waiver of that provision or future enforcement.

### 16.5 Severability

If any provision is invalid or unenforceable, it will be modified to achieve the intent (or severed if not possible). Other provisions remain in effect.

### 16.6 Notices

**To You:** Email to administrator (email on file with Atlassian) or in-app banner.

**To FirstTry:** Email to legal@firsttry.run (with subject "Legal Notice").

**Effective:** 3 business days after sending.

### 16.7 Relationship

These Terms do not create a partnership, joint venture, agency, or employment relationship.

### 16.8 Third-Party Beneficiaries

No third parties have rights under these Terms (except Atlassian for indemnification obligations).

### 16.9 Export Compliance

You will comply with export laws (US export control, sanctions). You represent that you are not located in an embargoed country.

### 16.10 Government End Users

If you are a US government entity, the App is "commercial computer software" (FAR 12.212, DFARS 227.7202). Rights are as specified in these Terms.

---

## 17. Contact Information

| Purpose | Email | Address |
|---------|-------|---------|
| General Support | support@firsttry.run | FirstTry Inc. (example address) |
| Legal | legal@firsttry.run | 123 Market St, San Francisco, CA 94103 |
| Privacy/Data | privacy@firsttry.run | Same as above |
| Security | security@firsttry.run | Same as above |

---

## 18. Acknowledgments

By clicking "Install" or using the App, you acknowledge that:
- ✅ You have read these Terms
- ✅ You understand these Terms
- ✅ You agree to be bound by these Terms
- ✅ You have authority to bind your organization (if applicable)

---

## 19. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-04 | Initial Terms of Service |

---

**Terms Owner:** FirstTry Legal Team  
**Approved By:** Chief Legal Officer  
**Next Review:** 2026-06-04 (quarterly)  
**Contact:** legal@firsttry.run

---

**Thank You for Using FirstTry**
