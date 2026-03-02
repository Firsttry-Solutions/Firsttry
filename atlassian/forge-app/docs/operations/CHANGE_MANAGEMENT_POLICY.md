# Change Management Policy

**Version**: 4.4.2  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual
**Doc ID**: FT-OPS-008  

---

## 1. Purpose

This policy establishes a framework for managing changes to FirstTry, including:
- Application code updates
- Dependency updates
- Documentation and security policy changes
- Evidence artifact regeneration
- Baseline file updates

---

## 2. Change Categories

### Routine Changes
- Bug fixes, non-security features
- Internal refactoring
- Documentation clarifications
- Test additions

**Process**: Code review → merge to main → tag release → deploy

**Evidence**: Automatic via CI/CD

### Security Changes
- Vulnerability fixes
- Scope adjustments (manifest.yml changes)
- Security policy updates
- Evidence baseline updates

**Process**: Code review → security lead approval → merge → security advisory → deploy

**Evidence**: Manual regeneration required (see below)

### Baseline Changes (manifest.yml or package-lock.json)
- New scope declarations
- Dependency security patches
- Major version updates

**Process**:
1. Update manifest.yml or package-lock.json
2. Regenerate baselines: `sha256sum manifest.yml > docs/evidence/baselines/manifest.yml.sha256`
3. Update CHANGELOG.md with justification
4. Regenerate evidence: `bash tools/generate_enterprise_evidence.sh`
5. Code review → merge → tag → deploy

**Verification**: Enterprise docs gate must pass before merge

---

## 3. Evidence Regeneration Requirement

**When required**:
- ✅ manifest.yml baseline changes (scope, version)
- ✅ package-lock.json baseline changes (dependencies)  
- ✅ Any resolver.ts file changes (can change API calls)
- ✅ Any format or serialization changes
- ❌ Documentation-only changes (evidence not required)
- ❌ Test-only changes (evidence not required)
- ❌ CI/CD configuration changes (evidence not required)

**Process**:
```bash
# After making baseline-affecting changes:
bash tools/generate_enterprise_evidence.sh $(date -u +%Y-%m-%d)

# Review generated files:
ls -la docs/evidence/$(date -u +%Y-%m-%d)_release/

# Commit evidence along with code changes:
git add docs/evidence/$(date -u +%Y-%m-%d)_release/
git commit -m "Evidence regeneration for v0.4.2"
```

---

## 4. Versioning Scheme

**Format**: `MAJOR.MINOR.PATCH-SUFFIX`

- **MAJOR**: Breaking changes (rare for app)
- **MINOR**: New features, scope changes
- **PATCH**: Bug fixes, security patches
- **SUFFIX**: Optional (e.g., "-rc1" for release candidate)

**Examples**:
- v0.4.1 (stable release)
- v0.4.2-security (security patch)
- v0.5.0-scope (new scope added)

---

## 5. Baseline Drift Policy

**Baseline files** (must only change via this process):
- `docs/evidence/baselines/manifest.yml.sha256`
- `docs/evidence/baselines/package-lock.json.sha256`

**Drift detection**: Enterprise docs gate fails if baselines don't match current files.

**If drift occurs**:
1. Investigate: Why did files change without baseline update?
2. Revert: Roll back to previous version
3. OR update: If intentional, follow baseline change process above
4. Document: Justify change in CHANGELOG.md

---

## 6. Release Process

1. **Update version**: Bump version in manifest.yml
2. **Update baseline**: Regenerate baseline hashes if needed
3. **Regenerate evidence**: Run evidence generation script
4. **Update CHANGELOG.md**: Document changes
5. **Create git tag**: `git tag v0.4.2`
6. **Push**: `git push origin main --tags`
7. **Deploy**: `forge deploy` (if not automatic)
8. **Notify**: Email release notes to customers (if not public)

---

## 7. Rollback Procedure

If deployed version has critical issue:

1. **Identify** previous stable version from git tags
2. **Checkout**: `git checkout v0.4.1`
3. **Deploy**: `forge deploy` (redeploy previous version)
4. **Communicate**: Notify customers of rollback and incident
5. **Investigate**: Debug issue before releasing new patch
6. **Document**: Record incident in INCIDENT_RESPONSE_PLAN.md

---

## 8. Configuration Management

**Controlled files** (changes require evidence regeneration):
- manifest.yml (scopes, version, metadata)
- package-lock.json (dependencies)

**Non-controlled files** (changes don't require evidence):
- src/**/*.ts (code; evidence auto-generated if manifest changes)
- docs/**/*.md (documentation)
- tests/**/*.ts (tests)
- .github/**

---

## 9. Approval Process

| Change Type | Reviewer | Approver | Deployment |
|-------------|----------|----------|------------|
| Routine bug fix | Code review | Lead dev | Auto (CI/CD) |
| Security fix | Code review + security screen | Security lead | Manual (controlled) |
| Scope change | Architecture review | Security lead | Gated (requires evidence) |
| Baseline update | Code review | Release manager | Manual |

---

## 10. References

- [docs/evidence/baselines/README.md](../evidence/baselines/README.md): Baseline file policy
- [CHANGELOG.md](../CHANGELOG.md): Release history
- [tools/generate_enterprise_evidence.sh](../trust/generated/repo_refs.md): Evidence generation
