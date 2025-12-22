/**
 * Enterprise Acceptance Test 2: Auth Boundary Sanity
 * ===================================================
 * Verifies no Jira write APIs used, minimal permissions
 * 
 * Mode Support: SIMULATION + REAL_TENANT
 * Evidence Output: evidence/auth_boundary.json
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const MODE = process.env.ENTERPRISE_MODE || 'SIMULATION';
const EVIDENCE_DIR = path.join(__dirname, 'evidence');

interface EvidenceResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  details: Record<string, any>;
  limitations?: string[];
}

describe('EA2: Auth Boundary Sanity', () => {
  let evidence: EvidenceResult;
  let sourceFiles: string[];

  beforeAll(async () => {
    evidence = {
      check: 'auth_boundary_sanity',
      status: 'PASS',
      details: {},
      limitations: []
    };
    
    // Find all TypeScript source files
    sourceFiles = await glob('src/**/*.ts', { cwd: path.join(__dirname, '../..') });
    evidence.details.files_scanned = sourceFiles.length;
    
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'auth_boundary.json'),
      JSON.stringify(evidence, null, 2)
    );
  });

  it('no Jira write APIs (POST/PUT/DELETE/PATCH) used', () => {
    const writePatterns = [
      { method: 'POST', forbidden: true },
      { method: 'PUT', forbidden: true },
      { method: 'DELETE', forbidden: true },
      { method: 'PATCH', forbidden: true }
    ];
    
    const violations: Array<{ file: string; line: number; method: string; context: string }> = [];
    
    for (const relPath of sourceFiles) {
      const fullPath = path.join(__dirname, '../..', relPath);
      if (!fs.existsSync(fullPath)) continue;
      
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check for requestJira with write methods
        for (const pattern of writePatterns) {
          if (pattern.forbidden && line.includes('requestJira') && line.includes(`'${pattern.method}'`)) {
            violations.push({
              file: relPath,
              line: i + 1,
              method: pattern.method,
              context: line.trim()
            });
          }
        }
        
        // Also check for direct HTTP write calls (should not exist)
        if (line.includes('method:') && line.match(/(POST|PUT|DELETE|PATCH)/)) {
          const isJiraRequest = lines.slice(Math.max(0, i - 5), i + 1).some(l => l.includes('requestJira'));
          if (isJiraRequest) {
            violations.push({
              file: relPath,
              line: i + 1,
              method: 'UNKNOWN',
              context: line.trim()
            });
          }
        }
      }
    }
    
    evidence.details.write_api_violations = violations;
    evidence.details.write_api_count = violations.length;
    
    if (violations.length === 0) {
      evidence.status = 'PASS';
      evidence.details.no_write_apis = true;
    } else {
      evidence.status = 'FAIL';
      evidence.details.no_write_apis = false;
      evidence.details.failure_reason = `Found ${violations.length} write API calls`;
    }
    
    expect(violations.length).toBe(0);
  });

  it('all requestJira calls are GET-equivalent', () => {
    const jiraApiCalls: Array<{ file: string; line: number; method: string; endpoint: string }> = [];
    
    for (const relPath of sourceFiles) {
      const fullPath = path.join(__dirname, '../..', relPath);
      if (!fs.existsSync(fullPath)) continue;
      
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('requestJira')) {
          // Try to extract endpoint and method
          const endpointMatch = line.match(/['"`]([^'"`]*\/rest\/api\/[^'"`]*)[' "`]/);
          const methodMatch = line.match(/method:\s*['"`]([A-Z]+)['"`]/);
          
          if (endpointMatch) {
            jiraApiCalls.push({
              file: relPath,
              line: i + 1,
              method: methodMatch ? methodMatch[1] : 'GET',
              endpoint: endpointMatch[1]
            });
          }
        }
      }
    }
    
    evidence.details.jira_api_calls = jiraApiCalls;
    evidence.details.total_jira_calls = jiraApiCalls.length;
    
    // All should be GET (or no explicit method, which defaults to GET in requestJira)
    const nonGetCalls = jiraApiCalls.filter(call => call.method !== 'GET');
    evidence.details.non_get_calls = nonGetCalls;
    
    expect(nonGetCalls.length).toBe(0);
  });

  it('no user interaction required beyond install', () => {
    // Check that there are no interactive prompts or OAuth flows in code
    const interactivePatterns = [
      'prompt(',
      'readline.',
      'stdin.',
      'oauth.authorize'
    ];
    
    const interactiveViolations: Array<{ file: string; line: number; pattern: string }> = [];
    
    for (const relPath of sourceFiles) {
      const fullPath = path.join(__dirname, '../..', relPath);
      if (!fs.existsSync(fullPath)) continue;
      
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        for (const pattern of interactivePatterns) {
          if (line.includes(pattern) && !line.trim().startsWith('//')) {
            interactiveViolations.push({
              file: relPath,
              line: i + 1,
              pattern
            });
          }
        }
      }
    }
    
    evidence.details.interactive_violations = interactiveViolations;
    evidence.details.no_user_interaction_required = interactiveViolations.length === 0;
    
    expect(interactiveViolations.length).toBe(0);
  });

  it('no external authentication beyond Forge platform', () => {
    // Check for external auth libraries (should not exist)
    const authLibraries = [
      'passport',
      'auth0',
      'okta',
      'jwt-decode',
      'jsonwebtoken'
    ];
    
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    const dependencies = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };
    
    const foundAuthLibs = authLibraries.filter(lib => dependencies[lib]);
    
    evidence.details.external_auth_libraries = foundAuthLibs;
    evidence.details.no_external_auth = foundAuthLibs.length === 0;
    
    expect(foundAuthLibs.length).toBe(0);
  });
});
