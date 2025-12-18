# Phase 0: History Rewrite Decision Gate

## ⚠️ CRITICAL: This document is informational only
**Do NOT execute these commands without explicit user approval.**

This document prepares the optional history rewrite process but does NOT execute it. The rewrite would completely remove venv/coverage artifacts from git history, but requires careful consideration due to significant impacts.

## What is History Rewrite?

Currently, Phase 0 has:
- ✅ Removed artifacts from git index (current HEAD)
- ✅ Updated .gitignore to prevent re-addition
- ❌ **NOT removed** artifacts from git history (older commits still contain them)

A history rewrite would:
1. Scan all commits in repository history
2. Remove venv/coverage artifacts from every commit that contains them
3. Rewrite commit SHAs (all commits after removal point change)
4. Reduce repository size further (affects clones of historical refs)

## Why Consider It?

**Pros:**
- Completely clean repository (no artifacts anywhere in history)
- Clones can access old commits without downloading 1.8 GB
- Backup/archive scenarios won't include trash
- Fresh start for history-based tools

**Cons:**
- ⚠️ **All commit SHAs change** after the rewrite point
- ⚠️ **Force-push required** to origin/main
- ⚠️ **All active clones must be re-cloned** (pulling will fail)
- ⚠️ **Breaks external references** (links to specific commits in issues/wikis)
- ⚠️ **Breaks tags/branches** pointing to old commits
- ⚠️ **One-way operation** (cannot undo without backup)

## Current State (After Phase 0)

```
Commit: 17d1dcf5e7fa170d75a082036dcf0ebfc2beecd4 (HEAD)
└─ Removed venv/coverage from index (.gitignore updated)

Commits before 17d1dcf:
├─ Still contain venv/coverage in git objects
├─ Won't be fetched unless requested
├─ Historical clones can access them
└─ Artifacts not in working tree (unless checking out old commits)
```

## If Rewriting: Impact Analysis

### Repository Size Impact
- **Current**: ~150 MB (after Phase 0)
- **After rewrite**: ~80-100 MB (worst-case)
- **Old commits**: Accessible but only via pack objects (not working tree)

### Commit Count
- **Total commits**: ~1,200 (estimated)
- **Affected commits**: ~50-100 (those that modified .venv or .coverage)
- **Rewritten commits**: All commits AFTER first affected commit

### New Commit SHAs Example

**Before rewrite:**
```
abc1234 - Fix build (added .venv-build/ by mistake)
def5678 - Update tests  
17d1dcf - chore(repo): remove venv/coverage artifacts  (← After Phase 0)
```

**After rewrite:**
```
xyz9999 - Fix build (history rewritten, venv removed)
uvw6666 - Update tests
ghi3333 - chore(repo): remove venv/coverage artifacts  (← New SHA!)
```

All downstream commits also get new SHAs.

## Decision Tree

### ✅ **CHOOSE REWRITE IF:**
- Repository is new (<6 months old)
- Few external references to commits
- Team can coordinate re-clone
- Long-term benefits outweigh disruption
- You have access to force-push permissions

### ❌ **AVOID REWRITE IF:**
- Repository is public/published
- External tools/docs reference commits
- Team members have active branches
- Cannot guarantee coordination of re-clones
- Historical accuracy is important for audit

## Current Recommendation

**Status quo (No rewrite) recommended because:**
1. Phase 0 already solved the practical problem (new clones are 92% smaller)
2. Old commits are rarely accessed
3. No disruption to active development
4. Can revisit after stabilization period (e.g., 3+ months)
5. Future features can be built without historical baggage

**If you choose rewrite later:** Run the commands below after notifying team.

---

## Prepared Commands (DO NOT RUN WITHOUT APPROVAL)

### Prerequisites
```bash
# Ensure you have git filter-repo installed
pip install git-filter-repo

# Create safety backups
git branch backup-before-rewrite
git tag backup-before-rewrite-tag
```

### Execution Plan (Optional - For Future Reference)

```bash
# STOP: Get explicit user approval before proceeding

# Step 1: Create working backup
cd /workspaces/Firstry
git branch backup-before-rewrite
git tag backup-before-rewrite-tag

# Step 2: Run filter-repo to remove artifacts from history
git filter-repo --path .venv-build --invert-paths \
                --path .venv_tmp --invert-paths \
                --path .coverage --invert-paths \
                --path .testmondata --invert-paths \
                --path .coveragerc --invert-paths \
                --force

# Step 3: Verify rewrite worked
git log --oneline --name-status | head -20
# Should show NO .venv-build, .venv_tmp, .coverage files

# Step 4: Check new size
du -sh .git

# Step 5: Force-push to origin (REQUIRES PERMISSIONS)
git push --force --all
git push --force --tags

# Step 6: Notify team to re-clone
echo "NOTIFY TEAM: Repository history rewritten. Please re-clone."
```

### Rollback Plan (If Rewrite Fails)

```bash
# If rewrite goes wrong, restore from backup
git reset --hard backup-before-rewrite-tag
git gc --aggressive --prune=now  # Clean up loose objects
```

---

## Questions for Decision Makers

Before choosing to rewrite, answer:

1. **Can the team coordinate?** (Re-clone will be required)
   - [ ] Yes - all team members can re-clone together
   - [ ] No - active branches would conflict
   - [ ] Unknown - needs discussion

2. **Are there external references?**
   - [ ] Yes - commits linked in issues/wikis/docs
   - [ ] No - internal repository only
   - [ ] Unknown - needs audit

3. **What's the urgency?**
   - [ ] High - needs immediate cleanup
   - [ ] Medium - cleanup preferred but not critical
   - [ ] Low - can defer or skip

4. **Who has permissions?**
   - [ ] I can force-push to main
   - [ ] Need approval/coordination
   - [ ] Cannot access

5. **Team size**
   - [ ] Solo/small (<5 people)
   - [ ] Medium (5-20 people)
   - [ ] Large (>20 people) - higher coordination complexity

---

## Status: DECISION PENDING

**This document is prepared and ready for execution IF user approves.**

To execute:
1. Review this document carefully
2. Answer all questions above
3. **Explicitly say: "Execute history rewrite"**
4. If approved, commands will be run by agent

To skip:
- No action needed - repository is already in good state (Phase 0 complete)

---

## Appendix: git filter-repo vs BFG Repo Cleaner

Why `git filter-repo` is recommended over BFG:

| Feature | git filter-repo | BFG |
|---------|---|---|
| Speed | Faster | Slower |
| Complexity | Simpler for this use case | More features |
| Maintained | Active (2024) | Inactive |
| Documentation | Excellent | Good |
| Predictability | Deterministic | May vary |

---

**Document Status**: Prepared, Not Executed  
**Created**: 2024-12-18  
**Awaiting**: User Decision (YES / NO / DEFER)

For execution, explicitly state: **"Proceed with history rewrite"**
