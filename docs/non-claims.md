# Non-Claims & Explicit Limitations

## SOC 2, ISO, Pentest Non-Claims

This application makes **no claims** regarding:
- SOC 2 Type II certification or compliance
- ISO/IEC 27001 certification or compliance
- ISO/IEC 27002 implementation
- NIST Cybersecurity Framework implementation
- PCI-DSS compliance
- Pentest certifications or completion
- HITRUST certification

Interior references to control mappings (e.g., SOC 2, NIST, ISO) are **internal interpretive references only** and are **not validated or certified by any external body**. These references are for internal governance and do not constitute claims of compliance.

## Scope & Applicability

This documentation describes:
- Implementation details of the FirstTry Forge application
- Architectural decisions and rationale
- Testing and verification practices
- Tenant isolation constraints
- Data handling practices

This documentation **does not**:
- Make warranties regarding security outcomes
- Guarantee protection against any specific threat class
- Represent completion of formal security audits
- Supersede official vendor documentation
- Override contractual terms with Atlassian Forge platform

## Vendor Control

First Try Solutions retains sole control of:
- Deployment decisions
- Secret management practices
- Access controls
- Incident response procedures

## Third-Party Dependencies

Security of this application depends upon:
- Atlassian Forge platform isolation mechanisms
- Node.js runtime security
- npm/pnpm package ecosystem integrity
- Operating system and container runtime

First Try Solutions does not control these dependencies and assumes responsibility only for application-layer code.

## Data Retention & Deletion

- Data retention is application-determined and configurable.
- Deletion is supported via storage API.
- No guarantees are made regarding permanent destruction (depends on underlying infrastructure).

## Performance & Scale

- Scale envelope (docs/scale-envelope.md) reflects tested configurations only.
- Performance is load-dependent and not guaranteed.
- Availability depends on Forge platform availability.

## Version & Update Policy

- This document reflects version 4.2.1.
- Updates may occur without notice.
- Backward compatibility is not guaranteed across major versions.

## Support & Liability

Contact vendor for support terms. See docs/support-policy.md for service levels.

---

**Last Updated**: 2026-02-16  
**Document Version**: 4.2.1
