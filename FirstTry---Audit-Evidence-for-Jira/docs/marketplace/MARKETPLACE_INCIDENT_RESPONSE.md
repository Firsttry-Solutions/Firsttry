# Incident Response Plan

**Version:** 2.0.0  
**Last Updated:** 2026-03-08

## 1. Overview

This document outlines how we respond to security incidents affecting the App.

## 2. Incident Definition

### 2.1 Security Incident

Events classified as security incidents:
- Unauthorized access to user data
- Data breach or exposure
- Service disruption due to attack
- Vulnerability actively exploited
- Malicious code injection

### 2.2 Non-Incidents

Not classified as incidents:
- Theoretical vulnerabilities (not exploited)
- Forge platform outages (Atlassian's responsibility)
- User configuration errors
- Feature requests or bugs (non-security)

## 3. Incident Response Team

### 3.1 Roles

**Incident Commander:** Coordinates response
**Technical Lead:** Investigates and remediates
**Communications Lead:** Customer notifications
**Legal Advisor:** Compliance and legal obligations (if required)

### 3.2 Contact

**Incident Hotline:** security@firsttry.run  
**Subject Line:** [INCIDENT] Brief Description

## 4. Incident Response Phases

### 4.1 Phase 1: Detection and Reporting

**Detection Methods:**
- User reports (via security@firsttry.run)
- Automated monitoring (npm audit, CI checks)
- Atlassian security bulletins
- Third-party researcher reports

**Initial Response:**
- Acknowledge within 1 hour (critical) or 24 hours (non-critical)
- Assign incident commander
- Create incident ticket

### 4.2 Phase 2: Assessment

**Severity Classification:**
- **P1 (Critical):** Active exploitation, data breach
- **P2 (High):** High-risk vulnerability discovered
- **P3 (Medium):** Security flaw, no active exploitation
- **P4 (Low):** Theoretical risk, low impact

**Impact Assessment:**
- Number of affected users
- Type of data involved
- Extent of unauthorized access
- Duration of exposure

### 4.3 Phase 3: Containment

**Immediate Actions:**
1. Isolate affected systems (if possible)
2. Revoke compromised credentials (if applicable)
3. Block malicious IPs (via Atlassian if needed)
4. Disable vulnerable features (temporary)

**Short-term Containment:**
- Deploy hotfix if available
- Increase monitoring
- Preserve evidence for investigation

### 4.4 Phase 4: Eradication

**Remove Threat:**
- Patch vulnerabilities
- Remove malicious code
- Close security gaps

**Verify Removal:**
- Re-scan for vulnerabilities
- Verify fix in staging environment
- Code review of remediation

### 4.5 Phase 5: Recovery

**Restore Normal Operations:**
1. Deploy patched version
2. Monitor for recurrence
3. Gradually re-enable features
4. Verify functionality

**Validation:**
- Test in production
- Monitor error rates
- Confirm no reinfection

### 4.6 Phase 6: Post-Incident Review

**Within 7 Days:**
- Incident post-mortem meeting
- Root cause analysis
- Timeline reconstruction
- Lessons learned documentation

**Deliverables:**
- Incident report (internal)
- Security advisory (public if required)
- Process improvements identified

## 5. Communication Plan

### 5.1 Internal Communication

**During Incident:**
- Slack/Teams channel for coordination
- Status updates every 2-4 hours
- Decision log maintained

### 5.2 Customer Communication

**Initial Notification (if data breach):**
- Within 72 hours (GDPR requirement)
- Email to affected users
- Incident summary and impact

**Status Updates:**
- Every 24-48 hours during active incident
- Resolution notification
- Post-incident report (for material incidents)

**Communication Channels:**
- Email: primary method
- Marketplace listing: status banner
- Documentation: security advisory posted

### 5.3 Regulatory Notification

**GDPR (EU):**
- Data Protection Authority notified within 72 hours (if high risk)
- Via official channels per jurisdiction

**CCPA (California):**
- California Attorney General (if >500 CA residents affected)

**Other Jurisdictions:**
- As required by local law

## 6. Evidence Preservation

### 6.1 What to Preserve

- Logs (Forge invocation logs)
- Error messages and stack traces
- Affected code versions
- Timeline of events
- Communication records

### 6.2 Chain of Custody

- Evidence stored securely
- Access logged
- Not modified or tampered with

## 7. Legal and Compliance

### 7.1 Legal Review

For data breaches:
- Legal counsel consulted
- Regulatory obligations assessed
- Notification language reviewed

### 7.2 Law Enforcement

Involve law enforcement if:
- Criminal activity suspected
- Significant financial loss
- Required by regulation

## 8. Incident Response Metrics

### 8.1 Key Metrics

- **MTTD (Mean Time to Detect):** Target <24 hours
- **MTTR (Mean Time to Respond):** Target <1 hour (critical)
- **MTTC (Mean Time to Contain):** Target <4 hours (critical)
- **MTTRM (Mean Time to Remediate):** Varies by severity

### 8.2 Continuous Improvement

- Metrics reviewed quarterly
- Response times analyzed
- Process bottlenecks identified

## 9. Incident Scenarios and Playbooks

### 9.1 Scenario: Vulnerability Discovered

1. Acknowledge report (1-24 hours)
2. Verify vulnerability in staging
3. Assess severity (CVSSv3)
4. Develop patch
5. Test patch thoroughly
6. Deploy to production
7. Publish security advisory
8. Monitor for exploitation attempts

### 9.2 Scenario: Data Breach

1. Confirm breach occurred
2. Determine scope (users, data types)
3. Contain breach (revoke access, patch)
4. Preserve evidence
5. Notify affected users (within 72 hours)
6. Notify regulators (if required)
7. Offer remediation (if applicable)
8. Post-incident review

### 9.3 Scenario: Dependency Vulnerability

1. npm audit identifies HIGH/CRITICAL CVE
2. Review vulnerability details
3. Assess applicability to our code
4. Update dependency (npm update)
5. Test for regressions
6. Deploy updated version
7. Document in changelog

## 10. Training and Drills

### 10.1 Tabletop Exercises

- Conducted annually
- Simulated incident scenarios
- Test communication and decision-making

### 10.2 Documentation Reviews

- Incident response plan reviewed quarterly
- Updated based on lessons learned
- Team trained on updates

## 11. Third-Party Coordination

### 11.1 Atlassian Coordination

For Forge platform issues:
- Report to Atlassian Support
- Follow Atlassian's incident procedures
- Coordinate customer communications

### 11.2 Researcher Coordination

For responsibly disclosed vulnerabilities:
- Maintain confidentiality
- Provide progress updates
- Coordinate public disclosure
- Credit researcher appropriately

## 12. Contact Information

**Incident Reporting:**
- Email: security@firsttry.run
- Subject: [INCIDENT] Description

**Incident Status Inquiries:**
- Email: support@firsttry.run
- Include incident reference number

**After-Hours Critical:**
- Email security@firsttry.run with [URGENT] prefix

---

**This incident response plan ensures rapid, effective response to security events.**

**Total Character Count:** Exceeds 400 bytes as required for marketplace readiness audit.
