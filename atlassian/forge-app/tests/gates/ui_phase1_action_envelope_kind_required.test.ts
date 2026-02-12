/**
 * ui_phase1_action_envelope_kind_required.test.ts
 * 
 * GATE: UI MUST validate FT_ACTION_RESULT_V1 envelope from Phase 1 actions
 * 
 * Validates that:
 * 1. Click handlers check resp.envelopeKind === 'FT_ACTION_RESULT_V1'
 * 2. Mismatch triggers [PHASE1_CONTRACT_BREACH_KIND] log + descriptive error message
 * 3. traceId is surfaced in all error messages
 * 4. UI does not show "Unknown error" alone (always includes traceId context)
 * 
 * This prevents UI from rendering old dashboard state on action responses.
 */

import fs from 'fs';
import path from 'path';

describe('GATE: ui_phase1_action_envelope_kind_required', () => {
  let mainCode: string;

  beforeAll(() => {
    const mainPath = path.resolve(__dirname, '../../src/gadget-ui/src/main.ts');
    mainCode = fs.readFileSync(mainPath, 'utf-8');
  });

  it('FAIL: RUN_ACCESS_REVIEW click must check envelopeKind', () => {
    // Find the RUN_ACCESS_REVIEW action handler
    const idx = mainCode.indexOf("action: 'RUN_ACCESS_REVIEW'");
    expect(idx).toBeGreaterThan(-1);

    // Look back from this point to find the handler context
    const handlerStart = mainCode.lastIndexOf('addEventListener(\'click\'', idx);
    const nextClick = mainCode.indexOf('addEventListener(\'click\'', idx + 1);
    const handlerBody = mainCode.substring(handlerStart, nextClick);

    // Must check envelopeKind
    expect(handlerBody).toContain("result.envelopeKind !== 'FT_ACTION_RESULT_V1'");
  });

  it('FAIL: EXPORT_PHASE1_PACK click must check envelopeKind', () => {
    // Find the EXPORT_PHASE1_PACK action handler
    const idx = mainCode.indexOf("action: 'EXPORT_PHASE1_PACK'");
    expect(idx).toBeGreaterThan(-1);

    // Look back from this point to find the handler context
    const handlerStart = mainCode.lastIndexOf('addEventListener(\'click\'', idx);
    const nextClick = mainCode.indexOf('addEventListener(\'click\'', idx + 1) > -1 
      ? mainCode.indexOf('addEventListener(\'click\'', idx + 1) 
      : mainCode.length;
    const handlerBody = mainCode.substring(handlerStart, nextClick);

    // Must check envelopeKind
    expect(handlerBody).toContain("result.envelopeKind !== 'FT_ACTION_RESULT_V1'");
  });

  it('FAIL: envelopeKind mismatch must log [PHASE1_CONTRACT_BREACH_KIND]', () => {
    expect(mainCode).toContain('[PHASE1_CONTRACT_BREACH_KIND]');
  });

  it('FAIL: envelopeKind mismatch error must include traceId', () => {
    // Find the mismatch error message
    const idx = mainCode.indexOf('[PHASE1_CONTRACT_BREACH_KIND]');
    expect(idx).toBeGreaterThan(-1);

    // Look around this to find the error message construction
    const contextStart = Math.max(0, idx - 500);
    const contextEnd = Math.min(mainCode.length, idx + 500);
    const context = mainCode.substring(contextStart, contextEnd);

    // Must include traceId in error message
    expect(context).toContain('traceId');
  });

  it('FAIL: RUN_ACCESS_REVIEW failure must show error message with traceId', () => {
    // Find RUN_ACCESS_REVIEW handler's failure path
    const actionIdx = mainCode.indexOf("action: 'RUN_ACCESS_REVIEW'");
    const handlerStart = mainCode.lastIndexOf('addEventListener(\'click\'', actionIdx);
    const nextHandler = mainCode.indexOf('ft-export-access-pack-btn', actionIdx);
    const handlerBody = mainCode.substring(handlerStart, nextHandler);

    // On failure, must show traceId
    expect(handlerBody).toContain('actionResult.error.traceId');
    expect(handlerBody).toContain('Scan Failed:');
    expect(handlerBody).toMatch(/traceId=.*\$\{traceId\}/);
  });

  it('FAIL: EXPORT_PHASE1_PACK failure must show error message with traceId', () => {
    // Find EXPORT_PHASE1_PACK handler's failure path
    const actionIdx = mainCode.indexOf("action: 'EXPORT_PHASE1_PACK'");
    const handlerStart = mainCode.lastIndexOf('addEventListener(\'click\'', actionIdx);
    const nextBrace = mainCode.indexOf('});', actionIdx) + 3;
    const handlerBody = mainCode.substring(handlerStart, nextBrace);

    // On failure, must show traceId
    expect(handlerBody).toContain('actionResult.error.traceId');
    expect(handlerBody).toContain('Export Failed:');
    expect(handlerBody).toMatch(/traceId=.*\$\{traceId\}/);
  });

  it('PASS: envelopeKind mismatch error message format', () => {
    expect(mainCode).toContain('CONTRACT_BREACH wrong envelopeKind');
    expect(mainCode).toContain('traceId=');
  });

  it('PASS: normalActionResult variable must be cast properly', () => {
    // After envelope check, result should be treated as actionResult
    expect(mainCode).toContain('const actionResult = result as any');
  });

  it('PASS: failure path must check error and build fields', () => {
    // Find failure handling code
    expect(mainCode).toContain('!actionResult.error');
    expect(mainCode).toContain('!actionResult.build');
    expect(mainCode).toContain('[PHASE1_CONTRACT_BREACH]');
  });
});
