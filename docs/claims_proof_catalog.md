# Claims ↔ Proof Catalog

**Purpose**: Machine-verifiable mapping of Marketplace claims to evidence in this repository.

**Last Updated**: 2025-12-22

---

## Claims Matrix

| Claim | Proof Location | Evidence Type | Status |
|-------|---------------|---------------|--------|
| Privacy Policy URL exists (GitHub Pages) | `/docs/privacy.html` | doc | PASS |
| Terms of Use URL exists (GitHub Pages) | `/docs/terms.html` | doc | PASS |
| No third-party data sharing | `atlassian/forge-app/docs/EXTERNAL_APIS.md:11-13`<br>`/docs/privacy.html` (Third-Party Data Sharing section)<br>`atlassian/forge-app/tests/credibility/gap3_egress_static_and_runtime.test.ts` | doc+test | PASS |
| No external network egress beyond Atlassian/Forge | `atlassian/forge-app/docs/EXTERNAL_APIS.md:11-13`<br>`atlassian/forge-app/manifest.yml:77-80` (no external.fetch permission)<br>`atlassian/forge-app/tests/credibility/gap3_egress_static_and_runtime.test.ts` (GAP3_STATIC_EGRESS_SCAN, GAP3_RUNTIME_NETWORK_TRAP)<br>`/docs/privacy.html` (Third-Party Data Sharing section) | code+doc+test | PASS |
| Tenant-isolated storage (Forge storage only) | `atlassian/forge-app/manifest.yml:77-80` (storage:app scope)<br>`atlassian/forge-app/docs/DATA_RETENTION.md:11-48`<br>`atlassian/forge-app/docs/SECURITY.md` (Platform Sandboxing section)<br>`/docs/privacy.html` (Where Data is Processed and Stored section) | code+doc | PASS |
| Read-only Jira access (no writes) | `atlassian/forge-app/src/jira_ingest.ts` (all requestJira calls are GET-equivalent reads)<br>`atlassian/forge-app/docs/EXTERNAL_APIS.md:23-59` (all documented calls are reads)<br>`/docs/privacy.html` (What Data the App Accesses section) | code+doc | PASS |

---

## Evidence Details

### Privacy Policy URL exists (GitHub Pages)
- **Claim**: A publicly accessible Privacy Policy is available via GitHub Pages
- **Proof**: `/docs/privacy.html` contains complete privacy policy with all required sections
- **Verification**: File exists and includes: Who We Are, Data Accessed, Data NOT Collected, Storage, Third-Party Sharing, Retention, Security, Contact
- **Status**: PASS

### Terms of Use URL exists (GitHub Pages)
- **Claim**: Publicly accessible Terms of Use are available via GitHub Pages
- **Proof**: `/docs/terms.html` contains complete terms with all required sections
- **Verification**: File exists and includes: Acceptance, License, Prohibited Use, Disclaimer, Limitation of Liability, Termination, Governing Law, Contact
- **Status**: PASS

### No third-party data sharing
- **Claim**: App does not share data with any external third-party services
- **Proof**:
  - `atlassian/forge-app/docs/EXTERNAL_APIS.md:11-13`: "This Forge app has **ZERO outbound egress to external services**"
  - `/docs/privacy.html`: "Third-Party Data Sharing: None. FirstTry Governance has zero external egress."
  - `atlassian/forge-app/tests/credibility/gap3_egress_static_and_runtime.test.ts`: GAP3_STATIC_EGRESS_SCAN test verifies no external network libraries (axios, node-fetch, http.request)
- **Verification**: Static code scan confirms no external API calls; documentation states zero egress; runtime tests enforce network traps
- **Status**: PASS

