# FirstTry — Documentation Index

Key docs: [PRIVACY.md](PRIVACY.md), [TERMS.md](TERMS.md), [SECURITY.md](SECURITY.md), [SUPPORT.md](SUPPORT.md), [DATA_RETENTION.md](DATA_RETENTION.md), [EXTERNAL_APIS.md](EXTERNAL_APIS.md), [SCOPES_JUSTIFICATION.md](SCOPES_JUSTIFICATION.md), [EXPORT_FORMAT.md](EXPORT_FORMAT.md), [EVIDENCE_INTEGRITY.md](EVIDENCE_INTEGRITY.md), [UNINSTALL.md](UNINSTALL.md)

What it does (factual)
- Collects Jira metadata and generates governance evidence, drift signals, and exportable reports. Data storage is tenant-scoped Forge Storage.

Where to view reports / outputs
- No admin UI is provided. All governance metrics are captured automatically via scheduled triggers. Reports are stored in tenant-scoped Forge Storage.

What runs automatically vs manual
- Scheduled functions defined in `manifest.yml` run automatically at the declared intervals (daily, weekly, fiveMinute, 12hours for token-refresh). See `manifest.yml` scheduledTrigger section.
- No manual actions are required.

Quickstart install steps (developer-facing)
1. Deploy or install the Forge app to your Jira Cloud site using the Forge CLI or Marketplace install flow.
2. Verify the app appears under Jira admin pages as "FirstTry Proof-of-Life Report".

Export steps (end-user)
- From the admin UI, open the Proof-of-Life / Reports page and use the Export action to download JSON or PDF of the latest report. (See `EXPORT_FORMAT.md` for schema details.)

Uninstall steps (summary)
- Uninstall the app from Jira admin. Forge Storage is not removed automatically; see `UNINSTALL.md` and `DATA_RETENTION.md` for deletion procedures.

Links
- Full documentation index: start from this file and follow links above.
