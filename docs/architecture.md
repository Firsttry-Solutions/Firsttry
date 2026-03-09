# Architecture — FirstTry

**Version**: 2.14.0  
**Last Updated**: 2026-03-09

---

## Overview

FirstTry is an Atlassian Forge app providing audit evidence snapshots for Jira Cloud. This document describes the technical architecture, design decisions, and implementation details.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Jira Cloud UI                             │
│                (Browser—Chrome, Firefox, Safari)                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Atlassian Forge Platform                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              FirstTry Frontend (React + TypeScript)       │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │  │
│  │  │   UI Panel  │  │  Audit View  │  │  Settings UI   │  │  │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │  │
│  └───────┬────────────────────────────────────────────┬─────┘  │
│          │ API Calls (Forge Storage + Jira APIs)     │         │
│          ▼                                            ▼         │
│  ┌────────────────────────┐         ┌────────────────────────┐ │
│  │   Forge Storage API    │         │   Jira Cloud API       │ │
│  │  (User Preferences)    │         │  (Issue/User/Perms)    │ │
│  └────────────────────────┘         └────────────────────────┘ │
│          │                                  │                   │
│          ▼                                  ▼                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │   Forge Managed Storage                                    │ │
│  │   (AWS S3, encrypted at rest + in transit)                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## High-Level Components

### 1. Frontend (React + TypeScript)

**Location**: `atlassian/forge-app/src/`

**Responsibilities**:
- Render FirstTry UI panels in Jira
- Fetch and display audit metrics
- Handle user interactions (export, settings)
- State management (React Context / Hooks)
- Caching of audit data (in-memory)

**Key Files**:
- `components/` — React components (UI panels, forms)
- `services/` — API wrappers (Jira, Storage, Analytics)
- `hooks/` — Custom React hooks (data fetching, state)
- `types/` — TypeScript interfaces and types
- `utils/` — Helper functions (formatting, validation)

### 2. Forge API Integration

**APIs Used**:
- **Jira APIs** (`api.asUser().requestJira()`)
  - GET /issue/{issueId} — Fetch issue data
  - GET /user/myself — Get current user
  - GET /permissions/check — Verify permissions

- **Forge Storage API** (`storage.get/set()`)
  - Store user preferences (theme, detail level, etc.)
  - Retrieve saved settings on load

- **Analytics** (optional — for usage metrics)
  - Track feature usage
  - Identify common workflows

### 3. Backend Logic

**Minimal Backend**:
FirstTry does **not require** a backend service. All logic is:
- Pure frontend (React)
- Serverless Forge functions (if needed)
- No external APIs called

**Why**:
- Reduces complexity and attack surface
- Faster load times (no network hops)
- Better privacy (data never leaves Forge)
- Easier compliance audits

---

## Data Flow

### Issue Audit Snapshot

```
1. User opens Jira issue
   ↓
2. Jira loads FirstTry panel
   ↓
3. Panel sends: GET /issue/{issueId} (to Jira API)
   ↓
4. Jira API returns: Issue metadata
   ↓
5. FirstTry transforms data:
   - Extract audit-relevant fields
   - Calculate metrics (compliance score, etc.)
   - Format for display
   ↓
6. Fetch cached data from
   Forge Storage (user preferences, historical cache)
   ↓
7. Merge live data + cached data
   ↓
8. Render UI with results
   ↓
9. User sees audit snapshot in < 1 second
```

### User Preferences

```
1. User opens Settings in FirstTry
   ↓
2. Adjusts preferences (theme, detail level)
   ↓
3. Clicks "Save"
   ↓
4. Frontend calls: storage.set(key, value)
   ↓
5. Forge Storage persists data
   ↓
6. On future loads, retrieve with: storage.get(key)
   ↓
7. Preferences applied automatically
```

### Export Workflow

```
1. User clicks "Export as PDF"
   ↓
2. Frontend prepares data:
   - Serialize audit metrics
   - Format with styling
   - Add timestamp and metadata
   ↓
3. Transform to PDF (using frontend library like pdfkit)
   ↓
4. Trigger browser download
   ↓
5. User receives PDF file
```

---

## Security Architecture

### Zero-Egress Policy

FirstTry makes **no outbound external API calls**:
- ✅ Only calls Jira APIs (internal to Forge)
- ✅ Only accesses Forge Storage (managed by Atlassian)
- ❌ No external analytics / third-party services
- ❌ No CDN for assets (all bundled)

**Benefit**: Data never leaves Atlassian infrastructure

### Scope Minimization

**Requested Scopes**:

| Scope | Purpose | Justification |
|-------|---------|------------------|
| `read:jira-work` | Read issue data | Core feature — audit metrics |
| `read:jira-user` | Get current user | User preferences per-user |
| `storage:app` | Store preferences | Persist user settings |

**Why minimal**:
- Reduces attack surface
- Easier for reviewers to approve
- Clear, justifiable permissions

### Input Validation

**All user input**:
- Validated before use
- Sanitized to prevent XSS
- Typed with TypeScript
- Tested in CI/CD

**All API responses**:
- Validated against expected schema
- Type-checked with TypeScript
- Handled gracefully if invalid

### Secure Storage

**Data at rest**:
- Forge Storage handles encryption
- Atlassian manages key rotation
- User data isolated per application

**Data in transit**:
- All API calls use TLS (HTTPS)
- Certificates verified
- No plaintext transmission

---

## Performance Considerations

### Load Time

**Goal**: < 1 second to display audit snapshot

**Optimizations**:
1. **No external API calls** → No network latency to external services
2. **Caching** → Reuse data between page loads
3. **Code splitting** → Only load needed JS
4. **Lazy loading** → Defer non-critical features

**Measured**: ~500ms average, <1s p99

### Memory Usage

