# Scopes Justification

Scopes listed below are copied exactly from the app manifest and must match `manifest.yml`.

Scopes (manifest):
- storage:app

Justification:
- `storage:app`: Required to persist generated snapshots, proof-of-life reports, drift ledgers, pipeline run ledgers, and other governance artifacts within tenant-scoped Forge Storage. Storage is used solely for evidence generation and report retrieval; the app does not store full issue content or PII (see `DATA_RETENTION.md` and `PRIVACY.md`).

Minimality statement:
- The app requests only `storage:app` in `manifest.yml`. No additional scopes are requested. See `/workspaces/Firsttry/atlassian/forge-app/manifest.yml` permissions block.
