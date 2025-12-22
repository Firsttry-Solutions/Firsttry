# External APIs Documentation

**Purpose**: Declare all outbound network calls and their purposes  
**Required By**: Marketplace launch (closes GAP 3)  
**Status**: In progress

---

## API Dependencies Found

### Fetch Calls in Admin Page

**Location**: `src/admin/phase5_admin_page.ts`

**Identified Fetch Calls** (4 total):

```typescript
// Lines 267-331
// NOTE: These are examples for documentation
// Replace with actual implementation details
```

#### Fetch Call 1
- **Line**: 267
- **URL Pattern**: [TO BE DOCUMENTED]
- **Method**: [TO BE DOCUMENTED]
- **Auth**: [TO BE DOCUMENTED]
- **Sensitivity**: [TO BE DOCUMENTED]
- **SLA**: [TO BE DOCUMENTED]
- **Purpose**: [TO BE DOCUMENTED]

#### Fetch Call 2
- **Line**: 289
- **URL Pattern**: [TO BE DOCUMENTED]
- **Method**: [TO BE DOCUMENTED]
- **Auth**: [TO BE DOCUMENTED]
- **Sensitivity**: [TO BE DOCUMENTED]
- **SLA**: [TO BE DOCUMENTED]
- **Purpose**: [TO BE DOCUMENTED]

#### Fetch Call 3
- **Line**: 312
- **URL Pattern**: [TO BE DOCUMENTED]
- **Method**: [TO BE DOCUMENTED]
- **Auth**: [TO BE DOCUMENTED]
- **Sensitivity**: [TO BE DOCUMENTED]
- **SLA**: [TO BE DOCUMENTED]
- **Purpose**: [TO BE DOCUMENTED]

#### Fetch Call 4
- **Line**: 331
- **URL Pattern**: [TO BE DOCUMENTED]
- **Method**: [TO BE DOCUMENTED]
- **Auth**: [TO BE DOCUMENTED]
- **Sensitivity**: [TO BE DOCUMENTED]
- **SLA**: [TO BE DOCUMENTED]
- **Purpose**: [TO BE DOCUMENTED]

---

## Template for Each API

```markdown
## API: [Name]

### Connection Details
- **Service**: [Service name]
- **URL Pattern**: [https://example.com/path]
- **HTTP Method**: [GET, POST, etc.]
- **Authentication**: [Bearer token, API key, OAuth, None]
- **Timeout**: [X seconds]

### Data Flow
- **Direction**: Outbound (our service → external service)
- **Payload Size**: [Typical X KB, max Y MB]
- **Response Size**: [Typical X KB, max Y MB]
- **Frequency**: [Per request / Hourly / Daily]

### Data Sensitivity
- **Includes Secrets**: [Yes/No]
- **Includes PII**: [Yes/No]
- **Includes Jira Data**: [Yes/No]
- **Encryption**: [TLS 1.3]

### Reliability & SLA
- **Service Owner**: [External service name]
- **SLA**: [99.9% uptime / Best effort / None]
- **Fallback**: [Cached response / Error message / Retry logic]
- **Monitoring**: [Alert threshold]

### Security Considerations
- **Least Privilege**: [Yes/No - describe]
- **Request Signing**: [HMAC / Ed25519 / None]
- **Rate Limiting**: [X requests/minute]
- **IP Whitelisting**: [Yes/No]

### Compliance
- **PII Handling**: [Allowed/Restricted]
- **Data Retention**: [None / X days]
- **Audit Logging**: [Yes/No]
- **GDPR Compliant**: [Yes/No]
```

---

## Next Steps

### Immediate (Before Marketplace)
1. [ ] Examine actual fetch() calls in src/admin/phase5_admin_page.ts
2. [ ] Document each API using template above
3. [ ] Add external API list to README.md
4. [ ] Get security review of API choices

### Testing Integration
Once documented:
- Credibility test GAP3_STATIC_EGRESS_SCAN will move to PASS
- All 7 gaps will be verified (7/7 PASS or UNKNOWN)

---

## Sign-Off

- [ ] Developer (code examination)
- [ ] Security (API review)
- [ ] Product Manager (SLA agreement)

**Document Status**: 🔴 INCOMPLETE - requires developer action
