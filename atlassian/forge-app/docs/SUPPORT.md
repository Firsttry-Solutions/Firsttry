# Support Documentation

**Last Updated**: January 2026

---

## Getting Support

### Support Email
- **Primary**: support@firstry.io
- **Alternative**: support@firstry.io (replace with your actual support contact)

### Support Hours
- **Monday–Friday**: 9 AM–5 PM PT
- **Holidays**: Closed (US holidays observed)
- **Response target**: Best effort within 2 business days

---

## How to Report an Issue

When contacting support, please include:

1. **Build Identity** (from the dashboard):
   - `ui_git_sha`: The git commit SHA displayed in the dashboard
   - `ui_bundle_hash`: The bundle hash displayed
   - Example: `ui_git_sha=3bddca6214fdd3319eb14d7a16696341501d3fed`

2. **Request Identifier**:
   - `ui_req_id`: Shown in debug mode (?ft_debug=1) or browser console
   - Helps correlate your request with server logs

3. **Dashboard State**:
   - Is the snapshot showing AVAILABLE, NO_SNAPSHOT, HARD_ERROR, or INVALID_SNAPSHOT?
   - Include a screenshot if possible

4. **Steps to Reproduce**:
   - What were you doing when the issue occurred?
   - Does it happen consistently or intermittently?

5. **Your Jira Workspace**:
   - Workspace URL (e.g., https://your-workspace.atlassian.net)
   - Your Jira user display name

---

## Common Issues

### Issue: Dashboard shows "NO_SNAPSHOT"
**Meaning**: No build snapshot is available yet.  
**Solution**: 
- Wait for a build to complete
- Click "Refresh" button to re-check
- Verify your Jira workspace has the Forge app enabled

### Issue: Dashboard shows "HARD_ERROR"
**Meaning**: The snapshot service encountered an error.  
**Solution**:
- Click "Refresh" to retry
- Check your Jira workspace is accessible
- Contact support with your ui_req_id (enable debug mode: ?ft_debug=1)

### Issue: Dashboard shows "INVALID_SNAPSHOT"
**Meaning**: The snapshot data is malformed or expired.  
**Solution**:
- Click "Refresh" to fetch a new snapshot
- If persistent, contact support with your ui_req_id

### Issue: Export button does not work
**Meaning**: The snapshot cannot be exported (may be missing data).  
**Solution**:
- Ensure dashboard shows AVAILABLE state
- Try refreshing first
- Contact support if the issue persists

### Issue: Debug mode (?ft_debug=1) shows red errors
**Meaning**: Network or serialization error in the dashboard.  
**Solution**:
- Check your internet connection
- Verify your Jira credentials are valid
- Contact support with the console error message (copy-paste the full error)

---

## Escalation Path

1. **First contact**: Email support address above (2-business-day SLA)
2. **No response within 2 business days**: Reply to escalate the ticket
3. **Urgent issues**: Mention "URGENT" in the subject line

---

## SLA (Service Level Agreement)

| Severity | Response Time | Resolution Target |
|----------|---------------|-------------------|
| **Critical** (app down) | 4 hours | 24 hours |
| **High** (major feature broken) | 8 hours | 3 days |
| **Medium** (workaround exists) | 2 business days | 5 business days |
| **Low** (minor issue) | 3 business days | Best effort |

*SLAs are best-effort; not guaranteed.*

---

## Security Vulnerabilities

**DO NOT** report security vulnerabilities via GitHub issues.

See [SECURITY.md](SECURITY.md) for responsible disclosure process.

---

## Service Level Expectations

**IMPORTANT**: This app provides **NO SERVICE LEVEL AGREEMENT (SLA)**.

- **Availability**: Dependent on Atlassian Forge platform (see [PLATFORM_DEPENDENCIES.md](PLATFORM_DEPENDENCIES.md))
- **Response Time**: Best effort, no guaranteed timeframe
- **Resolution Time**: UNKNOWN
- **Support Hours**: UNKNOWN (maintainers operate on voluntary basis)
- **Correlation ID** for tracing

## Troubleshooting Steps

1. **Check Health Dashboard**
   - Go to FirstTry admin UI
   - Look at current HealthStatus (HEALTHY, DEGRADED, UNHEALTHY, UNKNOWN)
   - If UNKNOWN, we don't have enough data yet

2. **Collect Correlation ID**
   - Reproduce the issue
   - Copy the correlation ID from the error message
   - Include it in your support ticket

3. **Verify Tenant Isolation**
   - We verify your Jira site is properly isolated
   - No other site can access your data
   - Tenant tokens prevent accidental cross-site leaks

4. **Check Recent Metrics**
   - If you have admin access: `GET /-/firstry/health`
   - Shows recent success rates for snapshots and exports
   - Shows drift detection status
   - Shows any DEGRADED or EXPIRED conditions

## SLI-Based Reliability

First Try tracks these reliability metrics:

- **snapshot_success_rate**: % of snapshot creations that succeed (target: 99.5%)
- **export_success_rate**: % of exports that complete (target: 99.5%)
- **truth_determinism_rate**: % of outputs with consistent truth metadata (target: 100%)
- **drift_detection_rate**: % of drift detections that are accurate (target: 100%)
- **degraded_export_rate**: % of exports marked as DEGRADED (target: <0.5%)
- **false_green_rate**: % of "VALID" outputs that are false positives (target: 0%)

If internal reliability indicators fall below expected thresholds, the issue may be reviewed by maintainers on a best-effort basis. This does not imply automated escalation or guaranteed response.

## Known Limitations

1. **UNKNOWN Status**
   - When health summary shows UNKNOWN, it means we don't have complete recent data
   - This is **not** a failure (see next point)
   - We explicit  reject guessing; UNKNOWN is preferred to false confidence

2. **Retention Policy**
   - Metric events are retained for 90 days by default
   - Correlation IDs are only useful within this window
   - After 90 days, we cannot trace historical issues

3. **Tenant Isolation**
   - If you migrate your Jira site or change cloudId, metric history resets
   - This is intentional (old tenant data is not carried forward)

4. **No Admin Bypass**
   - FirstTry applies the same rules to all tenants
   - There is no "skip validation" mode
   - This ensures consistency and prevents data corruption

## Escalation Path

1. Primary: GitHub Issues (link above)
2. If an issue requires escalation, include `@maintainers` and request an expedited response in the issue body
3. If SEV1 unresolved after an agreed acknowledgement, escalate within repository issue to maintainers
4. All escalations should include the correlation ID trace

## FAQ

**Q: Why is my export showing DEGRADED instead of VALID?**  
A: The output has warnings or incomplete data. Check the export's `missingData` field in the dashboard.

**Q: Why is drift_status showing UNKNOWN?**  
A: Drift detection requires at least 2 snapshots. Create another snapshot to enable drift detection.

**Q: Can you help me interpret a specific correlation ID?**  
A: Yes. Please include the full 32-character ID, the timestamp, and your Jira site name.

**Q: Why do my metrics reset after I update my Jira site?**  
A: Tenant tokens are based on your cloudId. Changing it creates a new tenant in our system. This is intentional for security.

**Q: Is my data safe?**  
A: Your actual snapshot and configuration data is never sent to FirstTry. We only receive metadata about success/failure and error classification. All metrics are hashed and tenant-scoped.

## Contact

For support escalations or questions about this policy:

**Primary support (issues):** https://github.com/Global-domination/Firstry/issues
**Status Page:** Not documented

## Contact
For support requests, contact: contact@firsttry.run
