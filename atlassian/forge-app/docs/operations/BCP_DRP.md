# Business Continuity and Disaster Recovery

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## 1. Overview

FirstTry's disaster recovery posture is dependent on Atlassian Forge platform availability. There is no independent FirstTry infrastructure to recover.

---

## 2. Failure Scenarios and Recovery

### Scenario 1: FirstTry App Crashes
- **Cause**: Unhandled exception, out-of-memory, logic error
- **Recovery**: Automatic restart by Forge platform (transparent)
- **RTO**: <5 minutes (Atlassian SLA)
- **RPO**: No data loss (Forge Storage is replicated)
- **Action**: Monitor Forge logs; engineer investigates

### Scenario 2: Forge Storage Unavailable
- **Cause**: Atlassian infrastructure failure, regional outage
- **Recovery**: Forge platform restores from replicated backups
- **RTO**: 1–4 hours (depends on Atlassian's incident)
- **RPO**: <1 hour (typical replication lag)
- **Action**: Await Atlassian incident resolution; customer can retry exports

### Scenario 3: Jira Cloud API Degraded
- **Cause**: Jira Cloud infrastructure incident
- **Recovery**: Atlassian infrastructure team responds
- **Impact**: FirstTry cannot read Jira data; dashboard shows error
- **Action**: Retry automatically; exponential backoff; customer exported data remains accessible

### Scenario 4: FirstTry Code Vulnerability Found
- **Cause**: Security issue in app code
- **Recovery**: Patch released, redeployed via forge deploy
- **RTO**: 24–48 hours (depends on severity)
- **RPO**: N/A (code vulnerability, not data loss)
- **Action**: Follow INCIDENT_RESPONSE_PLAN.md

---

## 3. Customer Responsibilities for BCP

**Export and backup**:
- Export compliance evidence regularly (recommended: monthly)
- Store exports in your own secure storage (encrypted, replicated)
- Don't rely solely on FirstTry for compliance record retention

**Uninstall and deletion**:
- If FirstTry is no longer needed, uninstall to trigger cleanup
- All data deleted within 30 days (Atlassian SLA)

**Contact updates**:
- Maintain security contact email in Jira admin settings
- Ensure we can reach you in case of incident

---

## 4. No Disaster Recovery SLA

**FirstTry does NOT provide**:
- ❌ Independent uptime guarantee beyond Forge platform SLA
- ❌ Data backup outside Forge Storage
- ❌ RTO or RPO guarantees independent of Atlassian's SLA
- ❌ Disaster recovery drills or tabletop exercises

**Customers MUST**:
- ✅ Plan for Atlassian Forge platform availability (99.5% SLA typical)
- ✅ Export data regularly for redundancy
- ✅ Maintain security contacts for incident notification

---

## 5. Platform Dependency Statement

> FirstTry's availability, recoverability, and data retention are entirely dependent on Atlassian Forge platform. All disaster recovery and business continuity guarantees flow from Atlassian's published SLA and terms of service. See FORGE_PLATFORM_DEPENDENCY.md.

---

## 6. Testing and Drills

**Annual test procedure**:
1. Simulate Forge Storage unavailability locally
2. Verify error handling (app returns clear error messages)
3. Confirm customer can still access previously exported archives
4. Document results

---

## 7. Emergency Contact

For business-impacting incidents requiring immediate escalation:

**Emergency**: [emergency@firsttry.run](mailto:emergency@firsttry.run)
**Security**: [security.contact@firsttry.run](mailto:security.contact@firsttry.run)

---

## References

- [FORGE_PLATFORM_DEPENDENCY.md](../trust/FORGE_PLATFORM_DEPENDENCY.md): Platform SLA details
- [docs/trust/UNINSTALL_DELETION.md](../trust/UNINSTALL_DELETION.md): Data deletion SLA
- [INCIDENT_RESPONSE_PLAN.md](INCIDENT_RESPONSE_PLAN.md): Incident handling
