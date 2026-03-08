# FirstTry Incident Response Plan

**Version:** 2.0.0  
**Last Updated:** March 4, 2026  
**Status:** Active  
**Classification:** Public

## 1. Overview

This document defines FirstTry's incident response procedures for security incidents, data breaches, and operational disruptions.

## 2. Scope

This plan covers:

- Security vulnerabilities
- Data breaches
- Service outages
- Code integrity issues
- Evidence tampering
- Supply chain compromises

**Out of Scope:**
- Atlassian infrastructure incidents (handled by Atlassian)
- Network-level attacks (handled by Atlassian)
- Physical security (handled by Atlassian)

## 3. Incident Classification

### 3.1 Severity Levels

| Severity | Criteria | Response Time | Example |
|----------|----------|---------------|---------|
| **Critical (P0)** | Data breach, external exfiltration, active exploit | **15 minutes** | Jira data leaked to external server |
| **High (P1)** | Privilege escalation, unauthorized access | **1 hour** | User accessed data outside their permissions |
| **Medium (P2)** | XSS vulnerability, evidence tampering | **4 hours** | Stored XSS in custom UI |
| **Low (P3)** | Minor config issue, non-exploitable bug | **24 hours** | Dashboard display glitch |

### 3.2 Impact Assessment

| Impact | Criteria |
|--------|----------|
| **Customer Data** | Customer Jira data accessed, modified, or exfiltrated |
| **Service Availability** | App downtime affecting multiple customers |
| **Compliance** | GDPR/CCPA breach notification required |
| **Reputation** | Public disclosure likely, Marketplace review at risk |

---

## 4. Incident Response Team

### 4.1 Roles and Responsibilities

| Role | Responsibilities | Contact |
|------|------------------|---------|
| **Incident Commander (IC)** | Coordinate response, make decisions | security@firsttry.run |
| **Security Lead** | Technical investigation, forensics | security@firsttry.run |
| **Engineering Lead** | Develop fixes, deploy patches | engineering@firsttry.run |
| **Compliance Officer** | Regulatory notifications (GDPR, CCPA) | compliance@firsttry.run |
| **Communications Lead** | Customer notifications, status updates | support@firsttry.run |
| **Legal Counsel** | Legal review, disclosure decisions | legal@firsttry.run |

### 4.2 Escalation Path

```
Detection
    │
    ▼
Security Lead (assess severity)
    │
    ├─ P3 (Low) → Engineering Lead → Fix via normal release
    │
    ├─ P2 (Med) → IC + Eng Lead → Hotfix within 24 hours
    │
    └─ P0/P1 (Critical/High)
         │
         ▼
    Incident Commander
         │
         ├─ Security Lead (forensics)
         ├─ Eng Lead (mitigation)
         ├─ Compliance Officer (breach notification)
         ├─ Comms Lead (customer notification)
         └─ Legal Counsel (disclosure review)
```

---

## 5. Incident Response Process

### 5.1 Phase 1: Detection and Identification

**Objective:** Detect and confirm incident.

**Actions:**
1. **Detection Sources:**
   - Automated monitoring (Forge logs)
   - Marketplace security scanner
   - User report (security@firsttry.run)
   - Atlassian notification
   - Evidence pack verification failure

2. **Initial Triage:**
   - Verify incident is real (not false positive)
   - Classify severity (P0-P3)
   - Identify affected systems
   - Assign Incident Commander

3. **Evidence Preservation:**
   - Snapshot Forge logs
   - Generate evidence pack (if applicable)
   - Document initial observations

**Timeline:** 15 minutes for P0, 1 hour for P1

---

### 5.2 Phase 2: Containment

**Objective:** Stop incident from spreading.

**Immediate Containment (P0/P1):**
1. **Isolate Affected Systems:**
   - Disable compromised resolver functions (Forge deployment)
   - Revoke API tokens (if compromised)
   - Suspend scheduled triggers (if malicious)

2. **Prevent Data Loss:**
   - Freeze auto-purge (legal hold if breach)
   - Backup current storage state (evidence pack)

3. **Notify Atlassian:**
   - Email security@atlassian.com for Forge-level incidents
   - Request Marketplace review suspension (if needed)

**Short-Term Containment (All Severities):**
- Develop patch or workaround
- Test fix in isolated environment
- Prepare hotfix deployment

**Timeline:** 1 hour for P0, 4 hours for P1

---

### 5.3 Phase 3: Eradication

**Objective:** Remove root cause.

**Actions:**
1. **Root Cause Analysis:**
   - Identify vulnerability source (code review, logs)
   - Determine attack vector
   - Assess blast radius (affected customers)

