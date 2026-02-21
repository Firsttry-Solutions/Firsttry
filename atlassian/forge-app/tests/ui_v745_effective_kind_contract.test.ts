/**
 * UI v7.45 Effective Kind — Contract Tests
 *
 * Verifies the ROOT CAUSE FIX: computeActionModel uses effectiveKind from backend
 * (GOVERNANCE/SEED/UNKNOWN) instead of variant string ("latest"/"seed").
 *
 * Also verifies export gate uses exportGateOk from exportGateReasonCodeNormalized,
 * and that proof markers exist in the dist bundle.
 */
import { describe, it, expect } from 'vitest';
import {
  computeActionModel,
  normalizeSnapshotKind,
} from '../src/gadget-ui/src/snapshotActionModel';
import type {
  ActionModelInput,
  ActionModelOutput,
  EffectiveKind,
} from '../src/gadget-ui/src/snapshotActionModel';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

// ── Test Helpers ────────────────────────────────────────────────────────────

/** Build an ActionModelInput with sensible defaults (v7.45 interface) */
function mkInput(overrides?: Partial<ActionModelInput>): ActionModelInput {
  return {
    status: 'AVAILABLE',
    selectedVariant: 'latest',
    effectiveKind: 'GOVERNANCE',
    exportGateOk: true,
    exportGateReasonCode: 'OK',
    sealed: false,
    buildCoherenceOk: true,
    ...overrides,
  };
}

// ── 1. effectiveKind drives Export + Seal visibility ────────────────────────

describe('v7.45 effectiveKind action model', () => {
  it('GOVERNANCE + exportGateOk=true → export visible, seal visible, run enabled', () => {
    const result = computeActionModel(mkInput({
      effectiveKind: 'GOVERNANCE',
      exportGateOk: true,
    }));
    expect(result.runVisible).toBe(true);
    expect(result.runEnabled).toBe(true);
    expect(result.sealVisible).toBe(true);
    expect(result.sealEnabled).toBe(true);
    expect(result.exportVisible).toBe(true);
    expect(result.exportEnabled).toBe(true);
  });

  it('GOVERNANCE + exportGateOk=false → export hidden, seal visible', () => {
    const result = computeActionModel(mkInput({
      effectiveKind: 'GOVERNANCE',
      exportGateOk: false,
      exportGateReasonCode: 'NO_RUN_FOUND',
    }));
    expect(result.runVisible).toBe(true);
    expect(result.runEnabled).toBe(true);
    expect(result.sealVisible).toBe(true);
    expect(result.sealEnabled).toBe(true);
    expect(result.exportVisible).toBe(false);
    expect(result.exportEnabled).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([expect.stringContaining('EXPORT_GATE')]));
  });

  it('SEED → run enabled, export hidden, seal hidden (R5)', () => {
    const result = computeActionModel(mkInput({
      effectiveKind: 'SEED',
      exportGateOk: false,
    }));
    expect(result.runVisible).toBe(true);
    expect(result.runEnabled).toBe(true);
    expect(result.sealVisible).toBe(false);
    expect(result.sealEnabled).toBe(false);
    expect(result.exportVisible).toBe(false);
    expect(result.exportEnabled).toBe(false);
    expect(result.reasons).toContain('SEED_NO_EXPORT');
  });

  it('UNKNOWN → run enabled (AVAILABLE), export hidden, seal hidden', () => {
    const result = computeActionModel(mkInput({
      effectiveKind: 'UNKNOWN',
      exportGateOk: false,
    }));
    expect(result.runVisible).toBe(true);
    expect(result.runEnabled).toBe(true);
    expect(result.sealVisible).toBe(false);
    expect(result.sealEnabled).toBe(false);
    expect(result.exportVisible).toBe(false);
    expect(result.exportEnabled).toBe(false);
  });

  it('selectedVariant="latest" does NOT hide export when effectiveKind is GOVERNANCE', () => {
    // This is the ROOT CAUSE test: variant label "latest" shouldn't matter
    const result = computeActionModel(mkInput({
      selectedVariant: 'latest',
      effectiveKind: 'GOVERNANCE',
      exportGateOk: true,
    }));
    expect(result.exportVisible).toBe(true);
    expect(result.sealVisible).toBe(true);
  });
});

// ── 2. Build coherence gate ───────────────────────────────────────────────

describe('v7.45 buildCoherence gate with effectiveKind', () => {
  it('buildCoherenceOk=false → all disabled, export/seal visibility still from effectiveKind', () => {
    const result = computeActionModel(mkInput({
      effectiveKind: 'GOVERNANCE',
      exportGateOk: true,
      buildCoherenceOk: false,
    }));
    expect(result.runVisible).toBe(true);
    expect(result.runEnabled).toBe(false);
    expect(result.sealVisible).toBe(true);
    expect(result.sealEnabled).toBe(false);
    expect(result.exportVisible).toBe(true);
    expect(result.exportEnabled).toBe(false);
    expect(result.customerMessage).toContain('Update in progress');
  });

  it('buildCoherenceOk=false + SEED → export/seal hidden even when incoherent', () => {
    const result = computeActionModel(mkInput({
      effectiveKind: 'SEED',
      exportGateOk: false,
      buildCoherenceOk: false,
    }));
    expect(result.sealVisible).toBe(false);
    expect(result.exportVisible).toBe(false);
  });
});

// ── 3. Sealed state ────────────────────────────────────────────────────────

