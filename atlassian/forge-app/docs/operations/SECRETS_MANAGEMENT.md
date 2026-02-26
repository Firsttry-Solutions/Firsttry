# Secrets Management

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual
**Doc ID**: FT-OPS-011  

---

## 1. Principle

FirstTry minimizes secrets and rotates them regularly. Secrets are never committed to git.

---

## 2. Secrets Inventory

| Secret Type | Usage | Storage | Rotation |
|------------|-------|---------|----------|
| Forge CLI token | Deployment authentication | GitHub Secrets | Annually |
| GitHub PAT (if used) | Repository automation | GitHub Secrets | Annually |
| Jira Cloud test credentials | Manual testing (optional) | Local (never committed) | N/A |
| Encryption keys | Platform-managed | Atlassian Forge | Not applicable |

---

## 3. Forge CLI Token Management

**Generation**:
```bash
forge login
# Credentials saved to ~/.forge/cli.conf (local only)
```

**Storage**:
- ✅ ~/.forge/cli.conf (user's home directory; never committed)
- ❌ Never stored in package.json, .env files, or source code

**Rotation**:
- Annually (at minimum)
- Immediately if compromised
- On team member departure

**Revocation**:
- Atlassian Marketplace → App Management → Revoke token
- Or use Atlassian Account Settings

---

## 4. GitHub Secrets (CI/CD)

**If using GitHub Actions for automation**:

**Secret names** (example):
- `FORGE_TOKEN` (Forge CLI authentication)
- `SLACK_WEBHOOK` (if notifications enabled; not recommended)

**Storage**:
- Settings → Secrets and variables → Actions
- Only accessible to workflows and authorized users
- Never log or echo secrets in CI/CD output

**Rotation**:
- Annually
- Test new secret before removing old one
- Update all references

---

## 5. Development Secrets

**Local .env file** (never committed):
```
FORGE_TOKEN=your_token_here
JIRA_TEST_SITE=your_test_site.atlassian.net
```

**Gitignore**:
```gitignore
.env
.env.local
~/.forge/
# OR
*.conf
```

---

## 6. Secret Scanning

**Pre-commit hooks** (recommended):
- Install: `npm install --save-dev detect-secrets`
- Configure .pre-commit-config.yaml
- Scan for: AWS keys, GitHub tokens, private keys, etc.

**CI/CD scanning**:
- GitHub's built-in secret scanning
- Alerts on accidental token exposure
- Action: Revoke token immediately if detected

**Manual audit** (quarterly):
```bash
# Search git history for secrets
git log --all --patch | grep -E 'password|secret|token|key' | head -20
```

---

## 7. Incident Response

**If secret is compromised**:
1. **Immediately**: Revoke the secret
2. **Within 1 hour**: Rotate to new secret
3. **Audit**: Check git history for any exposure
4. **Document**: Log in INCIDENT_RESPONSE_PLAN.md
5. **Notify**: Contact affected parties (if external token)

---

## 8. Audit and Compliance

**Audit trail** (GitHub):
- GitHub Audit Log shows secret access
- Settings → Audit log
- Review quarterly for unauthorized access

---

## References

- [ACCESS_CONTROL_POLICY.md](ACCESS_CONTROL_POLICY.md): Credential management
- [INCIDENT_RESPONSE_PLAN.md](INCIDENT_RESPONSE_PLAN.md): Breach response
