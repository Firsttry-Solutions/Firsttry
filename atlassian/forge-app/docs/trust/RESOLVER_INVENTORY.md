# Resolver Inventory

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual (Updated when resolver list changes)

---

## Overview

This inventory lists all FirstTry resolver files that call external APIs (Jira), the endpoints accessed, and HTTP methods used.

**Purpose**: Support MUTATION claim that FirstTry performs no WRITE operations (POST/PUT/DELETE).

---

## Resolver Files

| File | Purpose | Endpoints Called | HTTP Methods |
|------|---------|------------------|--------------|
| `src/milestone1/engines/inventory-engine.ts` | Project & user enumeration | GET /projects, GET /myself | GET |
| `src/milestone1/engines/access-engine.ts` | Permission matrix capture | GET /permissions | GET |
| `src/milestone1/engines/gadget-controller.ts` | Real-time dashboard data | GET /myself | GET |
| `src/phase7/export-service.ts` | Export formatting (no API calls) | (none) | (none) |
| `tools/enterprise_audit.py` | Evidence generation (static analysis) | (none) | (none) |

---

## Jira Endpoints Accessed

| Endpoint | HTTP Method | Purpose | Scope Required |
|----------|------------|---------|-----------------|
| `/rest/api/3/myself` | GET | Current user context | read:jira-user |
| `/rest/api/3/permissions` | GET | Permission matrix | read:jira-work |
| `/rest/api/3/projects` | GET | Project list | read:jira-work |
| `/rest/api/3/fieldconfiguration` | GET | Field metadata | read:jira-work |

---

## HTTP Methods Detected

| Method | Count | Status |
|--------|-------|--------|
| **GET** | 15+ | ✅ Read-only (expected) |
| **POST** | 0 | ✅ Not found (expected) |
| **PUT** | 0 | ✅ Not found (expected) |
| **DELETE** | 0 | ✅ Not found (expected) |
| **PATCH** | 0 | ✅ Not found (expected) |

---

## Evidence of Non-Mutation

**Evidence file**: `docs/evidence/<date>_release/resolver_scan.txt`

**Validation**: Enterprise docs gate (`tools/enterprise_docs_gate.sh`) scans resolver_scan.txt and fails if POST/PUT/DELETE is detected in production code paths.

**Result**: No POST/PUT/DELETE found in resolver code ✅

---

## Dynamic Endpoint Review

**Dynamic calls** (calls with variable endpoints):
- Wrapped in `jiraRequestGuard()` function (enforces GET only)
- Scoped to documented endpoints above
- No cross-tenant calls possible (Jira API enforces tenant isolation)

---

## References

- [SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md): Mutation claim context
- [docs/evidence/baselines/](../evidence/baselines/): SHA256 baseline for deterministic scanning
