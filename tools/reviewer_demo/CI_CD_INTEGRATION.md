# LIVE Mode Jira Integration - CI/CD Deployment Guide

## Overview

FirstTry LIVE mode provides Jira governance evidence collection suitable for CI/CD pipelines, automated reviews, and continuous compliance validation.

This guide shows how to integrate FirstTry LIVE mode into various CI/CD platforms.

## Prerequisites

- FirstTry repository with `tools/reviewer_demo/` scripts
- Jira Cloud instance with API token authentication support
- CI/CD platform with environment variable secret support
- Network access from CI/CD runners to Jira (HTTPS outbound)

## Setup: Create Jira API Token

1. Go to: https://id.atlassian.com/manage/api-tokens
2. Click "Create API Token"
3. Name: `FirstTry CI/CD`
4. Copy generated token (shown only once)
5. Store token securely as CI/CD secret

## GitHub Actions

### 1. Add Secrets

Go to: **Settings → Secrets and variables → Actions → New repository secret**

Add three secrets:
- `JIRA_BASE_URL`: `https://your-domain.atlassian.net`
- `JIRA_EMAIL`: `your-email@example.com`
- `JIRA_API_TOKEN`: (API token from step above)

### 2. Create Workflow

Create `.github/workflows/governance-verification.yml`:

```yaml
name: Governance Verification

on:
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * 1'  # Weekly Monday 2 AM

jobs:
  governance-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run FirstTry Governance Verification
        env:
          JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
          JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
        run: |
          bash tools/reviewer_demo/run_online_demo_live.sh

      - name: Upload Evidence
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: firsttry-evidence
          path: /tmp/firsttry_reviewer_demo_LATEST/
          retention-days: 30

      - name: Comment on PR
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '❌ FirstTry governance verification failed. See workflow artifacts for evidence.'
            })
```

### 3. Optional: Exit on Failure

To block PRs on governance failures:

```yaml
- name: Governance Status Check
  if: failure()
  run: |
    echo "❌ Governance verification failed"
    exit 1
```

## GitLab CI

### 1. Add CI/CD Variables

Go to: **Settings → CI/CD → Variables**

Add three variables:
- `JIRA_BASE_URL`: `https://your-domain.atlassian.net`
- `JIRA_EMAIL`: `your-email@example.com`
- `JIRA_API_TOKEN`: (API token, marked as protected & masked)

### 2. Add to `.gitlab-ci.yml`

```yaml
governance_verification:
  stage: verify
  image: ubuntu:latest
  variables:
    JIRA_BASE_URL: $JIRA_BASE_URL
    JIRA_EMAIL: $JIRA_EMAIL
    JIRA_API_TOKEN: $JIRA_API_TOKEN
  before_script:
    - apt-get update && apt-get install -y curl jq
  script:
    - bash tools/reviewer_demo/run_online_demo_live.sh
  artifacts:
    paths:
      - /tmp/firsttry_reviewer_demo_LATEST/
    expire_in: 30 days
    when: always
  allow_failure: false  # Set to true to warn but not fail verify stage
```

## Jenkins

### 1. Add Credentials

Go to: **Manage Jenkins → Manage Credentials → System → Global credentials**

Add credential with:
- Kind: "Secret text"
- Secret: (Jira API token)
- ID: `jira_api_token`

Repeat for `JIRA_BASE_URL` and `JIRA_EMAIL`.

### 2. Create Declarative Pipeline

```groovy
pipeline {
    agent any

    environment {
        JIRA_BASE_URL = credentials('jira_base_url')
        JIRA_EMAIL = credentials('jira_email')
        JIRA_API_TOKEN = credentials('jira_api_token')
    }

    stages {
        stage('Governance Verification') {
            steps {
                sh 'bash tools/reviewer_demo/run_online_demo_live.sh'
            }
        }
    }

    post {
        always {
            // Archive evidence
            archiveArtifacts artifacts: '/tmp/firsttry_reviewer_demo_LATEST/**',
                           allowEmptyArchive: true

            // Parse verdict
            script {
                def verdict = readFile(file: '/tmp/firsttry_reviewer_demo_LATEST/FINAL_REVIEWER_VERDICT.txt').trim()
                if (verdict == 'FAIL') {
                    error("Governance verification failed")
                }
            }
        }
    }
}
```

