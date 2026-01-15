# Corpus Policy: Public vs Internal Classification

**Last Updated**: 2025-01-15  
**Audit Phase**: 9C - Overclaim Purge + Corpus Truth Lock

---

## PUBLIC / REVIEWER-VISIBLE (STRICT SCANNING)

### Marketplace Reviewer Will See:
1. **GitHub Repository Structure** (public clone)
   - `README.md` (root)
   - `/docs/**` directory (all public-linked content)
   - `/atlassian/forge-app/docs/**` (app documentation)
   - `/atlassian/forge-app/legal/**` (legal documents)
   - Any file directly linked from above

2. **Deployed Artifacts** (if applicable)
   - GitHub Pages site (if configured)
   - Marketplace listing description (if stored in repo)
   - Any artifact published to external URL

3. **Transitive Corpus** (through links)
   - Any file linked from the above
   - All markdown/HTML files in primary doc directories
   - Legal/privacy/security documents in public paths

### STRICT SCANNING RULES FOR PUBLIC CORPUS:
- ❌ **Hard-Forbidden**: "guaranteed", "always available", "enterprise-ready", "mission-critical" (unconditional)
- ⚠️ **SLA-Sensitive**: "SLA" term only allowed if explicitly negated ("NO SLA", "not an SLA", "non-binding", "best-effort")
- ✅ **Allowed in Public**: Factual claims backed by code/tests, qualified language, documented scope

---

## INTERNAL-ONLY (INFORMATIONAL)

### Examples of Internal Directories:
- `/docs/audit/**` (audit artifacts, not linked from public)
- `/docs/internal/**` (explicitly internal)
- `/docs/proofs/**` (runtime proofs)
- `/docs/PHASE*/**` (audit phase documents)
- `/audit_artifacts/**` (audit-generated)
- `/atlassian/forge-app/tests/**` (test documentation)
- Generated reports not linked from public corpus

### Exemption Criteria:
- NOT listed in any public entrypoint (`README.md`, `docs/index.*`, etc.)
- NOT deployed to public URL
- NOT referenced from `atlassian/forge-app/docs/**`
- Explicitly marked as internal-only

### SCANNING MODE FOR INTERNAL:
- Report findings **informational only** (non-blocking)
- Provide evidence for auditor review
- Flag patterns for future hardening

---

## CORPUS DEFINITION FOR PHASE 9C

### True Public Prefixes (Marketplace/Reviewer Visible):
```
atlassian/forge-app/legal/
docs/legal/
docs/marketplace/
docs/support/
docs/security/
README.md (root only)
```

### Internal Excludes (Development Phase Docs - EXCLUDE from PUBLIC):
Under `docs/`:
```
docs/audit/
docs/audit_reports/
docs/evidence/
docs/internal/
docs/proofs/
docs/PHASE*
docs/DOCS_*
```

Under `atlassian/forge-app/docs/`:
```
atlassian/forge-app/docs/PHASE*
atlassian/forge-app/docs/P4_P5_*
atlassian/forge-app/docs/P5_*
atlassian/forge-app/docs/PHASE_*
atlassian/forge-app/docs/HEARTBEAT_* (internal deliverables tracking)
atlassian/forge-app/docs/MARKETPLACE_REVIEWER_* (audit artifact)
atlassian/forge-app/docs/MARKETPLACE_SUBMISSION_* (internal tracking)
```

**Rationale**: Phase documentation (P4, P5, HEARTBEAT, MARKETPLACE_REVIEWER) are internal development/audit artifacts. They describe implementation phases and internal verification processes, not product features visible to users/marketplace reviewers.

### Entry Points (checked for links to external/public):
- `README.md`
- `docs/README.md`
- `docs/index.md`
- `docs/index.html`
- `atlassian/forge-app/README.md`
- `atlassian/forge-app/docs/index.md`

---

## APPLICATION

**Phase 9C Scanner** (`p9c_overclaim_scan.py`):
1. Identifies all tracked files
2. Classifies as PUBLIC or INTERNAL based on prefixes
3. Runs STRICT rules on PUBLIC corpus
4. Runs INFORMATIONAL mode on INTERNAL corpus
5. **Blocks marketplace release** if PUBLIC violations found
6. Generates two reports: blocking (public) + informational (internal)

**Enforcement**:
- EXIT CODE 2: Blocking public overclaims detected
- EXIT CODE 0: Public corpus clean (release ready)
- Both codes generate detailed JSON+Markdown reports

---

## FIX STRATEGY

If blocking public overclaims detected:

1. **"guaranteed" / "GUARANTEED"**
   - Replace with: `designed to be deterministic under <test harness>`
   - Or: `verified by tests in <path>`
   - Or: Qualified claim with scope

2. **"ALWAYS AVAILABLE" / "always available"**
   - Replace with: `available when prerequisites are met`
   - Or: `best-effort availability`
   - Or: `falls back to <fallback mechanism>`

3. **"enterprise-ready" / "Enterprise-ready"**
   - Remove unqualified claim
   - Replace with: `supports enterprise security requirements` + link to proof doc
   - Never: "is enterprise-ready" (claim without evidence)

4. **"mission-critical"**
   - Remove unless explicitly scoped to specific use case
   - Replace with: `suitable for <specific scenario>` + evidence

5. **"SLA" (unqualified)**
   - Ensure: `NO SLA`, `not an SLA`, `non-binding`, or `best-effort` appears
   - In same paragraph or immediately nearby

---

## COMPLIANCE CHECKLIST

- [ ] All public corpus files scanned with strict rules
- [ ] Zero hard-forbidden unqualified terms in public docs
- [ ] All SLA mentions explicitly negated or marked non-binding
- [ ] Internal corpus exemptions properly classified
- [ ] Reports generated and committed
- [ ] Exit code 0 achieved (public clean)
- [ ] Marketplace reviewer-safe status achieved
