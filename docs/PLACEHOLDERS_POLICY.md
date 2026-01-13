# FirstTry Placeholder Policy

**Effective Date**: January 13, 2026  
**Last Audit**: 20260113T125008Z  
**Total Placeholders Tracked**: 384 (28 critical, 34 must-fix)

---

## Why This Policy Exists

Customer-facing documentation **cannot contain unvetted claims, fake data, or incomplete sections**. Placeholders like `TBD`, `TODO`, `ACME Corp`, or `example.com` risk:

- **Marketplace rejection** (reviewers flag incomplete docs)
- **Customer mistrust** (shipped docs appear unfinished)
- **Audit failures** (security teams see templates, not facts)

This policy ensures **every claim is either real, explicitly labeled, or removed**.

---

## Definition: What Is a Placeholder?

A placeholder is any text that is NOT intended for customers to read as-is:

### Hard Placeholders (Always Rejected)
- Explicit: `TBD`, `TODO`, `FIXME`, `XXX`, `REPLACE_ME`, `CHANGEME`, `PLACEHOLDER`
- Bracket blanks: `[___]`, `[TBD]`, `<YOUR_VALUE>`
- Fake identities: `ACME Corp`, `ExampleCorp`, `example.com`, `test@test.com` (without context)
- Missing artifacts: `[insert diagram]`, `[link here]`, `add description`

### Soft Placeholders (Context-Dependent)
- Cost/time claims: `$5,000`, `50% reduction`, `12 hours` (without "EXAMPLE" label in customer-facing docs)
- Compliance claims: `SOC2 compliant`, `GDPR-ready`, `zero-trust` (without proof anchor)
- Vague promises: `best-in-class`, `industry-leading`, `guaranteed` (without evidence)

---

## Severity Levels

| Level | Name | Impact | Action |
|-------|------|--------|--------|
| **SEV-0** | CRITICAL | Hard placeholder in doc-facing file | MUST fix before commit |
| **SEV-1** | HIGH | Fake identity or unanchored claim in docs | MUST fix before commit |
| **SEV-2** | MEDIUM | Cost/time claim without example label | MUST fix before commit |
| **SEV-3** | LOW | Code comment, archived doc, labeled example | Review; allow if context is clear |
| **SEV-4** | INFO | Enterprise claim with proof anchor | No action needed |

---

## How to Handle Placeholders

### Option 1: Replace with Real Value ✅ BEST

```markdown
# BAD
Setup takes [TBD] hours and costs $[UNKNOWN].

# GOOD
Setup typically takes 4-8 hours (depending on your governance model complexity) and requires:
- 2 hours infrastructure setup
- 2-4 hours policy configuration
- 0-2 hours team training (varies by org size)
```

### Option 2: Label Explicitly ✅ ACCEPTABLE (Temporary)

```markdown
# LABELED PLACEHOLDER (with instruction)
[PLACEHOLDER: Your organization name] → Replace with your company name before deploying.

# EXAMPLE CONTEXT (for calculations)
**EXAMPLE ONLY**: With 20 engineers and 24 releases/year, estimated payback: 2.3 months.
*Your actual payback depends on your deployment parameters. Use tools/roi_calc.py for your numbers.*
```

### Option 3: Delete or Move to FAQ ✅ ACCEPTABLE

```markdown
# BAD (in main docs)
Performance optimization: [coming soon]

# GOOD (move to FAQ)
**Q: Is performance optimization roadmapped?**
A: Yes, optimization features are under development. See [ROADMAP.md](ROADMAP.md).
```

### Option 4: Move to Archived/Test Context ✅ ACCEPTABLE

```markdown
# DON'T PUT IN docs/SUPPORT.md
[example@example.com]

# DO PUT IN tests/fixtures/user_data.py OR audit/proposal_demo/
const DEMO_USERS = [
  { email: "example@example.com", org: "ACME Corp" }
];
```

---

## Enforcement Rules

### Pre-Commit Validation

Every commit is validated by `tools/validate_placeholders.py`:

```bash
$ git commit -m "Fix: Replace TBD with actual setup time"
Running placeholder validator...
✓ Placeholder validator passed (no critical issues)
✓ Commit allowed
```

If violations are found:

```bash
$ git commit -m "Add placeholder-based docs"
Running placeholder validator...
❌ PLACEHOLDER VALIDATOR FAILED

Found 3 critical placeholder(s):
  docs/SUPPORT.md:42
    Type: explicit_placeholder
    Text: Setup time TBD

Action Required:
  1. Remove placeholder (replace with real value or delete)
  2. OR move to archived/test context
  3. OR label explicitly
  4. Then commit
```

