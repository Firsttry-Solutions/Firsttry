/**
 * SHK-096: TEST_ONLY_DRIFT_GUARD
 *
 * Credibility Hardening Test: Production source code has ZERO test-only
 * semantic branches. No IS_TEST, TEST_MODE, MOCK_MODE in src/** conditionals.
 *
 * Claim: "Production code semantics are identical in test vs production.
 * No conditional execution paths that are test-only."
 *
 * Test: Scan src/ directory for test-only condition keywords:
 * - IS_TEST, TEST_MODE, TESTING, MOCK_MODE, DEBUG_MODE
 * - Look for these in conditionals (if, switch, ternary)
 * - Allowed: comments, string literals, type/interface names
 * - Flag only actual logic gates affecting execution
 *
 * Evidence: Filesystem scan of source code files
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('SHK-096: Test-Only Drift Guard', () => {
  /**
   * Scan directory recursively for TypeScript files
   */
  function scanDirectory(dirPath: string): string[] {
    const files: string[] = [];

    function walk(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, .git, dist, build
          if (!['.git', 'node_modules', 'dist', 'build', '.next'].includes(entry.name)) {
            walk(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
    }

    walk(dirPath);
    return files;
  }

  /**
   * Check if string is inside a comment or string literal
   */
  function isInCommentOrString(content: string, index: number): boolean {
    let inString = false;
    let inComment = false;
    let stringChar = '';

    for (let i = 0; i < index; i++) {
      // Check for string delimiters
      if ((content[i] === '"' || content[i] === "'" || content[i] === '`') && content[i - 1] !== '\\') {
        if (!inComment) {
          if (!inString) {
            inString = true;
            stringChar = content[i];
          } else if (content[i] === stringChar) {
            inString = false;
          }
        }
      }

      // Check for comment delimiters
      if (!inString) {
        if (content[i] === '/' && content[i + 1] === '/') {
          inComment = true;
        }
        if (content[i] === '\n') {
          inComment = false;
        }
      }
    }

    return inString || inComment;
  }

  /**
   * Find test-only keywords in logic contexts (if/switch/ternary)
   */
  function findTestOnlyKeywords(filePath: string): Array<{ keyword: string; line: number; context: string }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches: Array<{ keyword: string; line: number; context: string }> = [];

    const keywords = ['IS_TEST', 'TEST_MODE', 'TESTING', 'MOCK_MODE', 'DEBUG_MODE', 'IS_MOCK', 'FAKE_MODE'];
    const logicPatterns = [
      /if\s*\(\s*[^)]*\b(IS_TEST|TEST_MODE|TESTING|MOCK_MODE|DEBUG_MODE|IS_MOCK|FAKE_MODE)\b[^)]*\)/gi,
      /switch\s*\(\s*[^)]*\b(IS_TEST|TEST_MODE|TESTING|MOCK_MODE|DEBUG_MODE|IS_MOCK|FAKE_MODE)\b[^)]*\)/gi,
      /\?\s*[^:]*:\s*[^;\n]*\b(IS_TEST|TEST_MODE|TESTING|MOCK_MODE|DEBUG_MODE|IS_MOCK|FAKE_MODE)\b/gi,
    ];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        let match;

        while ((match = regex.exec(line)) !== null) {
          // Skip if in comment or string literal
          if (isInCommentOrString(line, match.index)) {
            continue;
          }

          // Check if in logic context (not type name or interface)
          const before = line.substring(Math.max(0, match.index - 20));
          const after = line.substring(match.index, match.index + keyword.length + 20);

          // Simple heuristic: if preceded by 'if', 'switch', '?', '&&', '||', '!', '=='
          const logicContext = /[\(\!\&\|\?]\s*$|^\s*[\)\&\|\?\:]/.test(before + after);

          if (logicContext) {
            matches.push({
              keyword,
              line: lineNum + 1,
              context: line.trim(),
            });
          }
        }
      }
    }

    return matches;
  }

  it('should verify src/ exists and is scannable', () => {
    const srcRoot = '/workspaces/Firstry/atlassian/forge-app/src';
    expect(fs.existsSync(srcRoot)).toBe(true);

    const files = scanDirectory(srcRoot);
    expect(files.length).toBeGreaterThan(0);
    console.log(`[SHK-096] Found ${files.length} TypeScript files in src/`);
  });

  it('should find ZERO IS_TEST references in production logic', () => {
    const srcRoot = '/workspaces/Firstry/atlassian/forge-app/src';
    const files = scanDirectory(srcRoot);

    const testOnlyMatches: Array<{ file: string; matches: any[] }> = [];

    for (const file of files) {
      const matches = findTestOnlyKeywords(file);
      if (matches.length > 0) {
        testOnlyMatches.push({
          file: path.relative(srcRoot, file),
          matches,
        });
      }
    }

    if (testOnlyMatches.length > 0) {
      console.error('[SHK-096] FOUND test-only keywords in production code:');
      for (const item of testOnlyMatches) {
        console.error(`  File: ${item.file}`);
        for (const match of item.matches) {
          console.error(`    Line ${match.line}: ${match.keyword} in context: ${match.context}`);
        }
      }
    }

    // CRITICAL: Production source must have ZERO test-only branches
    expect(testOnlyMatches.length).toBe(0);
  });

  it('should allow test-only keywords ONLY in tests/** directory', () => {
    const testsRoot = '/workspaces/Firstry/atlassian/forge-app/tests';
    const files = scanDirectory(testsRoot);

    const testOnlyMatches: Array<{ file: string; matches: any[] }> = [];

    for (const file of files) {
      const matches = findTestOnlyKeywords(file);
      if (matches.length > 0) {
        testOnlyMatches.push({
          file: path.relative(testsRoot, file),
          matches,
        });
      }
    }

    // ALLOWED: test-only keywords in tests/
    // This is informational only; no failure
    console.log(`[SHK-096] Found ${testOnlyMatches.length} test-only keywords in tests/ (allowed)`);
  });

  it('should verify storage.ts has NO test-only conditionals', () => {
    const storagePath = '/workspaces/Firstry/atlassian/forge-app/src/storage.ts';

    if (fs.existsSync(storagePath)) {
      const matches = findTestOnlyKeywords(storagePath);
      console.log(`[SHK-096] storage.ts analysis:`, matches.length === 0 ? 'CLEAN' : 'FOUND matches');
      expect(matches.length).toBe(0);
    }
  });

  it('should audit drift guard verdicts', () => {
    const srcRoot = '/workspaces/Firstry/atlassian/forge-app/src';
    const files = scanDirectory(srcRoot);

    let totalFiles = files.length;
    let filesWithDrift = 0;

    const findings: any[] = [];

    for (const file of files) {
      const matches = findTestOnlyKeywords(file);
      if (matches.length > 0) {
        filesWithDrift++;
        findings.push({
          file: path.relative(srcRoot, file),
          driftCount: matches.length,
          driftItems: matches,
        });
      }
    }

    const verdict = filesWithDrift === 0 ? 'PASS' : 'FAIL';

    const auditEntry = {
      claim: 'Production code has zero test-only semantic branches',
      testScope: `${totalFiles} TypeScript files in src/`,
      findings: findings.length === 0 ? 'No test-only drift detected' : findings,
      verdict: `${verdict}: ${filesWithDrift} files with test-only branches found`,
      timestamp: new Date().toISOString(),
    };

    console.log('[SHK-096] Test-Only Drift Guard Result:', JSON.stringify(auditEntry, null, 2));

    expect(verdict).toBe('PASS');
  });

  it('should document allowed vs forbidden keywords', () => {
    const keywords = {
      forbidden_in_src: ['IS_TEST', 'TEST_MODE', 'TESTING', 'MOCK_MODE', 'DEBUG_MODE', 'IS_MOCK', 'FAKE_MODE'],
      allowed_in_tests: ['All of the above'],
      contexts_where_allowed_in_src: ['Comments only', 'String literals only', 'Type/interface names only'],
      contexts_forbidden_in_src: ['if conditionals', 'switch statements', 'Ternary operators', 'Logical gates (&&, ||, !)'],
    };

    console.log('[SHK-096] Keyword Policy:', JSON.stringify(keywords, null, 2));

    expect(keywords.forbidden_in_src.length).toBeGreaterThan(0);
  });
});
