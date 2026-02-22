# Proof Mode (Fail-Closed Evidence Run)

This repository provides a dedicated "Proof Mode" command that is the only accepted internal evidence run for enterprise review.

## Command
Run from /workspaces/Firsttry/atlassian/forge-app:

npm run proof

## What Proof Mode enforces (fail-closed)
- Clean git working tree (no uncommitted changes)
- FT_REQUIRE_CLEAN=1 (posttest clean gate must run and pass)
- Skip gate: fails if any tests are skipped, except explicitly allowlisted skips

## Evidence output
Proof Mode writes an evidence directory:

/tmp/ft_proof_mode_<UTC_TIMESTAMP>/

Artifacts include:
- EVIDENCE_DIR.txt
- 00_git_status.txt
- 01_test_output.txt
- 02_posttest_clean_gate.txt
- 03_no_skips_gate.txt
- 04_head_sha.txt
- 05_skips_allowlist.txt
- 06_evidence_sha256sums.txt
- 07_env_versions.txt
- 08_npm_ls_depth0.txt

Only this evidence directory should be attached to enterprise review artifacts. "npm test" is for local development and is not treated as evidence.
