# Release Integrity (Tags, Verification, and Evidence)

This project uses deterministic verification scripts and test markers to reduce drift and make releases reviewable.

## Tag immutability policy (vendor commitment)
- Release tags are intended to be immutable pointers to a specific commit.
- Going forward, we do not move existing release tags. If a fix is required, we publish a new patch tag.

## How verification is produced
- Tests are executed via `npm test` under `atlassian/forge-app/`.
- Required proof markers are emitted in test logs (e.g., `[FT_*]` markers).
- Guards are executed via `scripts/proof/verify_deterministic_build.sh`.

## Evidence location
- Verification logs are stored under `/tmp/` during local runs.
- CI runs execute the same guards to prevent regressions.

## No certification claims
This document does not assert SOC 2, ISO 27001, or third-party pentest certification.
