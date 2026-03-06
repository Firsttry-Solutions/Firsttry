# FirstTry Governance Evidence Collection - Quick Start

## One-Command LIVE Collection (90 seconds)

Get Jira API token from: https://id.atlassian.com/manage/api-tokens

Then run:
```bash
export JIRA_BASE_URL='https://your-domain.atlassian.net'
export JIRA_EMAIL='your-email@example.com'
export JIRA_API_TOKEN='your_api_token_here'

bash tools/reviewer_demo/run_online_demo_live.sh
```

## Results

Evidence saved to: `/tmp/firsttry_reviewer_demo_LATEST/`

View verdict:
```bash
cat /tmp/firsttry_reviewer_demo_LATEST/FINAL_REVIEWER_VERDICT.txt
```

View full report:
```bash
cat /tmp/firsttry_reviewer_demo_LATEST/ENTERPRISE_SAFETY_REPORT.md
```

## DEMO Mode (No Jira Needed)

For testing without Jira:
```bash
bash tools/reviewer_demo/run_reviewer_demo.sh
```

## Verify Integrity

```bash
cd /tmp/firsttry_reviewer_demo_LATEST/09_evidence_pack
sha256sum -c evidence_hashes.sha256
```

## Exit Status

- Exit code `0` = PASS ✅
- Exit code `1` = FAIL ❌

Use in scripts:
```bash
if bash tools/reviewer_demo/run_online_demo_live.sh; then
  echo "Governance verification passed"
fi
```

## Need Help?

See: [LIVE Mode Guide](./LIVE_MODE_GUIDE.md)
