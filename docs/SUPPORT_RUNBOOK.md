# FirstTry Support Runbook — Operational Escalation Process

**Version**: 1.0  
**Last Updated**: 2026-01-13  
**Status**: Operational

---

## Executive Summary

FirstTry is community-supported with **email and GitHub Issues** as the intake channels. This runbook defines:

- ✅ Intake channels (email, GitHub)
- ✅ Severity classification (P1–P4)
- ✅ SLA clock definition (when timer starts)
- ✅ Escalation ladder (who, when, condition)
- ✅ Communication templates
- ✅ What we **cannot** support
- ✅ Operating mode: **best-effort**, not guaranteed SLAs

---

## 1. Intake Channels

### 1.1 Primary: GitHub Issues

**Location**: [github.com/Firsttry-Solutions/Firsttry/issues](https://github.com/Firsttry-Solutions/Firsttry/issues)

**For**: Bug reports, feature requests, usage questions, compatibility issues

**Expected Response Time**: 3–7 days (best-effort, no SLA)

**Instructions**:
1. Check existing issues first (use search filter)
2. Click "New issue"
3. Select template: **Bug Report** or **Feature Request**
4. Fill in:
   - FirstTry version: `firstry --version`
   - Jira Cloud version
   - Exact steps to reproduce
   - Expected vs. actual behavior
   - Error messages from logs
   - Sanitized output of `firstry export` (policies only)
5. Submit issue

**Proof Anchor**: [docs/SUPPORT.md#Contact-Channels](SUPPORT.md)

---

### 1.2 Secondary: Email (Sensitive Issues Only)

**Address**: See [SECURITY.md#Vulnerability-Disclosure](SECURITY.md#11-reporting-security-issues)

**For**: 
- Security vulnerabilities (CVE-level, credential exposure)
- Private/confidential customer data (PII, licensed content)
- Sensitive operational issues

**Expected Response Time**: 
- **Security**: 48 hours (best-effort)
- **Other private issues**: 5–7 days (best-effort)

**Instructions**:
1. Send email to maintainer contact (see SECURITY.md for current contact)
2. Include:
   - **Subject**: `[SECURITY]` or `[PRIVATE]` prefix
   - **Severity**: P1, P2, P3, or P4 (see Section 2)
   - **Description**: Include steps to reproduce and impact
   - **Confidentiality**: Explain why issue must be private
3. Maintainer will acknowledge receipt within 24 hours (best-effort)

**Proof Anchor**: [docs/SECURITY.md#Vulnerability-Disclosure](SECURITY.md#11-reporting-security-issues)

---

### 1.3 Tertiary: Atlassian Community (Public Questions)

**Forum**: [community.atlassian.com/t5/Jira-Cloud-apps](https://community.atlassian.com/t5/Jira-Cloud-apps)

**For**: Usage questions, Jira compatibility, integration guidance

**Expected Response Time**: Varies (community-driven)

**Instructions**:
1. Post question in Jira Cloud Apps category
2. Tag: `FirstTry` and `Jira-Cloud`
3. Community members and maintainers may respond

**Proof Anchor**: [docs/SUPPORT.md#Contact-Channels](SUPPORT.md)

---

## 2. Severity Classification

**Severity** determines SLA clock and escalation trigger. Requestor may suggest; maintainer makes final determination.

### Severity Definitions

| Severity | Name | Criteria | SLA Triage | SLA Fix | Example |
|----------|------|----------|-----------|---------|---------|
| **P1** | Critical | Service unavailable; data loss; credential exposure; production app down | 4 hours | 24 hours | Audit events deleted; credentials exposed in logs; Jira integration broken |
| **P2** | High | Major feature broken; significant data corruption; security bypass | 1 day | 3 days | Policy evaluation returns wrong result; tenant isolation violated; write attempt succeeds |
| **P3** | Medium | Minor feature broken; workaround available; edge case | 3 days | 7 days | Specific policy type doesn't render; rare race condition; performance degradation |
| **P4** | Low | Documentation issue; cosmetic bug; enhancement request | 7 days | 30+ days | Typo in help text; UI alignment issue; feature idea |

---

## 3. SLA Clock Definition

### When SLA Timer Starts

**SLA timer starts when**:
1. Issue is **received** (email timestamp or GitHub issue creation time)
2. Issue is **publicly visible** (not in spam/moderation queue)
3. Issue **meets severity criteria** (if borderline, maintainer clarifies within 24 hours)

### What SLA Clock Measures

**"Triage SLA"** = Time from receipt to first maintainer response (acknowledgment + severity assessment)  
**"Fix SLA"** = Time from triage to code fix or documented workaround (not necessarily released)

### What SLA Clock Does NOT Cover

- ❌ Time waiting for requestor to provide details
- ❌ Time waiting for third-party (Atlassian, AWS) action
- ❌ Holidays, weekends (maintainers are volunteers)
- ❌ Complex root-cause analysis (may take longer)
- ❌ Multi-issue dependencies (some issues are blockers)

### SLA Suspension

SLA clock **pauses** if:
- Requestor hasn't provided required information (details, reproduction steps, version info)
- Requestor is waiting on third-party response (Atlassian support, AWS)
- Maintainer is waiting on code review or test results

Clock **resumes** when information is provided or dependency is resolved.

---

## 4. Escalation Ladder

### Level 1: Intake & Initial Triage (0–24 hours)

**Owner**: Community maintainer (first responder on GitHub/email)

**Action**:
1. Acknowledge receipt (GitHub comment or email reply)
2. Assess severity (P1–P4)
3. Check if duplicate (link to existing issue if applicable)
4. Request missing information (steps to reproduce, version, error logs)
5. If security issue → Move to private disclosure (see Level 3)

**Example Response**:
```
Thanks for reporting! This looks like a [P2/High] issue.

Can you provide:
1. Your FirstTry version (firstry --version)
2. Steps to reproduce
3. Error message from logs

We'll investigate as soon as we have these details.
```

**Escalation Trigger** → P1 (Critical) or blocked for >24 hours without response

---

### Level 2: Investigation & Reproduction (1–7 days)

**Owner**: Maintainer assigned to issue (or issue triage team)

**Action**:
1. Reproduce issue in local environment or test workspace
2. Check code history and related issues
3. Determine if bug, enhancement, or documentation gap
4. Provide:
   - **Diagnosis**: Root cause or contributing factors
   - **Workaround**: Temporary solution (if available)
   - **Next Steps**: Fix plan or "won't fix" with justification

**Example Response**:
```
Reproduced on v1.2.3 with Jira Cloud 9.x.

**Root cause**: Policy parser doesn't handle nested rules.

**Workaround**: Flatten your policy to single-level rules (see example below).

**Fix**: We'll add nested rule support in the next sprint (ETA 2 weeks).

**Tracking**: See PR #123 for draft implementation.
```

**Escalation Trigger** → No progress after 3 days on P1; no progress after 7 days on P2

---

### Level 3: Security / Private Disclosure (0–48 hours)

**Owner**: Maintainer with security responsibility (designated security contact)

**Condition**: Issue involves:
- Credential/key exposure
- Tenant isolation violation
- Authentication bypass
- Data exfiltration
- CVE-level vulnerability

**Action**:
1. **Acknowledgment** (within 12 hours):
   ```
   Thank you for reporting this security issue. We've received your report
   and are investigating. We will not disclose details until a fix is available.
   ```

2. **Investigation** (within 24–48 hours):
   - Reproduce and assess impact scope
   - Determine affected versions
   - Check if actively exploited

3. **Remediation Plan** (within 48 hours):
   - Create private fix in separate branch
   - Run full test suite
   - Prepare disclosure timeline

4. **Release** (coordinated disclosure):
   - Release fix version
   - Publish security advisory (referencing CVE if applicable)
   - Notify affected users
   - Public issue created after fix is released

**Reference**: [docs/SECURITY.md#Vulnerability-Disclosure](SECURITY.md#11-reporting-security-issues)

**Escalation Trigger** → No acknowledgment within 12 hours (incident)

---

### Level 4: Escalation to Maintainers / Project Leadership (7+ days)

**Condition**: Issue remains unresolved after Level 2 and Level 3 attempts:
- No progress for 7+ days on P2
- No progress for 14+ days on P3
- Blocking critical production system

**Owner**: Project maintainers (via GitHub discussion or email to maintainers)

**Action**:
1. Comment on GitHub issue: `@maintainers This is [P1/P2/P3] and blocking [impact]. Can we prioritize?`
2. If GitHub is unresponsive, email: maintainers@github-contact (see CODEOWNERS)
3. Escalation should include:
   - Issue link
   - Severity justification
   - Business impact
   - Proposed timeline

**Expected Response**: Best-effort review within 2–3 business days

**Escalation Trigger** → No response from maintainers within 3 days on P1 (incident)

---

## 5. Communication Templates

### Template 1: Initial Acknowledgment (Level 1)

```
Hi [Name],

Thanks for reporting! We've received your [Bug / Feature / Security] report and 
will investigate.

**Issue**: [One-line summary]
**Severity**: [P1 / P2 / P3 / P4]

Next steps:
- We're reproducing the issue in our environment
- Target triage response: [SLA triage time]
- We'll update you by [Date] with findings

In the meantime, can you provide:
[ ] FirstTry version (firstry --version)
[ ] Jira version
[ ] Reproduction steps
[ ] Error message from logs

Best regards,
FirstTry Maintainers
```

---

### Template 2: Triage Complete (Level 2)

```
Hi [Name],

**Status**: Triage complete

**Root Cause**: [Brief explanation]

**Severity**: P[1-4] - [Justification]

**Workaround** (if available):
[Step-by-step temporary solution]

**Fix Plan**:
- [ ] Code changes identified
- [ ] Fix in progress (ETA: [Date])
- [ ] Tests added
- [ ] Review scheduled for [Date]
- [ ] Target release: v[X.Y.Z] on [Date]

**Tracking**: See PR #[number] for implementation details.

Best regards,
FirstTry Maintainers
```

---

### Template 3: Security Issue Acknowledgment (Level 3)

```
Hi [Name],

**CONFIDENTIAL**

Thank you for responsibly disclosing this security issue. We've received your report
and are investigating in private.

**What happens next**:
1. We reproduce and assess impact (24–48 hours)
2. We develop a fix (3–7 days typical)
3. We release the fix and notify users
4. We publish a public security advisory

**Timeline**: We aim to have a fix ready within [N days].

**Please do not**:
- Disclose this issue publicly
- Test further (risk of data loss)
- Ask for interim compensation or credit

We will acknowledge your responsible disclosure in the security advisory.

Best regards,
FirstTry Security Team
```

---

### Template 4: Won't Fix / Wontfix (Closure)

```
Hi [Name],

**Status**: Closed - Won't Fix

**Reason**: [Choose one or more]
- [ ] By design (architectural constraint)
- [ ] Duplicate of issue #[number]
- [ ] Requires change to Atlassian Forge API (out of scope)
- [ ] Enhancement out of scope for v1 (to be prioritized in future versions)
- [ ] User error (see troubleshooting guide)
- [ ] Requires customer to upgrade [dependency]

**Justification**: [Detailed explanation]

**Workaround**: [If available]

**Appeal Process**: If you believe this decision should be reconsidered, please
reply with new information and we'll re-evaluate.

Best regards,
FirstTry Maintainers
```

---

## 6. What FirstTry Support Does NOT Cover

### Out of Scope (Will Not Support)

❌ **End-user training** — How to use FirstTry UI  
→ Refer to: `firstry help` or [docs/SUPPORT.md](SUPPORT.md)

❌ **Jira Cloud administration** — How to configure Jira  
→ Refer to: [Atlassian support](https://support.atlassian.com)

❌ **Jira plugin ecosystem** — Integrating FirstTry with other apps  
→ Refer to: [Atlassian Marketplace](https://marketplace.atlassian.com)

❌ **Custom policy development** — Writing custom policy syntax  
→ Refer to: [FirstTry policy documentation](../atlassian/forge-app/docs)

❌ **Performance tuning** — Optimizing Jira or AWS infrastructure  
→ Refer to: [Atlassian Cloud support](https://support.atlassian.com)

❌ **Data recovery** — Restoring deleted policies or data  
→ Refer to: [DATA_RETENTION.md](DATA_RETENTION.md) and Jira backups

❌ **Licensing / entitlements** — Paid support contracts  
→ Status: FirstTry is open-source; no paid support offered

❌ **Custom development** — Building features for your use case  
→ Status: Community contributions welcome (see CONTRIBUTING.md)

### In Scope (Will Support)

✅ **Bugs in FirstTry** — Code defects, platform incompatibilities  
✅ **Security vulnerabilities** — CVE-level issues, credential exposure  
✅ **Documentation gaps** — Unclear guides, outdated examples  
✅ **Feature requests** — Ideas for new functionality  
✅ **Compatibility** — FirstTry + specific Jira version combinations  
✅ **Integration guidance** — How FirstTry works with Jira features  

---

## 7. Operating Mode: Best-Effort, No Guaranteed SLAs

### Important Disclaimer

FirstTry is **community-supported software**. Maintainers are volunteers with limited time.

**What "best-effort" means**:
- ✅ We will try to respond within target timelines
- ✅ We will investigate issues in good faith
- ✅ We will prioritize critical security issues
- ❌ We do NOT guarantee response times
- ❌ We do NOT guarantee fixes within specific timeframes
- ❌ We do NOT provide 24/7 support or on-call coverage
- ❌ We do NOT offer SLAs for non-critical issues

### SLA Targets (NOT Guarantees)

| Severity | Triage Target | Fix Target | Confidence |
|----------|---------------|-----------|------------|
| P1 (Critical) | 4 hours | 24 hours | Best-effort |
| P2 (High) | 1 day | 3 days | Best-effort |
| P3 (Medium) | 3 days | 7 days | Best-effort |
| P4 (Low) | 7 days | 30+ days | Best-effort |

### When to Consider Paid Support

If you require:
- Guaranteed response times
- Dedicated support engineer
- Custom development
- 24/7 on-call coverage
- Service-level agreements (SLAs)

**Options**:
1. **Sponsor a maintainer** — Contribute financially to FirstTry
2. **Fork and maintain** — Use FirstTry as a base for your own deployment
3. **Hire a consultant** — Engage a Jira specialist familiar with FirstTry
4. **Use Atlassian support** — For Jira Cloud infrastructure issues

---

## 8. Issue Lifecycle & Closure Criteria

### Lifecycle Stages

```
┌────────────────────┐
│  NEW               │  Issue reported, not yet triaged
└─────────┬──────────┘
          │
┌─────────▼──────────┐
│  TRIAGED           │  Severity assigned, reproduced (or can't reproduce)
│  (P1–P4)           │
└─────────┬──────────┘
          │
┌─────────▼──────────┐
│  IN PROGRESS       │  Fix or investigation underway
│  (PR #[num])       │
└─────────┬──────────┘
          │
┌─────────▼──────────┐
│  RESOLVED          │  Fix released or workaround documented
└─────────┬──────────┘
          │
┌─────────▼──────────┐
│  CLOSED            │  User confirms fix works or won't-fix accepted
└────────────────────┘
```

### Closure Criteria

Issue is **closed** when one of:

1. **Fixed & Verified**
   - Fix released in a version
   - User confirms issue is resolved
   - Related tests added

2. **Workaround Provided**
   - Documented workaround available
   - Workaround tested and confirmed
   - User acknowledges

3. **Duplicate**
   - Issue is duplicate of existing issue
   - Linked to primary issue
   - User is directed to primary

4. **Won't Fix**
   - Architectural constraint (by design)
   - Out of scope (e.g., Jira Cloud responsibility)
   - Enhancement deferred (tracked for future version)
   - User error (documented in guide)

5. **User Error / Invalid**
   - Issue is not reproducible after investigation
   - User was not following documentation
   - Issue is environmental (user's Jira config)

### Re-opening Issues

Issue may be **re-opened** if:
- Fix is reverted
- Issue recurs in new version
- Additional information reveals original diagnosis was incomplete
- User's follow-up suggests workaround is insufficient

---

## 9. SLA Breach & Escalation Process

### What Happens If We Miss an SLA Target

**It happens.** Maintainers are volunteers. If we miss an SLA target:

1. **No automatic compensation** — FirstTry is free software; no refunds or credits
2. **Automatic escalation** — Issue is bumped to next level
3. **Transparency** — We will add a comment explaining the delay

**Example**:
```
@[user] — Apologies for the delayed response. We've been busy with [other critical issue],
but your issue is important. Bumping to P[X] priority. Investigation starting today.
```

### Incident Response (P1 Breach)

If a **P1 (Critical)** issue is NOT triaged within 4 hours:

1. **Automatic escalation** — Goes to secondary maintainers
2. **Incident declared** — Issue labeled `incident`
3. **Daily updates** — Maintainers post status every 24 hours
4. **Post-mortem** — After resolution, we discuss why SLA was missed

---

## 10. Related Documentation

- [docs/SUPPORT.md](SUPPORT.md) — Support contact channels & troubleshooting
- [docs/SUPPORT_POLICY.md](SUPPORT_POLICY.md) — Summary of support model
- [docs/SECURITY.md](SECURITY.md) — Vulnerability disclosure timeline
- [docs/SECURITY_CONTACT.md](SECURITY_CONTACT.md) — Security contact information
- [docs/CHANGE_MANAGEMENT.md](CHANGE_MANAGEMENT.md) — How changes are reviewed & released
- [CONTRIBUTING.md](../CONTRIBUTING.md) — How to contribute (not support, but related)

---

## 11. Contact Information

### Current Support Contacts

**GitHub Issues** (Recommended):  
→ [github.com/Firsttry-Solutions/Firsttry/issues](https://github.com/Firsttry-Solutions/Firsttry/issues)

**Email** (Security/Private):  
→ See [docs/SECURITY.md#Vulnerability-Disclosure](SECURITY.md#11-reporting-security-issues)

**Maintainers**:  
→ See CODEOWNERS file or GitHub organization profile

**Last Updated**: 2026-01-13

---

**End of Support Runbook**

*This runbook is operational. It defines FirstTry's actual support capacity and commitment. Deviations require maintainer consensus.*
