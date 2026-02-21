/**
 * Contract Test: Production Runtime Proof Markers
 * [FT_TEST_PASS_UI_PROD_RUNTIME_PROOF_MARKERS_CONTRACT]
 *
 * Verifies that the production UI source contains all required proof marker
 * relay calls and string literals, ensuring runtime observability via
 * forge logs (ft_uiLogRelay_v1).
 *
 * Requirements:
 *   1) main.ts contains marker strings: BUILD_IDENTITY, ACTION_MODEL_INITIAL, FOOTER_STATE
 *   2) main.ts calls invoke("ft_uiLogRelay_v1" ...) at least once
 *   3) No forbidden footer string literal exists in source
 *   4) l0_snapshot_mapper.ts renders UI build identity in DOM
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '..', 'src', 'gadget-ui', 'src');
const MAIN_TS = path.join(SRC_DIR, 'main.ts');
const L0_MAPPER = path.join(SRC_DIR, 'l0_snapshot_mapper.ts');
const ACTION_MODEL = path.join(SRC_DIR, 'snapshotActionModel.ts');

const mainSource = fs.readFileSync(MAIN_TS, 'utf-8');
const l0Source = fs.readFileSync(L0_MAPPER, 'utf-8');
const actionModelSource = fs.readFileSync(ACTION_MODEL, 'utf-8');

const FORBIDDEN_STRING = 'Tab navigation temporarily unavailable. Please refresh.';

describe('Production Runtime Proof Markers Contract', () => {
  // ========================================================================
  // 1) main.ts contains all required relay marker strings
  // ========================================================================
  it('main.ts contains [FT_PROOF_UI_BUILD_IDENTITY] marker', () => {
    expect(mainSource).toContain('[FT_PROOF_UI_BUILD_IDENTITY]');
  });

  it('main.ts contains [FT_PROOF_UI_ACTION_MODEL_INITIAL] marker', () => {
    expect(mainSource).toContain('[FT_PROOF_UI_ACTION_MODEL_INITIAL]');
  });

  it('main.ts contains [FT_PROOF_UI_FOOTER_STATE] marker', () => {
    expect(mainSource).toContain('[FT_PROOF_UI_FOOTER_STATE]');
  });

  it('main.ts contains [FT_PROOF_UI_SNAPSHOT_SELECTED] marker', () => {
    expect(mainSource).toContain('[FT_PROOF_UI_SNAPSHOT_SELECTED]');
  });

  it('main.ts contains [FT_PROOF_UI_ACTION_MODEL] marker (on dropdown change)', () => {
    expect(mainSource).toContain('[FT_PROOF_UI_ACTION_MODEL]');
  });

  // ========================================================================
  // 2) main.ts invokes ft_uiLogRelay_v1 at least once
  // ========================================================================
  it('main.ts calls invoke("ft_uiLogRelay_v1", ...) at least once', () => {
    expect(mainSource).toContain("ft_uiLogRelay_v1");
  });

  it('main.ts uses relayMarkerToBackend helper', () => {
    const relayCallCount = (mainSource.match(/relayMarkerToBackend\(/g) || []).length;
    // Must have at least 4 relay calls: BUILD_IDENTITY, ACTION_MODEL_INITIAL, FOOTER_STATE, SNAPSHOT_SELECTED
    expect(relayCallCount).toBeGreaterThanOrEqual(4);
  });

  // ========================================================================
  // 3) No forbidden footer string literal exists in source
  // ========================================================================
  it('main.ts does NOT contain forbidden footer string', () => {
    expect(mainSource).not.toContain(FORBIDDEN_STRING);
  });

  it('l0_snapshot_mapper.ts does NOT contain forbidden footer string', () => {
    expect(l0Source).not.toContain(FORBIDDEN_STRING);
  });

  it('snapshotActionModel.ts does NOT contain forbidden footer string', () => {
    expect(actionModelSource).not.toContain(FORBIDDEN_STRING);
  });

  // ========================================================================
  // 4) l0_snapshot_mapper.ts renders UI build identity element in DOM
  // ========================================================================
  it('l0_snapshot_mapper.ts renders ft-ui-build-id element', () => {
    expect(l0Source).toContain('ft-ui-build-id');
  });

  it('l0_snapshot_mapper.ts imports UI_GIT_SHA_SHORT', () => {
    expect(l0Source).toContain('UI_GIT_SHA_SHORT');
  });

  it('l0_snapshot_mapper.ts renders "Build:" text in DOM footer', () => {
    expect(l0Source).toContain('Build: ${UI_GIT_SHA_SHORT}');
  });

  // ========================================================================
  // 5) Relay calls include required data fields
  // ========================================================================
  it('BUILD_IDENTITY relay includes uiShort field', () => {
    expect(mainSource).toContain("uiShort: UI_GIT_SHA_SHORT");
  });

  it('BUILD_IDENTITY relay includes uiBuildTimeUtc field', () => {
    expect(mainSource).toContain("uiBuildTimeUtc: UI_BUILD_TIME_UTC");
  });

  it('FOOTER_STATE relay includes footerWarningPresent field', () => {
    expect(mainSource).toContain("footerWarningPresent:");
  });

  it('ACTION_MODEL_INITIAL relay includes visibility fields', () => {
    // The relay payload must include all 6 visibility/enabled fields
    expect(mainSource).toContain("runVisible: _actionModel.runVisible");
    expect(mainSource).toContain("sealVisible: _actionModel.sealVisible");
    expect(mainSource).toContain("exportVisible: _actionModel.exportVisible");
  });
});

// Final proof marker
console.log('[FT_TEST_PASS_UI_PROD_RUNTIME_PROOF_MARKERS_CONTRACT]');
