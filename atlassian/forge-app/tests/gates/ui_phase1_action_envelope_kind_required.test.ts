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
    // Find the EXPORT_PHASE1_PACK action handler using stable marker
    const markerIdx = mainCode.indexOf('[FT_UI_ACTION_EXPORT_PHASE1_PACK_HANDLER]');
    expect(markerIdx).toBeGreaterThan(-1);

    // Get handler body (5000 chars should capture all code including error checking)
    const handlerBody = mainCode.substring(markerIdx, markerIdx + 5000);

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
    // Find EXPORT_PHASE1_PACK handler using stable marker
    const markerIdx = mainCode.indexOf('[FT_UI_ACTION_EXPORT_PHASE1_PACK_HANDLER]');
    expect(markerIdx).toBeGreaterThan(-1);

    // Get handler body (5000 chars from marker should capture all error handling)
    const handlerBody = mainCode.substring(markerIdx, markerIdx + 5000);

    // On failure, must show traceId
    expect(handlerBody).toContain('actionResult.error');
    expect(handlerBody).toContain('Export Failed:');
    expect(handlerBody).toContain('traceId');
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
    expect(mainCode).toContain('[PHASE1_CONTRACT_BREACH_FIELDS]');
  });

  it('FAIL: envelopeKind mismatch must log [PHASE1_CONTRACT_BREACH_KIND] marker', () => {
    // The marker must be present for kind mismatch
    expect(mainCode).toContain('[PHASE1_CONTRACT_BREACH_KIND]');
    
    // Count occurrences - should have at least 2 (one for each action handler)
    const count = (mainCode.match(/\[PHASE1_CONTRACT_BREACH_KIND\]/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('FAIL: Missing reason/error fields must log [PHASE1_CONTRACT_BREACH_FIELDS] marker', () => {
    // Must have marker for field validation failures
    expect(mainCode).toContain('[PHASE1_CONTRACT_BREACH_FIELDS]');
  });

  it('FAIL: RUN_ACCESS_REVIEW must validate result.error existence on ok:false', () => {
    const actionIdx = mainCode.indexOf("action: 'RUN_ACCESS_REVIEW'");
    const handlerStart = mainCode.lastIndexOf('addEventListener(\'click\'', actionIdx);
    const nextHandler = mainCode.indexOf('ft-export-access-pack-btn', actionIdx);
    const handlerBody = mainCode.substring(handlerStart, nextHandler);

    // Must explicitly check for error/build/reason/traceId presence on failure
    expect(handlerBody).toContain('!actionResult.error');
    expect(handlerBody).toContain('!actionResult.build');
    expect(handlerBody).toContain('!actionResult.reason');
    expect(handlerBody).toContain('!actionResult.traceId');
    expect(handlerBody).toContain('CONTRACT_BREACH missing fields');
  });

  it('FAIL: EXPORT_PHASE1_PACK must validate result.error existence on ok:false', () => {
    // Find EXPORT_PHASE1_PACK handler using stable marker
    const markerIdx = mainCode.indexOf('[FT_UI_ACTION_EXPORT_PHASE1_PACK_HANDLER]');
    expect(markerIdx).toBeGreaterThan(-1);

    // Get handler body (5000 chars from marker should fully capture all error checking)
    const handlerBody = mainCode.substring(markerIdx, markerIdx + 5000);

    // Must explicitly check for error/build/reason/traceId presence on failure
    expect(handlerBody).toContain('!actionResult.error');
    expect(handlerBody).toContain('!actionResult.build');
    expect(handlerBody).toContain('!actionResult.reason');
    expect(handlerBody).toContain('!actionResult.traceId');
    expect(handlerBody).toContain('CONTRACT_BREACH missing fields');
  });
});
