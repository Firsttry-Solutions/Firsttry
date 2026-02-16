# Vendor Exit Scenario (Termination / Sunset Plan)

This document describes what happens if FirstTry ceases operations or support.

## Facts / Boundaries
- FirstTry runs on Atlassian Forge.
- FirstTry does not operate external infrastructure for customer data storage (see [data-flow.md](data-flow.md)).
- Any data stored by the app is stored in Forge tenant-scoped storage (Forge-managed).

## If FirstTry ceases operations
1. Customer can uninstall the app from Jira Cloud at any time.
2. Before uninstall, customer can generate and download export artifacts available in-app (where applicable).
3. No customer data is stored in external systems by FirstTry (see [data-flow.md](data-flow.md)).
4. Post-uninstall, any continued app access is not possible because the app is removed from the tenant.

## Data deletion / retention caveat (truthful)
- Uninstall removes the app from the tenant. Data retention/deletion behavior for Forge-hosted app storage is controlled by Atlassian platform behavior and is not independently guaranteed by the vendor.
- FirstTry does not possess separate copies of tenant data outside Forge storage.

## References
- Data boundaries: [data-flow.md](data-flow.md)
- Procurement summary: [procurement-summary.md](procurement-summary.md)
- Non-claims: [non-claims.md](non-claims.md)