2. **Remediation:**
   - Apply security patch
   - Update dependencies (if supply chain issue)
   - Fix code vulnerability
   - Update manifest (if permissions issue)

3. **Verification:**
   - Run marketplace audit: `bash tools/marketplace_audit/run_marketplace_readiness_v2.sh`
   - Run reviewer E2E test: `npm run test:e2e`
   - Verify evidence pack integrity
   - Confirm vulnerability resolved

**Timeline:** 4 hours for P0, 24 hours for P1

---

### 5.4 Phase 4: Recovery

**Objective:** Restore normal operations.

**Actions:**
1. **Deploy Fix:**
   - Forge deployment: `forge deploy --environment production`
   - Monitor deployment logs
   - Verify app functionality

2. **Customer Communication:**
   - Email affected customers (if data breach)
   - Post status update (if service outage)
   - Provide mitigation steps (if user action needed)

3. **Resume Operations:**
   - Re-enable scheduled triggers
   - Lift legal hold (if applicable)
   - Resume auto-purge

**Timeline:** 2 hours for P0, 8 hours for P1

---

### 5.5 Phase 5: Post-Incident Review

**Objective:** Learn and improve.

**Actions:**
1. **Incident Report:**
   - Timeline of events
   - Root cause analysis
   - Response effectiveness
   - Lessons learned

2. **Remediation Follow-Up:**
   - Implement preventive controls
   - Update incident response plan
   - Security training (if human error)

3. **Compliance:**
   - Finalize GDPR/CCPA notifications (if breach)
   - Update audit logs
   - Archive incident documentation

**Timeline:** 7 days after incident closure

---

## 6. Breach Notification

### 6.1 GDPR Requirements (Article 33 & 34)

**Supervisory Authority Notification (Article 33):**
- **When:** Personal data breach
- **Timeline:** Within **72 hours** of becoming aware
- **Content:**
  - Nature of breach
  - Data categories affected
  - Number of data subjects
  - Consequences
  - Mitigation measures
  - Contact information (DPO)

**Data Subject Notification (Article 34):**
- **When:** High risk to rights and freedoms
- **Timeline:** Without undue delay
- **Content:**
  - Nature of breach
  - Contact information (DPO)
  - Consequences
  - Mitigation measures

**Exemptions:**
- Technical protections (encryption) render data unintelligible
- Measures taken to ensure high risk no longer likely
- Notification would involve disproportionate effort (public communication instead)

---

### 6.2 CCPA Requirements (Section 1798.82)

**Notification Required When:**
- Personal information acquired by unauthorized person
- 500+ California residents affected

**Timeline:** Without unreasonable delay

**Content:**
- Contact information
- Types of information compromised
- Date of breach (or estimate)
- Steps taken to mitigate
- Advice to consumers

---

### 6.3 FirstTry Breach Notification Process

```
Breach Confirmed (IC)
    │
    ▼
Assess Risk (Security Lead + Compliance Officer)
    │
    ├─ High Risk? → GDPR Article 34 (notify data subjects)
    │
    └─ 500+ CA residents? → CCPA Section 1798.82 (notify consumers)
    │
    ▼
Draft Notification (Comms Lead + Legal Counsel)
    │
    ▼
Review and Approve (IC + Legal Counsel)
    │
    ▼
Send Notifications
    │
    ├─ Email to affected customers
    ├─ Supervisory authority (GDPR)
    └─ Public disclosure (if required)
```

**Timeline:** P0 breach notification within 24 hours (internal target), 72 hours (GDPR requirement)

---

## 7. Communication Plan

### 7.1 Internal Communication

**During Incident:**
- **Slack channel:** #incident-response
- **War room:** Video call (all hands)
- **Status updates:** Every 30 minutes (P0), hourly (P1)

**After Incident:**
- **Post-mortem:** Engineering team meeting
- **Documentation:** Incident report in `docs/incidents/`

---

### 7.2 External Communication

**Customers:**
- **Email:** All affected installations
- **In-app banner:** Dashboard notification
- **Support portal:** Status page update

**Atlassian:**
- **Marketplace team:** security@atlassian.com
- **Forge team:** forge-security@atlassian.com

**Regulators:**
- **GDPR:** Supervisory authority in customer's jurisdiction
- **CCPA:** California Attorney General (if 500+ CA residents)

---

### 7.3 Public Disclosure

**When Required:**
- GDPR Article 34 (high risk to data subjects)
- CCPA Section 1798.82 (500+ CA residents)
- Responsible disclosure (coordinated with reporter)

