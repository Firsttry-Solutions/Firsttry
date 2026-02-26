# Architecture

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual
**Doc ID**: FT-TRUST-011  

---

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Customer Environment                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Atlassian Jira Cloud Instance               │   │
│  │  (Customer's site; region-specific)                  │   │
│  │  ┌────────────────────────────────────┐              │   │
│  │  │  Jira REST API                     │              │   │
│  │  │  /permission, /project, /myself    │              │   │
│  │  │  (OAuth2 protected)                │              │   │
│  │  └────────────────────────────────────┘              │   │
│  └───────────────────────┬──────────────────────────────┘   │
│                          │ TLS 1.3                           │
│                          │                                    │
│  ┌───────────────────────▼──────────────────────────────┐   │
│  │     Atlassian Forge Platform (Managed)               │   │
│  │                                                       │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │  FirstTry Forge App                           │   │   │
│  │  │                                               │   │   │
│  │  │  ┌─────────────────────────────────────────┐ │   │   │
│  │  │  │  Gadget UI (React)                      │ │   │   │
│  │  │  │  - Dashboard                            │ │   │   │
│  │  │  │  - Export controls                      │ │   │   │
│  │  │  │  - Compliance evidence view             │ │   │   │
│  │  │  └─────────────────────────────────────────┘ │   │   │
│  │  │                                               │   │   │
│  │  │  ┌─────────────────────────────────────────┐ │   │   │
│  │  │  │  Backend Services                       │ │   │   │
│  │  │  │  - Inventory Engine (read Jira)         │ │   │   │
│  │  │  │  - Access Engine (permission snap)      │ │   │   │
│  │  │  │  - Export Service (deterministic zip)   │ │   │   │
│  │  │  │  - Ledger Service (append-only)         │ │   │   │
│  │  │  └─────────────────────────────────────────┘ │   │   │
│  │  │                                               │   │   │
│  │  │  ┌─────────────────────────────────────────┐ │   │   │
│  │  │  │  requestJira() API Wrapper              │ │   │   │
│  │  │  │  (Forge-provided; OAuth2 enforcement)   │ │   │   │
│  │  │  └─────────────────────────────────────────┘ │   │   │
│  │  │                                               │   │   │
│  │  │  ┌─────────────────────────────────────────┐ │   │   │
│  │  │  │  Forge Storage Client                   │ │   │   │
│  │  │  │  (KV store for snapshots & ledger)      │ │   │   │
│  │  │  └─────────────────────────────────────────┘ │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  │                                                       │   │
│  │  ┌─────────────────────┬──────────────────────────┐  │   │
│  │  │   Forge Storage     │    Isolating Boundary    │  │   │
│  │  │                     │  (Per-tenant data silo)  │  │   │
│  │  │ - Snapshots         │                          │  │   │
│  │  │ - Audit ledger      │  (encrypted at rest)     │  │   │
│  │  │ - Exports           │                          │  │   │
│  │  └─────────────────────┴──────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
│  Note: No egress to external networks                        │
│        All data stays within Atlassian infrastructure        │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Description

### 1. Jira Cloud REST API
- **Owner**: Atlassian
- **Security**: OAuth2 token validation (Forge provides bearer token)
- **Endpoints accessed**: 
  - GET /rest/api/3/myself (current user context)
  - GET /rest/api/3/permissions (project permissions)
  - GET /rest/api/3/projects (project catalog)
  - GET /rest/api/3/fieldconfiguration (field definitions)

### 2. Forge requestJira() API Wrapper
- **Role**: Gateway for all Jira API calls
- **Enforces**: OAuth2 scope validation (app cannot exceed declared scopes)
- **Prevents**: Unauthorized API calls, scope escalation
- **Owner**: Atlassian (not modifiable by FirstTry)

### 3. FirstTry Engines
- **Inventory Engine**: Reads Jira project/user metadata, caches in memory
- **Access Engine**: Analyzes role-based access control against permission matrix
- **Export Service**: Packages snapshots into deterministic ZIP archives with integrity markers
- **Ledger Service**: Maintains append-only audit trail in Forge Storage

### 4. Forge Storage KV Store
- **Type**: Atlassian-managed encrypted key-value store
- **Purpose**: Persistence for snapshots, ledgers, and export archives
- **Scope**: Per-tenant isolation guaranteed by Forge platform
- **Encryption**: AES-256 at rest (Atlassian-managed keys)

### 5. Trust Boundary (Isolation)
- **Network isolation**: Forge network policies prevent external egress
- **API gating**: requestJira() enforces scopes and authentication
- **Data isolation**: Per-tenant storage quarantine in Forge Storage
- **Runtime isolation**: Process sandbox for CPU and memory limits

---

## Data Flow at Component Level

```
[Jira Admin] ──┐
               │ (OAuth2 context: Jira account)
               ▼
        [Gadget UI]
               │
          [API Gateway]
               │
     ┌─────────┼─────────┐
     │         │         │
     ▼         ▼         ▼
[Inventory] [Access] [Export]
   Engine    Engine   Service
     │         │         │
     └─────────┴─────┬───┘
                     │
             [requestJira()
              API Gate]
                     │
                     ▼
              [Jira API]
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
      [Metadata]           [Permissions]
      (projects,           (roles,
       users)              scopes)
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
     [Ledger]            [Snapshot]
     (audit trail)       (governance
      immutable)         state)
          │                     │
          └──────────┬──────────┘
                     │
                [Forge Storage]
                     │
          (encrypted, persistent)
                     │
     ┌───────────────┴───────────────┐
     │                               │
     ▼                               ▼
 [Export ZIP]                  [Ledger Hash
  (compliance                   (for offline
   artifact)                    verification)
```

---

## Trust Boundaries and Crossing Points

| Boundary | Type | Control |
|----------|------|---------|
| Jira API | Network (OAuth2) | Forge requestJira() enforces scopes and authentication |
| Forge Storage | Data isolation | Atlassian tenant isolation; per-tenant KV store |
| Runtime | Process | Atlassian Forge sandbox; CPU, memory, execution time limits |
| Export | Integrity | SHA256 hashing; deterministic ordering; build identity markers |

---

## No External Network Paths

FirstTry does NOT:
- Call external HTTP/HTTPS endpoints
- Use external DNS lookups (except indirectly via Jira Cloud endpoint)
- Send data to non-Atlassian services
- Use third-party analytics, telemetry, or monitoring services

All data exchange occurs exclusively within Atlassian's network infrastructure.

---

## Scalability and Resilience Notes

- **Scalability**: Delegated to Forge platform; FirstTry is stateless within single app instance
- **High availability**: Dependent on Forge SLA; no independent HA mechanism
- **Failover**: Forge platform handles automatic failover of app instances
- **Blast radius**: If app crashes, Forge restarts; if Forge is unavailable, app is unavailable

---

## Change Log

- **2026-02-26**: Initial architecture documentation
