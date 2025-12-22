# FirstTry Documentation Truth Hierarchy

**Version**: 1.0  
**Last Updated**: 2025-12-22  
**Purpose**: Define single source of truth for each claim category to prevent contradictions and drift.

---

## Executive Summary

This document establishes a **truth hierarchy** that determines which source is authoritative for each claim type:

| Claim Category | Authoritative Source | Verification | CI Gate |
|---|---|---|---|
| **Scope & Modules** | `manifest.yml` | Tests scan manifest for declared scopes | ✅ `policy-gates.yml` |
| **Data Retention** | `docs/DATA_RETENTION.md` | All retention claims must reference this doc | ✅ `retention_consistency.test.ts` |
| **DPA Stance** | `docs/COMPLIANCE.md` (section: "Data Processing Addendum") | Must be single stance: "NOT offered" | ✅ `dpa_language_consistency.test.ts` |
| **Data Controller/Processor Role** | `docs/COMPLIANCE.md` (section: "Data Processor Model") + `docs/PRIVACY.md` | Must state "customers are controllers" | ✅ `controller_processor_consistency.test.ts` |
| **Platform Dependencies** | `docs/PLATFORM_DEPENDENCIES.md` | All platform-controlled behaviors must be disclaimed | ✅ `platform_dependency_disclosure.test.ts` |
| **Data Inventory** | `docs/DATA_INVENTORY.md` + `src/storage.ts` scans | Every data type must have: what, where, retention, PII check | ✅ `docs_data_inventory_consistency.test.ts` |
| **Egress & External APIs** | `manifest.yml` (remoteBaseUrl only) | Must match: no undeclared network calls | ✅ `docs_egress_consistency.test.ts` |
| **Certifications & Guarantees** | Only what code proves or Atlassian provides | No invented SOC 2 / ISO / FedRAMP claims | ✅ `docs_no_false_certification_claims.test.ts` |
| **Sensitive Data Handling** | `src/** static scans` for PII logging | No email/user ID/password in logs or console | ✅ `docs_pii_logging_enforcement.test.ts` (if triggered) |
| **Contact Information** | Only real, verified email addresses | No placeholder emails (support@example.com) | ✅ `docs_no_placeholders_or_fake_contacts.test.ts` |
| **Compliance Gaps** | `audit/CLAIMS_PROOF_CATALOG.md` | Claims marked UNKNOWN if gap exists | ✅ `docs_claims_proof_catalog_consistency.test.ts` |

---

## 1. Scope & Module Truth

**Authoritative Source**: `atlassian/forge-app/manifest.yml`

### What It Declares

```yaml
modules:
  - key: firstry-key
    request:
      - url: https://jira.atlassian.net/rest/api/3/**  # Jira Cloud API
      - url: https://your-organization.atlassian.net/** # Same-workspace only
```

### CI Gate Logic

