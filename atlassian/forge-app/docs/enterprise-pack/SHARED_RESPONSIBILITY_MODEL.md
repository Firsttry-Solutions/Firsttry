# Shared Responsibility Model — Enterprise Pack

## Scope

This document describes the shared responsibilities between the FirstTry platform and the customer (tenant) for enterprise governance evidence.

## Scheduled trigger timing and reliability (Forge platform)

Scheduled triggers start shortly after creation (about 5 minutes after deployment) and then run based on the configured interval. Deployments can reset start offsets because triggers are created after deployment. If a scheduled trigger invocation errors, it is not retried; the next attempt occurs at the next due interval. FirstTry records scheduled run attempts and outcomes in exported evidence so auditors can validate completeness across deployments.

FT_PROOF_DEPLOY_RESET_AWARE_v1

## Tenant responsibilities

- Enable or disable scheduled snapshot automation via the admin UI toggle
- Review exported evidence packs for completeness before submitting to auditors
- Maintain appropriate Jira permission scopes for the app

## FirstTry platform responsibilities

- Generate deterministic, canonical governance snapshots
- Provide SHA-256 public hashes for independent verification
- Record schedule run outcomes (success, skipped, failed) in storage
- Disclose deploy-offset behavior and missed-run signals in evidence exports
- Fail-closed on export when review state is incomplete

## Hashing model

- **publicHash** = SHA-256(canonicalPayload) — externally verifiable by any party
- **tenantTag** = HMAC-SHA256(tenantSecret, publicHash) — optional defense-in-depth; not externally verifiable without the tenant secret
- The external verifier warns (does not fail) when tenantTag is present but cannot be verified

## Evidence integrity

All exported evidence packs include:
- Schema version identifier
- Canonical serializer output (deterministic, sorted keys)
- SHA-256 hash chain for ledger blocks
- Verification script for auditor replay
