# FirstTry LIVE Mode - Documentation Index

## Quick Navigation

### 🚀 I Want to Get Started Immediately
→ Read: [QUICK_START.md](./QUICK_START.md) (5 minutes)

Key commands:
```bash
export JIRA_BASE_URL='https://your-domain.atlassian.net'
export JIRA_EMAIL='your-email@example.com'
export JIRA_API_TOKEN='your_api_token_here'
bash tools/reviewer_demo/run_online_demo_live.sh
```

### 📋 I Need Complete LIVE Mode Documentation
→ Read: [LIVE_MODE_GUIDE.md](./LIVE_MODE_GUIDE.md) (30 minutes)

Covers:
- LIVE mode architecture
- Prerequisites and Jira API token setup
- Four different ways to run LIVE mode
- Expected behavior and console output
- Evidence directory structure
- Comprehensive troubleshooting
- Advanced configuration
- Security best practices

### 🔧 I'm Setting Up CI/CD Integration
→ Read: [CI_CD_INTEGRATION.md](./CI_CD_INTEGRATION.md) (20 minutes)

Covers:
- GitHub Actions, GitLab CI, Jenkins, CircleCI, CodeBuild, Azure Pipelines
- Secrets and credentials configuration
- Example pipeline definitions
- Pre-flight diagnostics
- Evidence archival strategies
- Compliance recommendations

### 📊 I Want An Overview
→ Read: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) (15 minutes)

Contains:
- Complete implementation details
- Files modified and created
- Technical architecture
- Error handling approach
- Security considerations
- Performance metrics
- Troubleshooting table

### ✅ I Need to Verify My Setup
→ Run: `bash diagnose_jira_live_mode.sh`

This tool:
- Checks environment variables
- Tests network connectivity
- Validates Jira authentication
- Tests JQL search capability
- Provides actionable fixes

## Available Scripts

| Script | Type | Purpose | Usage |
|--------|------|---------|-------|
| `run_online_demo_live.sh` | Entrypoint | **Recommended** for LIVE mode | `bash run_online_demo_live.sh` |
| `run_reviewer_demo.sh` | Harness | Standard harness (DEMO or LIVE) | `MODE=LIVE bash run_reviewer_demo.sh` |
| `diagnose_jira_live_mode.sh` | Diagnostic | Validate Jira setup before running | `bash diagnose_jira_live_mode.sh` |
| `verify_demo_results.sh` | Analyzer | Analyze collected evidence | `bash verify_demo_results.sh /tmp/ft_/*` |

## Environment Variables

```bash
# Required for LIVE mode
export JIRA_BASE_URL='https://your-domain.atlassian.net'
export JIRA_EMAIL='your-email@example.com'
export JIRA_API_TOKEN='your_api_token_here'

# Optional
export MODE=LIVE                    # Override default DEMO
export FT_REVIEWER_MODE=1          # Legacy LIVE mode flag
```

## Evidence Output Location

```
/tmp/firsttry_reviewer_demo_LATEST/

├── 00_meta/                    # Runtime metadata
├── 01_raw_api/                 # Raw Jira API responses
├── 02_pagination/              # Pagination verification
├── 02_parity/                  # Vendor <-> Dev sync
├── 02_docs_integrity/          # Documentation audit
├── 03_*...                     # Various audit results
├── 09_evidence_pack/           # Final evidence hashes
├── 12_final_verdict/           # PASS/FAIL verdict
├── FINAL_REVIEWER_VERDICT.txt  # Simple verdict
├── ENTERPRISE_SAFETY_REPORT.md # Detailed report
└── demo_verdict.json           # Structured result
```

## Execution Flow

```
┌─────────────────────────────────┐
│   Set Environment Variables     │
│  (JIRA_BASE_URL, email, token)  │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  bash run_online_demo_live.sh   │  (or MODE=LIVE bash run_reviewer_demo.sh)
└────────────┬────────────────────┘
             │
             ▼
        ┌─────────────────────────────────────────┐
        │ Validate Mode & Credentials             │
        │ Exit if LIVE + credentials missing      │
        └────────────┬────────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────────────────┐
        │ Phase 1: Parity Gate (Vendor <-> Dev)   │
        │ Exit if out of sync                     │
        └────────────┬────────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────────────────┐
        │ Phase 1B: Jira Evidence Capture          │
        │ LIVE: Connect to Jira, fetch records    │
        │ DEMO: Use mock data                     │
        └────────────┬────────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────────────────┐
        │ Phases 2-8: Standard Audit Pipeline     │
        │ • Docs integrity                        │
        │ • Scope audit                           │
        │ • Network analysis                      │
        │ • Governance snapshot                   │
        └────────────┬────────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────────────────┐
        │ Generate Evidence Hashes & Final Verdict │
        │ Output: PASS or FAIL                    │
        └────────────┬────────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────────────────┐
        │ Evidence Saved to:                      │
        │ /tmp/firsttry_reviewer_demo_LATEST/    │
        └─────────────────────────────────────────┘
```

