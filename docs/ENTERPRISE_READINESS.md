# FirstTry Enterprise Readiness

**Version**: 1.0  
**Last Updated**: 2025-12-22

---

## What FirstTry Guarantees

✅ **Workspace Isolation**: Your data is structurally isolated from other Jira workspaces (Atlassian Forge enforced)  
✅ **Zero User Tracking**: No analytics, no profiling, no behavior logging  
✅ **Read-Only Access**: Cannot modify Jira issues or config  
✅ **HTTPS Encrypted**: All transit over TLS 1.2+  
✅ **Transparent Failures**: Explicit error messages (no silent failures)  

---

## What FirstTry Does NOT Guarantee

❌ **Automatic Data Deletion**: Data is retained indefinitely (see [DATA_RETENTION.md](DATA_RETENTION.md))  
❌ **Data Residency Control**: Residency determined by Jira Cloud region, not FirstTry  
❌ **Uptime**: No SLA; relies on Jira Cloud availability (Atlassian responsibility)  
❌ **100% Accuracy**: Drift detection may miss edge cases  
❌ **Backwards Compatibility**: MAJOR versions may break (see [CHANGELOG_POLICY.md](CHANGELOG_POLICY.md))  
❌ **Compliance Certifications**: No SOC 2, HIPAA, FedRAMP (see [COMPLIANCE.md](COMPLIANCE.md))  

---

## Platform-Controlled Behaviors

**CRITICAL**: The following behaviors are governed by Atlassian Forge platform guarantees and are NOT independently controlled or overridden by FirstTry.

### Storage & Deletion

- **Ownership**: Atlassian Forge
- **FirstTry Control**: NONE
- **Your Responsibility**: Request data deletion from Atlassian if needed
- **See Also**: [DATA_RETENTION.md#platform-controlled-behaviors](DATA_RETENTION.md#platform-controlled-behaviors)

### Data Residency & Location

- **Ownership**: Atlassian Forge  
- **FirstTry Control**: NONE
- **Your Responsibility**: Verify Jira Cloud region matches your requirements
- **FirstTry Cannot**: Change, specify, or guarantee data residency

### Backup & Recovery

- **Ownership**: Atlassian Forge
- **FirstTry Control**: NONE
- **Your Responsibility**: Contact Atlassian for backup/recovery
- **FirstTry Cannot**: Recover lost data

### Data Encryption & Security

- **Ownership**: Atlassian Forge (encryption key management)
- **FirstTry Control**: Application-level logging redaction only
- **Your Responsibility**: Verify Atlassian's encryption standards
- **What is Controlled by Atlassian**: Encryption algorithms, key lifecycle, and key management

---

## Enterprise Readiness Checklist

| Requirement | Status | Reference |
|-------------|--------|-----------|
| **Privacy Policy** | ✅ | [PRIVACY.md](PRIVACY.md) |
| **Security Statement** | ✅ | [SECURITY.md](SECURITY.md) |
| **Data Retention Policy** | ✅ | [DATA_RETENTION.md](DATA_RETENTION.md) |
| **Data Inventory** | ✅ | [DATA_INVENTORY.md](DATA_INVENTORY.md) |
| **Access Control** | ✅ | [ACCESS_CONTROL.md](ACCESS_CONTROL.md) |
| **Incident Response** | ✅ | [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) |
| **Support** | ✅ | [SUPPORT.md](SUPPORT.md) |
| **Terms of Service** | ✅ | [TERMS.md](TERMS.md) |
| **Subprocessors** | ✅ | [SUBPROCESSORS.md](SUBPROCESSORS.md) |
| **Changelog Policy** | ✅ | [CHANGELOG_POLICY.md](CHANGELOG_POLICY.md) |
| **DPA (NOT offered by FirstTry)** | ℹ️ | Rely on Atlassian terms; contact security@atlassian.com |

---

## Scaling & Capacity

### Storage Footprint

**Per-Workspace Estimate**:

```
Issue Snapshots:     ~1MB per 1000 issues
Event Ledger:        ~500KB per 1000 events/day (see DATA_RETENTION.md for retention policy)
Reports:             ~100KB each
Exports:             Temporary

Total (100K issues, avg activity): ~100-500MB per workspace
```

Workspace storage is managed by Atlassian Forge. No limits are enforced at the app level.

### Concurrent Users

FirstTry has no per-user limits:
- ✅ Unlimited users can view reports
- ✅ Unlimited concurrent read-only access
- ✅ No license seats required

---

## Operational Considerations

### Maintenance & Updates

- **Update Frequency**: ~Monthly minor updates, quarterly major versions
- **Downtime**: None (app automatically updates via Atlassian)
- **Rollback**: Automatic (no manual intervention needed)

### Backup & Disaster Recovery

- **Backup**: Atlassian Forge handles (no FirstTry action needed)
- **Restore**: Contact Atlassian if workspace data recovery needed
- **FirstTry Data**: Backed up by Atlassian infrastructure

---

## Known Limitations

1. **Workspace-Wide Monitoring**: Cannot restrict to specific projects (future roadmap)
2. **Custom Rules**: Drift detection rules are hardcoded (no UI configuration yet)
3. **Historical Analysis**: Limited to 90-day retention (by design)
4. **Export Formats**: JSON/CSV only (PDF not supported)
5. **Webhook Support**: Cannot trigger external actions (read-only tool)

---

## Roadmap & Future

| Feature | Timeline | Status |
|---------|----------|--------|
| **Fine-Grained Permissions** | 2026+ | Planned |
| **Custom Drift Rules UI** | 2026+ | Planned |
| **Longer Retention (configurable)** | 2026+ | Planned |
| **PDF Exports** | 2026+ | Under consideration |
| **External Webhook Integration** | 2026+ | Under consideration |
| **Atlassian Cloud Fortified** | 2026+ | Under evaluation |

---

## Procurement Support

### Compliance Documents Available

- ✅ Privacy Policy (GDPR-ready)
- ✅ Security Statement
- ℹ️ Data Processing: See Atlassian Forge DPA (FirstTry does not offer standalone DPA)
- ✅ Incident Response Plan
- ✅ Shakedown Test Report (technical verification)

**To Request**: Email security@atlassian.com with "FirstTry Enterprise Documentation Request"

### Assessment Support

- ✅ Available for security assessments
- ✅ Can provide evidence of practices (code samples, tests)
- ✅ Can discuss architecture and isolation model

---

## Recommended Pre-Deployment Steps

1. **Review** [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md), [COMPLIANCE.md](COMPLIANCE.md)
2. **Test** in non-production workspace first
3. **Review** [DATA_INVENTORY.md](DATA_INVENTORY.md) against your sensitivity classification
4. **Contact** Atlassian (security@atlassian.com) if you require a DPA
5. **Assess** against your compliance requirements (HIPAA, SOC 2, etc.)
6. **Deploy** to production with confidence

---

## Emergency Contacts

**For urgent security issues**: security@atlassian.com  
**For procurement questions**: Your Atlassian account manager  
**For technical escalation**: Atlassian support (via Marketplace)

---

**Enterprise Readiness**: 1.0  
**Next Review**: Q2 2026
