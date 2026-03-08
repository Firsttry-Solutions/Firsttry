Reviewer Evidence Pack — FirstTry Forge App

Release branch: release/freeze-20260111-4d9ed6c5
Bundle captured at lock commit (release tip): 4d9ed6c5cfe8f7d0b335f0fbac739fe1da19ae47
Payload commit (HEAD~1 model): a09f9fb36bb3a6ade66998ac4a73958115dbf078
Bundle created (UTC): 2026-01-11T07:26:01Z
Submission (Phase 4-7): 2026-01-11T07:43:00Z

This bundle contains:
- Repo identity + git logs/status/stat
- manifest.yml snapshot
- FREEZE_LOCK.json snapshot
- verify_freeze_lock.sh + reviewer_ready_gate.sh snapshots
- Local freeze verification + reviewer gate logs (Phase 2)
- Forge CLI version + whoami logs (pre-login + post-login)
- Forge environments/settings
- Production deploy logs
- Production install log (site URL recorded)
- Production logs tail (if supported)

Independent verification procedure (detached):
  git fetch origin
  git switch --detach 4d9ed6c5cfe8f7d0b335f0fbac739fe1da19ae47
  cd atlassian/forge-app
  ./audit/verify_freeze_lock.sh
  bash audit/reviewer_ready_gate.sh

NOT SAFE / FORBIDDEN:
  git checkout <sha> -- .
Reason: It does not move HEAD; it only mutates the working tree and can produce false proofs.

Submission Status:
  ✓ Phase 0-3: Repository freeze lock verification PASSED
  ✓ Phase 4: Forge authentication CONFIRMED (Arnab Poddar)
  ✓ Phase 5: Production deploy SUCCESS (v2.41.0)
  ✓ Phase 6: Production install SUCCESS (firsttry.atlassian.net)
  ✓ Phase 7: Evidence pack built

Site URL (normalized): https://firsttry.atlassian.net
Site URL (raw):        firsttry.atlassian.net

Site URL (normalized): https://firsttry.atlassian.net
Site URL (raw):        firsttry.atlassian.net
