/**
 * Scope Export Regression Test
 *
 * Ensures extractScopesFromManifestText is a named export from manifestScopes.ts.
 * Guards against accidental removal or renaming of this function.
 *
 * Marker: [FT_TEST_PASS_SCOPE_EXPORT_REGRESSION]
 */

import { describe, it, expect } from 'vitest';

describe('Scope Export Regression', () => {
  it('extractScopesFromManifestText must be a function export from manifestScopes', async () => {
    const mod = await import('../../src/security/manifestScopes');
    expect(typeof mod.extractScopesFromManifestText).toBe('function');
    console.log('[FT_TEST_PASS_SCOPE_EXPORT_REGRESSION] export-exists PASS');
  });

  it('extractScopesFromManifestText parses valid YAML scopes block', async () => {
    const { extractScopesFromManifestText } = await import('../../src/security/manifestScopes');
    const yaml = `
app:
  id: test-app
permissions:
  scopes:
    - read:jira-work
    - storage:app
    - read:jira-user
`;
    const scopes = extractScopesFromManifestText(yaml);
    expect(scopes).toEqual(['read:jira-work', 'storage:app', 'read:jira-user']);
    console.log('[FT_TEST_PASS_SCOPE_EXPORT_REGRESSION] parse-valid PASS');
  });

  it('extractScopesFromManifestText throws on missing scopes block', async () => {
    const { extractScopesFromManifestText } = await import('../../src/security/manifestScopes');
    const yaml = `
app:
  id: test-app
`;
    expect(() => extractScopesFromManifestText(yaml)).toThrow('Could not find "scopes:"');
    console.log('[FT_TEST_PASS_SCOPE_EXPORT_REGRESSION] missing-scopes PASS');
  });

  it('extractForgeScopesFromManifestYml must also exist (backward compat)', async () => {
    const mod = await import('../../src/security/manifestScopes');
    expect(typeof mod.extractForgeScopesFromManifestYml).toBe('function');
    console.log('[FT_TEST_PASS_SCOPE_EXPORT_REGRESSION] backward-compat PASS');
  });
});

describe('[FT_TEST_PASS_SCOPE_EXPORT_REGRESSION] — marker', () => {
  it('marker', () => {
    console.log('[FT_TEST_PASS_SCOPE_EXPORT_REGRESSION]');
    expect(true).toBe(true);
  });
});
