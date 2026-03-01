# Release Procedure — Versioning, Tagging, Change Control

**Doc ID:** FT-OPS-008  
**Version:** 1.0.0  
**Owner:** operations@firsttry.run  
**Last Updated:** 2026-03-01  
**Review Cycle:** Quarterly  

## Audience

Release managers and maintainers creating new FirstTry releases.

## Prerequisites

- Write access to repository
- Completed audit pass (artifacts available)
- Changelog prepared
- Forge CLI authenticated

## What Success Looks Like

- Version incremented per semver
- Git tag created and pushed
- Changelog updated
- Forge deployment successful
- Release documented

## Versioning Scheme

FirstTry follows [Semantic Versioning 2.0.0](https://semver.org/):

**Format:** `MAJOR.MINOR.PATCH`

- **MAJOR:** Breaking changes (incompatible API, manifest scope changes)
- **MINOR:** New features, backward-compatible
- **PATCH:** Bug fixes, security patches

**Examples:**
- `1.0.0` → `1.0.1`: Bug fix
- `1.0.1` → `1.1.0`: New feature
- `1.1.0` → `2.0.0`: Breaking change

## Release Types

### Patch Release (1.0.0 → 1.0.1)

**Triggers:**
- Bug fixes
- Security patches
- Documentation updates
- Dependency updates (non-breaking)

**Scope:** No new features, no breaking changes.

### Minor Release (1.0.0 → 1.1.0)

**Triggers:**
- New features
- Performance improvements
- New optional functionality

**Scope:** Backward-compatible additions.

### Major Release (1.0.0 → 2.0.0)

**Triggers:**
- Breaking API changes
- Manifest scope additions (requires user re-consent)
- Removal of deprecated features
- Data schema changes

**Scope:** Incompatible changes requiring customer action.

## Pre-Release Checklist

- [ ] All CI checks pass on main branch
- [ ] Audit 5x stability pass recorded (artifacts downloadable)
- [ ] No open critical bugs
- [ ] Changelog drafted
- [ ] Version number decided (MAJOR.MINOR.PATCH)
- [ ] Deployment timeline coordinated
- [ ] Rollback plan documented

## Release Procedure

### Step 1: Update Version in package.json

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
git checkout main
git pull origin main

# Option 1: Use npm version (recommended)
npm version patch  # or minor, or major
# This updates package.json AND creates git commit + tag

# Option 2: Manual edit
# Edit package.json, change "version": "1.0.1"
# Edit manifest.yml, change version if needed
git add package.json manifest.yml
git commit -m "chore: bump version to 1.0.1"
```

**Verification:**
```bash
jq '.version' package.json
```

Expected: New version number.

### Step 2: Update CHANGELOG.md

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
# Edit CHANGELOG.md manually or use script
cat >> CHANGELOG.md << EOF

## [1.0.1] - 2026-03-01

### Fixed
- Bug fix description
- Security patch description

### Changed
- Dependency updates

EOF

git add CHANGELOG.md
git commit -m "docs: update changelog for v1.0.1"
```

**Format:** Follow [Keep a Changelog](https://keepachangelog.com/).

### Step 3: Create Git Tag

```bash
# Working directory: /path/to/Firsttry
git tag -a v1.0.1 -m "Release v1.0.1"
```

**Verification:**
```bash
git tag -l "v *"
git show v1.0.1
```

Expected: Tag created with commit reference.

### Step 4: Push to Repository

```bash
# Working directory: /path/to/Firsttry
git push origin main
git push origin v1.0.1
```

**Verification:** Tag visible on GitHub Releases page.

### Step 5: Run Final Audit (Production Proof)

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
bash tools/audit/v3_1/run_stability_5x.sh
audit_exit=$?

if [ $audit_exit -ne 0 ]; then
  echo "ERROR: Audit failed, release blocked"
  exit 1
fi

echo "Audit pass confirmed, proceeding with release"
```

**Verification:** Exit code 0, all 5 runs pass.

### Step 6: Deploy to Forge

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
forge deploy
```

**Expected output:**
```
Deployed app to Forge platform
Deployment ID: abcdef1234567890
Version: 1.0.1
```

**Verification:**
```bash
forge deploy history | head -5
```

Expected: Latest deployment shows new version.

### Step 7: Upgrade Production Installation

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
forge install --upgrade --site firsttry.atlassian.net
```

**Expected output:**
```
Upgrading app on firsttry.atlassian.net...
Upgrade successful
```

**Verification:** Log in to Jira site, verify app UI loads.

### Step 8: Create GitHub Release

1. Navigate to https://github.com/Firsttry-Solutions/Firsttry/releases
2. Click "Draft a new release"
3. Select tag: `v1.0.1`
4. Release title: `v1.0.1 — <Brief description>`
5. Copy changelog entry into description
6. Attach audit evidence artifact (optional)
7. Click "Publish release"

**Verification:** Release visible on Releases page.

### Step 9: Notify Stakeholders

Send release notification via configured channels:
- Internal team Slack/email
- Customer pilot sites (if applicable)
- Trust center update (if transparency-relevant)

**Template:**
```
Subject: FirstTry v1.0.1 Released

FirstTry v1.0.1 has been deployed to production (firsttry.atlassian.net)

Changes:
- [Summarize changelog]

Audit evidence: [Link to CI artifacts]
Git tag: v1.0.1
Deployment ID: abcdef1234567890

For questions: operations@firsttry.run
```

## Post-Release Checklist

- [ ] Deployment succeeded (forge install --upgrade)
- [ ] Production app UI accessible
- [ ] No errors in forge logs (check for 1 hour)
- [ ] GitHub release published
- [ ] Stakeholders notified
- [ ] Rollback plan ready (if issues arise)

## Rollback Procedure

If release causes production issues:

### Step 1: Identify Previous Deployment ID

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
forge deploy history

# Note the deployment ID preceding the failed release
# Example: Previous ID = xyz789
```

### Step 2: Rollback Forge Deployment

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
forge deploy rollback --deployment-id xyz789
```

**Expected output:**
```
Rolling back to deployment xyz789...
Rollback successful
```

### Step 3: Verify Rollback

```bash
forge deploy history | head -1
```

Expected: Previous deployment ID is active.

### Step 4: Upgrade Production (Apply Rollback)

```bash
forge install --upgrade --site firsttry.atlassian.net
```

**Verification:** Log in to Jira, verify old version restored.

### Step 5: Document Rollback

Create incident report:
- Rollback reason
- Affected systems
- Root cause analysis
- Prevention measures

File location: `atlassian/forge-app/docs/incidents/YYYY-MM-DD-release-rollback.md`

## Emergency Hotfix Procedure

For critical bugs requiring immediate patch:

```bash
# Working directory: /path/to/Firsttry
git checkout main
git pull origin main

# Create hotfix branch
git checkout -b hotfix/critical-bug-fix

# Make minimal fix
# ... edit files ...

# Commit
git add .
git commit -m "fix: critical bug description"
git push origin hotfix/critical-bug-fix

# Open PR, request expedited review
# After merge:
git checkout main
git pull origin main

# Version bump (patch)
cd atlassian/forge-app
npm version patch
git push origin main --follow-tags

# Deploy immediately
forge deploy
forge install --upgrade --site firsttry.atlassian.net

# Run audit post-deployment (not blocked pre-deployment for hotfixes)
bash tools/audit/v3_1/run_stability_5x.sh
```

**Note:** Hotfixes skip pre-deploy audit but MUST pass audit post-deployment. If audit fails, initiate rollback immediately.

## Release Cadence

**Recommended:**
- **Patch releases:** As needed (bug fixes, security)
- **Minor releases:** Monthly or quarterly
- **Major releases:** Annually or as needed for breaking changes

## Troubleshooting

### Issue: "npm version" fails with "Git working directory not clean"

**Cause:** Uncommitted changes.

**Fix:**
```bash
git status
git stash
npm version patch
git stash pop
```

### Issue: "forge deploy" fails after version bump

**Cause:** Build error after code changes.

**Fix:**
```bash
npm run build  # See errors
# Fix issues, retry
forge deploy
```

### Issue: Tag already exists

**Cause:** Tag previously created.

**Fix:**
```bash
# Delete local tag
git tag -d v1.0.1

# Delete remote tag (DANGEROUS, coordinate with team)
git push origin :refs/tags/v1.0.1

# Recreate
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin v1.0.1
```

## Next Steps

- **For incidents during release:** [09_incident_response.md](09_incident_response.md)
- **For operational limits:** [10_known_limits.md](10_known_limits.md)

## Notes

- **Always tag releases.** Tags enable rollback and version tracking.
- **Audit before production deploy.** No exceptions except emergency hotfixes.
- **Document decisions.** Changelog is customer-facing, commit messages are internal.
- **Test rollback procedure** in non-production environment first.