## CircleCI

### 1. Add Environment Variables

Go to: **Project Settings → Environment Variables**

Add:
- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

### 2. Add to `.circleci/config.yml`

```yaml
version: 2.1

jobs:
  governance_verification:
    docker:
      - image: ubuntu:latest
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: apt-get update && apt-get install -y curl jq
      - run:
          name: Run FirstTry Governance Verification
          environment:
            JIRA_BASE_URL: $JIRA_BASE_URL
            JIRA_EMAIL: $JIRA_EMAIL
            JIRA_API_TOKEN: $JIRA_API_TOKEN
          command: bash tools/reviewer_demo/run_online_demo_live.sh
      - store_artifacts:
          path: /tmp/firsttry_reviewer_demo_LATEST
          destination: governance-evidence
      - store_test_results:
          path: /tmp/firsttry_reviewer_demo_LATEST/12_final_verdict

workflows:
  daily_governance_check:
    jobs:
      - governance_verification
    triggers:
      - schedule:
          cron: "0 2 * * 1"
          filters:
            branches:
              only: main
```

## AWS CodePipeline / CodeBuild

### 1. Create CodeBuild Project

Go to: **AWS CodeBuild → Create Build Project**

Configure:
- Environment: `Ubuntu:latest + Docker`
- Source: Your repository
- Environment variables (add):
  - `JIRA_BASE_URL`: Your Jira URL
  - `JIRA_EMAIL`: Your email
  - `JIRA_API_TOKEN`: (secure string from Secrets Manager)

### 2. Create `buildspec.yml`

```yaml
version: 0.2

phases:
  install:
    commands:
      - apt-get update
      - apt-get install -y curl jq

  build:
    commands:
      - bash tools/reviewer_demo/run_online_demo_live.sh

  post_build:
    commands:
      - |
        if [ -f /tmp/firsttry_reviewer_demo_LATEST/FINAL_REVIEWER_VERDICT.txt ]; then
          VERDICT=$(cat /tmp/firsttry_reviewer_demo_LATEST/FINAL_REVIEWER_VERDICT.txt)
          echo "Governance Verdict: $VERDICT"
          if [ "$VERDICT" != "PASS" ]; then
            exit 1
          fi
        fi

artifacts:
  files:
    - '/tmp/firsttry_reviewer_demo_LATEST/**'
  discard-paths: yes
```

## Azure Pipelines

### 1. Add Variable Group

Go to: **Pipelines → Library → Variable groups**

Create `JiraSecrets`:
- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN` (check "Keep this value secret")

### 2. Add to `azure-pipelines.yml`

```yaml
trigger:
  - main

schedules:
  - cron: "0 2 * * 1"
    displayName: Weekly Monday
    branches:
      include:
        - main
    always: false

pool:
  vmImage: 'ubuntu-latest'

variables:
  - group: JiraSecrets

stages:
  - stage: GovernanceVerification
    jobs:
      - job: VerifyGovernance
        steps:
          - checkout: self

          - task: Bash@3
            displayName: 'Run FirstTry Governance Verification'
            env:
              JIRA_BASE_URL: $(JIRA_BASE_URL)
              JIRA_EMAIL: $(JIRA_EMAIL)
              JIRA_API_TOKEN: $(JIRA_API_TOKEN)
            inputs:
              targetType: 'inline'
              script: 'bash tools/reviewer_demo/run_online_demo_live.sh'

          - task: PublishBuildArtifacts@1
            displayName: 'Publish Evidence'
            condition: always()
            inputs:
              pathToPublish: '/tmp/firsttry_reviewer_demo_LATEST'
              artifactName: 'governance-evidence'
              publishLocation: 'Container'
```

## Generic Shell Script Integration

For any CI/CD system, this shell script wraps the evidence collection:

```bash
#!/bin/bash
set -euo pipefail

# Pre-flight checks
bash tools/reviewer_demo/diagnose_jira_live_mode.sh || exit 2

