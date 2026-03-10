# Known Gaps - FirstTry Marketplace Submission

## Gap Summary

Two environment-dependent proofs cannot be completed in this build/CI context:

1. **Demo Flow Recording** (demo_flow_ready=NO)
2. **Gadget Render Proof** (gadget_render_proof=SKIPPED)

Both are resolved by Marketplace reviewers with runtime environment.

## Gap Details

### 1. Demo Flow Recording

**Status**: SKIPPED  
**Reason**: No Jira runtime instance and display capability in build environment  
**Impact**: demo_flow_ready=NO  
**Evidence**: `reviewer_demo_recording_runbook.md` (deterministic step-by-step demo script)

**What's Provided**:
- Deterministic 6-screen demo runbook with exact reviewer steps
- Reproducible in any environment with Jira instance + display
- No runtime-specific hardcoding

**What's Needed** (Marketplace):
- Jira instance with FirstTry app installed
- Display capability (screenshots/recording capability)
- ~10 minutes to execute runbook and record

### 2. Gadget Render Proof

**Status**: SKIPPED (static chain only)  
**Reason**: Runtime Jira dashboard not available in build environment  
**Impact**: gadget_render_proof=SKIPPED, but gadget module present in manifest  
**Evidence**: `gadget_static_chain.txt` (gadget module confirmed in manifest.yml)

**What's Provided**:
- Manifest proof: `jira:dashboardGadget` module present
- Static analysis: No runtime incompatibilities detected

**What's Needed** (Marketplace):
- Jira dashboard with FirstTry app installed
- Render the gadget (visual verification that it appears on dashboard)
- ~2 minutes

## No Impact on Proof Strength

These gaps do NOT weaken static proofs:
- ✅ Read-only scope audit: PASS (independent, proven)
- ✅ No-egress audit: PASS (independent, proven)
- ✅ No-mutation audit: PASS (independent, proven)

## Why PASS_WITH_GAPS?

Result is classified as PASS_WITH_GAPS to:
1. **Honestly report** that static safety proofs are complete (PASS)
2. **Transparently document** that runtime proofs require Marketplace environment (gaps)
3. **Unblock submission** – these gaps are expected and resolvable

## Resolution Verification

When Marketplace reviewers complete runtime verification:
1. Record demo flow execution
2. Capture gadget render screenshot
3. Update submission artifact with runtime proof files
4. Upgrade result to PASS (full proof complete)

## Current Submission Status

✅ Ready for Marketplace review despite gaps – all static safety proofs complete and valid.
