# RUNBOOK: PRODUCTION PROOF GATE

**Purpose:** Ensure production backend envelope contract remains valid after any deployment.

**Automated:** CI workflow runs daily + after deployments.  
**Manual:** Use any time to verify production state.

---

## Quick Start (Manual Verification)

```bash
# 1. Set your token (from Forge production secrets)
export FT_CONTRACT_PROOF_TOKEN="your-token-here"

# 2. Save webtrigger URL
echo "https://..." > /tmp/ft_contract_proof_url.txt

# 3. Run verification
bash tools/fetch_and_verify_contract_proof_prod.sh
```

---

## Detailed Procedures

### Procedure 1: Get Production Webtrigger URL

**When:** After first deployment with webtrigger, or if URL changes.

**Steps:**
```bash
cd atlassian/forge-app

# List available webtriggers
forge webtrigger list --environment production \
  --site firsttry.atlassian.net \
  --product Jira

# Copy the URL for ft-contract-proof-trigger module key
# Example: https://59d86182.../x1/C05blHqcUuOrdfPj28-FFEO_EU0
```

**Save it:**
```bash
echo "https://..." > /tmp/ft_contract_proof_url.txt
```

---

### Procedure 2: Rotate Production Token

**Why:** Rotate periodically for security (quarterly recommended).

**Steps:**

1. **Generate new token locally:**
   ```bash
   NEW_TOKEN=$(openssl rand -hex 32)
   echo "New token: $NEW_TOKEN"
   ```

2. **Save for reference (NOT in repo):**
   ```bash
   echo "$NEW_TOKEN" > ~/.ft_proof_token_backup.txt  # NEVER commit this
   ```

3. **Set in Forge production:**
   ```bash
   cd atlassian/forge-app
   forge variables set --environment production \
     FT_CONTRACT_PROOF_TOKEN "$NEW_TOKEN"
   ```

4. **Redeploy to activate:**
   ```bash
   forge deploy --environment production
   ```

5. **Update GitHub Secrets** (for CI):
   - Go to: https://github.com/Firsttry-Solutions/Firsttry/settings/secrets/actions
   - Edit secret: `FT_CONTRACT_PROOF_TOKEN`
   - Paste new token
   - Save

6. **Verify it works:**
   ```bash
   export FT_CONTRACT_PROOF_TOKEN="$NEW_TOKEN"
   bash tools/fetch_and_verify_contract_proof_prod.sh
   ```

---

### Procedure 3: Manual Verification After Deploy

**When:** After deploying new version to production.

**Steps:**

```bash
# 1. Ensure URL is saved
cat /tmp/ft_contract_proof_url.txt

# 2. Set token (from your secure location)
export FT_CONTRACT_PROOF_TOKEN="your-production-token"

# 3. Run verification (give it 30 sec for deploy to settle)
sleep 30
bash tools/fetch_and_verify_contract_proof_prod.sh

# Expected output:
# ✅ SUCCESS: Production proof verified
```

---

### Procedure 4: Troubleshoot Verification Failure

**Symptom:** `❌ FAILED: Verification failed`

**Diagnostic Steps:**

1. **Check artifact was fetched:**
   ```bash
   ls -la /tmp/ft_contract_proof_prod.json
   jq . /tmp/ft_contract_proof_prod.json | head -20
   ```

2. **Run verification verbosely:**
   ```bash
   bash -x tools/verify_contract_proof_json.sh /tmp/ft_contract_proof_prod.json
   ```

3. **Check common issues:**
   - ❌ `schemaVersion` is numeric instead of string `"v1"`
     - Root cause: Wrong resolver called (not ft_getDashboardState_v1)
     - Fix: Check gadget-handlers allows list routes to correct resolver
   
   - ❌ Missing `envelopeKind` or `marker`
     - Root cause: Resolver not using `dashOk()` wrapper
     - Fix: Ensure resolver calls dashOk({data, meta})
   
   - ❌ Timestamp missing or invalid
     - Root cause: Meta not constructed properly
     - Fix: Check nowUtcIso() is called and meta.ts_utc is set

