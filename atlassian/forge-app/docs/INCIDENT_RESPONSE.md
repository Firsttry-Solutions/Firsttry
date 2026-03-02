# Incident Response Documentation

**App Name**: FirstTry Governance - Atlassian Dual-Layer Integration  
**Last Updated**: 2025-12-22  
**Purpose**: Security incident and operational incident response procedures  

---

## Scope

This document covers incident response for:
1. **Security Incidents**: Suspected vulnerabilities, breaches, or security events
2. **Operational Incidents**: Service degradation, data integrity issues, unexpected behavior

**Out of Scope**:
- Atlassian Forge platform incidents (handled by Atlassian)
- Jira Cloud platform incidents (handled by Atlassian)
- Customer-side configuration issues

---

## Security Incident Response

### Reporting

**Method**: GitHub Security Advisory  
**URL**: https://github.com/Global-domination/Firstry/security/advisories/new  

**DO NOT** report security incidents via:
- Public GitHub issues
- Email
- Social media
- Public forums

### Response Process

1. **Acknowledgment**: Best effort within 7 days
2. **Triage**: Assess severity (Critical / High / Medium / Low / Informational)
3. **Investigation**: UNKNOWN timeframe (depends on maintainer availability)
4. **Remediation**: UNKNOWN timeframe
5. **Disclosure**: Coordinated with reporter

**NO GUARANTEED RESPONSE TIMES**

### Severity Classification

| Level | Definition | Example |
|-------|------------|---------|
| **Critical** | Active exploitation; data breach imminent | RCE vulnerability actively exploited |
| **High** | Exploitable vulnerability; no active exploitation | Authentication bypass possible |
| **Medium** | Theoretical vulnerability; difficult to exploit | XSS in admin-only UI |
| **Low** | Security issue with minimal impact | Information disclosure (non-sensitive) |
| **Informational** | Security concern but not exploitable | Outdated dependency (no known CVE) |

### Communication

- **Private**: Via GitHub Security Advisory until patched
- **Public**: After patch released, coordinated disclosure
- **Customer Notification**: GitHub repository release notes + security advisory

**NO EMAIL NOTIFICATIONS** (GitHub watch/subscribe only)

---

## Operational Incident Response

### Detection

**Customer-Reported**: GitHub issues  
**Platform-Detected**: Forge runtime errors (not visible to app developers)  
**Proactive Monitoring**: NONE (no monitoring infrastructure)

### Response Process

1. **Report Received**: Customer opens GitHub issue
2. **Triage**: Best effort by maintainers (no SLA)
3. **Investigation**: UNKNOWN timeframe
4. **Resolution**: UNKNOWN timeframe
5. **Communication**: Via GitHub issue comments

### Incident Severity (Operational)

**NO SLA PROVIDED**

Rough guidelines (not commitments):

| Impact | Definition | Example | Response |
|--------|------------|---------|----------|
| **Total Outage** | App completely non-functional | Forge runtime crash loop | Best effort |
| **Partial Outage** | Some features broken | Report generation fails | Best effort |
| **Degradation** | Performance issues | Slow storage operations | Best effort |
| **Minor Issue** | Cosmetic or edge case | UI layout glitch | Best effort |

**All response times: UNKNOWN (maintainer availability)**

---

## Data Integrity Incidents

### Scenarios

1. **Storage Corruption**: Data in Forge Storage becomes inconsistent
2. **Missing Data**: Expected data not captured or stored
3. **Incorrect Calculations**: Aggregations or reports contain errors

### Response

1. **Customer Reports Issue**: Via GitHub with evidence (screenshots, export files)
2. **Verification**: Maintainers attempt reproduction
3. **Root Cause Analysis**: UNKNOWN timeframe
4. **Fix**: Code patch (if reproducible)
5. **Data Recovery**: **NOT POSSIBLE** (app has no backup mechanism)

**IMPORTANT**: App does NOT provide data recovery or backlog replay.

---

## Incident Communication

### Internal

**Platform**: GitHub repository (public)  
**Channels**: Issue comments, security advisories, release notes  

**NO PRIVATE CUSTOMER PORTAL**

### External

**Status Page**: NONE  
**Incident Updates**: GitHub issue comments only  
**Post-Mortems**: UNKNOWN (at maintainer discretion)  

---

## Escalation Path

**Level 1**: GitHub issue (community support)  
**Level 2**: Repository maintainers (best effort)  
**Level 3**: NONE (no escalation beyond maintainers)  

**NO PAID SUPPORT TIER**

---

## Platform Incident Dependencies

### Forge Platform Incidents

**Responsibility**: Atlassian  
**Status Page**: https://status.atlassian.com  
**Customer Action**: Contact Atlassian support

This app **cannot mitigate** Forge platform incidents.

### Jira Cloud Incidents

**Responsibility**: Atlassian  
**Status Page**: https://status.atlassian.com  
**Customer Action**: Contact Atlassian support

This app **cannot mitigate** Jira Cloud incidents.

---

## Incident History

**Location**: GitHub repository releases and security advisories  
**URL**: https://github.com/Global-domination/Firstry/releases  

**NO FORMAL INCIDENT LOG**

---

## Disaster Recovery

### Backup Strategy

**App Code**: Git repository (GitHub)  
**App Data (in Forge Storage)**: **NO BACKUP** (Forge Storage API does not provide backup/restore)  

**Data Loss Risk**: Forge Storage failures = unrecoverable data loss

### Recovery Time Objective (RTO)

**UNKNOWN** (depends on Forge platform recovery)

### Recovery Point Objective (RPO)

