# Support Policy

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## 1. Support Channels

| Channel | Use Case | Response Time |
|---------|----------|----------------|
| **Email**: support@firsttry.run | Feature requests, bugs, general questions | 2 business days |
| **Email**: security@firsttry.run | Security vulnerabilities, data concerns | 4 hours (Critical) |
| **GitHub Issues** (if repo public) | Feature requests, bug reports | 3 business days |
| **Atlassian Marketplace** (if available) | Community support, ratings | 5 business days |

---

## 2. Support Scope

**We support**:
- ✅ FirstTry app functionality (dashboard, exports, gadget UI)
- ✅ Integration questions (how to use with Jira)
- ✅ Troubleshooting (resetting app, reexporting data)
- ✅ Documentation questions
- ✅ Feature requests (considered but not guaranteed)

**We do NOT support**:
- ❌ Jira Cloud configuration (contact Atlassian)
- ❌ Jira admin training (contact Atlassian or your IT)
- ❌ Compliance framework design (consult with your legal/compliance team)
- ❌ FirstTry app customization or forking (app is not extensible)
- ❌ Atlassian Forge platform issues (contact Atlassian)

---

## 3. Severity Levels

| Severity | Description | Example | Response |
|----------|-------------|---------|----------|
| **Critical** | App is broken; data is lost or inaccessible | Export fails; dashboard shows infinite error | 4 hours |
| **High** | Major feature is unavailable; workaround exists | Permissions endpoint times out (can retry) | 8 hours |
| **Medium** | Feature partially works; minor issue | Export is slow but completes | 1 business day |
| **Low** | UI cosmetic issue; documentation gap | Typo in help text | 5 business days |

---

## 4. Response and Resolution SLA

| Severity | Initial Response | Resolution Target | Status Updates |
|----------|-----------------|------------------|-----------------|
| Critical | 4 hours | 24 hours | Every 4 hours |
| High | 8 hours | 5 business days | Daily |
| Medium | 1 day | 14 days | Weekly |
| Low | 5 days | 30 days | On resolution |

**Note**: SLA targets are best-effort. Actual resolution time depends on issue complexity and availability of information from customer.

---

## 5. How to Report an Issue

**Essential information**:
- What happened (describe the issue)
- When it happened (date, time, timezone)
- How to reproduce (step-by-step)
- What you expected (intended behavior)
- What you got (actual behavior)
- Jira Cloud site name (if applicable)
- App version (if known)
- Browser and OS (if gadget/UI related)
- Error messages or logs (if available)

**Helpful but optional**:
- Screenshots
- Video recording of issue
- Recent changes made (if user suspects trigger)

---

## 6. Security Support

**For security issues**:
- Email security@firsttry.run (not general support)
- Follow VULNERABILITY_DISCLOSURE_POLICY.md
- Do NOT post security details publicly

---

## 7. Support Availability

**Support hours**: Business hours, US/UK timezones (typically 09:00–17:00 EST/GMT)

**Supported languages**: English (primary), other languages on best-effort basis

**Out of office**: Support may be delayed during company holidays. Critical issues may be escalated to on-call team.

---

## 8. End of Support

When FirstTry reaches end-of-life:
1. Announcement in CHANGELOG.md (6 months advance notice, if possible)
2. Deprecation message in app (last version)
3. Final support period: 3 months after announcement
4. After final date: App may be removed from Atlassian Marketplace

---

## References

- [SLA.md](SLA.md): Service level agreement (response times + targets)
- [INCIDENT_RESPONSE_PLAN.md](INCIDENT_RESPONSE_PLAN.md): Severity classification
- [docs/trust/SECURITY_CONTACT.md](../trust/SECURITY_CONTACT.md): Security contact
