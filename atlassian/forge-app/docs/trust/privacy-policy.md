# Privacy Policy

**Last updated: 2026-03-02**

> This is the canonical privacy policy for FirstTry. For the detailed technical specification, see **[PRIVACY_POLICY.md](PRIVACY_POLICY.md)**.

## Data we access

FirstTry accesses Jira administrative data to detect security misconfigurations:

- **User and group information**: To identify administrators, shadow administrators, and permission patterns
- **Project configurations**: To detect overly permissive project settings
- **Permission schemes**: To analyze access control configurations
- **Audit logs**: For timeline reconstruction and compliance verification

## Why we access it

We access this data to:
- Detect privilege escalation risks and shadow administrators
- Identify misconfigurations that could lead to data exposure
- Generate compliance-ready audit reports
- Provide actionable remediation guidance

## Data retention

- **Scan results**: Retained in Forge storage until explicitly deleted or app uninstalled
- **Temporary processing data**: Cleared after report generation
- **No persistent copies**: All data stays in your Jira Cloud instance or ephemeral Forge runtime

See **[Data Retention & Deletion](data-retention-deletion.md)** for full details.

## Data deletion

Upon app uninstallation:
1. All Forge storage keys are automatically deleted by Atlassian platform
2. No data is retained outside your Jira instance
3. No backups or copies exist in external systems

You can also manually delete scan results at any time from within the app.

## Contact

For privacy inquiries:
- Email: See [SECURITY_CONTACT.md](SECURITY_CONTACT.md)
- Security issues: See [Vulnerability Disclosure](vulnerability-disclosure.md)

---

**For comprehensive technical details, see: [PRIVACY_POLICY.md](PRIVACY_POLICY.md)**

<!-- BEGIN: GENERATED_FACTS -->
### Contacts (Generated)

**Privacy inquiries:** privacy@firsttry.solutions
**General support:** support@firsttry.solutions

For data access, correction, or deletion requests, contact privacy@firsttry.solutions.
<!-- END: GENERATED_FACTS -->
