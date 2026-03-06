# FirstTry LIVE Mode Jira Governance Evidence Collection Guide

## Overview

FirstTry provides two operating modes for governance evidence collection:

- **DEMO Mode** (default): Uses cached/mock data for safe offline testing and demonstrations
- **LIVE Mode**: Connects to your actual Jira instance to collect real governance evidence

This guide explains how to run FirstTry in LIVE mode against your Atlassian Jira instance.

## LIVE Mode Architecture

LIVE mode performs a **5-phase governance evidence collection**:

1. **Phase 1**: Parity Gate - Validates app consistency (vendor ↔ dev sync)
2. **Phase 1B**: Jira Governance Evidence Capture - Connects to Jira, fetches governance records
3. **Phase 2-5**: Audit Phases - Static analysis, documentation integrity, scope audit, etc.
4. **Phase 6B**: Runtime Execution Audit - Validates Forge CLI operations (if available)
5. **Final**: Verdict Generation - Produces PASS/FAIL with evidence hashing

## Prerequisites

To run LIVE mode, you need:

1. **Jira Instance Access**: An active Atlassian Jira Cloud instance
2. **Jira API Token**: Generated from your Jira user account
3. **Environment Variables**: Three required credentials (see below)
4. **Network Access**: Outbound HTTPS to your Jira instance
5. **Tools**: `bash`, `curl`, `jq`, `openssl` (standard Unix utilities)

### Obtaining Jira API Token

1. Go to: **Jira Account Settings → Security → API Tokens**
   - URL: `https://id.atlassian.com/manage/api-tokens`
2. Create a new token with label "FirstTry Reviewer"
3. Copy the generated token (shown only once)
4. Store securely in your environment

## Quick Start (One-Command Entrypoint)

The fastest way to run LIVE mode is using the one-command entrypoint:

```bash
export JIRA_BASE_URL='https://your-domain.atlassian.net'
export JIRA_EMAIL='your-email@example.com'
export JIRA_API_TOKEN='your_api_token_here'

bash tools/reviewer_demo/run_online_demo_live.sh
```

This script:
- ✅ Validates credentials
- ✅ Extracts Jira governance records
- ✅ Runs all audit phases
- ✅ Generates final verdict
- ✅ Displays results with evidence summary

Results are saved to: `/tmp/firsttry_reviewer_demo_LATEST/`

## Standard Harness with MODE Override

Alternatively, set `MODE=LIVE` and run the main harness:

```bash
export MODE=LIVE
export JIRA_BASE_URL='https://your-domain.atlassian.net'
export JIRA_EMAIL='your-email@example.com'
export JIRA_API_TOKEN='your_api_token_here'

bash tools/reviewer_demo/run_reviewer_demo.sh
```

## Legacy FT_REVIEWER_MODE Flag

The original environment variable flag is still supported:

```bash
export FT_REVIEWER_MODE=1
export JIRA_BASE_URL='https://your-domain.atlassian.net'
export JIRA_EMAIL='your-email@example.com'
export JIRA_API_TOKEN='your_api_token_here'

bash tools/reviewer_demo/run_reviewer_demo.sh
```

**All three methods are equivalent.** Use whichever is most convenient for your CI/CD system.

## Jira Credentials Reference

| Variable | Value | Example |
|----------|-------|---------|
| `JIRA_BASE_URL` | Your Jira Cloud URL | `https://mycompany.atlassian.net` |
| `JIRA_EMAIL` | Your Jira user email | `reviewer@mycompany.com` |
| `JIRA_API_TOKEN` | API token from Jira settings | `AThQ1a2bC3dEfG4hI5jK6` |

### URL Format

- **Jira Cloud**: `https://your-domain.atlassian.net` (without trailing slash)
- **Jira Server/DC**: `https://your-jira.example.com` (without trailing slash)

## Expected Behavior

When running in LIVE mode:

### Console Output
```
===============================================================
FirstTry LIVE Jira Governance Evidence Collection
===============================================================

Mode: LIVE
Jira Instance: https://your-domain.atlassian.net
User: your-email@example.com

[INFO] ====================================================================
[INFO] FirstTry Enterprise Safety Verification Harness v3
[INFO] ======================================================================

[INFO] PHASE 1: Parity Gate - Vendor <-> Dev Sync Check
[INFO] ✅ PARITY PASS

[INFO] PHASE 1B: Jira Governance Evidence Capture
[INFO] Connecting to Jira...
[INFO] Fetching issues with JQL: project = FIRSTTRY ...
[INFO] ✅ Jira governance evidence captured successfully
  - Issues found: 847
  - Total API calls: 12 (with pagination)
  - Response size: 2.3 MB
  - Hash: sha256:abc123def456...

[INFO] PHASE 2: Documentation Integrity Audit
[INFO] ✅ Docs integrity audit passed

[INFO] PHASE 3: Forge Manifest Scope Audit
[INFO] ✅ Scope audit passed

[INFO] PHASE 4: Read-Only Jira API Verification
[INFO] ✅ Read-only API audit passed

[INFO] PHASE 5: Static Network Egress Audit
[INFO] ✅ Network egress audit passed

[INFO] PHASE 6: Blast Radius Audit
[INFO] ✅ Blast radius audit passed

[INFO] PHASE 6B: Runtime Execution Audit (Forge CLI)
[INFO] ✅ Runtime execution audit passed

[INFO] PHASE 7: Governance Snapshot Audit
[INFO] ✅ Governance snapshot audit passed

[INFO] PHASE 8: Evidence Packing and Final Verdict
[INFO] ✅ Final verdict: PASS

===============================================================
EVIDENCE COLLECTION COMPLETE
===============================================================

Evidence directory: /tmp/firsttry_reviewer_demo_LATEST

Final Verdict:
PASS

Verifier Report:
{
  "overall_status": "PASS",
  "phases_passed": 10,
  "phases_failed": 0,
  ...
}

Evidence Summary:
  Total evidence files: 156
```

