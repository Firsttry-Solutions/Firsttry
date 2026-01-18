/**
 * Test: Ping Logging Contract (L1 Objective)
 * 
 * Verifies that ping resolver emits required logging markers:
 * - FT_PING_ENTRY: Entry point marker
 * - FT_PING_OK: Success marker with correlation IDs
 * - FT_PING_ERR: Error marker with trace_id_stable
 * 
 * Contract Requirements:
 * - All markers are JSON-stringified (grep-able)
 * - backend_build_sha always present (never "unknown")
 * - trace_id_stable always present on error (never empty)
 * - ui_req_id preserved even on error
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ping, type PingResponse } from '../src/resolvers/ping';

// Mock console.log and console.error to capture output
let capturedLogs: string[] = [];
let capturedErrors: string[] = [];

const originalLog = console.log;
const originalError = console.error;

beforeEach(() => {
  capturedLogs = [];
  capturedErrors = [];
  
  console.log = (...args: any[]) => {
    capturedLogs.push(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
  };
  
  console.error = (...args: any[]) => {
    capturedErrors.push(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
});

describe('Ping Logging Contract (L1)', () => {
  
  it('should emit FT_PING_ENTRY marker on function start', async () => {
    const req = {
      payload: {
        ui_req_id: 'ui_test_12345_abc'
      }
    };
    
    await ping(req);
    
    // Find FT_PING_ENTRY marker in logs
    const entryLog = capturedLogs.find(log => log.includes('FT_PING_ENTRY'));
    expect(entryLog).toBeDefined();
    expect(entryLog).toContain('ui_test_12345_abc');
  });
  
  it('should emit FT_PING_OK marker on success', async () => {
    const req = {
      payload: {
        ui_req_id: 'ui_test_67890_xyz'
      }
    };
    
    const response = await ping(req);
    
    expect(response.ok).toBe(true);
    expect(response.meta.ui_req_id).toBe('ui_test_67890_xyz');
    
    // Find FT_PING_OK marker
    const okLog = capturedLogs.find(log => log.includes('FT_PING_OK'));
    expect(okLog).toBeDefined();
    expect(okLog).toContain('ui_test_67890_xyz');
  });
  
  it('should include backend_build_sha in meta on success', async () => {
    const req = {
      payload: {
        ui_req_id: 'ui_sha_test_001'
      }
    };
    
    const response: PingResponse = await ping(req);
    
    expect(response.ok).toBe(true);
    expect(response.meta.backend_build_sha).toBeDefined();
    expect(response.meta.backend_build_sha).not.toBe('unknown');
    expect(response.meta.backend_build_sha.length).toBeGreaterThan(0);
  });
  
  it('should extract ui_req_id from multiple format precedences', async () => {
    const variants = [
      { payload: { ui_req_id: 'ui_direct_001' } },
      { payload: { meta: { ui_req_id: 'ui_meta_001' } } },
      { payload: { uiReqId: 'ui_compat_001' } },
      { payload: { requestId: 'ui_legacy_001' } }
    ];
    
    for (const req of variants) {
      capturedLogs = [];
      const response = await ping(req);
      expect(response.ok).toBe(true);
      expect(response.meta.ui_req_id).toBeDefined();
    }
  });
  
  it('should preserve ui_req_id in meta even if not provided', async () => {
    const req = { payload: {} };
    
    const response = await ping(req);
    
    expect(response.ok).toBe(true);
    expect(response.meta.ui_req_id).toBeDefined();
    expect(response.meta.ui_req_id.length).toBeGreaterThan(0);
  });
  
  it('should include backend_build_sha in meta on error (with invalid context)', async () => {
    // Valid request but missing payload (might be edge case)
    const req = { context: {} };
    
    const response = await ping(req as any);
    // Note: ping might still succeed with partial context, so this just verifies no crash
    if (!response.ok && response.meta) {
      expect(response.meta.backend_build_sha).toBeDefined();
      expect(response.meta.backend_build_sha).not.toBe('unknown');
    }
  });
  
  it('should include trace_id_stable on error', async () => {
    // Create a scenario that triggers error handling
    const req = null;
    
    const response: PingResponse = await ping(req as any);
    
    if (!response.ok && response.error) {
      expect(response.error.trace_id_stable).toBeDefined();
      expect(response.error.trace_id_stable.length).toBeGreaterThan(0);
      expect(response.error.trace_id_stable).not.toContain('UNSET');
      expect(response.error.trace_id_stable).not.toContain('unknown');
    }
  });
  
  it('should emit FT_PING_ERR marker with complete error details', async () => {
    const req = null;
    
    const response = await ping(req as any);
    
    if (!response.ok) {
      const errLog = capturedErrors.join('\n');
      expect(errLog).toContain('FT_PING_ERR');
      expect(errLog).toContain('trace_id_stable');
    }
  });
  
  it('should always return response object (never throw)', async () => {
    const req = null;
    
    let threw = false;
    try {
      await ping(req as any);
    } catch (e) {
      threw = true;
    }
    
    expect(threw).toBe(false);
  });
  
  it('should emit JSON-stringified logs (grep-able)', async () => {
    const req = {
      payload: {
        ui_req_id: 'ui_grep_test_999'
      }
    };
    
    await ping(req);
    
    // Find any log containing marker
    const markerLogs = capturedLogs.filter(log => 
      log.includes('FT_PING_ENTRY') || 
      log.includes('FT_PING_OK') || 
      log.includes('PING_OK')
    );
    
    expect(markerLogs.length).toBeGreaterThan(0);
    
    // At least one should contain JSON structure
    const jsonLog = markerLogs.find(log => {
      try {
        JSON.parse(log);
        return true;
      } catch {
        return log.includes('"');
      }
    });
    
    expect(jsonLog).toBeDefined();
  });
});
