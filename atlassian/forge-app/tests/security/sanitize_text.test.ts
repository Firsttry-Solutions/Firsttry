import { describe, test, expect } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('sanitize_text.mjs - JWT Redaction', () => {
  const sanitizerPath = join(process.cwd(), '../../tools/security/sanitize_text.mjs');

  function runSanitizer(input: string, options?: { summaryPath?: string }): { output: string; exitCode: number; summary?: any } {
    const tempDir = mkdtempSync(join(tmpdir(), 'sanitize-test-'));
    const inputPath = join(tempDir, 'input.txt');
    const outputPath = join(tempDir, 'output.txt');
    const summaryPath = options?.summaryPath || join(tempDir, 'summary.json');

    try {
      writeFileSync(inputPath, input, 'utf-8');
      
      const env = { ...process.env, SANITIZE_SUMMARY_PATH: summaryPath };
      let exitCode = 0;
      try {
        execSync(`cat "${inputPath}" | node "${sanitizerPath}" > "${outputPath}"`, { 
          env,
          stdio: 'pipe' 
        });
      } catch (err: any) {
        exitCode = err.status || 1;
      }

      const output = readFileSync(outputPath, 'utf-8');
      let summary = undefined;
      try {
        summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
      } catch {
        // Summary not written
      }

      return { output, exitCode, summary };
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  test('redacts Bearer JWT with eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 header', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ';
    const { output, exitCode } = runSanitizer(input);
    
    expect(output).toBe('Authorization: Bearer REDACTED_JWT');
    expect(exitCode).toBe(1); // Non-zero exit indicates redactions
  });

  test('redacts standalone JWT token', () => {
    const input = 'const secret = \'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ\';';
    const { output, exitCode } = runSanitizer(input);
    
    expect(output).toBe('const secret = \'REDACTED_JWT\';');
    expect(exitCode).toBe(1);
  });

  test('preserves non-JWT content', () => {
    const input = 'This is normal text with no secrets. Some tokens: abc.def but not JWT-like (too short).';
    const { output, exitCode } = runSanitizer(input);
    
    expect(output).toBe(input);
    expect(exitCode).toBe(0); // Zero exit when no redactions
  });

  test('generates summary when SANITIZE_SUMMARY_PATH is set', () => {
    const input = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ';
    const tempDir = mkdtempSync(join(tmpdir(), 'sanitize-summary-'));
    const summaryPath = join(tempDir, 'summary.json');

    try {
      const { summary } = runSanitizer(input, { summaryPath });
      
      expect(summary).toBeDefined();
      expect(summary.redactions).toBe(1);
      expect(summary.patterns).toContain('bearer_jwt');
      expect(summary.sha256_before).toBeDefined();
      expect(summary.sha256_after).toBeDefined();
      expect(summary.sha256_before).not.toBe(summary.sha256_after);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('redacts multiple JWT patterns in one pass', () => {
    const input = `
      const jwt1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload1234567890abcdef.signature1234567890ab';
      fetch(url, { headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload9876543210fedcba.signature9876543210fe' } });
    `;
    const { output, summary } = runSanitizer(input);
    
    expect(output).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(output).toContain('REDACTED_JWT');
    expect(summary.redactions).toBeGreaterThan(0);
  });

  test('fail-closed: exits non-zero when redactions occur', () => {
    const input = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.data1234567890abcdefghij.sign1234567890abcdefghij';
    const { exitCode } = runSanitizer(input);
    
    expect(exitCode).toBe(1);
  });
});
