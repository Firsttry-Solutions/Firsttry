/**
 * CONTRACT TEST: Backend runtime identity marker
 *
 * Proves that buildIdentityBackend.gen.ts contains a valid SHA
 * and [FT_PROOF_BACKEND_BUILD] marker string exists in gadget-resolver.ts.
 *
 * v7.52 — Ensures the generated identity is never stale after a build.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

describe('[FT_PROOF_BACKEND_RUNTIME_IDENTITY] contract', () => {

  it('buildIdentityBackend.gen.ts exports a 40-hex BACKEND_GIT_SHA', () => {
    const content = readFileSync(join(ROOT, 'src/build/buildIdentityBackend.gen.ts'), 'utf-8');
    const match = content.match(/export const BACKEND_GIT_SHA\s*=\s*'([0-9a-f]{40})'/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^[0-9a-f]{40}$/);
  });

  it('buildIdentityBackend.gen.ts exports a 7-char BACKEND_GIT_SHA_SHORT', () => {
    const content = readFileSync(join(ROOT, 'src/build/buildIdentityBackend.gen.ts'), 'utf-8');
    const match = content.match(/export const BACKEND_GIT_SHA_SHORT\s*=\s*'([0-9a-f]{7})'/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^[0-9a-f]{7}$/);
  });

  it('BACKEND_GIT_SHA_SHORT is first 7 chars of BACKEND_GIT_SHA', () => {
    const content = readFileSync(join(ROOT, 'src/build/buildIdentityBackend.gen.ts'), 'utf-8');
    const sha40 = content.match(/export const BACKEND_GIT_SHA\s*=\s*'([0-9a-f]{40})'/)![1];
    const sha7  = content.match(/export const BACKEND_GIT_SHA_SHORT\s*=\s*'([0-9a-f]{7})'/)![1];
    expect(sha7).toBe(sha40.substring(0, 7));
  });

  it('gadget-resolver.ts contains [FT_PROOF_BACKEND_BUILD] marker', () => {
    const content = readFileSync(join(ROOT, 'src/gadget-resolver.ts'), 'utf-8');
    expect(content).toContain('[FT_PROOF_BACKEND_BUILD]');
  });

  it('gadget-resolver.ts imports BACKEND_GIT_SHA_SHORT from gen file', () => {
    const content = readFileSync(join(ROOT, 'src/gadget-resolver.ts'), 'utf-8');
    expect(content).toMatch(/import\s*\{[^}]*BACKEND_GIT_SHA_SHORT[^}]*\}\s*from\s*['"]\.\/build\/buildIdentityBackend\.gen['"]/);
  });

});
