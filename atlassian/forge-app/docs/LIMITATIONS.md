# Known Limitations

This file lists product and documentation limitations that reviewers or users should be aware of.

- No tenant-level purge API: the app does not implement a per-tenant storage purge. See `UNINSTALL.md` and `DATA_RETENTION.md`.
- Indefinite retention by default: data is retained indefinitely until explicit deletion (see `DATA_RETENTION.md`).
- No app-level encryption management: encryption at rest and in transit are provided by Atlassian Forge platform; key management is not under app control. See `PLATFORM_DEPENDENCIES.md`.
- Export limitations: only the latest report is exportable via admin UI; historical report versioning is not implemented unless explicitly enabled (see `DATA_RETENTION.md`).
