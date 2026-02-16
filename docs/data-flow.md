# FirstTry Data Flow Architecture

## System Diagram

```
┌─────────────────────┐
│  Confluence User    │
│  Opens Gadget       │
└──────────┬──────────┘
           │
           ▼ (Forge)
┌─────────────────────────────────────────┐
│  FirstTry Forge App                     │
│  - Context: siteId, userId, etc         │
│  - assertTenantInvariant check          │
└────────────┬────────────────────────────┘
             │
             ▼ (Storage Layer)
┌─────────────────────────────────────────┐
│  Atlassian Forge Storage API            │
│  (Tenant-isolated, encrypted at rest)   │
└─────────────────────────────────────────┘
```

## Data Boundaries

**Ingress**:
- Forge OAuth passes site ID, user context
- No external authentication
- Tenant isolation enforced at platform

**Processing**:
- Application layer applies `assertTenantInvariant()` before storage access
- Storage keys enumerated and verified (see docs/storage-inventory.md)
- All operations scoped to site ID

**Egress**:
- PDF export (deterministic serialization, no network calls)
- No outbound HTTP/fetch/WebSocket
- Manifest declares no external permissions

## Isolation Enforcement

**Platform Level** (Atlassian Forge):
- Automatic storage isolation per tenant
- OAuth context validation

**Application Level** (FirstTry):
- `assertTenantInvariant()` in tenantInvariant.ts
- Cross-tenant read tests in tenantIsolation.spec.ts
- Storage key registry enforcement

See `tests/security/tenantInvariant.spec.ts` and `tests/security/tenantIsolation.spec.ts` for verification.

---

**Version**: 4.2.1  
**Last Updated**: 2026-02-16
