# Reviewer Demo Harness (Canonical)

Canonical reviewer harness lives in `tools/reviewer_demo/`.

## Quick Start

### DEMO Mode (Offline, Cached Data)
```bash
bash tools/reviewer_demo/run_reviewer_demo.sh
```

### LIVE Mode (Real Jira Instance)
```bash
export JIRA_BASE_URL='https://your-domain.atlassian.net'
export JIRA_EMAIL='your-email@example.com'
export JIRA_API_TOKEN='your_api_token_here'

bash tools/reviewer_demo/run_online_demo_live.sh
```

## Scripts

- **run_reviewer_demo.sh** - Main harness (DEMO or LIVE mode)
  - Demo: `bash tools/reviewer_demo/run_reviewer_demo.sh`
  - Live: Set MODE=LIVE and Jira credentials, then run script

- **run_online_demo_live.sh** - One-command LIVE mode entrypoint
  - Requires Jira credentials via environment variables
  - Validates credentials before connecting
  - Displays results summary and exit status

- **verify_demo_results.sh** - Offline result analyzer
  - Usage: `bash tools/reviewer_demo/verify_demo_results.sh /tmp/firsttry_reviewer_demo_LATEST/`
  - Parses evidence and displays final verdict

- **proof_pack/build_reviewer_proof_pack.sh** - Evidence packaging
  - Creates sealed proof pack with signatures

- **proof_pack/verify_reviewer_proof_pack.sh** - Proof verification
  - Usage: `bash tools/reviewer_demo/proof_pack/verify_reviewer_proof_pack.sh <evidence_dir>`
  - Verifies evidence integrity and signatures

## Execution Modes

### DEMO Mode (Default)
- No network access required
- Uses mock/cached Jira data
- Safe for testing and demonstrations
- Fast execution (< 1 minute)

### LIVE Mode
- Connects to real Jira instance
- Collects actual governance evidence
- Requires three environment variables (see above)
- Full pagination support for large result sets
- Evidence hashing and integrity verification
- Security: All credentials sent via HTTPS; tokens never logged

## Evidence Output

All runs produce evidence in:
```
/tmp/firsttry_reviewer_demo_LATEST/
```

Contains:
- Raw API responses (pagination, requests/responses separated)
- Canonical governance records
- Audit results (docs, scope, security, network)
- Final verdict (PASS/FAIL)
- Evidence hashes for integrity verification

## Environment Variables

**LIVE Mode Required:**
- `JIRA_BASE_URL` - Jira instance URL
- `JIRA_EMAIL` - Jira user email
- `JIRA_API_TOKEN` - API token from Jira user settings

**Optional:**
- `MODE` - Override to "LIVE" (default: DEMO)
- `FT_REVIEWER_MODE` - Legacy: set to "1" for LIVE
- `FT_APP_ROOT` - Custom app root (default: vendor canonical)
- `EVIDENCE_ROOT` - Custom output directory

## Documentation

- [LIVE Mode Guide](./LIVE_MODE_GUIDE.md) - Comprehensive LIVE mode documentation and troubleshooting
- [Implementation Details](./lib/README.md) - Audit module architecture

## Canonical App Location

**Important**: `FirstTry---Audit-Evidence-for-Jira/` is NOT canonical for runtime scripts.
Treat any nested copy as documentation mirror only.
**Canonical runnable scripts are only under `tools/reviewer_demo/`.**

## Legacy Commands

These remain supported for backward compatibility:

```bash
# Offline verification
bash tools/reviewer_demo/verify_demo_results.sh /tmp/ft_reviewer_demo_*

# Proof pack builder
bash tools/reviewer_demo/proof_pack/build_reviewer_proof_pack.sh

# Proof pack verifier
bash tools/reviewer_demo/proof_pack/verify_reviewer_proof_pack.sh <evidence_dir>
```
