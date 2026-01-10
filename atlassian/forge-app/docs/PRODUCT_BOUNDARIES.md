# Product Boundaries

**Classification**: Public (Marketplace Review)  
**Updated**: 2026-01-10

FirstTry defines clear **functional and security boundaries** to prevent scope creep and maintain privacy guarantees.

---

## ALLOWED Operations

### ✅ FirstTry CAN:

- **Read** Jira project, issue, and workflow metadata via `read:jira-work` scope
- **Store** governance evidence in app-scoped Forge storage (encrypted, isolated)
- **Display** read-only dashboard gadget to Jira admins
- **Schedule** background evidence collection every 5 minutes / daily / weekly
- **Export** evidence as JSON/CSV (on-demand, not stored by app)
- **Delete** evidence on admin request or after 90-day retention period
- **Refresh** OAuth tokens automatically (every 12 hours, for token validity)

---

## FORBIDDEN Operations

### ❌ FirstTry CANNOT:

| Operation | Why Forbidden | Verification |
|-----------|---------------|--------------|
| Write to Jira (`write:jira` scope) | Creates risk of data mutation; violates read-only guarantee | No `write:jira` in manifest; GET-only enforcer in code |
| Manage Jira (`manage:jira` scope) | Would allow altering projects, issues, users | Not in manifest; never requested |
| Send data to external APIs | Privacy & security risk | Code scan: zero `fetch()` to external domains |
| Store user PII (emails, names, IPs) | Privacy violation | Data handling verified: only IDs stored, not names |
| Decrypt/modify stored evidence | Integrity violation | Evidence stored with hash digests; read-only contracts |
| Access raw issue content | Prevents accidental data exposure | No access to `/rest/api/3/issue/<id>` (comments, description) |
| Execute arbitrary code on Jira | Security risk | Forge runtime sandbox enforced |
| Access other apps' storage | Isolation violation | Each app has isolated storage scope |

---

## Rate & Frequency Limits

| Operation | Frequency | Limit | Reason |
|-----------|-----------|-------|--------|
| Evidence snapshot | Every 5 minutes | Max 288/day per org | Prevents API abuse |
| Daily aggregation | Once per day | Max 1/day per org | Reduces noise |
| Weekly consolidation | Once per week | Max 4/month per org | Trend analysis |
| Token refresh | Every 12 hours | 2/day | Prevents expiry; reduces overhead |

---

## Data Scope

### FirstTry's View of Jira

FirstTry can see (and stores):

```
Jira Instance
├── Projects
│   ├── Project Key
│   ├── Project Name
│   └── Issue Type Definitions
├── Issues (enumerated via JQL)
│   ├── Issue Key
│   ├── Issue ID
│   ├── Created Date
│   ├── Updated Date
│   ├── Assignee ID (not name or email)
│   └── Current Status
└── Workflows
    └── Status Transition Rules
```

### FirstTry CANNOT Access

```
Jira Instance
├── Issue Descriptions ❌
├── Issue Comments ❌
├── Custom Field Values ❌
├── Attachments ❌
├── User Profiles ❌
│   ├── Emails ❌
│   ├── Phone Numbers ❌
│   └── Avatar Images ❌
├── Audit Logs ❌
└── Deleted Issues ❌
```

---

## API Endpoint Boundaries

### Allowed Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/rest/api/3/project` | GET | List projects |
| `/rest/api/3/issuetype` | GET | Get issue type definitions |
| `/rest/api/3/status` | GET | Get status definitions |
| `/rest/api/3/fields` | GET | Get field schema |
| `/rest/api/3/search` | GET | Query issues (via JQL) |
| `/rest/api/3/workflows` | GET | Get workflow definitions |

### Forbidden Endpoints

| Endpoint | Reason |
|----------|--------|
| Any with POST/PUT/PATCH/DELETE | Write operations not allowed |
| `/rest/api/3/issue/<id>` (full details) | Would expose comment, description, custom fields |
| `/rest/api/3/user/*` | Would expose PII |
| `/rest/api/3/audit/*` | Audit log access not needed |

---

## Feature Roadmap Constraints

### Future Features (Allowed)

- 🟢 Enhanced trend analysis (more complex queries on same data)
- 🟢 Policy templates (predefined compliance rules)
- 🟢 Custom dashboards (different views of same data)
- 🟢 CSV export templating (report generation)

### Features NEVER Planned (Forbidden)

- 🔴 Two-way sync (would require write scope)
- 🔴 User/admin panels (would expose PII)
- 🔴 Issue mutations (would require write scope)
- 🔴 External SaaS storage (privacy violation)
- 🔴 Webhooks to external systems (egress risk)

---

## Testing & Verification

Product boundaries are enforced by:

1. **Manifest Validation** (`forge lint`): Scopes checked against allowed list
2. **Type Contracts** (`src/phase5_report_contract.ts`): API responses validate data structure
3. **Runtime Guards** (`src/runtime_guards/assert_read_only.ts`): HTTP methods checked at runtime
4. **Automated Tests** (1243 tests): Including `no_jira_writes_contract.test.ts`
5. **Code Scans** (proof runs): All Jira API calls audited

**Evidence Location**: `audit/proof_runs/run_20260110_121856/`

---

## Questions?

See `docs/REVIEWER_FAQ.md` for marketplace reviewer questions.