**UNKNOWN** (no point-in-time recovery; depends on Forge Storage state)

---

## Business Continuity

**Alternative Deployment**: NONE (Forge-only app)  
**Failover Region**: NONE (Forge controls deployment region)  
**High Availability**: Forge platform responsibility  

---

## Compliance Obligations

### Breach Notification

**Responsibility**: Atlassian (as platform provider and data processor)

This app:
- Stores no PII (only Jira metadata)
- Has no direct customer data processor relationship
- Delegates breach notification to Atlassian/Forge

**Customer Obligation**: Review Atlassian's breach notification process

---

## Testing & Exercises

**Incident Response Drills**: NONE  
**Tabletop Exercises**: NONE  
**Penetration Testing**: NONE  

**Security Testing**: See [tests/credibility/](trust/generated/code_refs_inventory.md#credibility) for automated tests

---

## Evidence Handling, Chain of Custody, and Sharing

### What FirstTry Exports Contain

**PDF Report**:
- Title page with generation timestamp
- Executive summary (project counts, issue statistics)
- Snapshot timeline (Jira metadata over time)
- Configuration details (workflows, permissions, fields)
- Appendices (detailed project/issue data)

**JSON Report**:
- Structured snapshot objects (timestamp, projects, issues, metrics)
- Metadata (source Jira instance, export date, snapshot ID)
- Data hash (for integrity verification)

**What is NOT in exports**:
- Issue descriptions or comments (PII-minimizing design)
- User email addresses (only metadata)
- Passwords, API tokens, or secrets
- Attachments or file content

### Chain of Custody (Recommended Best Practices)

**Storage**:
- Export PDFs to customer-owned storage (not Atlassian)
- Recommend: Encrypted USB drive, secure file share, or compliance evidence repository
- Hash PDF files (SHA256) and store hash separately
  ```bash
  sha256sum FirstTry-Evidence-20260301.pdf > FirstTry-Evidence-20260301.pdf.sha256
  ```

**Access Control**:
- Restrict PDF/JSON access to authorized personnel (audit team, legal, compliance)
- Do NOT share on public forums or unencrypted email
- Document who accessed evidence and when (manual log or system tracking)

**Retention**:
- Keep PDF exports for duration of audit/compliance requirements
- After audit closure, follow data retention policy for audit evidence (typically 3-7 years)
- Destroy evidence after retention period expires

### Redaction Guidance

**If audit requires redaction**:
- FirstTry does NOT provide automatic redaction tools
- Manual redaction: Use PDF editor or command-line tools (gs, mutool, pdftk) to redact fields
- Recommend: Use "black box" redaction (not removal) to preserve evidence integrity
- **After redaction**: Generate new hash; document redactions applied

**What can typically be redacted** (audit-dependent):
- Project names (if commercially sensitive)
- Custom field labels (if internal process sensitive)
- Specific issue counts (if competitive data sensitive)

**What should NOT be redacted** (evidence integrity):
- Timestamps (proves when event occurred)
- Status/workflow data (proves control design)
- Configuration metadata (proves configuration state)

### Sharing Evidence with Auditors

**Recommended Process**:

1. **Package**:
   - Export PDF and JSON from FirstTry
   - Include this doc as context (AUDIT_USAGE_GUIDE.md + REVIEWER_FAQ.md)
   - Include file hash (SHA256)

2. **Deliver**:
   - Email: Encrypted/password-protected attachment (if email required)
   - File share: Secure file link (e.g., Dropbox File Request, Google Drive with expiration)
   - USB: Physically secure USB drive (if highly sensitive)

3. **Track Delivery**:
   - Note delivery date and recipient
   - Auditor acknowledges receipt and hash verification
   - Document in chain of custody log

4. **Verify Integrity** (Auditor's responsibility):
   ```bash
   # Auditor verifies hash matches
   sha256sum -c FirstTry-Evidence-20260301.pdf.sha256
   # Expected: "FirstTry-Evidence-20260301.pdf: OK"
   ```

### What NOT to Share

❌ Do NOT share:
- Access credentials to Jira or Atlassian account
- API tokens or authentication keys
- Internal FirstTry logs (may contain debug info)
- Raw Forge Storage data (customers cannot access)
- Unredacted PDFs if sensitive data present

✅ OK to share:
- PDF/JSON evidence exports
- FACTS_AND_NONCLAIMS.md (authoritative fact statements)
- SECURITY.md (security model overview)
- READ_ONLY_ASSURANCE.md (verification of read-only design)

### Legal Admissibility Note

⚠️ **IMPORTANT**: FirstTry evidence is **NOT inherently "legally admissible"**. Legal admissibility is determined by courts, not tools.

**What FirstTry evidence can support**:
- Demonstrating governance process (evidence timeline shows what happened when)
- Supporting compliance control assessment (evidence shows control design)
- Auditor analysis (data for auditor interpretation)

**What auditor/lawyer must determine**:
- Whether evidence is admissible in your jurisdiction
- What procedures were followed (chain of custody, handling, verification)
- Whether evidence is relevant to dispute/audit in question

**Recommendation**: For critical audits/disputes, engage legal counsel to assess admissibility before relying on evidence.

---

## Contact

**Security Incidents**: https://github.com/Global-domination/Firstry/security/advisories/new  
**Operational Incidents**: https://github.com/Global-domination/Firstry/issues  

**NO EMAIL SUPPORT**

---

## Disclaimer

This incident response process is provided on a **best-effort basis** with **no guaranteed response times**.

For production-critical applications, customers should implement their own monitoring, alerting, and incident response procedures that do not depend on app developer responsiveness.

See LICENSE for warranty disclaimer.
