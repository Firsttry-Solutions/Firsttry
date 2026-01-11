# Change Management

## Audience & Scope

**Audience**: IT operations teams, release managers, compliance officers, and organizations responsible for change governance and deployment control.

**Scope**: This document describes the change management process for FirstTry, including how changes are tracked, verified, and deployed. It covers deterministic verification mechanisms, freeze-lock enforcement, and audit trail generation. It does NOT describe governance policy for organizational change management; that is an organizational responsibility outside FirstTry scope.

## Executive Summary

FirstTry implements change management through a freeze-lock mechanism that cryptographically binds application state to specific commit SHAs. Every deployment is verified deterministically using `audit/verify_freeze_lock.sh`, ensuring that the deployed artifact matches the published release commit. This approach enables reproducible deployments, complete audit trails, and non-bypassable change control.

## What This Covers

- Freeze-lock mechanism and its role in change control
- Deployment verification procedures
- Evidence artifact generation and ledger maintenance
- Rollback procedures and recovery
- Audit trail generation and proof storage
- Change tracking and commit history

## What This Explicitly Does NOT Cover

- Organizational change management policies or governance
- Emergency change procedures or out-of-band approvals
- Change advisory board (CAB) processes
- Stakeholder notification procedures
- Communication plans for change deployment
- Risk assessment or impact analysis

## Change Management Mechanism: Freeze-Lock

### How It Works

1. **Freeze Generation**: Before each release, execute `audit/generate_freeze_lock.sh`
   - Computes cryptographic hash (SHA) of application state (code, dependencies, manifest)
   - Records frozen SHA in `audit/marketplace_submission/FREEZE_LOCK.json`
   - Commits freeze lock to version control with release tag

2. **Release Publication**: Publish release to Atlassian Forge App Hub
   - Evidence bundle is generated and stored
   - Freeze-lock file is included in evidence package
   - Release notes reference freeze commit SHA

3. **Deployment Verification**: Customer validates deployment using `audit/verify_freeze_lock.sh`
   - Recomputes state SHA from deployed artifact
   - Compares against published freeze-lock SHA
   - Produces cryptographic proof of matching state
   - Fails deterministically if deployed state differs from freeze

### Freeze-Lock Proof Structure

```json
{
  "frozen_sha": "4d9ed6c5...",
  "computed_sha": "4d9ed6c5...",
  "manifest_hash": "...",
  "package_lock_hash": "...",
  "verification_timestamp": "2026-01-11T...",
  "status": "VERIFIED"
}
```

**VERIFIED**: Deployed state matches published freeze commit; change was not applied
**MISMATCH**: Deployed state differs from freeze; unexpected modification detected

## Deployment Workflow

### Pre-Deployment

