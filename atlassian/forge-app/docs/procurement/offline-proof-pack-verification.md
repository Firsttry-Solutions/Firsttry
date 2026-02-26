# Offline Proof Pack Verification

A security reviewer or procurement auditor can independently verify the production readiness evidence without network access and without trusting the CI system.

## Proof Pack identity: PRESEAL vs FINAL

The sealed log (`09_release/run_prod_ready_audit.full.log`) contains exactly two packhash labels:

| Label | Meaning |
|---|---|
| `PROOF_PACK_PACKHASH_PRESEAL:` | Hash computed by pass-1 binding, **before** the PROOF_PACK summary lines are appended to the log. This hash is **sealed inside** the pass-2 cryptographic binding. |
| `PROOF_PACK_PACKHASH_FINAL:` | Hash computed by pass-2 binding (reseal), **after** the PROOF_PACK summary lines are part of the sealed content. This is the **authoritative** pack hash. Written to the log after sealing completes as a convenience annotation; it is not itself covered by the seal, but the verifier enforces it equals `prod_ready_packhash.txt` byte-for-byte. |

**Why they differ:** PRESEAL is the hash before the summary block (including PRESEAL itself) was added. FINAL is the hash after the reseal that covers those lines. They must differ by design.

**Which hash to cite:** Procurement reviewers and auditors must cite **FINAL** (`PROOF_PACK_PACKHASH_FINAL`). This matches `prod_ready_packhash.txt` and is the value the verifier enforces.

**Verifier enforcement:** The verifier fails with exit 1 if either label is missing, either value is not 64 lowercase hex, or `PROOF_PACK_PACKHASH_FINAL` does not equal `prod_ready_packhash.txt`.

---



A **Proof Pack** is a directory produced by `run_prod_ready_audit.sh` containing every evidence artifact generated during the audit: test results, build outputs, UI marker reports, scope justifications, enterprise audit data, and the full execution log. It is tamper-evident: any modification to any sealed file causes verification to fail.

The integrity chain is:

```
hash_inputs list
   → sha256 of each file → manifest_sha256.txt
     → sha256(manifest_sha256.txt) → packhash.txt
```

An auditor re-runs this chain independently using only standard Unix tools (`sha256sum`, `diff`).

---

## What is sealed vs unsealed

| Status | Files | Notes |
|---|---|---|
| **SEALED** | Every file listed in `09_release/prod_ready_manifest_hash_inputs.txt` | Tamper-evident; any modification fails verification |
| **UNSEALED** | `stdout.txt`, `stderr.txt` | Diagnostic only; excluded from hash commitment by design |
| **NOT HASHED** (but listed) | `09_release/prod_ready_manifest_sha256.txt`, `09_release/prod_ready_packhash.txt` | Self-reference exclusion; still enumerated in `manifest_files.txt` for completeness |