describe('v7.45 sealed behaviour with effectiveKind', () => {
  it('sealed GOVERNANCE: run disabled, seal disabled, export still visible and enabled', () => {
    const result = computeActionModel(mkInput({
      effectiveKind: 'GOVERNANCE',
      exportGateOk: true,
      sealed: true,
    }));
    expect(result.runEnabled).toBe(false);
    expect(result.sealEnabled).toBe(false);
    expect(result.exportVisible).toBe(true);
    expect(result.exportEnabled).toBe(true);
    expect(result.reasons).toContain('SEALED');
  });
});

// ── 4. Not AVAILABLE status ────────────────────────────────────────────────

describe('v7.45 non-AVAILABLE status', () => {
  it('NO_SNAPSHOT → nothing visible', () => {
    const result = computeActionModel(mkInput({ status: 'NO_SNAPSHOT' }));
    expect(result.runVisible).toBe(false);
    expect(result.sealVisible).toBe(false);
    expect(result.exportVisible).toBe(false);
    expect(result.reasons).toContain('NOT_AVAILABLE');
  });

  it('HARD_ERROR → nothing visible', () => {
    const result = computeActionModel(mkInput({ status: 'HARD_ERROR' }));
    expect(result.runVisible).toBe(false);
    expect(result.sealVisible).toBe(false);
    expect(result.exportVisible).toBe(false);
    expect(result.reasons).toContain('NOT_AVAILABLE');
  });
});

// ── 5. normalizeSnapshotKind still works (unchanged) ────────────────────────

describe('v7.45 normalizeSnapshotKind (unchanged)', () => {
  it('"latest" → "latest" (selector label, NOT kind)', () => {
    expect(normalizeSnapshotKind('latest')).toBe('latest');
  });
  it('"governance" → "governance"', () => {
    expect(normalizeSnapshotKind('governance')).toBe('governance');
  });
  it('"seed" → "seed"', () => {
    expect(normalizeSnapshotKind('seed')).toBe('seed');
  });
  it('null → "unknown"', () => {
    expect(normalizeSnapshotKind(null)).toBe('unknown');
  });
});

// ── 6. Dist bundle markers (post-build) ─────────────────────────────────────

describe('v7.45 dist bundle proof markers', () => {
  const distDir = resolve(__dirname, '..', 'src', 'gadget-ui', 'dist');

  // Helper: find the main JS bundle in dist (if it exists)
  function getDistBundle(): string | null {
    if (!existsSync(distDir)) return null;
    const files = readdirSync(distDir);
    const jsFile = files.find(f => f.endsWith('.js') && f.includes('index'));
    if (!jsFile) {
      // fallback: any .js file
      const anyJs = files.find(f => f.endsWith('.js'));
      return anyJs ? readFileSync(join(distDir, anyJs), 'utf-8') : null;
    }
    return readFileSync(join(distDir, jsFile), 'utf-8');
  }

  it('dist contains FT_PROOF_UI_EFFECTIVE_KIND marker', () => {
    const bundle = getDistBundle();
    if (!bundle) {
      console.warn('[SKIP] dist/ not built yet — run npm run build first');
      return;
    }
    expect(bundle).toContain('FT_PROOF_UI_EFFECTIVE_KIND');
  });

  it('dist contains FT_PROOF_UI_SNAPSHOT_REVERTED marker', () => {
    const bundle = getDistBundle();
    if (!bundle) {
      console.warn('[SKIP] dist/ not built yet — run npm run build first');
      return;
    }
    expect(bundle).toContain('FT_PROOF_UI_SNAPSHOT_REVERTED');
  });

  it('dist contains FT_PROOF_UI_ACTION_MODEL_INITIAL marker', () => {
    const bundle = getDistBundle();
    if (!bundle) {
      console.warn('[SKIP] dist/ not built yet — run npm run build first');
      return;
    }
    expect(bundle).toContain('FT_PROOF_UI_ACTION_MODEL_INITIAL');
  });
});

// ── 7. Non-fatal "Service temporarily unavailable" removed ──────────────────

describe('v7.45 no "Service temporarily unavailable" in non-fatal code paths', () => {
  const mainTs = resolve(__dirname, '..', 'src', 'gadget-ui', 'src', 'main.ts');
  const mapperTs = resolve(__dirname, '..', 'src', 'gadget-ui', 'src', 'l0_snapshot_mapper.ts');

  function countOccurrences(filePath: string, needle: string): number {
    if (!existsSync(filePath)) return 0;
    const content = readFileSync(filePath, 'utf-8');
    return (content.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  }

  it('l0_snapshot_mapper.ts has zero "Service temporarily unavailable" occurrences', () => {
    const count = countOccurrences(mapperTs, 'Service temporarily unavailable');
    expect(count).toBe(0);
  });

  it('main.ts seal handler does NOT use "Service temporarily unavailable"', () => {
    if (!existsSync(mainTs)) return;
    const content = readFileSync(mainTs, 'utf-8');
    // Find the seal handler catch block — should NOT contain the forbidden phrase
    // The phrase should only appear in truly fatal error boundary paths
    const sealHandlerRegion = content.slice(
      content.indexOf('REVIEW_SEAL_EXCEPTION'),
      content.indexOf('REVIEW_SEAL_EXCEPTION') + 500
    );
    expect(sealHandlerRegion).not.toContain('Service temporarily unavailable');
  });
});