1. **Review Change**: Examine commit diff for manifest changes, scope changes, or API surface modifications
   - Proof: [atlassian/forge-app/audit/reviewer_ready_gate.sh:L1-L230](../atlassian/forge-app/audit/reviewer_ready_gate.sh#L1-L230)

2. **Run Readiness Gate**: Execute reviewer readiness gate to validate change compliance
   ```bash
   ./atlassian/forge-app/audit/reviewer_ready_gate.sh
   ```
   - Validates manifest scopes
   - Scans for write-surface APIs
   - Runs NPM audit
   - Verifies claims ledger
   - Generates freeze-lock

3. **Generate Evidence**: Capture baseline evidence before deployment
   ```bash
   ./audit/generate_freeze_lock.sh
   ```
   - Evidence package includes freeze-lock, manifest, package-lock, logs

### Deployment

1. **Deploy via Forge CLI**:
   ```bash
   forge deploy
   ```

2. **Verify Deployment**:
   ```bash
   ./audit/verify_freeze_lock.sh
   ```
   - Confirms deployed state matches frozen state
   - Produces cryptographic proof of successful deployment

### Post-Deployment

1. **Archive Evidence**: Store evidence package in version control or external archive
2. **Update Evidence Ledger**: Record deployment metadata (timestamp, deployer, freeze SHA)
3. **Monitor Operations**: Dashboard gadget provides real-time operational status

## Change Types & Audit Trail

### Type 1: Code Changes

**Tracked By**: Git commit hash (parent of freeze commit)
**Verified By**: `git show <freeze-sha>`
**Proof Storage**: Evidence package includes git log excerpt

### Type 2: Manifest Changes

**Tracked By**: Manifest diff at freeze commit
**Verified By**: `audit/verify_freeze_lock.sh` (manifest hash in freeze-lock)
**Proof Storage**: Evidence package includes manifest excerpt

### Type 3: Dependency Updates

**Tracked By**: package-lock.json diff at freeze commit
**Verified By**: Freeze-lock hash comparison
**Proof Storage**: Evidence package includes dependency audit report

### Type 4: Configuration Changes

**Tracked By**: Freeze-lock records scheduled task frequency, evidence retention
**Verified By**: Dashboard gadget displays active configuration
**Proof Storage**: Configuration snapshot in evidence ledger

## Rollback Procedure

**Scenario**: Deployed version causes operational issues; need to revert to previous version

**Steps**:

1. **Identify Previous Freeze**: Locate prior freeze-lock commit in git history
   ```bash
   git log --grep="FREEZE_LOCK" --oneline
   ```

2. **Deploy Previous Version**:
   ```bash
   git checkout <previous-freeze-sha>
   forge deploy
   ```

3. **Verify Rollback**:
   ```bash
   ./audit/verify_freeze_lock.sh
   ```
   - Confirms deployment matches previous freeze commit

4. **Document Rollback**: Update change log with rollback reason and timestamp
   - Proof: Git commit log shows rollback operation
   - Evidence: Freeze-lock for both versions stored in evidence ledger

5. **Post-Incident Review**: Analyze root cause of issue that triggered rollback
   - Update documentation with lessons learned
   - Modify deployment process if necessary to prevent recurrence

## Core Assertions

- **Freeze-Lock Mechanism Enables Reproducible Deployments**: Every deployment can be independently verified to match published freeze commit, detecting unauthorized modifications.
  - Proof: [verify_freeze_lock.sh](../atlassian/forge-app/audit/verify_freeze_lock.sh)

- **Evidence Artifacts Provide Complete Audit Chain**: Freeze-lock files, manifests, and deployment logs form an immutable record of all changes.
  - Proof: [submission_bundle/](../atlassian/forge-app/audit/submission_bundle/)

- **Reviewer Readiness Gate Enforces Change Compliance**: Mandatory gate validates manifest scopes, scans for write-surface APIs, and verifies freeze-lock before release.
  - Proof: [reviewer_ready_gate.sh:L1-L230](../atlassian/forge-app/audit/reviewer_ready_gate.sh#L1-L230)

- **Rollback Procedures Are Straightforward and Deterministic**: Rolling back to a prior version requires only identifying the prior freeze commit and redeploying, with verification proving successful rollback.
  - Proof: [Rollback Procedure](CHANGE_MANAGEMENT.md#rollback-procedure) (this section)

## Audit Trail & Evidence Storage

### What Is Captured

| Artifact | Scope | Storage |
|----------|-------|---------|
| **Freeze-Lock** | Deployment-time state hash | Version control + evidence package |
| **Manifest** | API scopes, scheduled tasks | Evidence package |
| **Package-Lock** | Dependency manifest | Evidence package |
| **Git Log** | Code changes at freeze commit | Version control + evidence package |
| **Security Scan** | NPM audit, manifest validation | Evidence package |
| **Deployment Proof** | Freeze verification output | Evidence ledger |

### Evidence Ledger

Evidence ledger is maintained in `atlassian/forge-app/audit/` directory and includes:
- Freeze-lock files (one per release)
- Evidence packages (ZIP archives with complete deployment artifacts)
- Verification logs (freeze verification output from each deployment)
- Change logs (human-readable summary of changes per release)

### External Audit Access

Organizations can share evidence packages with external auditors:
1. Export evidence package: `Reviewer_Evidence_Pack_<timestamp>_<sha>.zip`
2. Provide to auditor with proof anchor documentation
3. Auditor can independently verify freeze-lock using: `audit/verify_freeze_lock.sh`

## Explicit Negative Assertions

- **This change management system does NOT include organizational change approvals or CAB workflows**: FirstTry automates technical verification and audit trail generation. Organizational change governance remains the customer's responsibility.

- **This system does NOT support feature-tier or conditional deployment logic**: All deployments use identical freeze-lock verification regardless of customer tier or license. No conditional code paths or feature gating exists.

- **This system does NOT include automatic rollback or incident remediation**: Rollback requires manual execution of `git checkout` and `forge deploy`. Automatic remediation policies must be configured separately by the organization.

- **This system does NOT track or enforce approval workflows**: Change management documents what changed and provides cryptographic proof of deployed state. Approval and authorization policies are organizational responsibilities.

- **This system does NOT provide real-time change notification or alert integration**: Evidence ledger is updated after deployment. Real-time alerting requires integration with external monitoring/alerting systems.

## Proof Anchors

| Claim | Location |
|-------|----------|
| Freeze-lock mechanism | [atlassian/forge-app/audit/generate_freeze_lock.sh](../atlassian/forge-app/audit/generate_freeze_lock.sh) |
| Freeze verification | [atlassian/forge-app/audit/verify_freeze_lock.sh](../atlassian/forge-app/audit/verify_freeze_lock.sh) |
| Reviewer readiness gate (change validation) | [atlassian/forge-app/audit/reviewer_ready_gate.sh:L1-L230](../atlassian/forge-app/audit/reviewer_ready_gate.sh#L1-L230) |
| Evidence package storage | [atlassian/forge-app/audit/submission_bundle/](../atlassian/forge-app/audit/submission_bundle/) |
| Manifest scope tracking | [atlassian/forge-app/manifest.yml](../atlassian/forge-app/manifest.yml) |

---

**Document Version**: 1.0 | **Updated**: 2026-01-11 | **Status**: Enterprise-Grade
