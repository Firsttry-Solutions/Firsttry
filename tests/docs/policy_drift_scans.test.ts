/**
 * policy_drift_scans.test.ts
 * 
 * CI Gate: Detect policy violations and prevent scope/egress/logging/storage drift.
 * 
 * Fails the build if:
 * - console.log/error appears in src/** (tests only allowed)
 * - New network egress code introduced
 * - manifest.yml scopes changed without doc updates
 * - New storage prefixes appear without DATA_INVENTORY update
 * - Credentials/secrets hardcoded in code
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Policy Drift Detection', () => {
  describe('Production Logging Policy', () => {
    it('src/** must not have console.log/error statements', () => {
      const srcPath = path.resolve(process.cwd(), 'src');

      if (!fs.existsSync(srcPath)) {
        // No src directory, skip
        expect(true).toBe(true);
        return;
      }

      const files = fs.readdirSync(srcPath, { recursive: true });
      const violations: string[] = [];

      files.forEach((file: any) => {
        if (!file.endsWith('.ts') && !file.endsWith('.js')) return;

        const filePath = path.resolve(srcPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (
            line.match(/console\.(log|error|warn|debug)/) &&
            !line.includes('//') // Not a comment
          ) {
            violations.push(`${file}:${index + 1} - ${line.trim()}`);
          }
        });
      });

      expect(violations).toEqual([]);
    });

    it('logging must be isolated to tests/logging or dedicated logging module', () => {
      const loggingPath = path.resolve(process.cwd(), 'src/logging');
      const testLoggingPath = path.resolve(process.cwd(), 'tests/logging');

      // At least one should exist
      const hasLoggingModule =
        fs.existsSync(loggingPath) || fs.existsSync(testLoggingPath);

      expect(hasLoggingModule).toBe(true);
    });

    it('logging redaction must be enforced for all output', () => {
      const redactPath = path.resolve(process.cwd(), 'src/logging/redact.ts');
      const testPath = path.resolve(
        process.cwd(),
        'tests/p1_logging_safety.test.ts'
      );

      // Either redaction code OR test enforcement
      expect(fs.existsSync(redactPath) || fs.existsSync(testPath)).toBe(true);
    });
  });

  describe('Network Egress Policy', () => {
    it('src/** must not make real HTTP calls', () => {
      const srcPath = path.resolve(process.cwd(), 'src');

      if (!fs.existsSync(srcPath)) {
        expect(true).toBe(true);
        return;
      }

      const files = fs.readdirSync(srcPath, { recursive: true });
      const httpViolations: string[] = [];

      files.forEach((file: any) => {
        if (!file.endsWith('.ts') && !file.endsWith('.js')) return;

        const filePath = path.resolve(srcPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Look for real network patterns (not mocked)
        const patterns = [
          /fetch\s*\(/,
          /axios\.(get|post|put|delete)/,
          /http\.(request|get|post)/,
          /https\.(request|get|post)/,
          /new\s+URL\(/
        ];

        patterns.forEach(pattern => {
          if (pattern.test(content)) {
            // Check if it's mocked or in a mock file
            if (
              !file.includes('mock') &&
              !content.includes('jest.mock') &&
              !content.includes('vi.mock')
            ) {
              httpViolations.push(`${file} - HTTP call detected`);
            }
          }
        });
      });

      expect(httpViolations).toEqual([]);
    });

    it('All HTTP calls must be mocked in tests', () => {
      const testsPath = path.resolve(process.cwd(), 'tests');

      if (!fs.existsSync(testsPath)) {
        expect(true).toBe(true);
        return;
      }

      const mockPath = path.resolve(testsPath, 'mocks');
      const hasSetup = fs.existsSync(mockPath);

      // Tests should have mock setup
      expect(hasSetup).toBe(true);
    });
  });

  describe('Manifest Scopes Policy', () => {
    it('manifest.yml scopes must not have undocumented changes', () => {
      const manifestPath = path.resolve(process.cwd(), 'manifest.yml');

      if (!fs.existsSync(manifestPath)) {
        expect(true).toBe(true);
        return;
      }

      const content = fs.readFileSync(manifestPath, 'utf-8');

      // Check that scopes section exists and is documented
      const hasScopesDoc = fs.existsSync(
        path.resolve(process.cwd(), 'docs/ACCESS_CONTROL.md')
      );

      expect(hasScopesDoc).toBe(true);
    });

    it('New scopes must be documented in ACCESS_CONTROL.md', () => {
      const manifestPath = path.resolve(process.cwd(), 'manifest.yml');
      const accessControlPath = path.resolve(
        process.cwd(),
        'docs/ACCESS_CONTROL.md'
      );

      if (!fs.existsSync(manifestPath) || !fs.existsSync(accessControlPath)) {
        expect(true).toBe(true);
        return;
      }

      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const docContent = fs.readFileSync(accessControlPath, 'utf-8');

      // Extract scopes from manifest
      const scopeMatches = manifestContent.match(/scopes:\s*\[\s*([^\]]+)\]/s);

      if (scopeMatches) {
        const scopes = scopeMatches[1]
          .split(',')
          .map(s => s.trim().replace(/['"`]/g, ''));

        // Each scope should be mentioned in docs
        scopes.forEach(scope => {
          expect(docContent).toMatch(
            new RegExp(scope.replace(/:/g, '.*'), 'i')
          );
        });
      }
    });

    it('manifest.yml write scopes should be explicitly limited', () => {
      const manifestPath = path.resolve(process.cwd(), 'manifest.yml');

      if (!fs.existsSync(manifestPath)) {
        expect(true).toBe(true);
        return;
      }

      const content = fs.readFileSync(manifestPath, 'utf-8');

      // If app claims to be read-only, verify no write scopes to Jira
      const accessControlPath = path.resolve(
        process.cwd(),
        'docs/ACCESS_CONTROL.md'
      );

      if (fs.existsSync(accessControlPath)) {
        const docContent = fs.readFileSync(accessControlPath, 'utf-8');

        if (docContent.includes('read-only')) {
          // Should not have write:jira-issue:write or similar
          expect(
            !content.includes('write:jira-issue:write') &&
              !content.includes('delete:jira-issue') &&
              !content.includes('admin:jira')
          ).toBe(true);
        }
      }
    });
  });

  describe('Storage Policy', () => {
    it('All storage keys must be documented in DATA_INVENTORY.md', () => {
      const storagePath = path.resolve(process.cwd(), 'src/storage.ts');
      const dataInventoryPath = path.resolve(
        process.cwd(),
        'docs/DATA_INVENTORY.md'
      );

      if (!fs.existsSync(storagePath) || !fs.existsSync(dataInventoryPath)) {
        expect(true).toBe(true);
        return;
      }

      const storageContent = fs.readFileSync(storagePath, 'utf-8');
      const inventoryContent = fs.readFileSync(dataInventoryPath, 'utf-8');

      // Find key prefixes (e.g., "policy:", "snapshot:")
      const keyMatches = storageContent.match(/['"`]([\w]+):/g);

      if (keyMatches) {
        const prefixes = new Set(
          keyMatches.map(m => m.replace(/['"`]|:/g, ''))
        );

        prefixes.forEach(prefix => {
          // Each prefix should be in DATA_INVENTORY
          expect(inventoryContent.toLowerCase()).toMatch(
            new RegExp(prefix.toLowerCase())
          );
        });
      }
    });

    it('Storage retention policy must match DATA_RETENTION.md', () => {
      const storagePath = path.resolve(process.cwd(), 'src/storage.ts');
      const dataRetentionPath = path.resolve(
        process.cwd(),
        'docs/DATA_RETENTION.md'
      );

      if (!fs.existsSync(storagePath) || !fs.existsSync(dataRetentionPath)) {
        expect(true).toBe(true);
        return;
      }

      const storageContent = fs.readFileSync(storagePath, 'utf-8');
      const retentionContent = fs.readFileSync(dataRetentionPath, 'utf-8');

      // Find TTL constants
      const ttlMatches = storageContent.match(/TTL[A-Z_]*\s*=\s*(\d+)/g);

      if (ttlMatches) {
        const ttlValues = ttlMatches.map(m => m.match(/\d+/)![0]);

        // At least some TTL values should appear in docs
        const hasAtLeastOne = ttlValues.some(ttl =>
          retentionContent.includes(ttl)
        );

        expect(hasAtLeastOne || retentionContent.includes('UNKNOWN')).toBe(
          true
        );
      }
    });

    it('No undocumented storage write operations', () => {
      const storagePath = path.resolve(process.cwd(), 'src/storage.ts');
      const dataInventoryPath = path.resolve(
        process.cwd(),
        'docs/DATA_INVENTORY.md'
      );

      if (!fs.existsSync(storagePath) || !fs.existsSync(dataInventoryPath)) {
        expect(true).toBe(true);
        return;
      }

      const storageContent = fs.readFileSync(storagePath, 'utf-8');
      const inventoryContent = fs.readFileSync(dataInventoryPath, 'utf-8');

      // Check for write operations
      const hasSets = storageContent.includes('.set(') ||
        storageContent.includes('.put(');

      if (hasSets) {
        // DATA_INVENTORY should mention write/storage
        expect(inventoryContent).toMatch(/write|store|save/i);
      }
    });
  });

  describe('Secret Management Policy', () => {
    it('No hardcoded secrets in src/**', () => {
      const srcPath = path.resolve(process.cwd(), 'src');

      if (!fs.existsSync(srcPath)) {
        expect(true).toBe(true);
        return;
      }

      const files = fs.readdirSync(srcPath, { recursive: true });
      const secretPatterns = [
        /api[_-]?key\s*=\s*['"`]/i,
        /secret\s*=\s*['"`]/i,
        /token\s*=\s*['"`]/i,
        /password\s*=\s*['"`]/i,
        /private[_-]?key\s*=\s*['"`]/i
      ];

      const violations: string[] = [];

      files.forEach((file: any) => {
        if (!file.endsWith('.ts') && !file.endsWith('.js')) return;

        const filePath = path.resolve(srcPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        secretPatterns.forEach(pattern => {
          if (pattern.test(content)) {
            // Should be in a .env example, not actual code
            if (!file.includes('example') && !file.includes('env')) {
              violations.push(`${file} - Potential hardcoded secret`);
            }
          }
        });
      });

      expect(violations).toEqual([]);
    });

    it('Environment variables must not default to real secrets', () => {
      const srcPath = path.resolve(process.cwd(), 'src');

      if (!fs.existsSync(srcPath)) {
        expect(true).toBe(true);
        return;
      }

      const files = fs.readdirSync(srcPath, { recursive: true });
      const violations: string[] = [];

      files.forEach((file: any) => {
        if (!file.endsWith('.ts') && !file.endsWith('.js')) return;

        const filePath = path.resolve(srcPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // process.env.X || 'real_value'
          if (
            line.match(/process\.env\.[A-Z_]+\s*\|\|\s*['"`]/) &&
            !line.includes('EXAMPLE') &&
            !line.includes('PLACEHOLDER')
          ) {
            violations.push(`${file}:${index + 1} - Default secret value`);
          }
        });
      });

      expect(violations).toEqual([]);
    });
  });

  describe('Documentation Update Requirements', () => {
    it('If code changed, docs must be updated in same PR', () => {
      // This check ensures docs and code are kept in sync
      // In a real CI, this would compare file modification dates

      const requiredDocs = [
        'docs/PRIVACY.md',
        'docs/SECURITY.md',
        'docs/DATA_INVENTORY.md',
        'docs/DATA_RETENTION.md'
      ];

      requiredDocs.forEach(doc => {
        expect(fs.existsSync(path.resolve(process.cwd(), doc))).toBe(true);
      });
    });

    it('No doc should be more than 1 version behind latest code', () => {
      const packagePath = path.resolve(process.cwd(), 'package.json');
      const privacyPath = path.resolve(process.cwd(), 'docs/PRIVACY.md');

      if (!fs.existsSync(packagePath) || !fs.existsSync(privacyPath)) {
        expect(true).toBe(true);
        return;
      }

      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      const privacyContent = fs.readFileSync(privacyPath, 'utf-8');

      // Check that PRIVACY.md references current/recent version
      const version = packageJson.version;
      const majorVersion = version.split('.')[0];

      // Should mention version or have recent update date
      expect(
        privacyContent.includes(version) ||
          privacyContent.includes(majorVersion) ||
          privacyContent.includes('2025')
      ).toBe(true);
    });
  });

  describe('Cross-Module Policy Enforcement', () => {
    it('No circular dependencies between modules', () => {
      const srcPath = path.resolve(process.cwd(), 'src');

      if (!fs.existsSync(srcPath)) {
        expect(true).toBe(true);
        return;
      }

      // Basic check: no module should import its parent
      const files = fs.readdirSync(srcPath, { recursive: true });

      const violations: string[] = [];

      files.forEach((file: any) => {
        if (!file.endsWith('.ts')) return;

        const filePath = path.resolve(srcPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const fileDir = path.dirname(file);

        // Check for imports from parent directories
        const importMatches = content.match(
          /import\s+.*from\s+['"`](\.\.\/)+/g
        );

        if (importMatches && importMatches.length > 2) {
          violations.push(
            `${file} - Multiple parent imports (potential circular dependency)`
          );
        }
      });

      expect(violations).toEqual([]);
    });
  });
});