# Run evidence collection
if bash tools/reviewer_demo/run_online_demo_live.sh; then
  echo "✅ Governance verification PASSED"

  # Optional: Upload evidence somewhere
  # aws s3 cp /tmp/firsttry_reviewer_demo_LATEST/ s3://my-bucket/governance/

  exit 0
else
  echo "❌ Governance verification FAILED"

  # Display report
  cat /tmp/firsttry_reviewer_demo_LATEST/ENTERPRISE_SAFETY_REPORT.md

  exit 1
fi
```

## Pre-Flight Diagnostics

Before adding to a CI/CD pipeline, use diagnostics to validate setup:

```bash
bash tools/reviewer_demo/diagnose_jira_live_mode.sh
```

This script checks:
- ✅ All Jira credentials are set
- ✅ Network connectivity to Jira
- ✅ Jira API authentication
- ✅ Search capability

Success: Ready for CI/CD integration
Failure: Fix issues before continuing

## Evidence Archive & Retention

### GitHub Actions
Evidence is uploaded as artifact for 30 days (configurable).

View: **Actions → Workflow run → Artifacts**

### GitLab CI
Evidence stored in job artifacts for specified duration.

View: **CI/CD → Pipelines → Job**

### Jenkins
Evidence archived in job workspace.

View: **Job → Artifacts**

### Recommended: Long-term Storage

```bash
# Copy evidence to secure location
aws s3 cp /tmp/firsttry_reviewer_demo_LATEST/ \
  s3://my-artifacts/governance/$(date -u +%Y%m%d_%H%M%S)/

# Or to git (for audit trail)
git add governance-evidence/
git commit -m "Governance evidence [automated]"
git push origin governance-branch
```

## Compliance & Audit Trail

For regulatory compliance, establish:

1. **Evidence Retention**: Store evidence for minimum 2+ years
2. **Evidence Integrity**: Verify SHA256 checksums on access
3. **Audit Trail**: Record all verification runs with timestamps
4. **Change Management**: Document any modifications to evidence

Example log entry:
```
2024-03-06T08:15:00Z | GOVERNANCE_VERIFICATION | PASS | evidence_hash=abc123 | performer=ci-bot
```

## Troubleshooting

### CI/CD Pipeline Timeouts

LIVE mode typically needs:
- Network latency: ~5-10 seconds
- API calls with pagination: ~30-60 seconds depending on Jira dataset size
- Total: ~2-3 minutes for typical instances

Set timeout: 5-10 minutes

### Rate Limiting

If Jira rate-limits the CI/CD system:
- Jira Cloud: Up to 8 req/sec per user
- Request pagination automatically queues
- Add delays between API calls if needed:
  ```bash
  # In jira_capture.sh, add:
  sleep 0.5  # 500ms between requests
  ```

### Network Errors

If CI/CD network is restricted:
- Whitelist Jira domain in firewall
- Check outbound HTTPS (port 443)
- Verify no proxy intercepts API calls

### Authentication Failures

```
HTTP 401: Invalid Credentials
```
- Verify API token not expired (rotate every 90 days)
- Check email matches Jira account
- Ensure token has permission to browse issues

## Metrics & Dashboards

Extract metrics from evidence for dashboards:

```bash
# Count issues analyzed
jq '.total' /tmp/firsttry_reviewer_demo_LATEST/08_governance_snapshot/derived/governance_derived.json

# Get verdict
cat /tmp/firsttry_reviewer_demo_LATEST/FINAL_REVIEWER_VERDICT.txt

# Evidence integrity
sha256sum /tmp/firsttry_reviewer_demo_LATEST/09_evidence_pack/evidence_hashes.sha256

# Runtime
jq '.meta.timestamp' /tmp/firsttry_reviewer_demo_LATEST/00_meta/METADATA.json
```

## Support

For CI/CD integration issues:
1. Run `diagnose_jira_live_mode.sh` locally
2. Check CI/CD logs and environment
3. Verify network/firewall allows Jira access
4. See [LIVE Mode Guide](./LIVE_MODE_GUIDE.md) for detailed troubleshooting
