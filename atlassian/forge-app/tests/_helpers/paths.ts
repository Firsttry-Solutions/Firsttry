/**
 * Portable path resolution helper
 * Computes paths dynamically instead of using hardcoded /workspaces paths
 * Prefers GITHUB_WORKSPACE in CI, otherwise walks up from __dirname
 */

import { resolve } from 'path';
import { existsSync } from 'fs';

let _cachedRepoRoot: string | null = null;

/**
 * Get the repository root
 * 1. Check GITHUB_WORKSPACE env var (set by GitHub Actions)
 * 2. Walk up from this helper file location until we find .git/
 */
export function repoRoot(): string {
  if (_cachedRepoRoot) return _cachedRepoRoot;

  // In CI: GITHUB_WORKSPACE is set
  if (process.env.GITHUB_WORKSPACE) {
    _cachedRepoRoot = process.env.GITHUB_WORKSPACE;
    return _cachedRepoRoot;
  }

  // Local: walk up from __dirname (tests/_helpers/)
  let current = __dirname;
  while (current !== '/') {
    if (existsSync(resolve(current, '.git'))) {
      _cachedRepoRoot = current;
      return _cachedRepoRoot;
    }
    current = resolve(current, '..');
  }

  throw new Error('Could not find repository root (no .git/ found)');
}

/**
 * Get the atlassian/forge-app directory
 */
export function forgeRoot(): string {
  return resolve(repoRoot(), 'atlassian', 'forge-app');
}

/**
 * Get path to manifest.yml
 */
export function manifestPath(): string {
  return resolve(forgeRoot(), 'manifest.yml');
}

/**
 * Get path to docs schema
 */
export function docsSchemaPath(): string {
  return resolve(repoRoot(), 'docs', 'marketplace', 'MARKETPLACE_SCHEMA.json');
}

/**
 * Get path to src directory
 */
export function srcRoot(): string {
  return resolve(forgeRoot(), 'src');
}

/**
 * Get path to tests directory
 */
export function testsRoot(): string {
  return resolve(forgeRoot(), 'tests');
}
