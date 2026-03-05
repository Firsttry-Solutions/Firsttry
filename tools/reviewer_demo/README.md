# Reviewer Demo Harness (Canonical)

Canonical reviewer harness lives in `tools/reviewer_demo/`.

- One-command demo run: `bash tools/reviewer_demo/run_reviewer_demo.sh`
- Offline verifier: `bash tools/reviewer_demo/verify_demo_results.sh /tmp/ft_reviewer_demo_*`
- Proof-pack builder: `bash tools/reviewer_demo/proof_pack/build_reviewer_proof_pack.sh`
- Proof-pack verifier: `bash tools/reviewer_demo/proof_pack/verify_reviewer_proof_pack.sh <evidence_dir>`

`FirstTry---Audit-Evidence-for-Jira/` is not canonical for runtime scripts. Treat any nested copy as documentation mirror only; canonical runnable scripts are only under `tools/reviewer_demo/`.
