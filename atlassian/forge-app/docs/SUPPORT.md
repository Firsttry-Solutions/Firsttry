# Support Documentation

**App Name**: FirstTry Governance - Atlassian Dual-Layer Integration  
**Last Updated**: 2025-12-22  
**Status**: Production  

---

## Support Channels

### Primary Support

**Method**: GitHub Issues  
**URL**: https://github.com/Global-domination/Firstry/issues  
**Response Time**: Best effort (no SLA)  
**Scope**: Bug reports, feature requests, technical questions

**Process**:
1. Open issue in GitHub repository
2. Include app version, Jira Cloud site ID (if applicable), and detailed description
3. Maintainers will respond when available (no guaranteed timeframe)

### Community Support

**Method**: Public repository discussions  
**URL**: https://github.com/Global-domination/Firstry/discussions  
**Scope**: General questions, usage guidance, community-contributed solutions

---

## What We Support

✅ **Bug Fixes**: Issues with app functionality as documented  
✅ **Documentation Clarifications**: Ambiguities or errors in docs  
✅ **Feature Requests**: Suggestions for future enhancements (no commitment)  

❌ **NOT SUPPORTED**:
- Jira Cloud platform issues (contact Atlassian support)
- Forge runtime issues (contact Atlassian Forge support)
- Custom development or consulting
- Urgent/emergency support outside GitHub issues
- Phone or video call support

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

If any SLI drops below target, we escalate automatically.

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

1. Initial support email: [SUPPORT_EMAIL_TO_BE_SET]
2. If no response in 2x response target: escalate to engineering
3. If SEV1 unresolved after 4 hours: escalate to on-call engineer
4. All escalations include full correlation ID trace

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

**Email:** [SUPPORT_EMAIL_TO_BE_SET]  
**Status Page:** [STATUS_PAGE_URL_TO_BE_SET]
