# Incident Response Overview

**Last Updated**: 2026-01-10

---

## Incident Types

FirstTry may experience:

| Type | Example | Response |
|------|---------|----------|
| **Security** | Data exposure, unauthorized access | Notify affected users within 24 hours |
| **Availability** | App crash, Jira API rate limit | Mitigation within 4 hours |
| **Data Integrity** | Evidence hash mismatch | Investigation + rollback if needed |

---

## Response Process

### Phase 1: Detection (0-1 hour)
- Automated monitoring alerts (Jira health checks)
- Manual reports via `contact@firsttry.run`
- Initial triage: Severity determination

### Phase 2: Investigation (1-4 hours)
- Root cause analysis
- Scope determination (affected instances)
- Evidence collection (logs, metrics)

### Phase 3: Mitigation (4-24 hours)
- Temporary workaround (if immediate fix not available)
- Code fix + testing
- Staged rollout (if applicable)

### Phase 4: Communication
- Status updates to affected admins
- Root cause summary
- Prevention steps for future

---

## Communication

- **Status Updates**: Via email to admin contact
- **Public Status**: GitHub discussions (if applicable)
- **Follow-up**: Post-incident review within 7 days

---

## Recovery & Prevention

After incident resolution:
1. **Root Cause Analysis**: Document why it happened
2. **Action Items**: Prevent recurrence
3. **Monitoring**: Enhanced alerts if needed
4. **Documentation**: Update runbooks and guides

---

## Contact During Incident

Email: `contact@firsttry.run` (mark as URGENT - INCIDENT)

Include:
- Symptom (what's not working)
- When it started
- Any error messages in logs

