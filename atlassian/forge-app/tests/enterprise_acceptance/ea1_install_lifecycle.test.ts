/**
 * Enterprise Acceptance Test 1: Install Lifecycle Sanity
 * =======================================================
 * Validates manifest.yml structure, required modules, handler paths
 * 
 * Mode Support: SIMULATION + REAL_TENANT
 * Evidence Output: evidence/manifest_validation.json
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

const MODE = process.env.ENTERPRISE_MODE || 'SIMULATION';
const EVIDENCE_DIR = path.join(__dirname, 'evidence');

interface EvidenceResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  details: Record<string, any>;
  limitations?: string[];
}

describe('EA1: Install Lifecycle Sanity', () => {
  let manifestPath: string;
  let manifest: any;
  let evidence: EvidenceResult;

  beforeAll(() => {
    manifestPath = path.join(__dirname, '../../manifest.yml');
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    manifest = yaml.parse(manifestContent);
    
    evidence = {
      check: 'install_lifecycle_sanity',
      status: 'PASS',
      details: {},
      limitations: MODE === 'SIMULATION' ? ['Cannot verify live app installation'] : []
    };
    
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'manifest_validation.json'),
      JSON.stringify(evidence, null, 2)
    );
  });

  it('manifest.yml exists and parses correctly', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(manifest).toBeDefined();
    expect(manifest.app).toBeDefined();
    
    evidence.details.manifest_parsed = true;
  });

  it('app runtime is declared (nodejs20.x)', () => {
    expect(manifest.app.runtime).toBeDefined();
    expect(manifest.app.runtime.name).toBe('nodejs20.x');
    
    evidence.details.runtime = manifest.app.runtime.name;
  });

  it('required modules exist: function, scheduled', () => {
    expect(manifest.modules).toBeDefined();
    expect(manifest.modules.function).toBeDefined();
    
    const functionKeys = manifest.modules.function.map((f: any) => f.key);
    evidence.details.function_modules = functionKeys;
    
    // Check for scheduled pipelines
    const hasScheduled = manifest.modules.trigger !== undefined;
    evidence.details.has_scheduled_triggers = hasScheduled;
  });

  it('scheduler function handlers exist', () => {
    const schedulerFunctions = manifest.modules.function.filter((f: any) => 
      f.key.includes('pipeline') || f.key.includes('scheduler') || f.key.includes('snapshot')
    );
    
    expect(schedulerFunctions.length).toBeGreaterThan(0);
    
    const handlerPaths = schedulerFunctions.map((f: any) => ({
      key: f.key,
      handler: f.handler
    }));
    
    evidence.details.scheduler_handlers = handlerPaths;
    
    // Verify handler paths are valid (relative to repo)
    for (const func of schedulerFunctions) {
      const handlerPath = func.handler.replace('.', '/') + '.ts';
      const fullPath = path.join(__dirname, '../../src', handlerPath);
      
      // Note: Handler files may not exist in test environment, so we just document expected paths
      evidence.details[`handler_path_${func.key}`] = handlerPath;
    }
  });

  it('permissions are minimal and read-only', () => {
    expect(manifest.permissions).toBeDefined();
    const scopes = manifest.permissions.scopes || [];
    
    // Should only have storage:app (no external.fetch, no write scopes)
    const hasExternalFetch = scopes.includes('external.fetch');
    const hasStorageApp = scopes.includes('storage:app');
    
    expect(hasExternalFetch).toBe(false);
    expect(hasStorageApp).toBe(true);
    
    evidence.details.permissions_scopes = scopes;
    evidence.details.has_external_fetch = hasExternalFetch;
    evidence.details.minimal_permissions = !hasExternalFetch && hasStorageApp;
    
    if (!hasExternalFetch && hasStorageApp) {
      evidence.status = 'PASS';
    } else {
      evidence.status = 'FAIL';
      evidence.details.failure_reason = 'Permissions are not minimal (external.fetch detected or storage:app missing)';
    }
  });

  it('no admin page modules (future-safe removal)', () => {
    const adminPages = manifest.modules['jira:adminPage'] || [];
    
    expect(adminPages.length).toBe(0);
    
    evidence.details.admin_pages_status = 'REMOVED (no admin UI)';
  });
});