The full audit log (`09_release/run_prod_ready_audit.full.log`) is **SEALED** (its hash is in the sealed commitment). It contains `PROOF_PACK_PACKHASH_PRESEAL` (sealed) and `PROOF_PACK_PACKHASH_FINAL` (post-seal annotation, see [Proof Pack identity](#proof-pack-identity-preseal-vs-final)). A reviewer can read it without opening any other file.

---

## Run the audit

These commands are cwd-independent. Run them from any directory.

```bash
# 1. Create a fresh evidence directory
E="/tmp/ft_proof_pack_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$E"

# 2. Run the audit (stdout/stderr captured as unsealed diagnostics)
FT_PROD_READY_E="$E" \
  bash /workspaces/Firsttry/atlassian/forge-app/tools/production/run_prod_ready_audit.sh \
  >"$E/stdout.txt" 2>"$E/stderr.txt"

# 3. Check the verdict
echo "VERDICT : $(cat "$E/PROD_READY_VERDICT.txt")"
echo "EXIT    : $(cat "$E/09_release/run_prod_ready_audit.exit_code.txt")"
```

> `VERDICT: PASS` and `EXIT: 0` together mean all gates passed.
> `VERDICT: FAIL` means at least one gate failed; check `09_release/run_prod_ready_audit.full.log` for per-step results.

---

## Verify offline

The verifier is a self-contained bash script with no external dependencies. It is fail-closed: it never prints `STATUS: PASS` if any required file is missing, malformed, or tampered.

```bash
bash /workspaces/Firsttry/atlassian/forge-app/tools/production/verify_prod_ready_proof_pack.sh "$E"
echo "VERIFIER_EXIT=$?"
```

Exit codes:

| Exit code | Meaning |
|---|---|
| `0` | Pack is cryptographically intact; all required files present and correctly formed |
| `1` | Pack is invalid: one or more required files are missing, empty, tampered, or the hash chain does not verify |

The verifier output (on success) looks like:

```
========================================================
  verify_prod_ready_proof_pack.sh
  Pack dir    : /tmp/ft_proof_pack_...
  Verdict     : PASS
  Exit code   : 0
  Packhash    : <64 hex chars>
  Manifest    : N files listed
  Hash inputs : M files hashed
  STATUS      : PASS
========================================================
```

---

## Manual verification (optional)

For auditors who want to verify the chain by hand without running any script:

**Recompute packhash:**

```bash
cd "$E"
sha256sum 09_release/prod_ready_manifest_sha256.txt | awk '{print $1}'
# Compare to: cat 09_release/prod_ready_packhash.txt
```

**Recompute all file hashes and diff against manifest:**

```bash
cd "$E"
# Re-hash every file in hash_inputs (in stored order)
while IFS= read -r f; do sha256sum "$f"; done \
  < 09_release/prod_ready_manifest_hash_inputs.txt \
  > /tmp/ft_recomputed_sha256.txt

# Any difference means tampering or unintended modification
diff /tmp/ft_recomputed_sha256.txt 09_release/prod_ready_manifest_sha256.txt \
  && echo "HASH CHAIN: VERIFIED" \
  || echo "HASH CHAIN: MISMATCH — see diff above"
```

**Confirm the sealed log contains both packhash labels:**

```bash
grep "^PROOF_PACK_PACKHASH_PRESEAL:" "$E/09_release/run_prod_ready_audit.full.log"
grep "^PROOF_PACK_PACKHASH_FINAL:"   "$E/09_release/run_prod_ready_audit.full.log"
grep "^PROOF_PACK_VERIFY_CMD:"        "$E/09_release/run_prod_ready_audit.full.log"

# FINAL must match prod_ready_packhash.txt exactly:
diff <(grep "^PROOF_PACK_PACKHASH_FINAL:" "$E/09_release/run_prod_ready_audit.full.log" | awk '{print $2}') \
     "$E/09_release/prod_ready_packhash.txt" \
  && echo "FINAL hash matches packhash.txt" || echo "MISMATCH"
```

---

## Common failure modes

| Symptom | Likely cause | Resolution |
|---|---|---|
| `FAIL: required file missing: ...` | Pack directory is incomplete or was partially deleted | Re-run the audit; do not modify `$E` after the run |
| `FAIL: manifest_sha256 does not match recomputed sha256` | A sealed file was modified after the audit | Treat the pack as tampered; re-run from scratch |
| `FAIL: packhash mismatch` | `manifest_sha256.txt` was modified after the audit | Same as above |
| `FAIL: manifest_hash_inputs does not match the expected derived set` | `manifest_hash_inputs.txt` was manually edited | Do not edit binding files after the audit |
| `FAIL: full.log missing PROOF_PACK_PACKHASH_PRESEAL: label` | Pack was not generated by `run_prod_ready_audit.sh`, or was generated by an older version | Regenerate with the current script |
| `FAIL: full.log missing PROOF_PACK_PACKHASH_FINAL: label` | Same as above, or manual edit removed FINAL line | Regenerate with the current script |
| `FAIL: PROOF_PACK_PACKHASH_FINAL ... does not equal prod_ready_packhash.txt` | FINAL annotation was tampered after generation | Treat as compromised; full hash chain is still checked separately |
| `FAIL: proof pack directory does not exist` | `$E` path is wrong or not an absolute path | Verify the path: `ls "$E"` before calling the verifier |
| Verifier prints `FAIL` but `VERDICT: PASS` | The audit gates passed but binding failed | Check `$E/stdout.txt` and `$E/stderr.txt` for binding error messages |
