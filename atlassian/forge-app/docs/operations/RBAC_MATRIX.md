# RBAC Matrix

**Version**: 4.4.2  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Quarterly (access review every 90 days)
**Doc ID**: FT-OPS-009  

---

## Current Access Matrix

| User/Team | GitHub Repo | Code Review | Merge | Deploy | Vulnerability Triage |
|-----------|-------------|------------|-------|--------|----------------------|
| **Public** | Read (if public) | ✅ | ❌ | ❌ | ❌ |
| **Developers** | Read/Write | ✅ (PR required) | ❌ | ❌ | ❌ |
| **Maintainers** | Read/Write admin | ✅ | ✅ | ✅ | ⚠️ (under supervision) |
| **Security Lead** | Read/Write admin | ✅ | ✅ | ✅ | ✅ |

---

## Role Descriptions

### Developer
- Creates branches, commits code, opens pull requests
- Code reviewed by maintainer before merge
- No direct deploy access
- Limited to feature branches (not main)

### Maintainer
- Merges PRs after code review
- Deploys releases via forge deploy
- Manages CI/CD workflows
- Can trigger evidence regeneration
- Responds to non-critical security issues

### Security Lead
- All maintainer permissions
- Reviews and triages security vulnerabilities
- Approves security patches
- Conducts threat model updates
- Decides incident severity and response

---

## MFA Requirement

| Role | MFA Required | Enforcement |
|------|--------------|-------------|
| Developer | ⚠️ Recommended | Branch protection (soft-enforced) |
| Maintainer | ✅ Mandatory | Branch protection (hard-enforced) |
| Security Lead | ✅ Mandatory | Branch protection (hard-enforced) |

---

## Quarterly Access Review Steps

1. **Run audit**:
   ```bash
   # List GitHub team members
   gh team list-members --org Firsttry-Solutions --team-slug firsttry-dev
   ```

2. **Validate each user**:
   - Still active in organization?
   - Still requires this access level?
   - MFA still enabled?

3. **Update this matrix** if changes detected

4. **Document findings**:
   - Date of review
   - Changes made (if any)
   - Next review date

5. **Example review record**:
   ```
   ---
   Review Date: 2026-05-26
   Reviewers: Security Lead
   Changes: Added Developer "alice [redacted]"
   Next Review: 2026-08-26
   ```

---

## Current Team Members

| Name | GitHub | Role | MFA Status | Last Updated |
|------|--------|------|-----------|--------------|
| (Example) | @dev1 | Developer | ✅ | 2026-02-26 |
| (Example) | @maintainer1 | Maintainer | ✅ | 2026-02-26 |
| (Example) | @security-lead | Security Lead | ✅ | 2026-02-26 |

**Note**: Maintain names and GitHub handles for audit trail.

---

## Access Termination

When user leaves project or organization:

1. **Immediate**:
   - Disable GitHub account (remove from teams)
   - Revoke Forge CLI credentials
   - Revoke GitHub personal access tokens (if any)

2. **Next business day**:
   - Audit commit log (check for any unauthorized commits)
   - Review merged PRs
   - Check for any remaining access

3. **Document**:
   - Date of termination
   - Reason for access revocation
   - Final access audit results

---

## References

- [ACCESS_CONTROL_POLICY.md](ACCESS_CONTROL_POLICY.md): Access control principles
- [INCIDENT_RESPONSE_PLAN.md](INCIDENT_RESPONSE_PLAN.md): Breach response
