# Prerequisites — Tools, Accounts, Access

**Doc ID:** FT-OPS-001  
**Version:** 1.0.0  
**Owner:** operations@firsttry.run  
**Last Updated:** 2026-03-01  
**Review Cycle:** Quarterly  

## Audience

Operators preparing to install, deploy, or audit FirstTry.

## What You Need Before You Start

Nothing. This is the first document to read.

## What Success Looks Like

After reading this document and completing the checklist, you will have:
- All required tools installed and verified
- Account access to required services
- Correct permission levels documented

## Required Tools

### 1. Git (>= 2.0)

**Purpose:** Clone repository, track changes, push commits.

**Install:**
```bash
# Debian/Ubuntu
sudo apt-get update && sudo apt-get install -y git

# macOS
brew install git

# Verify
git --version
```

**Expected output:** `git version 2.x.x` or higher.

### 2. Node.js (>= 18.0, recommended: 18.x LTS)

**Purpose:** Run npm, execute build scripts, run tests.

**Install:**
```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Verify
node --version
npm --version
```

**Expected output:**
```
v18.x.x
9.x.x or higher
```

### 3. Forge CLI (>= 13.0)

**Purpose:** Deploy to Atlassian Forge, manage app lifecycle.

**Install:**
```bash
# Working directory: any
npm install -g @forge/cli

# Verify
forge --version
```

**Expected output:** `13.x.x` or higher.

**Critical:** Do not use Forge CLI < 13.0. Older versions have known compatibility issues with manifest v2 format.

### 4. jq (>= 1.6)

**Purpose:** Parse JSON results from audit, CI artifacts.

**Install:**
```bash
# Debian/Ubuntu
sudo apt-get install -y jq

# macOS
brew install jq

# Verify
jq --version
```

**Expected output:** `jq-1.6` or higher.

### 5. ripgrep (rg) (>= 13.0)

**Purpose:** Fast regex search in audit scripts.

**Install:**
```bash
# Debian/Ubuntu
sudo apt-get install -y ripgrep

# macOS
brew install ripgrep

# Verify
rg --version
```

**Expected output:** `ripgrep 13.x.x` or higher.

### 6. Python 3 (>= 3.11, for audit scripts)

**Purpose:** Run bandit security scanner, optional audit tools.

**Install:**
```bash
# Debian/Ubuntu
sudo apt-get install -y python3 python3-pip

# macOS
brew install python@3.11

# Verify
python3 --version
pip3 --version
```

**Expected output:** `Python 3.11.x` or higher.

### 7. semgrep (>= 1.0, optional but recommended)

**Purpose:** SAST analysis in audit Phase 04.

**Install:**
```bash
# Using pip
pip3 install semgrep

# Verify
semgrep --version
```

**Expected output:** `1.x.x` or higher.

**Note:** If semgrep is unavailable, audit will skip SAST phase and flag as MEDIUM severity.

## Required Accounts

### 1. GitHub Account

**Purpose:** Clone repository, review code, submit issues.

**Access Level:** Read-only (public repo).

**Setup:**
```bash
# Working directory: any
git clone https://github.com/Firsttry-Solutions/Firsttry.git
```

**Verification:** Clone completes without authentication prompt.

### 2. Atlassian Account

**Purpose:** Log in to Jira sites, install Forge apps, manage permissions.

**Access Level:**
- **Development/Test:** Jira Admin on test site
- **Production:** Jira Admin on `firsttry.atlassian.net`

**Setup:**
1. Create Atlassian account at https://id.atlassian.com
2. Request Jira Admin access from site owner
3. Verify access: Log in to site, navigate to **Settings > Apps**

**Verification:** You can see "Manage apps" and "Upload app" options.

### 3. Forge Developer Account

**Purpose:** Deploy apps to Forge platform, manage app installations.

**Access Level:** Developer (linked to Atlassian account).

**Setup:**
1. Log in to https://developer.atlassian.com
2. Accept Forge developer terms
3. Link to Atlassian account if prompted

