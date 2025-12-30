# Data Flow (text diagram)

Inputs
- Jira Cloud REST API (via Forge `requestJira`): project list, issue type metadata, statuses, fields, search results (timestamps/ids).

Processing
- Scheduled ingestion pipelines parse Jira metadata, aggregate daily/weekly metrics, compute drift signals, and generate Phase-5/Phase-6 reports.
- Deterministic verification harness validates outputs and reduces nondeterministic results (see `EVIDENCE_INTEGRITY.md`).

Storage
- All generated artifacts (snapshots, reports, ledgers) are stored in Atlassian Forge Storage API — tenant-scoped. See `DATA_RETENTION.md`.

Outputs / Exports
- Admin UI report view (Phase-5 admin page) — user can export JSON or PDF of the latest report. Exports are served as browser downloads (not stored externally). See `EXPORT_FORMAT.md` for schema.

External sharing
- None: no external third-party APIs are used. Only Atlassian platform APIs and same-origin app endpoints are invoked (see `EXTERNAL_APIS.md`).

Text diagram

Jira Cloud (requestJira) --> Scheduled ingest pipelines --> Aggregation/Drift compute --> Forge Storage (tenant-scoped) --> Admin UI (view/export)
