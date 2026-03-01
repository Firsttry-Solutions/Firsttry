# Operator Runbooks — FirstTry Audit Evidence for Jira

**Doc ID:** FT-OPS-000  
**Version:** 1.0.0  
**Owner:** operations@firsttry.run  
**Last Updated:** 2026-03-01  
**Review Cycle:** Quarterly  

## Audience

This documentation is for:
- **Operators** installing, deploying, and maintaining FirstTry in Atlassian/Forge environments
- **Reviewers** auditing CI/CD processes and security controls
- **Buyers** evaluating operational maturity and support boundaries

## What You Need Before You Start

- Read-only access to this repository
- Basic working knowledge of: Git, Node.js (npm), Forge CLI, Jira Admin
- No prior FirstTry-specific knowledge required

## What Success Looks Like

After following these runbooks, you will be able to:
- Install and run FirstTry deterministically from clean clone
- Execute the enterprise audit and interpret results
- Understand CI artifacts and evidence directories
- Troubleshoot common issues without escalation
- Perform releases and rollbacks per change control

## Start Here — 10-Step Operator Path

Follow these steps in order for first-time setup:

1. **Read prerequisites** — [01_prereqs.md](01_prereqs.md) — Accounts, tools, access levels
2. **Clone and install** — [02_local_setup.md](02_local_setup.md) — Repo, dependencies, proof
3. **Forge authentication** — [03_forge_setup.md](03_forge_setup.md) — Login, env, scopes
4. **Deploy and verify** — [04_deploy_run.md](04_deploy_run.md) — Install app

, smoke test
5. **Run audit 5x** — [05_audit_runbook.md](05_audit_runbook.md) — Deterministic audit proof
6. **Understand CI** — [06_ci_and_artifacts.md](06_ci_and_artifacts.md) — Required checks, evidence
7. **Bookmark troubleshooting** — [07_troubleshooting.md](07_troubleshooting.md) — Symptoms to fixes
8. **Review release procedure** — [08_release_procedure.md](08_release_procedure.md) — Versioning, tags
9. **Read incident response** — [09_incident_response.md](09_incident_response.md) — Operator steps
10. **Know the limits** — [10_known_limits.md](10_known_limits.md) — What FirstTry does NOT do

## Zero-Guess Quickstart

From fresh clone to audit proof in under 15 minutes:

```bash
# Working directory: /path/to/clone/location
git clone https://github.com/Firsttry-Solutions/Firsttry.git
cd Firsttry/atlassian/forge-app

# Install dependencies (deterministic via package-lock.json)
npm ci

# Run clean install proof (validates reproducible build)
bash tools/prove_clean_install.sh

# ★ RECOMMENDED: Run deterministic audit (single canonical command)
bash tools/audit/v3_1/run_deterministic.sh

# Check exit code (0 = pass, 1 = fail)
echo $?

# View latest audit evidence (stable symlink)
ls -ld /tmp/ft_audit_deterministic_latest
readlink /tmp/ft_audit_deterministic_latest  # Actual directory path

# ALTERNATIVE: Run 5x stability harness (for CI/release gates)
bash tools/audit/v3_1/run_stability_5x.sh
```

**Expected output (deterministic runner):**
- Preflight checks all pass
- Audit completes with `Decision: CONDITIONAL_ACCEPT`
- Exit code: `0`
- Evidence directory: `/tmp/ft_audit_deterministic_TIMESTAMP_RANDOM`
- Stable symlink: `/tmp/ft_audit_deterministic_latest`

**Expected output (5x stability harness):**
- `prove_clean_install.sh` completes with no errors
- `run_stability_5x.sh` exits 0 (all 5 runs PASS)
- Evidence directory created in `/tmp/ft_audit_stability_5x_*` with `SUCCESS.txt`

## Most Common Mistakes (12 Items)