**Per issue**:
- ~2-5 MB for first issue
- ~1-2 MB for subsequent issues (cached assets)
- Usage stable after load (no memory leaks)

### Concurrent Users

**Scalability**:
- Limited by Forge concurrency (not FirstTry)
- Each user session isolated
- No shared backend state (stateless)

---

## Caching Strategy

### Client-Side Caching

**In-Memory Cache**:
- Issue data cached in React component state
- TTL: Session (cleared on page reload)
- Hit rate: ~80% (for repeated issue views)

**Browser Storage (Forge Storage)**:
- User preferences
- Historical snapshots (optional)
- Persists across sessions

### Cache Invalidation

**Automatic**:
1. Refresh button (manual)
2. Time-based (5 min auto-refresh)
3. Event-based (on issue change notification)

**Strategy**: Conservative TTL to ensure data freshness

---

## Error Handling

### API Failures

**Graceful degradation**:
- Jira API down? Show cached data + warning
- Forge Storage unavailable? Use defaults
- Network error? Inform user, offer retry

**Error boundaries**:
- React error boundary catches crashes
- Prevents entire app crash
- Shows fallback UI

### Invalid Data

**Type safety**:
- TypeScript catching most invalid data at compile time
- Runtime validation for API responses
- Fallback values for missing fields

---

## Testing Strategy

### Unit Tests

**Coverage**: ~80% of utility functions

**Stack**: Jest + React Testing Library

**Example**:
```typescript
test("calculates compliance score correctly", () => {
  const score = calculateComplianceScore(issueData);
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(100);
});
```

### Integration Tests

**Coverage**: Component integration, API mocking

**Stack**: Playwright for e2e testing

**Example**:
```typescript
test("loads and displays issue audit on page open", async () => {
  await page.goto("/browse/PROJ-1234");
  await expect(page.locator(".firsttry-panel")).toBeVisible();
  await expect(page.locator(".compliance-score")).toContainText(/\d+/);
});
```

### Security Tests

**Types**:
- No console.log of sensitive data
- No eval() or dynamic code execution
- No disallowed APIs (child_process, fs, etc.)
- npm audit: no HIGH/CRITICAL vulnerabilities

---

## Deployment & CI/CD

### Build Pipeline

```
1. Commit to main branch
   ↓
2. GitHub Actions trigger:
   - npm lint (ESLint)
   - npm test (Jest)
   - npm audit (Security scan)
   - npm build (Webpack)
   ↓
3. All checks pass?
   ↓ YES
4. Deploy to staging (for review)
   ↓
5. Manual approval
   ↓
6. Deploy to production (Atlassian Marketplace)
   ↓
7. Users receive app update
```

### Manifest & Configuration

**manifest.yml**:
- Defines app modules (panels, tabs)
- Declares scopes (permissions)
- Specifies resources served

**package.json**:
- Node dependencies
- Build scripts
- App metadata

---

## Scalability & Limits

### Users

- Per-user isolation (Forge-managed)
- Unlimited concurrent users (platform limit)

### Data

- Per-issue audit data: ~10-50 KB
- Per-user preferences: ~1-5 KB
- Total storage: Limited by Forge (typically abundant)

### API Rate Limits

- Jira Cloud: 60 requests/user/minute
- Forge Storage: Generous limits
- FirstTry: Operates well within limits

---

## Monitoring & Observability

### Logging

**What's logged**:
- App start/stop events
- API call summaries (no PII)
- Error events (with stack trace)

**What's NOT logged**:
- User data values
- Issue content
- Sensitive fields

**Where**: Forge logs (via console.log, exported to CloudWatch)

### Metrics

**Available**:
- Page load time
- API response times
- Error rates
- Feature usage (if opted-in)

---

## Technology Stack

### Frontend

| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| UI Framework | React | 18.x | Industry standard, good Forge support |
| Language | TypeScript | 5.x | Type safety, IDE support |
| Build Tool | Webpack | 5.x | Forge-recommended |
| CSS | CSS Modules | N/A | Scoped styling, no conflicts |
| Testing | Jest + RTL | Latest | Good React component testing |

### Backend / Runtime

| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| Runtime | Atlassian Forge | Latest | Managed, isolated, secure |
| Storage | Forge Storage API | Latest | Built-in, encrypted, managed |

---

## Development Setup

### Prerequisites

- Node.js 16+
- npm 7+
- Atlassian Forge CLI

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm build
```

### Deployment

```bash
# Deploy to staging
forge deploy --environment staging

# Deploy to production
forge deploy --environment production
```

---

## Future Improvements

### Planned

- [ ] Bulk audit export (multiple issues)
- [ ] Audit dashboard (aggregate metrics)
- [ ] Custom audit rules (admin-configured)
- [ ] Integration with JIRA automation

### Considered But Out of Scope

- External backend service (increases complexity, compliance burden)
- Machine learning (overkill for deterministic metrics)
- Mobile app (Jira mobile UI constraints)
- Self-hosted version (Forge Cloud-only)

---

## Troubleshooting

### Build Fails

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Try again
npm build
```

### Tests Fail

```bash
# Run with verbose output
npm test -- --verbose

# Run specific test file
npm test -- src/utils.test.ts
```

### Deploy Fails

```bash
# Check Forge credentials
forge whoami

# Check manifest syntax
forge validate

# Deploy with verbose logging
forge deploy --verbose
```

---

## References

- [Atlassian Forge Documentation](https://developer.atlassian.com/platform/forge/)
- [Jira Cloud API](https://developer.atlassian.com/cloud/jira/platform/rest/v2/)
- [Forge Storage API](https://developer.atlassian.com/platform/forge/apis/storage/)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**Version**: 2.14.0  
**Last Reviewed**: 2026-03-09
