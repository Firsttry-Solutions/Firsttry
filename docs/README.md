# FirstTry Governance Documentation

Welcome to FirstTry Governance documentation. This directory contains comprehensive guides for users, enterprise reviewers, security teams, and developers.

---

## 🚀 Start Here

**New to FirstTry?** Start with the [ENTERPRISE_ONE_PAGER.md](ENTERPRISE_ONE_PAGER.md) (5-min overview) or [index.md](index.md) for a quick introduction.

---

## 📋 Documentation by Audience

### For End Users & Administrators

- **[ENTERPRISE_ONE_PAGER.md](ENTERPRISE_ONE_PAGER.md)** — High-level overview, key features, what's included/excluded
- **[SUPPORT_POLICY.md](SUPPORT_POLICY.md)** — How to get help, support scope, escalation paths
- **[ROADMAP.md](ROADMAP.md)** — Planned capabilities and known limitations

### For Enterprise Security & Procurement Teams

**Security & Compliance**:
- **[SECURITY.md](SECURITY.md)** — Security model, threat analysis, access control, encryption
- **[SECURITY_SUMMARY.md](SECURITY_SUMMARY.md)** — Executive summary for security reviews
- **[PRIVACY.md](PRIVACY.md)** — Data handling, retention, deletion, tenant isolation
- **[COMPLIANCE.md](COMPLIANCE.md)** — Certification status, regulatory compliance posture
- **[security/security-controls.md](security/security-controls.md)** — Detailed security controls matrix

**Data & Operations**:
- **[SCOPES.md](SCOPES.md)** — Atlassian Forge API scopes, permissions, what's accessed/not accessed
- **[DATA_INVENTORY.md](DATA_INVENTORY.md)** — Complete data flow diagram and inventory
- **[DATA_RETENTION.md](DATA_RETENTION.md)** — Data retention policies, purging, Forge platform dependencies
- **[INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md)** — Security incident response procedures

**Procurement & Business**:
- **[ROI_JUSTIFICATION.md](ROI_JUSTIFICATION.md)** — ROI framework and cost-benefit analysis
- **[PRICING_RATIONALE.md](PRICING_RATIONALE.md)** — Pricing model, tier justification
- **[PRICING_GUARANTEES.md](PRICING_GUARANTEES.md)** — What pricing tiers include/exclude
- **[ENTITLEMENTS.md](ENTITLEMENTS.md)** — Feature entitlements, tier mappings
- **[COMPLIANCE.md](COMPLIANCE.md)** — Certification status, regulatory compliance posture

### For Atlassian Marketplace Reviewers

**Required Reading**:
- **[MARKETPLACE_LEGAL_IMPLEMENTATION.md](MARKETPLACE_LEGAL_IMPLEMENTATION.md)** — Marketplace compliance checklist
- **[SCOPES.md](SCOPES.md)** — Scope justification and no-access assertions
- **[SUPPORT_POLICY.md](SUPPORT_POLICY.md)** — Support model and no-SLA disclaimer
- **[claims_proof_catalog.md](claims_proof_catalog.md)** — All marketplace claims with proof references

**Legal & Terms**:
- **[legal/terms-of-service.md](legal/terms-of-service.md)** — Terms of service
- **[legal/privacy-policy.md](legal/privacy-policy.md)** — GDPR, data processing, privacy terms
- **[legal/data-handling.md](legal/data-handling.md)** — Detailed data handling specification
- **[legal/service-level-agreement.md](legal/service-level-agreement.md)** — SLA and support timelines

**Technical Specification**:
- **[ATLASSIAN_DUAL_LAYER_SPEC.md](ATLASSIAN_DUAL_LAYER_SPEC.md)** — Complete technical specification
- **[CHANGE_MANAGEMENT.md](CHANGE_MANAGEMENT.md)** — Change documentation and version control

### For Developers & Contributors

**Architecture & Implementation**:
- **[ATLASSIAN_DUAL_LAYER_SPEC.md](ATLASSIAN_DUAL_LAYER_SPEC.md)** — Full technical architecture
- **[EXTERNAL_APIS.md](EXTERNAL_APIS.md)** — Jira API surface, endpoints, constraints
- **[ACCESS_CONTROL.md](ACCESS_CONTROL.md)** — Access control model, tenant isolation
- **[CANONICALIZATION_SPEC.md](CANONICALIZATION_SPEC.md)** — Deterministic output specification
- **[forge-app/AUDIT_USAGE_GUIDE.md](forge-app/AUDIT_USAGE_GUIDE.md)** — Forge app audit guide

**Metrics & Data Models**:
- **[PHASE_8_V2_SPEC.md](PHASE_8_V2_SPEC.md)** — Governance metrics specification (M1-M5)
- **[PHASE_9_V2_SPEC.md](PHASE_9_V2_SPEC.md)** — Evidence ledger and canonical data spec
- **[FEATURE_PHASE_TIER_MATRIX.md](FEATURE_PHASE_TIER_MATRIX.md)** — Feature matrix and tier definitions

