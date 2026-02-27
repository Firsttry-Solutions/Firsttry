# Service Level Agreement (SLA)

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## 1. Overview

FirstTry provides an SLA for **support response times only**. We do NOT guarantee uptime, data availability, or performance metrics.

**Why?** FirstTry runs entirely on Atlassian Forge platform, which has its own SLA. We cannot guarantee availability independent of Atlassian.

---

## 2. What We DONT Guarantee

❌ **No uptime percentage claims**  
- FirstTry availability is **dependent on Atlassian Forge SLA**
- No independent infrastructure to guarantee uptime
- If Atlassian Forge is down, FirstTry is down

❌ **No data availability guarantee**  
- Relies on Atlassian Forge Storage (Atlassian-managed backups)
- FirstTry does not control backup/restore procedures

❌ **No performance SLA**  
- Response times depend on Jira Cloud API performance
- No guaranteed latency for exports or dashboard loads

❌ **No disaster recovery SLA**  
- See BCP_DRP.md for platform dependencies

❌ **No uptime percentage threshold**  
- No uptime percentage claims are made
- No SLA credit or refund for outages
- Support response times are "best-effort only"

---

## 3. What We DO Guarantee

✅ **Support Response Times** (best-effort):
- Critical issue: Initial response within 4 business hours
- High issue: Initial response within 8 business hours
- Medium issue: Initial response within 1 business day
- Low issue: Initial response within 5 business days

**Caveat**: Response times are "best-effort" and subject to customer availability, information provided, and scope of issue.

✅ **Security Incident Acknowledgement**:
- All security reports acknowledged within 24 hours
- Severity assessment within 48 hours
- Updates provided every 5 business days minimum

✅ **Documented Support Channels**:
- Email support available (support@firsttry.run, security.contact@firsttry.run)
- Response SLA as stated above

---

## 4. Dependency on Atlassian Forge SLA

**Atlassian Forge SLA** (reference only; see Atlassian docs for authoritative details):
- Platform availability target: Refer to current Atlassian SLA documentation (varies by region)
- Data replication and backup: Atlassian-managed
- Incident response: Atlassian SLA applies

**Where to find Atlassian SLA**:
- Atlassian Service Level Agreement: https://www.atlassian.com/legal/service-level-agreement (pinned URL)

**FirstTry responsibility in outage**:
1. Monitor Atlassian status page (https://status.atlassian.com)
2. Notify customers of related issues (if not already aware)
3. Await Atlassian incident resolution
4. Update INCIDENT_RESPONSE_PLAN.md after incident

---

## 5. Exclusions from SLA

Support response times are NOT guaranteed for:
- Jira Cloud configuration issues (contact Atlassian support)
- Issues caused by customer's network or infrastructure
- Issues related to third-party integrations not supported by FirstTry
- Issues from unsupported app versions (upgrade required)
- Issues from data corruption caused by customer actions

---

## 6. Customer Responsibilities

To receive support:
- Provide clear reproduction steps
- Confirm app is up-to-date (latest version)
- Confirm Jira Cloud site is healthy
- Include relevant logs or error messages

---

## 7. SLA Credits

**FirstTry does NOT offer SLA credits** for missed response times because:
1. Response time is "best-effort," not guaranteed
2. Availability is outside FirstTry's control (Forge platform)
3. No subscription tier exists; app is provided as-is

---

## 8. Changes to SLA

This SLA may be updated at any time with notice in CHANGELOG.md. Material changes will be announced in advance.

---

## 9. IMPORTANT DISCLAIMER

> **FirstTry is provided "AS-IS" without warranty of any kind. FirstTry is NOT responsible for:**
> 
> - Data loss or corruption (reliance on Forge Storage)
> - Service unavailability (reliance on Forge platform)
> - Performance degradation (reliance on Jira Cloud API)
> - Compliance violations (compliance is customer's responsibility)
> - Business losses (see TERMS_OF_SERVICE.md liability limitations)
>
> **Customer must obtain independent assurances** from Atlassian regarding Forge platform SLA if uptime guarantees are critical to your use case.

---

## 10. References

- [Atlassian Service Level Agreement](https://www.atlassian.com/legal/service-level-agreement)
- [FORGE_PLATFORM_DEPENDENCY.md](../trust/FORGE_PLATFORM_DEPENDENCY.md): Platform dependencies
- [BCP_DRP.md](BCP_DRP.md): Business continuity and disaster recovery
- [SUPPORT_POLICY.md](SUPPORT_POLICY.md): Support channels and scope
- [TERMS_OF_SERVICE.md](../trust/TERMS_OF_SERVICE.md): Liability limitations