1. **Running audit without clean git tree** — Fix: `git status --porcelain` must be empty before audit
2. **Using `npm install` instead of `npm ci`** — Fix: Use `npm ci` for deterministic installs
3. **Wrapping audit with external timeout** — Fix: Do NOT use `timeout`. Run directly: `bash tools/audit/v3_1/run_deterministic.sh`
4. **Modifying evidence directories** — Fix: NEVER edit contents of `/tmp/ft_*` directories
5. **Running audit from wrong directory** — Fix: Must run from `atlassian/forge-app`, not repo root
6. **Deleting package-lock.json** — Fix: Lockfile is required; restore from git if deleted
7. **Running in non-production Atlassian site** — Fix: Production proofs require `firsttry.atlassian.net`
8. **Ignoring audit exit code** — Fix: Exit 0 = pass, exit 1 = reject; do not override
9. **Skipping CI required checks** — Fix: All checks in ci-core.yml must pass before merge
10. **Force-pushing without proof** — Fix: Never `git push --force` on main without audit proof
11. **Installing in personal Jira Cloud** — Fix: Use dedicated test site or production site only
12. **Assuming "CONDITIONAL_ACCEPT" means failure** — Fix: Exit 0 with CONDITIONAL_ACCEPT is success

## Do Not Do This (10 Forbidden Actions)

1. **Do not wrap audit with external timeout** — Deterministic runner has internal time budget
2. **Do not run audit from wrong directory** — Must be in `atlassian/forge-app`, not repo root
3. **Do not run audit with dirty git tree** — Preflight check will fail; commit or stash first
4. **Do not modify evidence dirs** — Evidence must remain immutable for audit trail
5. **Do not skip npm ci** — Dependencies must be installed via lockfile for determinism
6. **Do not disable CI checks** — Required checks enforce security and reproducibility
7. **Do not run in Forge tunnel mode during audit** — Audit must run in offline mode
8. **Do not use `npm update`** — Lockfile must not drift; use Dependabot/renovate for updates
9. **Do not deploy to production without audit pass** — Exit 0 required before production deployment
10. **Do not run audits in parallel** — Non-deterministic; run sequentially

## When to Escalate

Escalate to maintainers (security.contact@firsttry.run) if:

- **Audit exits 1 with 0 blocking HIGHs** — Scoring logic issue
- **CI passes but local audit fails** — Environment drift detected
- **Evidence directories missing required files** — Trap handler failure (results.json, FINAL_REPORT.md, 99_FINAL_DECISION.txt)
- **Forge deployment fails with permissions error** — Scopes/manifest mismatch
- **Stability harness fails after 1st run** — Non-deterministic build detected
- **Production incident with data integrity concern** — Immediate escalation required
- **Security vulnerability reported by customer** — Follow vulnerability disclosure policy

Do NOT escalate for:
- Documentation typos or clarity improvements (file GitHub issue)
- Feature requests or enhancements (file GitHub issue with "enhancement" label)
- General Forge platform questions (use Atlassian community forums)
- Jira admin questions unrelated to FirstTry (use Atlassian support)

## Glossary

### Terms

**Evidence Directory**  
Immutable timestamped directory in `/tmp` containing audit outputs: `results.json`, `FINAL_REPORT.md`, `99_FINAL_DECISION.txt`, `SCORING_SUMMARY.json`, and phase-specific evidence files. Format: `/tmp/ft_f100_hostile_audit_v3_1_YYYYMMDDTHHMMSSZ_PID`.

**Blocking HIGH**  
A HIGH severity flag where `allowlisted != true`. Counted toward reject threshold (3+ blocking HIGHs = REJECT). Only blocking HIGHs prevent audit pass.

**Allowlisted HIGH**  
A HIGH severity flag marked as reviewed/operational (allowlisted=true). Does NOT count toward reject threshold. Examples: Forge tenant-isolated storage, duplicate npm packages, outdated dependencies managed by Dependabot.

**CI Required Check**  
A GitHub Actions workflow job that must pass before PR merge. For FirstTry, this is `ci-core.yml`. It includes: unit tests, clean install proof, backbone verification, and 5x audit stability.

**Forge Environment**  
- **Development:** forge tunnel mode, local testing, non-production data
- **Production:** firsttry.atlassian.net Jira site, customer-visible, requires audit pass

