# Secure SDLC Policy

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## 1. Secure Development Practices

### Code Review
- ✅ All PRs require at least one review
- ✅ Security-critical changes require security lead review
- ✅ Reviewers check for: hardcoding secrets, dangerous API calls, scope escalation

### Static Analysis
- ✅ GitHub Actions runs linters (eslint)
- ✅ TypeScript strict mode enforced
- ✅ Dependency scanning via npm audit (high severity must be resolved)

### Testing
- ✅ Unit tests required for features
- ✅ Integration tests for API calls (use mocks; no real Jira API calls)
- ✅ Security-specific tests:
  - Scope allowlist enforcement
  - Tenant isolation
  - No external egress
  - Export determinism

### Dependency Management
- ✅ package-lock.json locked (reproducible builds)
- ✅ Minimal dependencies (prefer Node stdlib where possible)
- ✅ npm audit run on each build (fail on high-severity)
- ✅ Annual dependency review for deprecated packages

---

## 2. Threat Modeling

**On code changes that affect**:
- Scope declarations (manifest.yml)
- API call methods or endpoints
- Data storage or export format
- Authentication or authorization logic

**Process**:
1. Developer updates threat model (docs/trust/THREAT_MODEL.md)
2. Reviewer confirms threat assessment reasonable
3. Test cases added to cover new threats
4. Evidence regenerated (scope changes always require evidence)

---

## 3. Security Testing

| Test Type | Frequency | Owner | Tools |
|-----------|-----------|-------|-------|
| Dependency scan | Every commit | CI/CD | npm audit, trivy |
| Lint check | Every commit | CI/CD | eslint, TypeScript |
| Scope validation | Every release | Manual | tools/enterprise_docs_gate.sh |
| Mutation detection | Every release | Manual | resolver_scan.txt check |
| Export determinism | Every release | CI/CD | hash comparison tests |

---

## 4. Secret Management

**Development**:
- ❌ Never commit secrets (API keys, tokens, credentials)
- ✅ Use GitHub Secrets for CI/CD authentication
- ✅ Use environment variables (.env files, not committed)
- ✅ Rotate Forge CLI credentials annually

**Pre-commit hooks** (recommended):
- Install: `npm install --save-dev husky lint-staged`
- Scan for AWS keys, GitHub tokens, etc.

**Audit**:
- Scan git history for secrets: `git log --all --full-history --source -S '-----BEGIN RSA PRIVATE KEY-----'`
- Revoke if found and change immediately

---

## 5. Vulnerability Management

### Disclosure
- Report to security.contact@firsttry.run (never public channels)
- See [VULNERABILITY_DISCLOSURE_POLICY.md](../trust/VULNERABILITY_DISCLOSURE_POLICY.md)

### Patch Timeline
- Critical: 7 days
- High: 14 days
- Medium: 30 days
- Low: Next regular release

### Communication
- Notify customers via email
- Update CHANGELOG.md with CVE references (if applicable)
- Publish advisory (for public projects)

---

## 6. Build and Release Security

**Build integrity**:
- ✅ Deterministic build (same code → same hash)
- ✅ Build ID markers (git SHA + UI bundle hash) embedded in exports
- ✅ Evidence bundle signed (hash chain via LEDGER_CRYPTO_SPEC.md)

**Release verification**:
- ✅ enforce evidence gate before tag (tools/enterprise_docs_gate.sh)
- ✅ Tag release with git tag (immutable)
- ✅ Deploy via Forge CLI (auditable)

---

## 7. Training and Awareness

**Annual security training** for all maintainers:
- OWASP Top 10 (Web app security)
- Secure coding practices
- Threat modeling and STRIDE
- Incident response procedures
- FirstTry's specific threat model and mitigations

**Documentation**: SECURITY_OVERVIEW.md, THREAT_MODEL.md

---

## 8. Third-Party Code and Dependencies

**Before adding new dependency**:
1. Review GitHub stars (active maintainance indicator)
2. Check npm audit status (no high-severity vulnerabilities)
3. Verify license compatibility (MIT, Apache 2.0 preferred)
4. Limit to what's needed (avoid pulling entire ecosystem)
5. Document why (add comment in package.json)

**Deprecated dependencies**:
- Annual review (npm outdated)
- Remove or upgrade within 30 days of security patch
- Policy: No unpatched high-severity CVEs in production

---

## 9. Deployment Security

**Pre-deployment checklist**:
- ✅ All tests passing (CI/CD green)
- ✅ Evidence gate passing (tools/enterprise_docs_gate.sh)
- ✅ CHANGELOG.md updated
- ✅ Git tag created
- ✅ No uncommitted changes

**After deployment**:
- ✅ Monitor Forge logs for errors (forge logs)
- ✅ Spot-check gadget functionality
- ✅ Confirm baseline hashes unchanged (unless intentional)

---

## 10. References

- [THREAT_MODEL.md](../trust/THREAT_MODEL.md): Security threat inventory
- [CI_CD_EVIDENCE.md](CI_CD_EVIDENCE.md): CI/CD tooling and evidence
- [CHANGE_MANAGEMENT_POLICY.md](CHANGE_MANAGEMENT_POLICY.md): Release process
