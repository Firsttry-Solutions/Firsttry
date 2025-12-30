# Uninstall and Data Cleanup

This document describes the effect of uninstalling the app and the customer-facing cleanup steps.

Uninstall behavior
- Uninstalling the Forge app from a Jira Cloud site does NOT automatically delete Forge Storage data. Forge Storage is tenant-scoped and persists after app uninstall.

Customer deletion steps (recommended)
1. Before uninstall: export any required reports via the admin UI (JSON/PDF) — see `EXPORT_FORMAT.md`.
2. If the customer requires Forge Storage deletion after uninstall, contact Atlassian support with the tenant cloudId and request Forge Storage deletion. Use the support contact described in `SUPPORT.md`.
3. Provide the Atlassian support request with the app id and evidence that you own the tenant.

Template support request (copy-paste)
```
Subject: Request to delete Forge Storage for FirstTry app

Body:
Please delete Forge Storage for app id ari:cloud:ecosystem::app/59d86182-c1c6-49ea-b2fb-6ee5be52b7fc for tenant the site identifier (cloudId). The customer has uninstalled the app and requests permanent deletion of app storage. Contact: contact@firsttry.run
```

Notes
- Developers cannot delete tenant Forge Storage on behalf of customers. This is a platform limitation and is documented in `DATA_RETENTION.md`.
