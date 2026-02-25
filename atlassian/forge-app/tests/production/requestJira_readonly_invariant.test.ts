import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, extname } from 'path';

/**
 * requestJira Readonly Invariant Test
 * 
 * Verify that all requestJira() calls in runtime code (src/**) 
 * do NOT specify POST/PUT/DELETE/PATCH methods.
 * 
 * This ensures Jira mutation scope violations are detected at test time.
 */

describe('CR4/CR7: requestJira Readonly Invariant', () => {
  
  it('should have no requestJira calls with mutation methods', () => {
    const srcDir = join(process.cwd(), 'src');
    const violations: string[] = [];
    
    /**
     * Recursively scan TypeScript files for requestJira(...) calls
     * and check if they contain forbidden mutation method specifications
     */
    function scanDir(dir: string) {
      const files = readdirSync(dir, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = join(dir, file.name);
        
        // Skip node_modules, dist, test files
        if (file.name === 'node_modules' || file.name === 'dist' || 
            file.name.endsWith('.test.ts') || file.name.endsWith('.spec.ts')) {
          continue;
        }
        
        if (file.isDirectory()) {
          scanDir(fullPath);
        } else if (file.isFile() && (extname(file.name) === '.ts' || extname(file.name) === '.tsx')) {
          const content = readFileSync(fullPath, 'utf-8');
          
          // Find all requestJira(...) calls
          const requestJiraPattern = /requestJira\s*\([^)]*\{[^}]*\}/g;
          let match;
          
          while ((match = requestJiraPattern.exec(content)) !== null) {
            const callSnippet = match[0];
            
            // Check for forbidden mutation methods in the call
            const forbiddenPatterns = [
              /method\s*:\s*['"]POST['"]/i,
              /method\s*:\s*['"]PUT['"]/i,
              /method\s*:\s*['"]DELETE['"]/i,
              /method\s*:\s*['"]PATCH['"]/i,
            ];
            
            for (const pattern of forbiddenPatterns) {
              if (pattern.test(callSnippet)) {
                violations.push(
                  `${fullPath}:\n` +
                  `    ${callSnippet.substring(0, 120)}\n` +
                  `    METHOD: ${callSnippet.match(/method\s*:\s*['"]([^'"]+)['"]/i)?.[1] || 'UNKNOWN'}`
                );
              }
            }
          }
        }
      }
    }
    
    scanDir(srcDir);
    
    if (violations.length > 0) {
      console.error('\n❌ FAIL: Found requestJira calls with mutation methods:\n');
      violations.slice(0, 10).forEach(v => console.error(v));
      if (violations.length > 10) {
        console.error(`\n... and ${violations.length - 10} more violations`);
      }
    }
    
    expect(violations, `Should have zero requestJira mutation method violations (found ${violations.length})`).toHaveLength(0);
  });
  
  it('should have no direct HTTP mutations in runtime code', () => {
    const srcDir = join(process.cwd(), 'src');
    const violations: string[] = [];
    
    function scanDir(dir: string) {
      const files = readdirSync(dir, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = join(dir, file.name);
        
        if (file.name === 'node_modules' || file.name === 'dist' ||
            file.name.endsWith('.test.ts') || file.name.endsWith('.spec.ts') ||
            file.name.endsWith('.d.ts')) {
          continue;
        }
        
        if (file.isDirectory()) {
          scanDir(fullPath);
        } else if (file.isFile() && (extname(file.name) === '.ts' || extname(file.name) === '.tsx')) {
          const content = readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          
          lines.forEach((line, idx) => {
            // Skip comments
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
              return;
            }
            
            // Detect forbidden patterns
            if (/\baxios\s*\.(?:post|put|delete|patch)\s*\(/i.test(line)) {
              violations.push(`${fullPath}:${idx + 1}: ${line.trim()}`);
            }
            
            if (/new\s+Request\s*\([^)]*https?:\/\/[^)]*\)/i.test(line)) {
              violations.push(`${fullPath}:${idx + 1}: ${line.trim()}`);
            }
          });
        }
      }
    }
    
    scanDir(srcDir);
    
    expect(violations, `Should have zero direct HTTP mutations (found ${violations.length})`).toHaveLength(0);
  });
});
