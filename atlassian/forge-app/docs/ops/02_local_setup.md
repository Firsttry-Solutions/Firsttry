# Local Setup — Clone, Install, Verify

**Doc ID:** FT-OPS-002  
**Version:** 1.0.0  
**Owner:** operations@firsttry.run  
**Last Updated:** 2026-03-01  
**Review Cycle:** Quarterly  

## Audience

Operators setting up FirstTry development/audit environment for the first time.

## Prerequisites

- Completed [01_prereqs.md](01_prereqs.md) checklist
- Git, Node.js, npm installed and verified

## What Success Looks Like

After completing this runbook:
- Repository cloned to local machine
- Dependencies installed deterministically via `npm ci`
- Clean install proof passes
- Worktree is clean (no uncommitted changes)

## Procedure

### Step 1: Clone Repository

```bash
# Working directory: /path/to/your/projects (choose any location)
git clone https://github.com/Firsttry-Solutions/Firsttry.git
cd Firsttry
```

**Verification:**
```bash
# Working directory: /path/to/Firsttry
git status
```

**Expected output:** `On branch main` and `nothing to commit, working tree clean`.

### Step 2: Navigate to Forge App Directory

```bash
# Working directory: /path/to/Firsttry
cd atlassian/forge-app
```

**Verification:**
```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
ls -la package.json manifest.yml src/
```

**Expected output:** All three exist (package.json, manifest.yml, src/ directory).

### Step 3: Install Dependencies (Deterministic)

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
npm ci
```

**Critical:** Use `npm ci` (clean install), NOT `npm install`. `npm ci` installs exact versions from `package-lock.json` for deterministic builds.

**Expected output:**
```
added XXX packages in Xs
```

**Verification:**
```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
ls -la node_modules/ | wc -l
```

**Expected:** Hundreds of packages installed (exact count varies, typically 400-600).

### Step 4: Run Clean Install Proof

This script validates that the install is reproducible and the worktree remains clean.

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
bash tools/prove_clean_install.sh
```

**What it does:**
1. Verifies `package-lock.json` exists
2. Removes `node_modules/` and `package-lock.json`
3. Runs `npm install` to regenerate lockfile
4. Checks if lockfile changed (must be identical)
5. Runs `npm ci` to install from lockfile
6. Verifies worktree is clean

**Expected output:**
```
=== Clean Install Proof ===
[Timestamp]
Lockfile exists: package-lock.json
Removing node_modules and lockfile...
Running npm install (regenerate lockfile)...
Checking lockfile diff...
Lockfile unchanged: PASS
Running npm ci (install from lockfile)...
Verifying worktree clean...
Worktree clean: PASS

Clean install proof: SUCCESS
```

**Verification:**
```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
echo $?
```

**Expected:** `0` (exit code 0 = success).

### Step 5: Verify Worktree Clean

```bash
# Working directory: /path/to/Firsttry
git status
```

**Expected output:** `nothing to commit, working tree clean`.

**If worktree is dirty:**
```bash
# Show what changed
git status --porcelain
git diff

# If changes are unintended, reset
git reset --hard HEAD
git clean -fd
```

## Directory Structure

After setup, your directory structure should look like this:

```
Firsttry/
├── .github/                   # CI workflows
│   └── workflows/
│       ├── ci-core.yml        # Required checks (tests, audit 5x)
│       └── docs.yml           # Docs deploy (workflow_dispatch)
├── atlassian/
│   └── forge-app/             # Main Forge application
│       ├── docs/              # Documentation
│       │   ├── ops/           # Operator runbooks (this directory)
│       │   ├── trust/         # Trust center docs
│       │   ├── operations/    # Ops policies (SLA, incident response)
│       │   └── procurement/   # Buyer docs
│       ├── src/               # TypeScript source code
│       ├── tools/             # Build, audit, verification scripts
│       │   └── audit/
│       │       └── v3_1/      # Enterprise audit v3.1
│       ├── manifest.yml       # Forge app manifest
│       ├── package.json       # Dependencies
│       └── package-lock.json  # Lockfile (DO NOT DELETE)
├── tools/                     # Repo-wide tools
└── docs/                      # Top-level docs (optional)
```

