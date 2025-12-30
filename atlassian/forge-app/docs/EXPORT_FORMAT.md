# Export Format and Schema

Schema versioning
- `export_schema_version`: v1
- Stability policy: schema v1 is the initial export schema. Breaking changes will increment the major version and be documented in `CHANGELOG.md`.

Metadata fields (example)
- `schema_version`: string (e.g. "v1")
- `generated_at`: ISO-8601 timestamp
- `tenant_cloudId`: string
- `report_type`: string (e.g. "phase5_proof_of_life")
- `report_id`: string
- `summary`: object

JSON export characteristics
- Exports include the latest generated report and summary metadata. Exports are served as browser downloads and are not sent to third parties by default.

PDF export characteristics
- PDF export is a rendering of the JSON report for human consumption; PDF generation may omit certain raw fields for readability.

Versioning and compatibility
- Consumers should check `schema_version` in the export. Backward compatibility guarantees will be documented in `CHANGELOG.md` when schema changes occur.