### Evidence Directory Structure

Upon completion, all governance evidence is saved to `/tmp/firsttry_reviewer_demo_LATEST/`:

```
00_meta/                          # Runtime metadata
  METADATA.json

01_raw_api/                       # Raw Jira API responses
  responses/
    jira_issues_page_1.json
    jira_issues_page_2.json
    ...

02_pagination/                    # Pagination verification
  pagination_verification.json
  jira_pagination_chain.json

02_parity/                        # Vendor <-> Dev sync check
  parity_gate_result.json

08_governance_snapshot/           # Jira governance records (canonical form)
  raw/requests/                   # API request bodies
  raw/responses/                  # Raw API responses
  derived/                        # Canonicalized governance data
    governance_records.json
    governance_derived.json
  validation/                     # Validation reports
    canonicalization_validation.json

09_evidence_pack/                 # Final evidence pack
  evidence_manifest.json
  evidence_hashes.sha256

12_final_verdict/
  FINAL_REVIEWER_VERDICT.txt      # PASS or FAIL
  ENTERPRISE_SAFETY_REPORT.md     # Detailed report
  demo_verdict.json               # Structured verdict
```

## Troubleshooting

### Error: "LIVE mode requires environment variables"

**Cause**: One or more required environment variables not set
**Fix**: Check all three are exported:
```bash
printenv | grep JIRA_
```

### Error: "Connection failed to Jira"

**Cause**: Network error, wrong URL, or authentication failure
**Solutions**:
- Verify `JIRA_BASE_URL` is correct and accessible
- Check API token is valid and not expired
- Try manually: `curl -H "Authorization: Basic $(echo -n 'email:token' | base64)" https://your-domain.atlassian.net/rest/api/3/myself`

### Error: "Invalid Jira API token"

**Cause**: Token is incorrect, revoked, or expired
**Fix**:
1. Generate a new token at: https://id.atlassian.com/manage/api-tokens
2. Verify you're using the token value, not the label

### Error: "Rate limited by Jira"

**Cause**: Too many API requests in short time
**Solution**: Run again after waiting 1-2 hours, or contact Jira admin to increase rate limits

### Empty or Incomplete Evidence

**Cause**: Jira JQL query returned no results
**Fix**: The query used is: `project = FIRSTTRY`
- Check if `FIRSTTRY` project exists in your Jira
- Adjust query in `lib/jira_capture.sh` if needed

## Advanced Configuration

### Custom JQL Query

To collect evidence from a different Jira project or issue set, edit `lib/jira_capture.sh`:

Find this line:
```bash
JQL_QUERY="project = FIRSTTRY AND type IN (Issue, Task, Bug, Story) ORDER BY key ASC"
```

Change to your custom query, e.g.:
```bash
JQL_QUERY="project = CUSTOMPROJ AND assignee = currentUser()"
```

### Large Result Sets (>10k issues)

For large Jira instances, the harness automatically:
- Uses pagination (max 50 issues/request)
- Verifies pagination integrity
- Stores responses separately
- Computes content hashes

No configuration needed! The harness handles pagination transparently.

### Persistent Evidence Archive

By default, evidence is stored in `/tmp/` and may be cleaned after system reboot.
To preserve evidence, copy to a permanent location:

```bash
cp -r /tmp/firsttry_reviewer_demo_LATEST ~/firsttry_evidence_backup/
```

### CI/CD Integration

For GitHub Actions or GitLab CI:

```yaml
# GitHub Actions example
- name: FirstTry LIVE Governance Evidence
  env:
    JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
    JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
    JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
  run: |
    bash tools/reviewer_demo/run_online_demo_live.sh
```

Similar for GitLab CI using `$CI_JOB_TOKEN` or secrets.

## Exit Codes

- `0`: All evidence collected and verdict is **PASS**
- `1`: Evidence collection incomplete or verdict is **FAIL**
- `2`: Missing required environment variables (usage error)

Use exit codes to gate CI/CD pipeline decisions:
```bash
if bash tools/reviewer_demo/run_online_demo_live.sh; then
  echo "✅ Governance verification passed"
  # Deploy or approve review
else
  echo "❌ Governance verification failed"
  # Reject or require manual review
fi
```

## Security Best Practices

### API Token Safety

1. **Never commit tokens** to version control
2. **Rotate tokens regularly** (monthly recommended)
3. **Use Jira user level permissions** (not admin)
4. **Monitor token usage** in Jira audit logs

### Evidence File Handling

1. **Evidence files are sensitive** - contain governance records
2. **Store in secure location** access-controlled backup
3. **Hash verification**: Use `sha256sum -c` to verify file integrity
4. **Redact PII** if sharing evidence with third parties

### Network Security

- All Jira API calls use HTTPS
- Credentials sent via HTTP Basic Auth (base64 encoded, over HTTPS only)
- No credentials logged or printed to console

## Support & Help

For issues or questions:

1. **Check logs**: View `ENTERPRISE_SAFETY_REPORT.md` in evidence directory
2. **Test credentials**: Try manual API call with curl
3. **Verify Jira access**: Ensure your user account has permission to browse issues
4. **Check network**: Ensure outbound HTTPS allowed to Jira instance

## Reference

- [Atlassian Jira API Documentation](https://developer.atlassian.com/cloud/jira/rest/v3)
- [Jira API Token Docs](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)
- [FirstTry Evidence Collection Architecture](../docs/ARCHITECTURE.md)
