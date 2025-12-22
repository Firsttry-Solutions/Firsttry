# FirstTry Support & Contact

## Getting Help

FirstTry is a community-supported Jira app. We're here to help you succeed.

## Contact Channels

### GitHub Issues (Recommended for Technical Issues)

For bugs, feature requests, or technical questions:

**Repository**: [https://github.com/user/firstry](https://github.com/user/firstry)  
**Issues**: [https://github.com/user/firstry/issues](https://github.com/user/firstry/issues)

When reporting an issue, include:
- Your FirstTry version: `firstry --version`
- Your Jira version
- Steps to reproduce
- Error messages (from CLI or audit trail)
- Output of `firstry export` (policies only, sanitized)

### Email (For Sensitive Issues)

For security vulnerabilities or sensitive topics:

**Email**: Contact maintainers via GitHub (email address in repository profile)

**Response time**: Best effort (community project)

### Atlassian Community

For questions about Jira compatibility or app integration:

**Forum**: [Atlassian Community - Apps](https://community.atlassian.com/t5/Jira-Cloud-apps/ct-p/jira-cloud-apps)

## Support Channels by Issue Type

| Issue Type | Recommended Channel | Response Time |
|-----------|---------------------|---------------|
| **Bug report** | GitHub Issues | 3-7 days (best effort) |
| **Feature request** | GitHub Issues | 3-7 days (best effort) |
| **Security vulnerability** | Email (private) | 48 hours |
| **Usage question** | GitHub Issues or Atlassian Community | 3-7 days |
| **Jira compatibility** | Atlassian Community | Varies |

## Troubleshooting Guide

### Common Problems

#### Problem: "JIRA_UNAVAILABLE" Error

**Symptom**: `firstry` commands fail with "JIRA_UNAVAILABLE"

**Cause**: Jira Cloud API is unreachable or slow

**Solution**:
1. Check [Jira Cloud Status](https://status.atlassian.com)
2. Retry after 5 minutes
3. Check your internet connection
4. If persistent, file a GitHub issue with the timestamp and error code

#### Problem: "INVALID_POLICY" Error

**Symptom**: Policy evaluation fails with "INVALID_POLICY"

**Cause**: Policy ruleset has syntax error

**Solution**:
1. Run: `firstry policy validate <policy-id>`
2. Review the error message (includes line number)
3. Fix the policy: `firstry policy update <policy-id> --rules <rules.json>`
4. If you can't fix it, delete and re-create: `firstry policy delete <policy-id>`

#### Problem: "STORAGE_QUOTA_EXCEEDED" Error

**Symptom**: Cannot create new policies; error "STORAGE_QUOTA_EXCEEDED"

**Cause**: Forge storage limit reached (policies, metadata, audit entries)

**Solution**:
1. Check current usage: `firstry storage info`
2. Delete unused policies: `firstry policy delete <policy-id>`
3. Clear old metadata cache: `firstry cache clear`
4. If still full, delete all and start over: `firstry policy delete --all` (WARNING: irreversible)
5. Contact support if quota seems too low

#### Problem: "SCHEMA_VERSION_MISMATCH" Error

**Symptom**: Policies fail to load after FirstTry upgrade; error "SCHEMA_VERSION_MISMATCH"

**Cause**: Policy format changed in new version

**Solution**:
1. Upgrade FirstTry to latest: `npm update firstry`
2. Run auto-migration: `firstry migrate --auto` (usually works)
3. If migration fails, export and manually fix:
   ```
   firstry export > backup.json
   # Edit backup.json to match new schema (check docs)
   firstry import < backup.json
   ```

#### Problem: No Policies Are Being Evaluated

**Symptom**: Policies created, but no audit entries; transitions are not blocked

**Cause**: Policies may be disabled or Jira app may not have required scopes

**Solution**:
1. Check policy status: `firstry policy list`
2. Ensure policies have `enabled: true`
3. Check Jira app scopes: Go to Jira Settings > Apps > Manage Apps > FirstTry > Permissions
4. Required scopes: `read:jira-work`, `write:jira-work`, `read:account`
5. If scopes are missing, reinstall the app: `firstry reinstall`

### Diagnostic Commands

Use these commands to debug issues:

```bash
# Show FirstTry version and environment
firstry --version
firstry --diagnostics

# List all policies with status
firstry policy list --verbose

# Show usage metrics and entitlements
firstry entitlement info
firstry usage current

# Export all data for analysis
firstry export > data.json

# View audit trail (recent entries)
firstry audit list --limit 50

# Filter audit by error type
firstry audit list --error-only

# Check Forge storage usage
firstry storage info

# Validate all policies for syntax errors
firstry policy validate --all

# Clear caches and reinitialize
firstry cache clear
firstry init
```

## Escalation Procedure

If you can't resolve your issue:

1. **Document the problem**:
   - Note the exact error code and timestamp
   - Run `firstry export` to capture state
   - Run `firstry audit list --error-only` to capture recent failures
   - Save outputs to files

2. **Search existing issues**:
   - Go to [GitHub Issues](https://github.com/user/firstry/issues)
   - Search by error code (e.g., "JIRA_UNAVAILABLE")
   - Check if someone has reported the same issue

3. **Create a GitHub issue**:
   - Title: Concise description (e.g., "INVALID_POLICY on schema migration")
   - Body: Include the diagnostic outputs above
   - Label: Use labels like `bug`, `help-wanted`, `security`

4. **Email if sensitive**:
   - For security issues, email the maintainers privately
   - Include a link to a draft GitHub issue (optional, for reference)

5. **Wait for response**:
   - Maintainers will comment within 3-7 days (best effort)
   - Be prepared to provide more information

## Feature Requests

To request a new feature:

1. **Check if it's already requested**: Search [GitHub Issues](https://github.com/user/firstry/issues) for similar ideas
2. **Open a GitHub issue**:
   - Label: `enhancement` or `feature-request`
   - Title: Clear description of the feature
   - Body: Explain the use case and why it matters
   - Attach mockups or examples if helpful

3. **Vote with reactions**: If you like an existing feature request, add a 👍 reaction to show support

## Billing & Entitlements

For questions about plan limits, usage billing, or entitlements:

**GitHub Issues**: [Feature: Entitlements](https://github.com/user/firstry/issues) or tag `entitlements`

Entitlements are evaluated automatically based on your Jira plan:
- **Jira Free**: Baseline entitlements (limited features)
- **Jira Standard/Premium**: Pro entitlements (full features)
- **Jira Enterprise**: Enterprise entitlements (advanced features)

No additional configuration needed.

## Related Documentation

- [Security Model](./SECURITY.md)
- [Privacy Policy](./PRIVACY.md)
- [Reliability SLAs](./RELIABILITY.md)
- [Shakedown Test Harness](./SHAKEDOWN.md)
- [README](../README.md)