## Key Files

| File | Purpose | DO NOT |
|------|---------|--------|
| `package-lock.json` | Lockfile for deterministic installs | Delete, edit, or regenerate manually |
| `manifest.yml` | Forge app configuration | Edit without full audit cycle |
| `src/**/*.ts` | Application source code | Edit without running tests |
| `tools/audit/**` | Audit scripts | Modify during audit execution |

## Verification Checklist

Before proceeding to [03_forge_setup.md](03_forge_setup.md), verify:

- [ ] Repository cloned to local machine
- [ ] `cd atlassian/forge-app` succeeds
- [ ] `npm ci` completed without errors
- [ ] `bash tools/prove_clean_install.sh` exits 0
- [ ] `git status` shows clean worktree
- [ ] `node_modules/` directory exists and is populated
- [ ] `package-lock.json` exists and is unchanged

## Troubleshooting

### Issue: "npm ci" fails with "Cannot read property 'something' of null"

**Cause:** Corrupted npm cache.

**Fix:**
```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
npm cache clean --force
rm -rf node_modules
npm ci
```

### Issue: "prove_clean_install.sh" fails with "Lockfile changed"

**Cause:** Lockfile out of sync with package.json, or npm version mismatch.

**Fix:**
```bash
# Check npm version (must be >= 9.0)
npm --version

# If npm < 9.0, upgrade
npm install -g npm@latest

# Regenerate lockfile (only if instructed by maintainer)
# WARNING: This changes lockfile; commit separately
rm package-lock.json
npm install
git diff package-lock.json  # Review changes
git add package-lock.json
git commit -m "chore: regenerate lockfile with npm 9.x"
```

### Issue: "EACCES: permission denied" during npm ci

**Cause:** npm global directory requires sudo, or incorrect file permissions.

**Fix:**
```bash
# Option 1: Use nvm (recommended, no sudo required)
nvm install 18
nvm use 18
cd /path/to/Firsttry/atlassian/forge-app
npm ci

# Option 2: Fix ownership (Linux)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /path/to/Firsttry/atlassian/forge-app/node_modules
```

### Issue: "git status" shows modified files after npm ci

**Cause:** Platform-specific line endings (CRLF vs LF), or file permissions.

**Fix:**
```bash
# Check what changed
git diff

# If only line endings:
git config core.autocrlf false
git reset --hard HEAD

# If file permissions (Linux/macOS):
git config core.fileMode false
git reset --hard HEAD
```

### Issue: Clone fails with "Permission denied (publickey)"

**Cause:** Using SSH URL without SSH key configured.

**Fix:** Use HTTPS URL instead:
```bash
git clone https://github.com/Firsttry-Solutions/Firsttry.git
```

## Common Workflows

### Update Local Repository

```bash
# Working directory: /path/to/Firsttry
git fetch origin
git pull origin main
cd atlassian/forge-app
npm ci  # Reinstall dependencies if lockfile changed
```

### Switch Branches

```bash
# Working directory: /path/to/Firsttry
git checkout -b feature/my-feature
cd atlassian/forge-app
npm ci  # Always reinstall on branch switch
```

### Clean Slate (Reset Everything)

```bash
# Working directory: /path/to/Firsttry
git reset --hard HEAD
git clean -fd
cd atlassian/forge-app
rm -rf node_modules
npm ci
```

## Next Steps

After completing this runbook, proceed to:
- **For deployment:** [03_forge_setup.md](03_forge_setup.md)
- **For audit only:** [05_audit_runbook.md](05_audit_runbook.md) (skip Forge setup)

## Notes

- **Clean install proof is required before PR merge.** CI runs this automatically in `ci-core.yml`.
- **Do not commit node_modules/.** It is gitignored and regenerated via `npm ci`.
- **Do not delete package-lock.json.** Reproducible builds depend on exact dependency versions.
- **If you see "npm WARN deprecated," this is informational.** Warnings do not fail install.