**Production Policy**  
FirstTry production environment is `firsttry.atlassian.net` only. Customer pilot sites are NOT production. Deployment to customer sites requires separate audit proof and change control approval.

**Exit Code Semantics**  
- `0` = CONDITIONAL_ACCEPT or PASS (deployment allowed)
- `1` = REJECT, CONDITIONAL_REMEDIATION_REQUIRED, HIGH_RISK (deployment blocked)
- `2` = Audit script error (not a scoring outcome)

**Stability Harness**  
Script that runs audit 5 times sequentially and requires all 5 to exit 0. Located at `tools/audit/v3_1/run_stability_5x.sh`. Purpose: Prove deterministic audit behavior (no flaky tests, no network dependencies, no race conditions).

**Canonical Artifacts**  
Three required files in every evidence directory:
1. `results.json` — Parseable JSON array of phase results
2. `FINAL_REPORT.md` — Human-readable audit report
3. `99_FINAL_DECISION.txt` — Single-line decision (CONDITIONAL_ACCEPT, REJECT, etc.)

If audit crashes, trap handler creates fallback versions to preserve evidence integrity.

**Allowlist Rationale**  
Phase 05 storage operations: Forge platform provides automatic tenant isolation via storage API. No code-level tenant binding required per Forge security model (commit c86e8ad1a).

Phase 01 duplicates/outdated: Operational maintenance handled by automated dependency updates (Dependabot). Not security blockers.

Phase 02 trufflehog unavailable: Regex/entropy fallback detection is sufficient for baseline secret scanning.

**Scoring Model**  
```
score = 100
  - (blocking_highs penalty: 15-20 per flag, cap 45 for 3+)
  - (medium flags: 5 per flag, cap 25)
  - (low flags: 1 per flag, cap 10)

Decision thresholds:
  score >= 70 && blocking_highs == 0 → CONDITIONAL_ACCEPT (exit 0)
  score >= 85 && blocking_highs < 3  → CONDITIONAL_ACCEPT (exit 0)
  score >= 65                        → CONDITIONAL_REMEDIATION_REQUIRED (exit 1)
  score >= 50                        → HIGH_RISK (exit 1)
  score < 50                         → REJECT (exit 1)
```

## Document Structure

Each runbook follows this structure:
- **Audience** — Who should read this
- **Prerequisites** — What you need before starting
- **Success Criteria** — How to verify completion
- **Procedures** — Step-by-step commands with working directories
- **Verification** — Expected output and validation checks
- **Troubleshooting** — Common errors and fixes

## File Index

| File | Purpose | When to Use |
|------|---------|-------------|
| [01_prereqs.md](01_prereqs.md) | Tools, accounts, access | Before any setup |
| [02_local_setup.md](02_local_setup.md) | Clone, dependencies, proof | First-time local setup |
| [03_forge_setup.md](03_forge_setup.md) | Forge login, env, scopes | Before deployment |
| [04_deploy_run.md](04_deploy_run.md) | Install app, verify, smoke | Deploy to Jira site |
| [05_audit_runbook.md](05_audit_runbook.md) | Run audit 5x, interpret results | Before production deploy |
| [06_ci_and_artifacts.md](06_ci_and_artifacts.md) | CI checks, evidence downloads | PR review, CI troubleshooting |
| [07_troubleshooting.md](07_troubleshooting.md) | Symptoms to fixes | When errors occur |
| [08_release_procedure.md](08_release_procedure.md) | Versioning, tagging, changelog | Making a release |
| [09_incident_response.md](09_incident_response.md) | Operator steps, evidence capture | Production incidents |
| [10_known_limits.md](10_known_limits.md) | What FirstTry does NOT do | Setting expectations |

## Additional Resources

- **Trust Center:** https://firsttry-solutions.github.io/Firsttry/
- **Security Contact:** security.contact@firsttry.run
- **Vulnerability Disclosure:** See trust/vulnerability-disclosure-policy.html
- **Support Policy:** See operations/support-policy.html
- **GitHub Repository:** https://github.com/Firsttry-Solutions/Firsttry

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-01 | Initial operator runbooks release |
