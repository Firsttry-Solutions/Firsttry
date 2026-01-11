# Atlassian Forge App — Marketplace Submission Instructions

## 📋 Overview

This document provides exact instructions for submitting the Atlassian Forge app to the Marketplace with cryptographic proof of integrity via the **freeze lock model**.

---

## 🔐 Release Metadata

| Property | Value |
|----------|-------|
| **Release Branch** | `release/freeze-20260111-4d9ed6c5` |
| **Lock Commit SHA** | `4d9ed6c5cfe8f7d0b335f0fbac739fe1da19ae47` |
| **Payload Commit SHA** | `a09f9fb36bb3a6ade66998ac4a73958115dbf078` |
| **Frozen Content SHA** | `5cc870333b2748763a5d6d9320e23d083e9262e5be71c893008077f016cc0ae0` |
| **Lock Method** | `git-tracked-files+sha256-manifest` |

---

## ✅ Pre-Submission Checklist

### Required Files
- All 22 required files listed in `atlassian/forge-app/audit/REQUIRED_FILES.txt`
- No MISSING statuses in `atlassian/forge-app/audit/CLAIMS_LEDGER.md`
- Freeze lock file: `atlassian/forge-app/audit/marketplace_submission/FREEZE_LOCK.json`
- Freeze generator: `atlassian/forge-app/audit/generate_freeze_lock.sh` (executable)
- Freeze verifier: `atlassian/forge-app/audit/verify_freeze_lock.sh` (executable)

### Compliance Checks
- ✓ Write-scope ban: No write/manage/admin scopes in manifest
- ✓ Write-surface ban: No write APIs (POST/PUT/PATCH/DELETE) in source code
- ✓ Tests: All 1243 tests pass (normal + deterministic modes)
- ✓ npm audit: Zero HIGH/CRITICAL vulnerabilities
- ✓ Freeze verification: Passes with clean hash matching

---

## 🎯 Submission Instructions

### Step 1: Fetch Latest from Remote

```bash
git fetch origin
```

This ensures you have the latest release branches and commits.

### Step 2: Switch to Release Branch

```bash
git switch release/freeze-20260111-4d9ed6c5
```

**Tip:** The release branch name encodes the lock commit short SHA (`4d9ed6c5`) and creation date (`20260111`), making it easy to identify.

### Step 3: (Optional) Real Detached Verification

For independent reviewers or additional proof, verify using a **real detached checkout** (not a worktree trick):

```bash
# Switch to detached HEAD at the lock commit
git switch --detach 4d9ed6c5cfe8f7d0b335f0fbac739fe1da19ae47

# Run freeze verification
cd atlassian/forge-app
./audit/verify_freeze_lock.sh

# Run marketplace compliance gate (8 checks)
bash audit/reviewer_ready_gate.sh

# Verify success
# Both commands should exit with 0 and show:
#   "✓ Freeze lock matches"
#   "GATE_PASS"
```

After verification, return to the release branch:

```bash
git switch release/freeze-20260111-4d9ed6c5
```

### Step 4: Submit to Marketplace

From the release branch (`release/freeze-20260111-4d9ed6c5`), use Forge CLI to submit:

```bash
cd atlassian/forge-app
forge app install --no-prompt
# or
forge app submit
```

**Important:** Submission **MUST** be done from the release branch tip. Do not use `git checkout <sha> -- .` (see safety note below).

---

## 🛡️ Safety Guidelines

### ⚠️ FORBIDDEN Pattern: `git checkout <sha> -- .`

**DO NOT use this command:**

```bash
git checkout 4d9ed6c5cfe8f7d0b335f0fbac739fe1da19ae47 -- .
```

**Why this is unsafe:**
1. **HEAD does not move** — you remain on your original branch (e.g., `main`)
2. **No detached state** — git still considers you on `main`, but working tree is from lock commit
3. **Confusing state** — `git branch --show-current` shows `main`, but code is from another commit
4. **Verification ambiguity** — verifier may use `git rev-parse HEAD` and get the wrong commit SHA
5. **Hidden mistakes** — easy to accidentally commit changes from the wrong branch state

### ✅ CORRECT Patterns

