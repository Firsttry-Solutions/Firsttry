# STOP_REQUIREMENTS — Gate 1 + Gate 2 Implementation Blocked

## Issue
Gate 1 + Gate 2 implementation requires **operational truth** that cannot be inferred from code.

## Blocker: Missing docs/VENDOR_FACTS.yml

To generate non-placeholder enterprise + reviewer documentation, you must supply the following truth values in **docs/VENDOR_FACTS.yml**.

### Required File Format (YAML)

Create: `docs/VENDOR_FACTS.yml` with these keys populated (no placeholders, no TBD, no TODO):

```yaml
legal_entity_name: "Your Legal Company Name"
support_email: "support@yourdomain.com"
security_email: "security@yourdomain.com"
vulnerability_ack_sla: "24 hours"
vulnerability_triage_sla: "48 hours"
incident_comm_channel: "security@yourdomain.com or security hotline"
retention_duration: "30 days" # or your actual policy
deletion_request_process: "Email support@yourdomain.com with subject 'Data Deletion Request'"
```

### Why This Is Required

1. **Privacy Policy** requires legal entity name, retention policy, deletion process
2. **Security Contact** requires security email and SLA commitments
3. **Incident Response** requires communication channel and response times
4. **Data Retention** requires exact retention duration policy
5. **Terms of Service** requires legal entity name and contact info

These values **cannot be proven from repo code**. Creating docs without them would violate the "no placeholders / no guessing" rule.

### Why STOP Here

Per mega-prompt rules:
- **R1**: No guessing. If truth cannot be proven, STOP.
- **R2**: Everything must be evidence-backed
- Creating placeholder docs would violate Gate philosophy

### Next Steps

1. **Provide actual values** in `docs/VENDOR_FACTS.yml`
2. Commit: `git add docs/VENDOR_FACTS.yml && git commit -m "docs: vendor operational truth (Gate 1+2 requirement)"`
3. Re-run the Gate 1 + Gate 2 mega-prompt

### Example Validation

After creating `docs/VENDOR_FACTS.yml`, the mega-prompt will:
1. Load and validate it has no placeholders
2. Generate all required Gate 1+2 docs using actual values
3. Run proof tests (both gates must pass, exit=0)
4. Commit everything
5. Generate FINAL_PROOF.md with SHA

---

**Status**: ⏸️ PAUSED — Awaiting input  
**Evidence**: See /tmp/ft_gate/manifests_all.txt (5 manifests found, canonical: ./atlassian/forge-app/manifest.yml)