**Verification:**
```bash
# Working directory: any
forge login

# Follow browser authentication flow
# Expected: "Logged in successfully"
```

## Optional Tools (For Reviewers)

### 1. trufflehog (>= 3.0)

**Purpose:** Secret detection in audit Phase 02.

**Install:**
```bash
# macOS
brew install trufflesecurity/trufflehog/trufflehog

# Linux (download binary)
curl -L https://github.com/trufflesecurity/trufflehog/releases/latest/download/trufflehog_linux_amd64.tar.gz -o /tmp/trufflehog.tar.gz
tar -xzf /tmp/trufflehog.tar.gz -C /usr/local/bin

# Verify
trufflehog --version
```

**Note:** If unavailable, audit uses regex/entropy fallback (flagged as HIGH, allowlisted=true).

### 2. curl (>= 7.0)

**Purpose:** Test external link validation (Phase 11).

**Verification:**
```bash
curl --version
```

Expected: Pre-installed on most systems.

## Access Levels Matrix

| Resource | Role | Required For | Verification Command |
|----------|------|--------------|---------------------|
| GitHub repo | Read | Clone, review code | `git clone https://github.com/Firsttry-Solutions/Firsttry.git` |
| Jira test site | Admin | Deploy, test | Log in to site > Settings > Apps |
| Jira production | Admin | Production deploy | Log in to firsttry.atlassian.net > Settings > Apps |
| Forge platform | Developer | Deploy apps | `forge whoami` |
| CI artifacts | Read | Download evidence | GitHub Actions > Run > Artifacts |

## Environment Variables (Optional)

### For Audit Determinism

Set these before running audit if you need custom behavior:

```bash
# Skip external link validation (recommended in offline environments)
export FT_SKIP_EXTERNAL_LINKS=1

# Skip npm test in audit (tests run separately in CI)
export FT_SKIP_TESTS_IN_AUDIT=1

# Disable semgrep version check (for determinism)
export SEMGREP_ENABLE_VERSION_CHECK=0

# Set locale for deterministic output
export LC_ALL=C
export LANG=C
export TZ=UTC
```

**Note:** These are pre-configured in audit scripts. Manual export only needed for debugging.

## Checklist

Before proceeding to [02_local_setup.md](02_local_setup.md), verify:

- [ ] Git installed and `git --version` shows >= 2.0
- [ ] Node.js installed and `node --version` shows >= 18.0
- [ ] npm installed and `npm --version` shows >= 9.0
- [ ] Forge CLI installed and `forge --version` shows >= 13.0
- [ ] jq installed and `jq --version` shows >= 1.6
- [ ] ripgrep installed and `rg --version` shows >= 13.0
- [ ] Python 3 installed and `python3 --version` shows >= 3.11
- [ ] GitHub account created (or have read access to public repo)
- [ ] Atlassian account created
- [ ] Forge developer account created and `forge login` successful
- [ ] Jira Admin access on test site or production site (if deploying)

## Troubleshooting

### Issue: "forge: command not found"

**Cause:** Forge CLI not installed or not in PATH.

**Fix:**
```bash
# Working directory: any
npm install -g @forge/cli
echo $PATH  # Verify npm global bin is in PATH
```

### Issue: "jq: command not found"

**Cause:** jq not installed.

**Fix:** Follow jq install instructions above for your OS.

### Issue: "Permission denied" when installing global npm packages

**Cause:** npm global directory requires sudo, or incorrect permissions.

**Fix:**
```bash
# Option 1: Use nvm (recommended)
nvm install 18
nvm use 18

# Option 2: Fix npm permissions (Linux)
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Issue: "forge login" opens browser but fails

**Cause:** Firewall blocking localhost callback, or browser session expired.

**Fix:**
1. Disable VPN/firewall temporarily
2. Clear browser cookies for `atlassian.com`
3. Retry `forge login`
4. If still failing, use `forge login --interactive` for manual token entry

## Next Steps

After completing this checklist, proceed to [02_local_setup.md](02_local_setup.md).