### CI/CD Gate

The GitHub Actions workflow `.github/workflows/placeholders-guard.yml` blocks merge if:
- SEV-0 or SEV-1 found in `docs/` or `README.md`
- Allowlist is missing rationale
- Validator exits with code 1

### Allowlist Management

See [tools/placeholder_allowlist.yml](../tools/placeholder_allowlist.yml) for current allowlisted items. Every allowlist entry requires:

1. **File pattern** — Which files are affected?
2. **Reason** — Why is this placeholder acceptable?
3. **Status** — Permanent or temporary?

**Rule**: No blank permissions. No allowlist entries without documented rationale.

---

## Examples: Fix Real Placeholders

### Example 1: TBD in Case Studies

**BEFORE** (docs/CASE_STUDIES.md):
```markdown
### Quantified Impact
- **Time Investment**: [X hours per release] — TBD
- **Error Rate**: [X%] — TBD
- **Business Impact**: [Revenue delay] — TBD
```

**AFTER** (Option 1: Replace with context):
```markdown
### Case Study Program Status
FirstTry has not yet been deployed to production customers. Real case studies
with verified metrics will be published after our first customer deployment.

See tools/roi_calc.py for example calculations.
```

### Example 2: ACME Corp in Examples

**BEFORE** (docs/DATA_INVENTORY.md):
```markdown
Example:
  Workspace "ACME Corp" (orgKey=acme-corp)
```

**AFTER** (generic context):
```markdown
Example:
  Workspace "Example Corp" (orgKey=example-corp)
```

### Example 3: Fake Email in Code

**BEFORE** (docs/SECURITY.md):
```markdown
Admin contact: admin@example.com
```

**AFTER** (Option A: generic):
```markdown
Admin contact: [your admin email]
```

**OR AFTER** (Option B: real email):
```markdown
Admin contact: support@firsttry.dev
```

---

## Audit Results

**Date**: 20260113T125008Z  
**Files Audited**: 983 doc/config files  
**Total Matches**: 384

### Breakdown by Severity

| Severity | Count | Status |
|----------|-------|--------|
| SEV-0 (CRITICAL) | 28 | Fixed or allowlisted |
| SEV-1 (HIGH) | 6 | Fixed or allowlisted |
| SEV-2 (MEDIUM) | 167 | Under review |
| SEV-3 (LOW) | 177 | Allowlisted or legitimate |
| SEV-4 (INFO) | 6 | No action needed |

### Audit Tools

- **Scan Tool**: `ripgrep` (6 pattern searches)
- **Registry**: [20_placeholder_registry.json](../tmp/ft_placeholders_audit_20260113T125008Z/20_placeholder_registry.json)
- **Report**: [20_audit_report.md](../tmp/ft_placeholders_audit_20260113T125008Z/20_audit_report.md)
- **Validator**: [tools/validate_placeholders.py](tools/validate_placeholders.py)

---

## For Contributors

When adding documentation:

1. **Before committing**, run placeholder validator:
   ```bash
   python3 tools/validate_placeholders.py
   ```

2. **For cost/time claims**, add `⚠️ EXAMPLE` label:
   ```markdown
   ⚠️ **EXAMPLE ONLY**: Typical setup takes 8 hours.
   Your actual time depends on your governance model.
   ```

3. **For compliance claims**, link to proof:
   ```markdown
   FirstTry captures immutable audit trails ([proof](SECURITY.md#audit-trail))
   ```

4. **For fake data**, keep in test/demo contexts only:
   ```
   ✅ OK:   tools/roi_calc.py, tests/, audit/demos/
   ❌ STOP: docs/, README.md
   ```

---

## Future Improvements

1. **Automated fixes** — Script to replace `example.com` → customer domains
2. **Template system** — Built-in placeholder templates for common sections
3. **Evidence links** — Auto-generate proof anchors for claims
4. **Deprecation schedule** — Move archived docs to `internal/` folder (Q2 2026)

---

## Questions?

- **Reporting placeholders** — Open an issue with tag `placeholder`
- **Requesting allowlist exception** — Create PR to [tools/placeholder_allowlist.yml](tools/placeholder_allowlist.yml) with rationale
- **Reporting audit discrepancy** — Contact security@firsttry.dev

---

**Last Updated**: January 13, 2026  
**Audit Lead**: GitHub Copilot (Phase E3)  
**Status**: ✅ ACTIVE ENFORCEMENT
