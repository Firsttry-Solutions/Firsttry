# Permissions and Scopes

## Forge Manifest
Source: ./atlassian/forge-app/manifest.yml

## Declared Scopes (List EXACT)
- READ scopes: jira:read:issue, jira:read:metadata, jira:read:user
- WRITE scopes: jira:write:issue, jira:write:comment
- WEBHOOK: jira:issue:updated, jira:issue:created, jira:comment:created

## Least Privilege Rationale
- **jira:read:issue**: Required to fetch issue details for audit/sync
- **jira:read:metadata**: Required to retrieve project/field metadata
- **jira:read:user**: Required to identify audit changes by user
- **jira:write:issue**: Minimal scope - only for sync/mirror operations
- **jira:write:comment**: Minimal scope - only for audit notes
- **Webhooks**: Event-driven monitoring of issue/comment changes for compliance tracking