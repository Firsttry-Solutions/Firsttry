# Evidence Retention Policy

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## 1. Evidence Retention Requirement

**Minimum retention**: 12 months

All evidence bundles generated via `tools/generate_enterprise_evidence.sh` must be retained for minimum 12 months from generation date.

---

## 2. Storage Location

**Primary**: docs/evidence/{YYYY-MM-DD}_release/ (git-committed)

**Backup**: GitHub commit history (immutable via git)

---

## 3. Retention Duration

| Evidence Bundle | Retention | Disposal |
|-----------------|-----------|----------|
| Current (latest) | Indefinite | Never delete while in production |
| 1–12 months old | 12 months minimum | May archive after 12 months with approval |
| >12 months old | May be archived | Requires change management approval + documentation |

---

## 4. Archival and Deletion Process

**Before deleting old evidence**:
1. Obtain approval from security lead
2. Document reason for deletion in CHANGELOG.md
3. Confirm you have more recent evidence bundle
4. Create git commit with deletion justification
5. Example commit message: "Archive evidence from 2025-02-26 (12 months retention met)"

**Cannot delete**:
- Current evidence bundle (in use)
- Evidence for versions still in production
- Evidence supporting active incidents or CVE patches

---

## 5. Audit Trail

**Git retains history**:
- Historic evidence can be recovered: `git log --all -- docs/evidence/`
- Deleted bundles are recoverable from git history for legal/compliance reasons

---

## 6. Legal and Compliance Holds

If under legal hold or audit, do NOT delete evidence without legal/compliance approval.

---

## 7. Exceptions

**No deletions allowed for**:
- Evidence supporting security patches (retain indefinitely)
- Evidence from breach incidents (retain per legal guidance; typically 3+ years)
- Evidence from compliance audits (retain per audit retention requirements)

---

## References

- [CHANGE_MANAGEMENT_POLICY.md](../operations/CHANGE_MANAGEMENT_POLICY.md): Approval process
- [CI_CD_EVIDENCE.md](../operations/CI_CD_EVIDENCE.md): Evidence artifact details
