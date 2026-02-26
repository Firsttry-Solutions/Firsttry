# Access Control Policy

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual (Quarterly access review recommended)
**Doc ID**: FT-OPS-007  

---

## 1. Principle

FirstTry follows the principle of **least privilege**: Users have minimum access required for their role.

---

## 2. Access Tiers

### Tier 1: Public (No Authentication Required)
- Documentation (docs/)
- Public GitHub repository (if applicable)

### Tier 2: Developer (Atlassian OAuth2)
- Source code repository access (GitHub)
- Development environment
- Requires: GitHub pull request review

### Tier 3: Maintainer (Admin)
- Merge permissions on main branch
- Release and deployment authority
- Requires: Multi-factor authentication (MFA) on GitHub
- Requires: Security training (annual)

### Tier 4: Security Lead (Full Admin)
- All above
- Plus: vulnerability triage, incident response decisions
- Requires: MFA (mandatory)
- Requires: Security clearance or vetting

---

## 3. Multi-Factor Authentication (MFA)

**Mandatory for**:
- All GitHub accounts with repo push access
- Atlassian Forge deployment accounts
- Jira Cloud admin site (if test site exists)

**Method**: GitHub's built-in authentication (TOTP or security keys)

**Enforcement**: GitHub branch protection rules block commits from non-MFA accounts.

---

## 4. Onboarding

**New team member process**:
1. Assign to GitHub team (with least privilege role)
2. Enable MFA on GitHub account
3. Provision Forge CLI credentials (if deploying)
4. Grant Jira Cloud test site access (if applicable)
5. Conduct security training (docs/trust/SECURITY_OVERVIEW.md)

**Offboarding**:
1. Disable GitHub access (remove from team)
2. Revoke Forge credentials
3. Remove from Jira Cloud site
4. Audit for any lingering access

---

## 5. Access Review

**Quarterly** (every 3 months):
1. List all users with repo access
2. Confirm each user still requires access
3. Revoke access for users who have changed roles
4. Update RBAC_MATRIX.md with current state
5. Document findings in changelog or access log

---

## 6. Credential Management

**Forge CLI credentials**:
- Store in `~/.forge/cli.conf` (local machine; never commit)
- Rotate annually or on role change
- Revoke on offboarding
- Never share credentials (one per person)

**GitHub tokens** (if used for automation):
- Store in GitHub Secrets (if CI/CD uses PATs)
- Rotate every 90 days
- Limit scope to minimum required
- Audit token usage logs

---

## 7. Incident and Breach Response

**If unauthorized access suspected**:
1. Notify security.contact@firsttry.run immediately
2. Revoke suspect credentials
3. Conduct audit log review (GitHub Actions logs, Forge logs)
4. Reset MFA on affected accounts
5. Follow INCIDENT_RESPONSE_PLAN.md

---

## References

- [RBAC_MATRIX.md](RBAC_MATRIX.md): Current access matrix
- [INCIDENT_RESPONSE_PLAN.md](INCIDENT_RESPONSE_PLAN.md): Breach response procedures
- [docs/trust/SECURITY_OVERVIEW.md](../trust/SECURITY_OVERVIEW.md): Security principles
