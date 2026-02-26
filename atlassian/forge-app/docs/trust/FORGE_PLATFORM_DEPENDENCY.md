# Forge Platform Dependency

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual (Interim updates within 30 days of Atlassian publishing material change notices relevant to Forge hosting, security, or subprocessors)
**Doc ID**: FT-TRUST-012  

---

## Forge Dependency Statement

FirstTry is not an independently hosted application. It is entirely dependent on Atlassian Forge as its hosting platform.

**No independent infrastructure exists**. The application:
- Runs within Atlassian's Forge runtime (managed Node.js environment)
- Accesses Jira Cloud exclusively via Atlassian's OAuth2-protected requestJira() API
- Persists data using Atlassian's Forge Storage service (Atlassian-managed database)
- Does not operate its own servers, databases, or network infrastructure

**Consequence**: ALL infrastructure, compliance, availability, and security guarantees are contingent on Atlassian Forge SLA and terms of service.

---

## Forge CLI Version and Runtime Record

**Evidence generation context**:
- Forge CLI version used for deployment and testing: *See evidence bundle git history*
- Runtime: Atlassian Forge managed Node.js runtime
- Deployment: Automated via forge deploy (Atlassian-hosted CI pipeline)

**Note**: Runtime version is controlled by Atlassian; patch and minor version updates are deployed transparently by Atlassian without explicit end-user control.

---

## Encryption In Transit and At Rest

### In Transit
- **Protocol**: TLS 1.3 (Atlassian Forge default)
- **Enforcement**: Forge platform enforces TLS for all API calls to Jira
- **Certificate validation**: Delegated to Forge runtime
- **Reference**: Atlassian security documentation (link to be pinned: `https://www.atlassian.com/trust/security`)

### At Rest
- **Forge Storage encryption**: AES-256 (Atlassian platform-provided)
- **Encryption key management**: Atlassian-managed; keys not exposed to application
- **Caveat**: Application assumes Atlassian encryption; no independent verification performed
- **Reference**: Atlassian Forge Storage documentation (link to be pinned: `https://developer.atlassian.com/cloud/forge/manifest-reference/storage/`)

---

## Data Residency

**Residency statement (EXACT)**:
> Processing follows the customer's Atlassian site region configuration; the app does not override residency.

**Detail**:
- Jira Cloud site is configured by the customer to a specific region (US, EU, APAC, etc.) during setup
- FirstTry app inherits this residency from Jira Cloud
- Forge Storage persistence is in the same region as the Jira Cloud site
- Application code does NOT implement region-selection logic; all data handling is region-agnostic

**Customer responsibility**: Selecting appropriate region during Atlassian Cloud account setup.

---

## Availability and SLA Dependency

**Guarantee by FirstTry**: None. 

**Dependency on Atlassian Forge SLA**:
- Forge API availability target: *See Atlassian Service Level Agreement (pinned URL: `https://www.atlassian.com/legal/service-level-agreement`)*
- If Forge is unavailable, FirstTry is unavailable
- If Jira Cloud is unavailable, FirstTry cannot access data

**Application responsibility**: Fail-closed design (errors are explicit; no hidden failures).

---

## Subprocessors and Third Parties

**FirstTry subprocessors**:
- Atlassian Forge platform (primary)
- Atlassian Jira Cloud (data source)

**Atlassian's subprocessors** (relevant to Forge):
- See public list at: *Pinned URL: `https://www.atlassian.com/legal/subprocessors`* (note: specific CDNs, logging aggregators, DDoS providers documented there)

**FirstTry caveat**: We do not independently control or validate Atlassian's subprocessor list. Changes to Atlassian's subprocessors are outside our change management process.

---

## Update Triggers

FirstTry documentation and evidence are updated under the following triggers:

### Standard Review (Annual)
- Once per calendar year, review this document for accuracy against Atlassian's published terms.

### Material Change Interim Trigger
- Within 30 days of Atlassian publishing a material change notice relevant to:
  - Forge hosting, runtime, or infrastructure security
  - Forge Storage encryption or key management
  - Regional availability or data residency
  - Subprocessor additions/changes affecting Forge
  - OAuth2 API security or scope definitions

**Action**: Update this document and regenerate evidence bundle via `bash tools/generate_enterprise_evidence.sh`.

---

## Last Reviewed Date

**This document reviewed against Atlassian terms**: 2026-02-26

---

## References

- [Atlassian Trust Center](https://www.atlassian.com/trust/) (to be pinned)
- [Atlassian Forge Documentation](https://developer.atlassian.com/cloud/forge/) (to be pinned)
- [Atlassian Subprocessor List](https://www.atlassian.com/legal/subprocessors) (pinned)
- [Atlassian Service Level Agreement](https://www.atlassian.com/legal/service-level-agreement) (to be pinned)
