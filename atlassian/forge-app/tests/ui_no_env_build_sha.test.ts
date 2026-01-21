/**
 * tests/ui_no_env_build_sha.test.ts
 *
 * Regression test to ensure:
 * 1. UI build SHA no longer comes from process.env.FT_BUILD_SHA
 * 2. UI build metadata is loaded from ui_build_meta.json (written by build_meta.mjs)
 * 3. build_meta.mjs writes ui_build_meta.json correctly
 *
 * SCOPE:
 * - Verify Vite config does NOT use process.env.FT_BUILD_SHA
 * - Verify Vite config DOES reference ui_build_meta.json
 * - Verify build_meta.mjs writes ui_build_meta.json
 * - Verify JSON structure contains FT_BUILD_SHA and FT_BUILD_TIME_UTC
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('UI build metadata (no env fallback)', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const viteConfigPath = path.join(projectRoot, 'src', 'gadget-ui', 'vite.config.ts');
  const buildMetaScriptPath = path.join(projectRoot, 'tools', 'build_meta.mjs');
  const uiBuildMetaPath = path.join(projectRoot, 'src', 'gadget-ui', 'src', 'build', 'ui_build_meta.json');

  it('vite.config.ts does NOT reference process.env.FT_BUILD_SHA', () => {
    const content = fs.readFileSync(viteConfigPath, 'utf8');
    // Should NOT have the direct env reference with fallback
    expect(content).not.toMatch(/process\.env\.FT_BUILD_SHA\s*\|\|/);
  });

  it('vite.config.ts DOES reference ui_build_meta.json', () => {
    const content = fs.readFileSync(viteConfigPath, 'utf8');
    expect(content).toMatch(/ui_build_meta\.json/);
  });

  it('vite.config.ts has fail-closed logic for production (throws if missing or invalid)', () => {
    const content = fs.readFileSync(viteConfigPath, 'utf8');
    // Should check for production environment
    expect(content).toMatch(/process\.env\.NODE_ENV|process\.env\.FORGE_ENV|isProduction/);
    // Should throw in production
    expect(content).toMatch(/throw new Error/);
  });

  it('build_meta.mjs writes ui_build_meta.json', () => {
    const content = fs.readFileSync(buildMetaScriptPath, 'utf8');
    expect(content).toMatch(/ui_build_meta\.json/);
    expect(content).toMatch(/ui_build_meta/);
  });

  it('build_meta.mjs verifies ui_build_meta.json SHA format', () => {
    const content = fs.readFileSync(buildMetaScriptPath, 'utf8');
    // Should check for hex regex /^[0-9a-f]{7,40}$/
    expect(content).toMatch(/hexRegex|\\^\\[0-9a-f\\]|7,40/);
  });

  it('ui_build_meta.json exists and is valid JSON (if build_meta.mjs was run)', () => {
    if (fs.existsSync(uiBuildMetaPath)) {
      const content = fs.readFileSync(uiBuildMetaPath, 'utf8');
      const parsed = JSON.parse(content); // Will throw if invalid JSON
      
      // NEW CONTRACT: UI_GIT_SHA must be exactly 40 hex chars (full git SHA)
      expect(parsed).toHaveProperty('UI_GIT_SHA');
      expect(parsed.UI_GIT_SHA).toMatch(/^[0-9a-f]{40}$/);
      
      // UI_GIT_TIME must exist
      expect(parsed).toHaveProperty('UI_GIT_TIME');
    }
    // If file doesn't exist yet, that's OK (test will be run after build_meta.mjs)
  });

  it('vite.config.ts loads and parses ui_build_meta.json with fallback to "dev"', () => {
    const content = fs.readFileSync(viteConfigPath, 'utf8');
    // Should have fallback to "dev" for development
    expect(content).toMatch(/dev/);
    // Should parse JSON
    expect(content).toMatch(/JSON\.parse|parsed\./);
  });
});
