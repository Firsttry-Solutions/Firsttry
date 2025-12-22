# FirstTry Compliance Statement

**Version**: 1.0  
**Last Updated**: 2025-12-22

---

## What FirstTry IS (Factual Statements)

✅ **Atlassian Forge App** — Runs on Atlassian's managed platform (Jira Cloud)  
✅ **HTTPS Encrypted** — All data in transit over TLS 1.2+  
✅ **Workspace-Isolated** — Each Jira workspace's data is structurally isolated  
✅ **Read-Only** — Cannot modify Jira data; analysis-only  
✅ **Zero User Tracking** — No analytics, no user behavior profiling  
✅ **Actively Maintained** — Security patches applied within 1-2 weeks  
✅ **Open Security** — Welcomes security researcher disclosure  

---

## What FirstTry is NOT (Important Disclaimers)

❌ **NOT SOC 2 Certified** — No formal SOC 2 audit completed  
❌ **NOT HIPAA Compliant** — Not designed for healthcare data  
❌ **NOT PCI DSS Compliant** — No payment card data handling  
❌ **NOT FedRAMP Authorized** — Not approved for US government  
❌ **NOT FIPS 140-2 Validated** — Not a cryptographic module  
❌ **NOT ISO 27001 Certified** — No ISO certification pursuit yet  
❌ **NOT Cloud Fortified** — Not enrolled in Atlassian's hardening program  

---

## Data Residency & Handling

### Data Location

- **Where**: Atlassian Forge Storage (same region as your Jira Cloud tenant)
- **Who Controls**: Atlassian (FirstTry accesses via Forge APIs)
- **Encryption**: Atlassian-managed (AES-256 or equivalent)

### Data Retention

- **Authoritative source**: See [DATA_RETENTION.md](DATA_RETENTION.md) for official retention policy
- **Default behavior**: Data is retained indefinitely by FirstTry; no automatic TTL-based deletion
- **On uninstall**: Atlassian Forge handles data deletion (FirstTry does not control this)
- **Residency**: Determined by Jira Cloud region, not FirstTry

See [docs/DATA_RETENTION.md](DATA_RETENTION.md) for details.

### Data Processor Model

**Customers remain the data controllers of their Jira data.**

FirstTry operates as a **processor within Atlassian Forge** and processes data solely under the customer's Atlassian agreement. FirstTry does not:
- ❌ Determine purpose of data processing (customer controls)
- ❌ Set retention policies (customer controls via Atlassian)
- ❌ Sell or share data (no data processors beyond Atlassian)
- ❌ Process personal data on behalf of customers

**Data Processing Addendum (DPA)**

FirstTry does NOT currently offer a standalone Data Processing Addendum (DPA). Customers rely on Atlassian's Forge platform terms for data processing assurances. 

**If you require a DPA**: Contact security@atlassian.com to discuss data processing terms with Atlassian.

---

## Compliance Roadmap (Not Commitments)

| Certification | Status | Target Timeline |
|--------------|--------|-----------------|
| **SOC 2 Type II** | Not started | 2026+ (if demand justifies) |
| **ISO 27001** | Not started | 2026+ (if demand justifies) |
| **Cloud Fortified** | Not started | Evaluate 2026 |
| **FedRAMP** | Not planned | Escalate to Atlassian if needed |

---

## Regulatory Assessments

### GDPR (EU General Data Protection Regulation)

**Status**: Data Protection Dependent on Atlassian Forge Terms

- ✅ Data is isolated by workspace (Atlassian-controlled)
- ✅ Data uninstall access revoked (Atlassian-controlled)
- ✅ No personal data is collected/stored by FirstTry
- ❌ No standalone DPA offered (rely on Atlassian terms)
- ❌ No FirstTry-specific data subject rights mechanism

**Recommendation**: EU customers must review Atlassian's Forge DPA and data processing terms. FirstTry cannot independently guarantee GDPR compliance.

### CCPA (California Consumer Privacy Act)

**Status**: Likely Compliant (no personal data collected)

- ✅ FirstTry does not collect "personal information" (no email, ID)
- ✅ No data sale or sharing
- ✅ Users can request deletion (uninstall app)

### HIPAA (Health Insurance Portability & Accountability)

**Status**: Not Compliant (no healthcare design)

FirstTry is NOT suitable for handling:
- ❌ Patient health records
- ❌ PHI (Protected Health Information)
- ❌ HIPAA-covered information

If your Jira instance contains healthcare data, FirstTry must be reviewed by your HIPAA compliance team before use.

### PCI DSS (Payment Card Industry)

**Status**: Not Applicable (no payment card data)

FirstTry does not process payment cards.

---

## Security Practices

- ✅ Code reviewed before merge
- ✅ Static analysis + ESLint enforced
- ✅ Dependency scanning (npm audit)
- ✅ CI/CD gating
- ✅ Log redaction enforced (no PII)
- ✅ Vulnerability disclosure process in place

---

## Audit & Verification

- **Shakedown Report**: See [audit/CLAIMS_PROOF_CATALOG.md](../audit/CLAIMS_PROOF_CATALOG.md)
- **Test Coverage**: See [tests/](../atlassian/forge-app/tests/) for security tests
- **Determinism Proof**: 10+ identical runs verified

---

## Risk Assessment: Compliance Gaps

| Gap | Risk | Mitigation | Owner |
|-----|------|-----------|-------|
| **No SOC 2** | Enterprise procurement may require | Contact Atlassian for SOC 2 inquiry | Atlassian |
| **No HIPAA** | Healthcare orgs can't use | Educate market; mark HIPAA-unsuitable | FirstTry |
| **No FedRAMP** | US government can't use | Unlikely to pursue (niche) | FirstTry + Atlassian |
| **No DPA** | GDPR compliance unclear | Rely on Atlassian's DPA terms; contact security@atlassian.com | Atlassian |

---

## Reporting Compliance Issues

If you discover compliance gaps or security issues:

1. **Email**: security@atlassian.com
2. **Include**: Specific concern, regulatory reference, risk assessment
3. **Timeline**: 3-5 business day triage

---

## Compliance Contact

**For compliance questions or assessments**:
- **Email**: security@atlassian.com
- **Subject**: "FirstTry Compliance Question"
- **Response Target**: 5 business days

---

**Compliance Statement**: 1.0  
**Last Review**: 2025-12-22  
**Next Review**: Q2 2026 or upon regulatory change