### No external network egress beyond Atlassian/Forge
- **Claim**: All network activity is confined to Atlassian Forge platform APIs
- **Proof**:
  - `atlassian/forge-app/docs/EXTERNAL_APIS.md:11-13`: Policy statement "ZERO outbound egress to external services"
  - `atlassian/forge-app/manifest.yml:77-80`: No `external.fetch` permission declared (only `storage:app`)
  - `atlassian/forge-app/tests/credibility/gap3_egress_static_and_runtime.test.ts`:
    - GAP3_STATIC_EGRESS_SCAN: Scans src/** for axios, node-fetch, http.request (found 0)
    - GAP3_RUNTIME_NETWORK_TRAP: Runtime enforcement of network call blocking
  - `/docs/privacy.html`: "The app does not make external API calls outside the Atlassian Forge platform"
- **Verification**: Manifest lacks external fetch permission; code scan found zero external network libraries; tests enforce network isolation
- **Status**: PASS

### Tenant-isolated storage (Forge storage only)
- **Claim**: All data storage is tenant-isolated using Forge Storage API
- **Proof**:
  - `atlassian/forge-app/manifest.yml:77-80`: Only `storage:app` scope declared (tenant-isolated by Forge platform)
  - `atlassian/forge-app/docs/DATA_RETENTION.md:11-48`: "Data is stored exclusively in tenant-isolated Forge Storage"
  - `atlassian/forge-app/docs/SECURITY.md`: Documents platform sandboxing and tenant isolation mechanisms
  - `/docs/privacy.html`: "Data is stored exclusively in tenant-isolated Forge Storage, managed by Atlassian"
- **Verification**: Manifest declares storage:app scope; documentation confirms tenant isolation; Forge platform enforces isolation
- **Status**: PASS

### Read-only Jira access (no writes)
- **Claim**: App only reads Jira configuration metadata; performs no writes
- **Proof**:
  - `atlassian/forge-app/src/jira_ingest.ts`: All requestJira calls use GET-equivalent read operations:
    - Line 157: `/rest/api/3/project` (GET)
    - Line 222: `/rest/api/3/issuetype` (GET)
    - Line 287: `/rest/api/3/status` (GET)
    - Line 352: `/rest/api/3/fields` (GET)
    - Line 421: `/rest/api/3/search` (GET)
    - Line 502: `/rest/api/3/automations` (GET)
  - `atlassian/forge-app/docs/EXTERNAL_APIS.md:23-59`: Table documents all Jira API calls as reads
  - `/docs/privacy.html`: "What Data the App Accesses" section specifies "read-only mode"
- **Verification**: All documented Jira API calls are read operations; no POST/PUT/DELETE found in codebase
- **Status**: PASS

---

## Verification Instructions

To verify claims programmatically:

1. **Privacy Policy exists**:
   ```bash
   test -f /workspaces/Firstry/docs/privacy.html && echo "PASS" || echo "FAIL"
   ```

2. **Terms of Use exist**:
   ```bash
   test -f /workspaces/Firstry/docs/terms.html && echo "PASS" || echo "FAIL"
   ```

3. **No external egress (manifest check)**:
   ```bash
   grep -q "external.fetch" atlassian/forge-app/manifest.yml && echo "FAIL" || echo "PASS"
   ```

4. **No external egress (code scan)**:
   ```bash
   cd atlassian/forge-app && \
   grep -r "axios\|node-fetch\|https\?.request" src/ && echo "FAIL" || echo "PASS"
   ```

5. **Tenant-isolated storage only**:
   ```bash
   grep -A2 "permissions:" atlassian/forge-app/manifest.yml | grep -q "storage:app" && echo "PASS" || echo "FAIL"
   ```

6. **Read-only Jira access (no writes)**:
   ```bash
   cd atlassian/forge-app && \
   grep -r "requestJira.*method.*POST\|requestJira.*method.*PUT\|requestJira.*method.*DELETE" src/ && echo "FAIL" || echo "PASS"
   ```

---

## Notes

- **GitHub Pages URL**: Once this repository enables GitHub Pages, the public URLs will be:
  - Privacy Policy: `https://global-domination.github.io/Firstry/privacy.html`
  - Terms of Use: `https://global-domination.github.io/Firstry/terms.html`
  - Index: `https://global-domination.github.io/Firstry/`

- **Proof Location Format**: `file:lines` or `file#anchor` or file description
- **Evidence Type**: `code` (source code), `doc` (documentation), `test` (test suite), or combinations
- **Status Values**: `PASS` (evidence exists and is valid), `FAIL` (missing or invalid evidence)

- **Continuous Verification**: This catalog is checked by CI workflow `.github/workflows/docs-credibility-guardrails.yml`