---

## 📚 Additional Resources

### Governance Models & Concepts

- **[ENTERPRISE_READINESS.md](ENTERPRISE_READINESS.md)** — Enterprise readiness matrix
- **[ENTERPRISE_ACCEPTANCE.md](ENTERPRISE_ACCEPTANCE.md)** — Acceptance criteria for enterprise deployments
- **[SHAKEDOWN.md](SHAKEDOWN.md)** — Determinism and correctness verification

### Marketplace & Legal

- **[marketplace/screenshots-checklist.md](marketplace/screenshots-checklist.md)** — Screenshot submission guidelines

### Operations & Reference

- **[DOCS_INDEX.md](DOCS_INDEX.md)** — Comprehensive doc index (for navigation)
- **[claims_proof_catalog.md](claims_proof_catalog.md)** — All claims with evidence references
- **[CHANGE_MANAGEMENT.md](CHANGE_MANAGEMENT.md)** — How we manage changes and versioning
- **[SUPPORT.md](SUPPORT.md)** — Legacy support guide

---

## ✅ Document Status & Compliance

| Aspect | Status | Location |
|--------|--------|----------|
| **Security Review** | ✅ Reviewed | [SECURITY.md](SECURITY.md) |
| **Privacy Compliance** | ✅ Documented | [PRIVACY.md](PRIVACY.md) |
| **API Scope Justification** | ✅ Complete | [SCOPES.md](SCOPES.md) |
| **No False Claims** | ✅ Verified | [claims_proof_catalog.md](claims_proof_catalog.md) |
| **Marketplace Readiness** | ✅ Checked | [MARKETPLACE_LEGAL_IMPLEMENTATION.md](MARKETPLACE_LEGAL_IMPLEMENTATION.md) |
| **Data Handling** | ✅ Explicit | [legal/data-handling.md](legal/data-handling.md) |

---

## 🔍 How to Use This Documentation

### By Use Case

**"I'm a CIO/Security Lead evaluating FirstTry for our enterprise"**
1. Read [ENTERPRISE_ONE_PAGER.md](ENTERPRISE_ONE_PAGER.md)
2. Review [SECURITY_SUMMARY.md](SECURITY_SUMMARY.md)
3. Share [COMPLIANCE.md](COMPLIANCE.md) with your compliance team
4. Schedule a call via [SUPPORT_POLICY.md](SUPPORT_POLICY.md)

**"I'm a developer/DevOps engineer implementing FirstTry"**
1. Start with [index.md](index.md)
2. Study [ATLASSIAN_DUAL_LAYER_SPEC.md](ATLASSIAN_DUAL_LAYER_SPEC.md)
3. Review [CHANGE_MANAGEMENT.md](CHANGE_MANAGEMENT.md) for deployment updates
4. Consult [forge-app/AUDIT_USAGE_GUIDE.md](forge-app/AUDIT_USAGE_GUIDE.md) for Forge-specific questions

**"I'm a Marketplace reviewer checking compliance"**
1. Review [MARKETPLACE_LEGAL_IMPLEMENTATION.md](MARKETPLACE_LEGAL_IMPLEMENTATION.md)
2. Verify claims in [claims_proof_catalog.md](claims_proof_catalog.md)
3. Check scopes and permissions: [SCOPES.md](SCOPES.md)
4. Confirm support model: [SUPPORT_POLICY.md](SUPPORT_POLICY.md)

---

## 📝 Documentation Principles

All FirstTry documentation follows these principles:

1. **Explicit over Implicit** — We document what we do AND what we don't do
2. **Evidence-Backed Claims** — Every claim is anchored to code, tests, or Forge platform guarantees
3. **No False Promises** — We avoid terms like "guarantee," "always," "never" without absolute proof
4. **Reviewer-Ready** — Docs are structured for marketplace, security, and compliance reviews
5. **Tenant Isolation First** — We explicitly call out Forge platform boundaries vs. FirstTry scope

---

## 🔗 Quick Links

- **GitHub Repository**: [Firsttry-Solutions/Firsttry](https://github.com/Firsttry-Solutions/Firsttry)
- **LICENSE**: [First Try Source Available License 1.0](../LICENSE)
- **CONTRIBUTING**: [How to contribute](../CONTRIBUTING.md)
- **SECURITY**: [Report security issues](SECURITY.md#reporting-security-issues)

---

## 📞 Need Help?

- **General Support**: See [SUPPORT_POLICY.md](SUPPORT_POLICY.md)
- **Security Questions**: [SECURITY.md](SECURITY.md#security-contact)
- **Privacy/Data Handling**: [PRIVACY.md](PRIVACY.md#contact-us)
- **Enterprise Procurement**: Contact via [SUPPORT_POLICY.md](SUPPORT_POLICY.md#escalation)

---

**Last Updated**: 2026-01-12 | **Status**: Marketplace-Ready | **Maintained By**: FirstTry Team
