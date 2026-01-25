# QUICK REFERENCE: Runtime Version Proof

## One-Line Summary
Token-gated webtrigger returns runtime proof (release version, build SHA, @forge/api shape) → deploy script validates it → fails if mismatch.

## Key Files
- **Webtrigger**: `src/webtriggers/runtime_proof.ts`
- **Deploy Script**: `tools/deploy_and_prove_runtime_version.sh`
- **Version Constant**: `src/release/release_version.ts` → `"2026.01.24.01"`

## How It Works

```
User runs deploy script
  ↓
Script checks: git clean, main branch, synced
  ↓
Script runs: build (7/7 gates) + version bump gate
  ↓
Script deploys: forge deploy + forge install --upgrade
  ↓
Script gets webtrigger URL: forge webtriggers:list
  ↓
Script calls: curl -H "x-ft-token: ${FT_RUNTIME_PROOF_TOKEN}" <url>
  ↓
Script receives: { ok: true, marker: "FT_RUNTIME_PROOF", release: "2026.01.24.01", ... }
  ↓
Script validates: ok=true, marker matches, release matches, hasAsApp=true
  ↓
Result: EXIT 0 (SUCCESS) or EXIT 1 (FAILURE)
```

## To Use

### 1. Set Token
```bash
export FT_RUNTIME_PROOF_TOKEN="your-secret-token-here"
```

### 2. Run Deploy + Prove
```bash
cd atlassian/forge-app
./tools/deploy_and_prove_runtime_version.sh
```

### 3. Check Result
```bash
cat /tmp/ft_runtime_version_proof_*/EVIDENCE_SUMMARY.txt
```

## Fail-Closed Scenarios
| Scenario | Behavior |
|----------|----------|
| Token missing | Exit 1 + error message |
| Git dirty | Exit 1 + error message |
| Build fails | Exit 1 + error message |
| Proof ok=false | Exit 1 + error message |
| Release mismatch | Exit 1 + error message |
| hasAsApp=false | Exit 1 + error message |

## What It Proves
- ✅ Correct release version deployed
- ✅ Build SHA matches expectations
- ✅ @forge/api imported correctly (hasAsApp present)
- ✅ No deployment failures
- ✅ No version skipping

## Proof JSON Example
```json
{
  "ok": true,
  "marker": "FT_RUNTIME_PROOF",
  "release": "2026.01.24.01",
  "buildSha": "970ddb07258b",
  "env": "production",
  "tsUtc": "2026-01-24T17:30:15Z",
  "forgeApi": {
    "type": "object",
    "hasAsApp": true,
    "keys": ["asApp", "asUser", "requestStorage", ...]
  }
}
```

## Webtrigger URL Format
```
https://<forge-url>/webtrigger/ft-runtime-proof

Authorization: x-ft-token header OR ?token=<value> query param
```

## Troubleshooting

**"Not logged in"**
- Run `forge login` first
- Or set FORGE auth env vars

**"forge webtriggers:list not found"**
- Update Forge CLI: `npm install -g @forge/cli@latest`

**"Cannot reach webtrigger URL"**
- Wait 60 seconds for deployment to propagate
- Check manifest.yml has webtrigger entry
- Check internet connectivity

**"ok=false, error=unauthorized"**
- Token mismatch: check FT_RUNTIME_PROOF_TOKEN matches server config
- Header/query param syntax: must use exactly `x-ft-token` (case-sensitive)

**"proof release mismatch"**
- Expected version not deployed yet: check forge deploy output
- Or version was already bumped: update FT_RELEASE_VERSION in source

## Commits
- `766a2583`: Runtime proof webtrigger + script
- `970ddb07`: Build artifacts update

Both on `origin/main` (synced).
