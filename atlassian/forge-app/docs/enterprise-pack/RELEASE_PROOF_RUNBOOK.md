# Release Proof Runbook

Non-bypassable operator flow for producing tamper-evident release proof that the FirstTry dashboard loads and renders correctly in production Jira.

## Purpose

`tools/release_proof_run.sh` is the single authoritative release proof runner.  It:
- Forces `FT_UI_SMOKE=1` (cannot be disabled by the operator)
- Rejects any `FT_E2E_ISSUE_URL` that is not on `firsttry.atlassian.net`
- Runs the full `npm run proof` gate (all 259+ Vitest tests + Playwright UI smoke)
- Writes a tamper-evident evidence directory with SHA-256 sums

## One-time setup: save operator session

Run once per session (or when the session expires):

```bash
node tools/e2e_save_storage_state.mjs
```

A browser window opens. Log in interactively, navigate to a Jira issue where the FirstTry panel is visible, then press ENTER in the terminal.

Saved to `/tmp/ft_storage_state.json` by default (override with `FT_E2E_STORAGE_STATE`).

**Security: never commit the storageState file. It contains session cookies.**

## Run release proof

```bash
FT_E2E_ISSUE_URL=https://firsttry.atlassian.net/browse/<ISSUE-KEY> \
FT_E2E_STORAGE_STATE=/tmp/ft_storage_state.json \
tools/release_proof_run.sh
```

Replace `<ISSUE-KEY>` with any real issue on firsttry.atlassian.net that shows the FirstTry panel.

## Outputs

All evidence is written to `/tmp/ft_release_proof_<UTC>/`:

| File | Contents |
|------|----------|
| `00_context.txt` | Git SHA, Node version, Forge version, env vars used |
| `01_proof_stdout_stderr.txt` | Full output of `npm run proof` |
| `02_proof_mode_dir.txt` | Path to latest `/tmp/ft_proof_mode_*` evidence dir |
| `03_ui_smoke_dir.txt` | Path to latest `/tmp/ft_ui_smoke_*` evidence dir |
| `RELEASE_PROOF_RECEIPT.txt` | Summary: PASS, git SHA, paths |
| `99_SHA256SUMS.txt` | SHA-256 of all files in this directory |

The `npm run proof` output itself contains a nested evidence dir at `/tmp/ft_proof_mode_<UTC>/` (artifacts 00–10).

## Failure handling

Any failure exits non-zero and writes `FAIL_REASON.txt` to the evidence dir.

Common failures:
- `FT_E2E_ISSUE_URL` not set → set it explicitly
- `FT_E2E_ISSUE_URL` wrong domain → must be `firsttry.atlassian.net`
- `FT_E2E_STORAGE_STATE` missing → re-run `e2e_save_storage_state.mjs`
- Session expired → re-run `e2e_save_storage_state.mjs` to refresh cookies
- UI smoke assertions failed → check `/tmp/ft_ui_smoke_*/04_assertions.json`

## Security notes

- Never commit `storageState` files — add `/tmp/ft_storage_state*.json` to `.gitignore` if working locally
- `release_proof_run.sh` never prints cookie values
- Evidence dirs in `/tmp/` are not committed to the repo