Tests must verify:
1. ✅ All scopes declared in manifest exist in code
2. ✅ All data types accessed are declared in scope
3. ✅ No undeclared network calls in src/**
4. ❌ FAIL if: Code makes API calls outside declared scope

### Verification Command

```bash
npm run test:docs -- tests/docs/docs_manifest_scope_consistency.test.ts
```

---

## 2. Data Retention Truth

**Authoritative Source**: `docs/DATA_RETENTION.md` (Sections: Executive Summary, Platform-Controlled Behaviors)

### The Single Statement

> "Data is retained indefinitely within Atlassian Forge storage until tenant uninstall or Atlassian-controlled lifecycle deletion. FirstTry does not currently enforce time-based TTL deletion."

### What It Forbids (CI Will Fail)

❌ Retention claims in other docs that conflict:
- "Data auto-deleted after 90 days" (contradicts indefinite)
- "TTL enforcement by FirstTry" (contradicts "does not enforce")
- "90-day retention guarantee" (contradicts indefinite)

### What It Permits (CI Will Pass)

✅ Statements that reinforce:
- "See DATA_RETENTION.md for retention policy"
- "FirstTry retains data indefinitely"
- "Uninstall triggers Atlassian-controlled deletion"
- "FirstTry has no TTL enforcement"

### Verification Command

```bash
npm run test:docs -- tests/docs/retention_consistency.test.ts
```

### Evidence

| Evidence Type | Location |
|---|---|
| **Code TTL constants** (placeholders, not enforced) | `src/storage.ts` |
| **Indefinite retention policy** | `docs/DATA_RETENTION.md#executive-summary` |
| **Platform control disclaimer** | `docs/DATA_RETENTION.md#2-platform-controlled-behaviors` |
| **CLAIMS_PROOF_CATALOG mapping** | `audit/CLAIMS_PROOF_CATALOG.md#RET-001` |

---

## 3. DPA Stance Truth

**Authoritative Source**: `docs/COMPLIANCE.md` (Section: "Data Processing Addendum")

### The Single Statement

> "FirstTry does NOT currently offer a standalone Data Processing Addendum (DPA). Customers rely on Atlassian's Forge platform terms for data processing assurances."

### What It Forbids (CI Will Fail)

❌ Mixed stances in the same or different docs:
- "DPA available on request" ← Contradicts "NOT offered"
- "Contact us for DPA" ← Implies DPA exists
- "DPA available; legal review recommended" ← False hope

### What It Permits (CI Will Pass)

✅ Statements that reinforce:
- "See Atlassian terms for DPA"
- "Contact security@atlassian.com for DPA needs"
- "FirstTry does not provide DPA"
- "Rely on Forge DPA"

### Verification Command

```bash
npm run test:docs -- tests/docs/dpa_language_consistency.test.ts
```

### Evidence

| Evidence Type | Location |
|---|---|
| **Single DPA stance** | `docs/COMPLIANCE.md#data-processing-addendum` |
| **No "on request" language** | Forbidden across all docs |
| **Atlassian contact info** | `docs/COMPLIANCE.md` references security@atlassian.com |
| **CLAIMS_PROOF_CATALOG mapping** | `audit/CLAIMS_PROOF_CATALOG.md#COMP-005` |

---

## 4. Controller/Processor Role Truth

**Authoritative Source**: `docs/COMPLIANCE.md` (Section: "Data Processor Model") + `docs/PRIVACY.md` (Section: "Data Control Model")

### The Single Statement

> "Customers remain the data controllers of their Jira data. FirstTry processes data solely within Atlassian Forge under the customer's Atlassian agreement."

### What It Forbids (CI Will Fail)

❌ Absolute processor claims without qualification:
- "FirstTry is a data processor" ← Too absolute; must say "within Forge"
- "FirstTry determines data purpose" ← Only customer determines
- "FirstTry controls retention" ← Only Atlassian controls
- "FirstTry owns encryption keys" ← Atlassian controls

### What It Permits (CI Will Pass)

✅ Qualified statements:
- "FirstTry operates as a processor within Atlassian Forge"
- "Customers determine purpose; FirstTry processes under that purpose"
- "FirstTry processes data under customer's Atlassian agreement"

### Verification Command

```bash
npm run test:docs -- tests/docs/controller_processor_consistency.test.ts
```

### Evidence

| Evidence Type | Location |
|---|---|
| **Customer controller role** | `docs/COMPLIANCE.md#data-processor-model` |
| **Qualified processor language** | `docs/COMPLIANCE.md` states "processor within Atlassian Forge" |
| **Atlassian agreement dependency** | `docs/PRIVACY.md#data-control-model` |
| **CLAIMS_PROOF_CATALOG mapping** | `audit/CLAIMS_PROOF_CATALOG.md#COMP-006` |

---

## 5. Platform Dependencies Truth

**Authoritative Source**: `docs/PLATFORM_DEPENDENCIES.md` + `docs/DATA_RETENTION.md` (Platform-Controlled Behaviors)

### The Key Disclaimer

> "These behaviors are governed by Atlassian Forge and Jira Cloud platform guarantees and are not independently controlled or overridden by FirstTry."

### What Must Be Disclaimed (CI Will Fail If Missing)

| Behavior | Why FirstTry Can't Control | Where Disclosed |
|---|---|---|
| **Uninstall deletion** | Atlassian Forge auto-purges | `docs/DATA_RETENTION.md#21-data-deletion-on-uninstall` |
| **Data residency** | Jira Cloud region locks location | `docs/DATA_RETENTION.md#22-data-residency` |
| **Backup & recovery** | Atlassian manages backups | `docs/DATA_RETENTION.md#23-data-backup--recovery` |
| **Encryption keys** | Atlassian holds keys | `docs/SECURITY.md#21-data-at-rest` |
| **Storage quota** | Atlassian Forge plan limits | `docs/DATA_RETENTION.md#24-storage-quotas--limits` |

### What It Forbids (CI Will Fail)

❌ Implicit FirstTry responsibility:
- "FirstTry deletes your data on uninstall" ← Must say "Atlassian does"
- "FirstTry determines residency" ← Must say "Jira region does"
- "FirstTry can recover lost data" ← Must say "Contact Atlassian"

### Verification Command

```bash
npm run test:docs -- tests/docs/platform_dependency_disclosure.test.ts
```

---

## 6. Data Inventory Truth

**Authoritative Source**: `docs/DATA_INVENTORY.md` + code scans of `src/storage.ts`

### Truth Requirements

Every data type stored must have:

| Requirement | Example | Location |
|---|---|---|
| **What is stored** | "Issue snapshots (keys, status)" | `docs/DATA_INVENTORY.md` section 3 |
| **Where it's stored** | "Forge KV storage, workspace-scoped" | `docs/DATA_INVENTORY.md` storage table |
| **Retention period** | "Indefinite until uninstall" | `docs/DATA_RETENTION.md` |
| **PII check** | "No: email/user ID/password" | `docs/DATA_INVENTORY.md` section 9 |
| **Code evidence** | `StorageManager.write()` in `src/storage.ts` | Tests scan src/** |

### What It Forbids (CI Will Fail)

❌ Undocumented data:
- Code stores data type X, but `docs/DATA_INVENTORY.md` doesn't list it
- Claims to store Y, but code doesn't actually store it
- PII "not stored" claim, but log redaction code is missing

### Verification Command

```bash
npm run test:docs -- tests/docs/docs_data_inventory_consistency.test.ts
```

---

## 7. Egress & External APIs Truth

**Authoritative Source**: `manifest.yml` + code scans

### Truth Requirements

Every external call must:

| Requirement | Example | Location |
|---|---|---|
| **Declared in manifest** | `request: - url: https://jira.atlassian.net/**` | `manifest.yml` |
| **Code matches manifest** | Code only calls Jira API, no other services | `src/**` scans |
| **No undeclared calls** | No AWS / Stripe / Segment / etc | Tests verify whitelist only |

### What It Forbids (CI Will Fail)

❌ Undeclared egress:
- Code calls external API not in manifest
- Manifest declares scope A, but code uses scope B
- Network call to service not listed in egress rules

### Verification Command

```bash
npm run test:docs -- tests/docs/docs_egress_consistency.test.ts
```

---

## 8. Certifications & Guarantees Truth

**Authoritative Source**: Only what code/infrastructure proves OR Atlassian provides

### Truth Rules

| Claim | Can FirstTry Claim? | Evidence Required | Location |
|---|---|---|---|
| "Encrypt data at rest" | ❌ **NO** (Atlassian does) | Can only say: "Atlassian encrypts" | `docs/SECURITY.md` |
| "Backup your data" | ❌ **NO** (Atlassian does) | Can only say: "Atlassian backs up" | `docs/DATA_RETENTION.md` |
| "SOC 2 certified" | ❌ **NO** (Atlassian is) | Can only say: "Runs on Atlassian's SOC 2 infra" | `docs/COMPLIANCE.md` |
| "GDPR compliant" | ⚠️ **PARTIAL** (depends on customer use) | Must explain dependencies | `docs/COMPLIANCE.md#gdpr` |
| "No PII logged" | ✅ **YES** | Code scan must prove no email/ID in logs | `src/**` scans + tests |
| "Read-only to Jira" | ✅ **YES** | Code inspection proves no writes | `src/**` scans |

### What It Forbids (CI Will Fail)

❌ Invented certifications:
- "SOC 2 certified by FirstTry"
- "ISO 27001 compliant"
- "Cloud Fortified"
- "Military-grade encryption by FirstTry"

### Verification Command

```bash
npm run test:docs -- tests/docs/docs_no_false_certification_claims.test.ts
```

---

## 9. Sensitive Data Handling Truth

**Authoritative Source**: `src/**` static code scans + test evidence

### What Must Be Proven (Not Claimed)

| Claim | Proof Required | Location |
|---|---|---|
| "No email addresses logged" | Code scan shows no `user.email` in logs | `src/**` + `tests/p1_logging_safety.test.ts` |
| "No user IDs logged" | Code scan shows no `user.id` in logs | `src/**` + tests |
| "No passwords logged" | Code scan shows no `password` in logs | `src/**` + tests |
| "No API tokens logged" | Code scan shows no `token` in logs | `src/**` + tests |
| "No Jira credentials" | Code scan + manifest shows read-only scope | `manifest.yml` + code scans |

### Auto-Verification

If any PII logging is detected by static scan:
- ✅ Tests automatically fail
- ✅ CI blocks merge
- ✅ Forces code fix before docs can claim "no PII logging"

### Verification Command

```bash
npm run test:docs -- tests/docs/docs_no_forbidden_setup_language.test.ts  # Tests forbidden phrases
npm run test:docs -- tests/docs/docs_pii_logging_enforcement.test.ts       # If triggered by static scan
```

---

## 10. Contact Information Truth

**Authoritative Source**: Only real, verified email addresses

### What's Allowed

✅ Real email addresses:
- `security@atlassian.com` (Atlassian's official security contact)
- `support@atlassian.com` (Atlassian support)
- Any verified company/product email

### What's Forbidden (CI Will Fail)

❌ Placeholder emails:
- `support@example.com`
- `hello@firstry.io` (if not verified to exist)
- `contact@company.com` (if generic/unverified)
- Any email not confirmed to receive and respond to mail

### Verification Command

```bash
npm run test:docs -- tests/docs/docs_no_placeholders_or_fake_contacts.test.ts
```

---

## 11. Compliance Claims Truth

**Authoritative Source**: `audit/CLAIMS_PROOF_CATALOG.md`

### Single Claim Status Format

Every claim must have exactly ONE status:

| Status | Meaning | Example |
|---|---|---|
| **VERIFIED** | Claim + Evidence both exist, no dependencies | "FirstTry retains data indefinitely" + docs prove it |
| **VERIFIED_WITH_DEPENDENCY** | Claim exists but depends on Atlassian behavior | "Data deleted on uninstall" (Atlassian controls) |
| **PARTIAL** | Claim partially proven; gaps exist | "GDPR ready" (depends on customer implementation) |
| **UNKNOWN** | Claim not verified; blocked until resolved | "Enterprise support SLA" (no SLA defined) |
| ❌ **EXPIRED** | Claim was true; now invalidated | "90-day TTL enforced" (now indefinite retention) |

### CI Gate Logic

- ✅ PASS: All claims are VERIFIED or VERIFIED_WITH_DEPENDENCY
- ❌ FAIL: Any claim is PARTIAL or UNKNOWN without documented reason
- ❌ FAIL: Any claim is EXPIRED without change log entry

### Verification Command

```bash
npm run test:docs -- tests/docs/docs_claims_proof_catalog_consistency.test.ts
```

---

## 12. Truth Hierarchy Resolution (If Sources Conflict)

If two sources disagree, follow this order:

1. **Code (src/**)** is truth for what actually happens
2. **manifest.yml** is truth for what scope is declared
3. **Shakedown tests** are truth for determinism
4. **docs/** must match code, not vice versa
5. **Audit files** must acknowledge conflicts or mark UNKNOWN

### Example Conflict

| Source | Claims | Resolution |
|---|---|---|
| Code | Retains data indefinitely | **✅ Authoritative** |
| docs/COMPLIANCE.md | 90-day retention | ❌ Wrong; must be updated |
| docs/SECURITY.md | 30-day TTL | ❌ Wrong; must be updated |

**Resolution**: Code is truth. Update all docs to say "indefinite."

---

## 13. CI Test Coverage (All Required to Pass)

| Test File | Purpose | Truth Source | CI Gate |
|---|---|---|---|
| `docs_required_files_sections.test.ts` | All mandatory docs exist | This file + manifest | ✅ Policy gates |
| `docs_no_contradictions.test.ts` | No docs contradict each other | manifest.yml | ✅ Policy gates |
| `docs_claims_proof_catalog_consistency.test.ts` | All claims mapped & verified | Catalog + code | ✅ Policy gates |
| `docs_manifest_scope_consistency.test.ts` | Docs match manifest scope | manifest.yml | ✅ Policy gates |
| `docs_egress_consistency.test.ts` | No undeclared external calls | manifest.yml + src/** | ✅ Policy gates |
| `retention_consistency.test.ts` | DATA_RETENTION.md is single truth | docs/DATA_RETENTION.md | ✅ Policy gates |
| `dpa_language_consistency.test.ts` | DPA stance is single & unambiguous | docs/COMPLIANCE.md | ✅ Policy gates |
| `controller_processor_consistency.test.ts` | Controller/processor qualified | docs/COMPLIANCE.md + PRIVACY.md | ✅ Policy gates |
| `platform_dependency_disclosure.test.ts` | Platform behaviors disclaimed | docs/PLATFORM_DEPENDENCIES.md | ✅ Policy gates |
| `docs_no_forbidden_setup_language.test.ts` | No setup/config language | Forbidden phrases list | ✅ Policy gates |
| `docs_no_false_certification_claims.test.ts` | No invented certifications | Code + Atlassian only | ✅ Policy gates |
| `docs_data_inventory_consistency.test.ts` | Inventory matches code scans | docs/DATA_INVENTORY.md + src/** | ✅ Policy gates |
| `docs_no_placeholders_or_fake_contacts.test.ts` | Only real contact info | Verified emails only | ✅ Policy gates |

### Run All Tests

```bash
cd atlassian/forge-app
npm run test:docs
```

---

## 14. Change Log

| Date | Change |
|---|---|
| 2025-12-22 | v1.0 - Initial release: Established truth hierarchy for all FirstTry claims |

---

## Related Documents

- [CLAIMS_PROOF_CATALOG.md](CLAIMS_PROOF_CATALOG.md) — All claims mapped to evidence
- [RESIDUAL_RISKS.md](RESIDUAL_RISKS.md) — What remains unknown
- [CREDIBILITY_HARDENING_REPORT.md](CREDIBILITY_HARDENING_REPORT.md) — Summary of all fixes
- [PLATFORM_DEPENDENCIES.md](../docs/PLATFORM_DEPENDENCIES.md) — What FirstTry depends on