**Channels:**
- Blog post: firsttry.io/blog
- GitHub Security Advisory: github.com/firsttry/security/advisories
- Atlassian Marketplace listing update

**Template:** See Section 9.2 for breach notification email template.

---

## 8. Incident Response Tools

### 8.1 Forensics

| Tool | Purpose | Command |
|------|---------|---------|
| Evidence Pack | Capture app state | `bash tools/reviewer_demo/proof_pack/build_reviewer_proof_pack.sh` |
| Forge Logs | Runtime diagnostics | `forge logs --environment production` |
| Marketplace Audit | Security scan | `bash tools/marketplace_audit/run_marketplace_readiness_v2.sh` |
| Git History | Code archaeology | `git log --all --full-history -- <file>` |

### 8.2 Monitoring

**Forge Platform:**
- App logs: `forge logs`
- Invocation metrics: Forge dashboard

**Evidence Packs:**
- Verify integrity: `bash tools/reviewer_demo/proof_pack/verify_reviewer_proof_pack.sh <pack_dir>`
- Check for tampering: Compare SHA256 manifests

---

## 9. Templates

### 9.1 Incident Report Template

```markdown
# Incident Report: [INCIDENT-ID]

**Date:** YYYY-MM-DD  
**Severity:** P0/P1/P2/P3  
**Status:** Resolved/Investigating

## Summary
[Brief description of incident]

## Timeline
- HH:MM UTC: Detection
- HH:MM UTC: Containment
- HH:MM UTC: Eradication
- HH:MM UTC: Recovery

## Root Cause
[Technical explanation]

## Impact
- Customers affected: [number]
- Data accessed: [type]
- Downtime: [duration]

## Response Actions
1. [Action taken]
2. [Action taken]

## Lessons Learned
- [What went well]
- [What to improve]

## Follow-Up Actions
- [ ] Task 1 (Owner: Name, Due: Date)
- [ ] Task 2 (Owner: Name, Due: Date)
```

---

### 9.2 Breach Notification Email Template

**Subject:** Security Incident Notification - FirstTry for Jira

**Body:**
```
Dear [Customer Name],

We are writing to inform you of a security incident affecting your FirstTry installation ([Installation ID]).

WHAT HAPPENED:
On [Date], we discovered [brief description of incident]. Our investigation indicates that [scope of breach].

WHAT INFORMATION WAS INVOLVED:
[List data types, e.g., "Jira issue keys and summaries for [number] issues"]

WHAT WE ARE DOING:
- We have [containment actions taken]
- We have [remediation steps]
- We have [preventive measures]

WHAT YOU CAN DO:
- [Recommended customer actions, if any]
- Review your Jira audit logs for [date range]
- Contact us at security@firsttry.run with questions

We take this incident very seriously and are committed to protecting your data. We will provide updates as our investigation progresses.

Contact Information:
- Security Team: security@firsttry.run
- Data Protection Officer: dpo@firsttry.run
- Support: support@firsttry.run

Sincerely,
FirstTry Security Team
```

---

## 10. Responsible Disclosure

See [Responsible Disclosure Policy](responsible_disclosure.md) for vulnerability reporting procedures.

---

## 11. Testing and Drills

### 11.1 Tabletop Exercises

**Frequency:** Quarterly

**Scenarios:**
1. P0: Data exfiltration via malicious dependency
2. P1: XSS vulnerability reported by researcher
3. P2: Evidence pack manifest tampering detected

**Participants:** All incident response team members

**Outcome:** Updated incident response plan

---

### 11.2 Technical Drills

**Frequency:** Annually

**Procedures:**
1. Simulate outage (disable app in test environment)
2. Execute containment (disable triggers)
3. Generate evidence pack (forensics)
4. Deploy hotfix
5. Verify recovery

**Metrics:**
- Time to containment
- Time to resolution
- Communication effectiveness

---

## 12. References

- [GDPR Articles 33 & 34](https://gdpr-info.eu/art-33-gdpr/) (Breach Notification)
- [CCPA Section 1798.82](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.82) (Data Breach Notification)
- [NIST SP 800-61r2](https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final) (Incident Handling Guide)
- [Atlassian Security Incident Response](https://www.atlassian.com/trust/security/incident-response)
- FirstTry Responsible Disclosure: `docs/trust/responsible_disclosure.md`
- FirstTry Threat Model: `docs/trust/threat_model.md`

---

**Plan Owner:** FirstTry Security Team  
**Approved By:** Chief Information Security Officer  
**Next Review:** 2026-06-04  
**Version History:**
- v1.0 (2026-03-04): Initial release
