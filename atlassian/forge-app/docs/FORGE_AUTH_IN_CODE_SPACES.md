# Forge CLI Authentication in Codespaces

## Problem: Keychain Isn't Available

Atlassian's Forge CLI stores authentication credentials in the system keychain (e.g., macOS Keychain, Linux Secret Service). However, GitHub Codespaces running in a remote container does **not** have access to your local keychain.

**Result:** Even if you run `forge login` interactively in Codespaces, the credentials won't persist or work for future runs.

## Solution: Environment Variable Authentication

Forge CLI respects `FORGE_EMAIL` and `FORGE_API_TOKEN` environment variables, allowing passwordless, keychain-free authentication in headless and containerized environments.

### Step 1: Create an Atlassian API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Save the token securely (you will only see it once)
4. **CRITICAL:** Do NOT paste this token into terminal or CI logs

### Step 2: Authenticate in Codespaces

Set the environment variables in your Codespaces terminal:

```bash
export FORGE_EMAIL="your-atlassian-email@example.com"
export FORGE_API_TOKEN="your-api-token"
```

**CRITICAL SECURITY WARNINGS:**
- Never echo the token: `echo $FORGE_API_TOKEN` will expose it in logs
- Never commit these env vars to `.bashrc`, `.zshrc`, or Git
- Never paste the token into a Gist, PR comment, or Slack
- Only set in the **current terminal session** for deploy/test runs

### Step 3: Verify Authentication

```bash
forge whoami
```

Expected output:
```
email@example.com
```

If you see `Error: Not logged in`, check that BOTH env vars are set:

```bash
# Check (value will be masked):
echo "FORGE_EMAIL=${FORGE_EMAIL:-(unset)}"
echo "FORGE_API_TOKEN=${FORGE_API_TOKEN:-(unset)}"
```

## Usage in Scripts

The production ship gates (`ship_prod_release.sh`, `ship_phase2_gate.sh`, `ship_phase3_gate.sh`) enforce a **fail-closed** Forge CLI auth guard:

- **Before** any deployment, merge, or install command
- The guard verifies:
  1. `forge` binary is in PATH
  2. `forge whoami` succeeds (auth is valid)
- **If verification fails,** the script exits with remediation instructions

This means you must authenticate **before** running any ship script:

```bash
# 1. Set env vars (once per session)
export FORGE_EMAIL="your-atlassian-email@example.com"
export FORGE_API_TOKEN="your-api-token"

# 2. Verify
forge whoami

# 3. Run ship script (will fail-closed if auth invalid)
bash scripts/proof/ship_prod_release.sh
```

## Codespaces Setup (Persistent Per Session)

To avoid re-typing env vars every time you open a Codespaces terminal, add them to your session's environment **once**:

**Option A: Codespaces Secrets (Recommended)**
1. Go to https://github.com/settings/codespaces
2. Click **Codespaces secrets**
3. Add `FORGE_EMAIL` and `FORGE_API_TOKEN` as secrets
4. They will auto-inject into all new Codespaces terminals

**Option B: Manual Session Setup**
If not using Codespaces secrets, set env vars in a terminal startup script (but **never** commit it):

```bash
# In a terminal, create a local-only setup file:
cat >~/.codespaces_forge_env.sh <<'EOF'
# Local-only Forge auth (never commit)
export FORGE_EMAIL="your-atlassian-email@example.com"
export FORGE_API_TOKEN="your-api-token"
EOF

# Then source it in your terminal session:
source ~/.codespaces_forge_env.sh

# Verify:
forge whoami
```

## Troubleshooting

### Error: `forge: command not found`

```bash
npm i -g @forge/cli
npm config get prefix  # Print global bin path
export PATH="$(npm config get prefix)/bin:$PATH"
which forge
```

### Error: `Not logged in`

Ensure both env vars are set:

```bash
export FORGE_EMAIL="your-email@example.com"
export FORGE_API_TOKEN="your-token"
forge whoami  # Should print your email
```

### Error: `UserNotFoundError` or `InvalidTokenError`

- Verify the email matches your Atlassian account
- Verify the API token is correct (no typos, no copy-paste corruption)
- Create a new API token at https://id.atlassian.com/manage-profile/security/api-tokens

## Ship Script Auth Guard Output

When you run a ship script, the Forge auth guard outputs evidence logs showing authentication status:

- `01_forge_version.log` — Forge CLI version
- `02_forge_whoami.log` — Result of `forge whoami`

Example success output:
```
[FT_PROOF] ═══════════════════════════════════════════════
[FT_PROOF] STEP: Forge CLI Auth Precheck
[FT_PROOF] ═══════════════════════════════════════════════
[FT_PROOF] FORGE_VERSION=12.14.0
[FT_PROOF] Forge binary present
[FT_PROOF] Forge authentication OK
[FT_PROOF] AUTH_GUARD_PASS
```

Example failure output:
```
[FT_PROOF] ERROR: Forge CLI not authenticated
[FT_PROOF] REMEDIATION OPTIONS:
[FT_PROOF] Option A: Interactive login (if keychain available):
[FT_PROOF]   forge login
[FT_PROOF] Option B: Environment variable auth (Codespaces-safe):
[FT_PROOF]   export FORGE_EMAIL="your-atlassian-email@example.com"
[FT_PROOF]   export FORGE_API_TOKEN="your-api-token"
```

## References

- **Atlassian Forge Getting Started:** https://go.atlassian.com/dac/platform/forge/getting-started/#log-in-with-an-atlassian-api-token
- **GitHub Codespaces Secrets:** https://docs.github.com/en/codespaces/managing-your-codespaces/managing-secrets-for-your-codespaces
- **Atlassian API Tokens:** https://id.atlassian.com/manage-profile/security/api-tokens
