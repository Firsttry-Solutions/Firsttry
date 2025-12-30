# Privacy Policy (Repository-hosted copy)

This file documents the app-level privacy statements required for Marketplace review. It is evidence-backed and aligned with `DATA_RETENTION.md`.

Key docs: [README.md](README.md), [DATA_RETENTION.md](DATA_RETENTION.md), [EXTERNAL_APIS.md](EXTERNAL_APIS.md), [SUPPORT.md](SUPPORT.md)

## Data categories collected
- Jira metadata events: issue created/updated timestamps, project IDs and keys, issue type metadata, status metadata, field definitions (no field values).
- Aggregated metrics: daily event counts, weekly summaries, project coverage statistics.
- Generated reports: Phase 5 Proof-of-Life reports, Phase 6 snapshot evidence ledgers, Phase 7 drift detection results.
- Operational data: pipeline run ledgers, scheduler state, readiness gate flags.

## Purpose of processing
- Provide governance evidence, compute drift signals, surface readiness metrics, and enable exportable audit reports.

## Where data is stored
- All app data is stored in the Atlassian Forge Storage API (tenant-scoped). See `DATA_RETENTION.md` for details.

## Retention summary
- Default retention: Data is retained indefinitely until explicit deletion, as documented in `DATA_RETENTION.md`.
- Exceptions: Run ledgers and scheduler state retention are implementation-dependent and flagged as UNKNOWN in `DATA_RETENTION.md`.

## Sharing
- No external third-party APIs are used for processing or sharing customer data. App network activity is limited to Atlassian platform APIs and same-origin admin UI calls (see `EXTERNAL_APIS.md`).

## Rights and controls
- Customers may export data via the admin UI (JSON/PDF). Deletion of Forge Storage following uninstall requires contacting Atlassian support; app-level tenant purge is not implemented (see `DATA_RETENTION.md`).

## Contact
- Support and privacy enquiries: see `SUPPORT.md` (Support contact subsection).

## No certifications claimed
- This app does NOT claim SOC2, ISO 27001, Cloud Fortified, or any Atlassian certification. See `SECURITY.md`.
