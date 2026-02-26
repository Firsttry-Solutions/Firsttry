# Subprocessors

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual (Interim updates within 30 days of Atlassian publishing subprocessor changes)

---

## FirstTry Direct Subprocessors

FirstTry does not directly employ subprocessors. All third-party services are provided through Atlassian.

| Subprocessor | Purpose | Data Access | Agreement |
|--------------|---------|-------------|-----------|
| Atlassian Forge | App hosting and runtime | All data | Forge Terms of Service |
| Atlassian Jira Cloud | API and data source | Jira metadata queried by app | Jira Cloud Terms of Service |

---

## Atlassian's Subprocessors

Atlassian may use third-party subprocessors for Forge and Jira Cloud services. FirstTry does **NOT** control or verify Atlassian's subprocessor list.

**Authority**: Atlassian publishes the official list at:  
🔗 [https://www.atlassian.com/legal/subprocessors](https://www.atlassian.com/legal/subprocessors) (pinned URL)

**Content**: The subprocessor list includes (but is not limited to):
- CDN providers (CloudFlare, Akamai, etc.)
- Logging and monitoring services
- DDoS mitigation providers
- Database and encryption key management services
- Cloud infrastructure providers

**FirstTry caveat**: We do not maintain an independent copy of Atlassian's subprocessor list. Customers should:
1. Review Atlassian's published list directly
2. Note that FirstTry has no visibility into Atlassian subprocessor contracts
3. Contact Atlassian directly with subprocessor questions (not FirstTry)

---

## Updates and Change Notification

**Atlassian's policy**: Atlassian notifies customers of material subprocessor changes per their terms of service.

**FirstTry refresh**: Within 30 days of Atlassian publishing a material subprocessor change, we will:
1. Update this document to reference the change
2. Regenerate evidence artifacts (docs/evidence/)
3. Commit changes to git with justification

**No independent verification**: FirstTry does not independently audit Atlassian's subprocessor agreements or practices.

---

## How Subprocessor Data Flows

```
FirstTry App
  ↓ uses requestJira() API
Atlassian Forge
  ↓ forwards requests
Atlassian Jira Cloud
  ↓ processes and stores
Atlassian Subprocessors (CDN, logging, etc.)
  ↓ per Atlassian's terms
```

FirstTry has **no control** over data handling by Atlassian subprocessors. Responsible party: Atlassian.

---

## References

- [SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md): Shared responsibility model
- [FORGE_PLATFORM_DEPENDENCY.md](FORGE_PLATFORM_DEPENDENCY.md): Platform dependency
- [Atlassian Subprocessor List](https://www.atlassian.com/legal/subprocessors) (external link)