## Common Tasks

### Validate Jira Connectivity
```bash
bash diagnose_jira_live_mode.sh
```

### Run LIVE Mode Collection
```bash
export JIRA_BASE_URL='https://company.atlassian.net'
export JIRA_EMAIL='reviewer@company.com'
export JIRA_API_TOKEN='AtT_...'
bash run_online_demo_live.sh
```

### View Results
```bash
# Simple verdict
cat /tmp/firsttry_reviewer_demo_LATEST/FINAL_REVIEWER_VERDICT.txt

# Detailed report
cat /tmp/firsttry_reviewer_demo_LATEST/ENTERPRISE_SAFETY_REPORT.md

# Structured JSON
jq . /tmp/firsttry_reviewer_demo_LATEST/demo_verdict.json
```

### Verify Evidence Integrity
```bash
cd /tmp/firsttry_reviewer_demo_LATEST/09_evidence_pack
sha256sum -c evidence_hashes.sha256
```

### Run in DEMO Mode (No Jira)
```bash
bash run_reviewer_demo.sh
```

### Run with Custom Output Location
```bash
export EVIDENCE_ROOT=~/governance_evidence
MODE=LIVE bash run_reviewer_demo.sh
```

## Troubleshooting Guide

### 1. Missing Credentials
```
Error: LIVE mode requires environment variables
Fix: Export JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
```

### 2. Connection Refused
```
Error: Can't connect to Jira
Check:
  - JIRA_BASE_URL is correct (e.g., https://company.atlassian.net)
  - Jira instance is accessible
  - Network allows outbound HTTPS
```

### 3. Authentication Failed
```
Error: HTTP 401 - Invalid credentials
Check:
  - JIRA_EMAIL matches your Jira account
  - JIRA_API_TOKEN is valid (not expired)
  - Generate new token at: https://id.atlassian.com/manage/api-tokens
```

### 4. Permission Denied
```
Error: HTTP 403 - Forbidden
Check:
  - Your user has permission to browse issues
  - Contact Jira admin if restricted
```

### 5. Empty Evidence
```
Warning: No issues found in FIRSTTRY project
Check:
  - FIRSTTRY project exists in Jira
  - Project contains issues
  - Edit jira_capture.sh to change JQL query
```

## Getting Help

1. **Check Documentation**
   - General: [README.md](./README.md)
   - LIVE mode: [LIVE_MODE_GUIDE.md](./LIVE_MODE_GUIDE.md)
   - CI/CD: [CI_CD_INTEGRATION.md](./CI_CD_INTEGRATION.md)
   - Overview: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

2. **Run Diagnostics**
   ```bash
   bash diagnose_jira_live_mode.sh
   ```

3. **Check Evidence Report**
   ```bash
   cat /tmp/firsttry_reviewer_demo_LATEST/ENTERPRISE_SAFETY_REPORT.md
   ```

4. **Verify Jira Access**
   ```bash
   curl -H "Authorization: Basic $(echo -n 'email:token' | base64)" \
     https://your-domain.atlassian.net/rest/api/3/myself
   ```

## Next Steps

1. ✅ **Get Jira API Token**
   - https://id.atlassian.com/manage/api-tokens

2. ✅ **Run Diagnostics**
   ```bash
   bash diagnose_jira_live_mode.sh
   ```

3. ✅ **Execute LIVE Mode**
   ```bash
   bash run_online_demo_live.sh
   ```

4. ✅ **Review Evidence**
   ```bash
   cat /tmp/firsttry_reviewer_demo_LATEST/FINAL_REVIEWER_VERDICT.txt
   ```

5. ✅ **Integrate into CI/CD** (if needed)
   - See [CI_CD_INTEGRATION.md](./CI_CD_INTEGRATION.md)

## Reference

- [Atlassian Jira API](https://developer.atlassian.com/cloud/jira/rest/v3)
- [Jira API Tokens](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)
- [FirstTry Architecture](../docs/ARCHITECTURE.md)

---

**Version**: 1.0
**Last Updated**: 2024-03-06
**Mode**: LIVE with DEMO fallback
**Status**: Production Ready ✅