#### For Branch-Based Submission
```bash
git switch release/freeze-20260111-4d9ed6c5
# Now on release branch, HEAD is at lock commit
```

#### For Real Detached Verification
```bash
git switch --detach 4d9ed6c5cfe8f7d0b335f0fbac739fe1da19ae47
# Now in detached HEAD state at lock commit
# git rev-parse HEAD returns the lock commit SHA
# Verification passes because HEAD matches lock commit
```

---

## 📝 Understanding the Freeze Lock Model

### The Architecture

1. **Payload Commit** (`a09f9fb3...`)
   - Contains the actual code being frozen
   - Updates to `verify_freeze_lock.sh` and `generate_freeze_lock.sh`
   - Lock file **does not** exist at this commit

2. **Lock Commit** (`4d9ed6c5...`)
   - Child commit that adds `FREEZE_LOCK.json`
   - FREEZE_LOCK.json binds to the payload commit (via `commitSha`)
   - Cryptographic guarantee: code cannot change without invalidating the lock

### The Verification Logic

```
At lock commit 4d9ed6c5:
  1. Read FREEZE_LOCK.json from disk
  2. Extract LOCK_FILE.commitSha = a09f9fb3
  3. Run: git rev-parse HEAD~1
     → Since HEAD = 4d9ed6c5, HEAD~1 = a09f9fb3
  4. Compute: frozenContentSha by hashing all tracked files
  5. Compare: Computed hash == Locked hash → ✓ PASS
```

**Key Property:** The lock commit points to the payload commit via HEAD~1, creating a stable binding that cannot be broken without committing new changes.

---

## 🔍 Verification Commands

### Quick Verify (from release branch or detached)

```bash
cd atlassian/forge-app
./audit/verify_freeze_lock.sh
```

Expected output:
```
COMPUTED_FROZEN_SHA=5cc870333b2748763a5d6d9320e23d083e9262e5be71c893008077f016cc0ae0
LOCKED_FROZEN_SHA=5cc870333b2748763a5d6d9320e23d083e9262e5be71c893008077f016cc0ae0
✓ Freeze lock matches
```

### Full Compliance Gate (8 checks)

```bash
bash audit/reviewer_ready_gate.sh
```

Expected final output:
```
GATE_PASS
```

This validates:
1. All required files present
2. Claims ledger has no MISSING statuses
3. Freeze lock verification passes
4. No write-scopes in manifest
5. No write-surface APIs in code
6. All tests pass (normal mode)
7. All tests pass (deterministic mode)
8. npm audit shows no HIGH/CRITICAL vulnerabilities

---

## 📚 Additional Resources

- [Freeze Process](./FREEZE_PROCESS.md) — Explains freeze lock generation and update procedures
- [Convergence Proof](./MEGA_PROMPT_V5_CONVERGENCE_PROOF.md) — Demonstrates idempotent verification
- [Audit Scripts](./atlassian/forge-app/audit/) — All verification and gate scripts
- [Required Files Manifest](./atlassian/forge-app/audit/REQUIRED_FILES.txt) — List of all required files
- [Claims Ledger](./atlassian/forge-app/audit/CLAIMS_LEDGER.md) — Compliance claims and status

---

## 🚀 Quick Reference

| Task | Command |
|------|---------|
| Fetch release branches | `git fetch origin` |
| Switch to release | `git switch release/freeze-20260111-4d9ed6c5` |
| Verify freeze lock | `cd atlassian/forge-app && ./audit/verify_freeze_lock.sh` |
| Run gate checks | `cd atlassian/forge-app && bash audit/reviewer_ready_gate.sh` |
| Detached verify | `git switch --detach 4d9ed6c5cfe8f7d0b335f0fbac739fe1da19ae47` |
| Return to branch | `git switch release/freeze-20260111-4d9ed6c5` |
| Submit to marketplace | `cd atlassian/forge-app && forge app submit` |

---

**Generated:** 2026-01-11  
**Release Branch:** `release/freeze-20260111-4d9ed6c5`  
**Lock Commit:** `4d9ed6c5cfe8f7d0b335f0fbac739fe1da19ae47`