4. **Check production logs:**
   ```bash
   cd atlassian/forge-app
   forge logs --environment production --since 5m
   
   # Look for:
   # - [FT_CONTRACT_PROOF] marker (function executed)
   # - [FT_CONTRACT_PROOF_WEBTRIGGER] marker (webtrigger called)
   # - Any ERROR lines that explain failure
   ```

5. **Re-verify after fix:**
   ```bash
   # After fixing root cause and redeploying:
   forge deploy --environment production
   sleep 60
   bash tools/fetch_and_verify_contract_proof_prod.sh
   ```

---

## CI Workflow: prod-proof-gate.yml

**Location:** `.github/workflows/prod-proof-gate.yml`

**Triggers:**
- Manual: `workflow_dispatch` (GitHub Actions > Run workflow)
- Scheduled: Daily at 2 AM UTC
- After deploy: Runs after "Build and Deploy" workflow completes

**Required Secrets:**
- `FT_PROOF_WEBTRIGGER_URL` - Production webtrigger URL
- `FT_CONTRACT_PROOF_TOKEN` - Production verification token

**How to add/update secrets:**
1. Go to: Repo Settings > Secrets and variables > Actions
2. Add or update:
   - `FT_PROOF_WEBTRIGGER_URL`
   - `FT_CONTRACT_PROOF_TOKEN`
3. Done (no redeploy needed for CI)

**Job: verify-production-proof**
- Fetches artifact from production with token
- Runs verify_contract_proof_json.sh
- Reports status to GitHub Step Summary
- Fails if verification fails (blocks deployment in dependent workflows)

---

## What the Proof Gate Verifies

**Non-Negotiable Assertions (all must pass):**

| # | Assertion | Meaning |
|---|-----------|---------|
| 1 | `envelopeKind === "FT_DASH_ENVELOPE_V1"` | Marker present (v3.10.0+ requirement) |
| 2 | `envelopeVersion === 1` | Envelope format version |
| 3 | `schemaVersion === "v1"` (string) | Schema is v1, not numeric (UI contract) |
| 4 | `ok` is boolean | Type safety |
| 5 | `ok=true → data exists` | Consistency (success must have data) |
| 6 | `meta` exists | Metadata structure required |
| 7 | `meta.ts_utc` exists | Timestamp proof (audit trail) |

**If any assertion fails:**
- Exit code: 1
- CI job fails
- Error details printed
- No automatic rollback (manual review required)

---

## References

**Related Files:**
- [tools/verify_contract_proof_json.sh](../tools/verify_contract_proof_json.sh) - Verification script
- [tools/fetch_and_verify_contract_proof_prod.sh](../tools/fetch_and_verify_contract_proof_prod.sh) - Fetch harness
- [PRODUCTION_CONTRACT_PROOF.md](../PRODUCTION_CONTRACT_PROOF.md) - Proof documentation
- [src/webtriggers/contract-proof.ts](../atlassian/forge-app/src/webtriggers/contract-proof.ts) - Webtrigger handler

**Architecture:**
- **Webtrigger:** Read-only, token-gated HTTP endpoint
- **Handler:** Calls ft_contractProof_dashEnvelope_v1() resolver
- **Resolver:** Uses dashOk() wrapper (guarantees marker + schema)
- **Verification:** Deterministic jq assertions (7 checks)

---

## Contact & Escalation

**Issue:** Proof verification fails consistently

**Steps:**
1. Run diagnostic procedure above
2. Check recent commits to resolver or dashboard handlers
3. If recent change introduced bug: revert and redeploy
4. If infrastructure issue: contact DevOps
5. If token-related: follow token rotation procedure

**Do NOT:**
- Disable the proof gate
- Bypass verification in CI
- Deploy without passing proof verification
