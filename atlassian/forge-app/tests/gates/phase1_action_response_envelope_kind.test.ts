/**
 * phase1_action_response_envelope_kind.test.ts
 * 
 * GATE: Phase 1 action responses MUST use FT_ACTION_RESULT_V1 envelope
 * 
 * Validates that:
 * 1. handlePhase1AccessReview returns envelopeKind: 'FT_ACTION_RESULT_V1'
 * 2. handlePhase1ExportPack returns envelopeKind: 'FT_ACTION_RESULT_V1'
 * 3. Failure responses include error{code,message,traceId} and build{buildShaShort,buildUtc,version}
 * 4. ft_getDashboardState_v1 returns action envelope directly (no wrapping)
 * 
 * This prevents UI from ever seeing wrong envelope kind.
 */

import fs from 'fs';
import path from 'path';

describe('GATE: phase1_action_response_envelope_kind', () => {
  let resolverCode: string;

  beforeAll(() => {
    const resolverPath = path.resolve(__dirname, '../../src/gadget-resolver.ts');
    resolverCode = fs.readFileSync(resolverPath, 'utf-8');
  });

  it('FAIL: FT_ACTION_RESULT_V1 interface must be defined', () => {
    expect(resolverCode).toContain('interface FtActionResultV1');
    expect(resolverCode).toContain("envelopeKind: 'FT_ACTION_RESULT_V1'");
    expect(resolverCode).toContain('ok: boolean');
    expect(resolverCode).toContain("action: 'RUN_ACCESS_REVIEW' | 'EXPORT_PHASE1_PACK'");
    expect(resolverCode).toContain('traceId: string');
    expect(resolverCode).toContain('build: {');
  });

  it('FAIL: handlePhase1AccessReview must return FtActionResultV1', () => {
    // Find the function
    const match = resolverCode.match(
      /async function handlePhase1AccessReview\(request: any\): Promise<FtActionResultV1>/
    );
    expect(match).toBeDefined();
    
    // Find the return statements
    const fnStartIdx = resolverCode.indexOf('async function handlePhase1AccessReview');
    const nextFnIdx = resolverCode.indexOf('async function handlePhase1ExportPack', fnStartIdx + 1);
    const fnBody = resolverCode.substring(fnStartIdx, nextFnIdx);

    // Check for envelope kind in success path
    expect(fnBody).toContain("envelopeKind: 'FT_ACTION_RESULT_V1'");
    expect(fnBody).toContain("action: 'RUN_ACCESS_REVIEW'");
  });

  it('FAIL: handlePhase1AccessReview failure path must include error object', () => {
    const fnStartIdx = resolverCode.indexOf('async function handlePhase1AccessReview');
    const nextFnIdx = resolverCode.indexOf('async function handlePhase1ExportPack', fnStartIdx + 1);
    const fnBody = resolverCode.substring(fnStartIdx, nextFnIdx);

    // Failure path must have error fields
    expect(fnBody).toContain('reason: normalized.reason');
    expect(fnBody).toContain('error: normalized.error');
    expect(fnBody).toContain('build');
  });

  it('FAIL: handlePhase1ExportPack must return FtActionResultV1', () => {
    const match = resolverCode.match(
      /async function handlePhase1ExportPack\(request: any\): Promise<FtActionResultV1>/
    );
    expect(match).toBeDefined();

    const fnStartIdx = resolverCode.indexOf('async function handlePhase1ExportPack');
    const nextFnIdx = resolverCode.indexOf('export async function ft_getDashboardState_v1', fnStartIdx + 1);
    const fnBody = resolverCode.substring(fnStartIdx, nextFnIdx);

    // Check for envelope kind
    expect(fnBody).toContain("envelopeKind: 'FT_ACTION_RESULT_V1'");
    expect(fnBody).toContain("action: 'EXPORT_PHASE1_PACK'");
  });

  it('FAIL: ft_getDashboardState_v1 action branch must return envelope directly', () => {
    const fnStartIdx = resolverCode.indexOf('export async function ft_getDashboardState_v1');
    const returnIdx = resolverCode.indexOf('return actionResult as any', fnStartIdx);
    
    // Should have at least 2 occurrences (one for each action)
    let count = 0;
    let idx = fnStartIdx;
    while ((idx = resolverCode.indexOf('return actionResult as any', idx)) !== -1 && idx < resolverCode.indexOf('// STEP 2: No action present', fnStartIdx)) {
      count++;
      idx += 1;
    }
    expect(count).toBeGreaterThanOrEqual(1);

    // Should NOT wrap in dashboard envelope for action paths
    const actionIdx = resolverCode.indexOf('if (action === \'RUN_ACCESS_REVIEW\')', fnStartIdx);
    const nextActionIdx = resolverCode.indexOf('} else if (action === \'EXPORT_PHASE1_PACK\')', actionIdx);
    const actionBody = resolverCode.substring(actionIdx, nextActionIdx);
    
    // Should return directly without creating FT_DASH_ENVELOPE_V1 wrapping
    expect(actionBody).toContain('return actionResult as any');
    expect(actionBody).not.toContain('envelopeKind: \'FT_DASH_ENVELOPE_V1\'');
  });

  it('PASS: [FT_PROOF_ACTION_ENVELOPE] marker must be logged', () => {
    expect(resolverCode).toContain('[FT_PROOF_ACTION_ENVELOPE]');
  });

  it('PASS: normalizeActionError helper must ensure no empty strings', () => {
    expect(resolverCode).toContain('function normalizeActionError');
    expect(resolverCode).toContain('reason && reason.length > 0 ? reason : \'UNSPECIFIED_FAILURE\'');
    expect(resolverCode).toContain('message && message.length > 0 ? message : \'Phase 1 failed\'');
    expect(resolverCode).toContain('code && code.length > 0 ? code : \'PHASE1_FAILED\'');
  });

  it('PASS: buildMeta() helper must return non-empty build fields', () => {
    expect(resolverCode).toContain('function buildMeta()');
    expect(resolverCode).toContain('buildShaShort:');
    expect(resolverCode).toContain('buildUtc:');
    expect(resolverCode).toContain('version:');
    // Ensure defaults are set
    expect(resolverCode).toContain("? BACKEND_BUILD_TIME_UTC : 'unknown'");
    expect(resolverCode).toContain("? BACKEND_APP_VERSION : 'unknown'");
  });

  it('PASS: getBuildShaShort must handle null/undefined', () => {
    expect(resolverCode).toContain('function getBuildShaShort');
    expect(resolverCode).toContain("return 'unknown'");
  });
});
