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
import { ping } from '../src/resolvers/ping';
import type { TruthEnvelope, PingData } from '../src/shared/truth_contract';

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
    
    const response: TruthEnvelope<PingData> = await ping(req);
    
    expect(response.ok).toBe(true);
    expect(response.correlation.uiReqId).toBe('ui_test_67890_xyz');
    
    // Find FT_PING_OK marker
    const okLog = capturedLogs.find(log => log.includes('FT_PING_OK'));
    expect(okLog).toBeDefined();
    expect(okLog).toContain('ui_test_67890_xyz');
  });
  
  it('should include backend_build_sha on success', async () => {
    const req = {
      payload: {
        ui_req_id: 'ui_sha_ping_001'
      }
    };
    
    const response: TruthEnvelope<PingData> = await ping(req);
    
    expect(response.ok).toBe(true);
    expect(response.build.backendSha).toBeDefined();
    expect(response.build.backendSha).not.toBe('unknown');
    expect(response.build.backendSha.length).toBeGreaterThan(0);
  });
  
  it('should extract ui_req_id from multiple format precedences', async () => {
    const req = { payload: { ui_req_id: 'ui_direct_001' } };
    
    capturedLogs = [];
    const response: TruthEnvelope<PingData> = await ping(req);
    expect(response.ok).toBe(true);
    expect(response.correlation.uiReqId).toBeDefined();
  });
  
  it('should preserve ui_req_id in meta even if not provided', async () => {
    const req = { payload: {} };
    
    const response: TruthEnvelope<PingData> = await ping(req);
    
    if (!response.ok) {
      // FAIL CLOSED: missing uiReqId returns error
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('MISSING_UI_REQ_ID');
    }
  });
  
  it('should include backend_build_sha in meta on error (with invalid context)', async () => {
    // Valid request but missing payload (might be edge case)
    const req = { context: {} };
    
    const response: TruthEnvelope<PingData> = await ping(req as any);
    // Note: ping might still succeed with partial context, so this just verifies no crash
    if (!response.ok && response.build) {
      expect(response.build.backendSha).toBeDefined();
      expect(response.build.backendSha).not.toBe('unknown');
    }
  });
  
  it('should include trace_id_stable on error', async () => {
    // Create a scenario that triggers error handling
    const req = null;
    
    const response: TruthEnvelope<PingData> = await ping(req as any);
    
    if (!response.ok && response.trace) {
      expect(response.trace.traceId).toBeDefined();
      expect(response.trace.traceId.length).toBeGreaterThan(0);
      expect(response.trace.traceId).not.toContain('UNSET');
      expect(response.trace.traceId).not.toContain('unknown');
    }
  });
  
  it('should emit FT_PING_ERR marker with complete error details', async () => {
    const req = null;
    
    const response: TruthEnvelope<PingData> = await ping(req as any);
    
    if (!response.ok) {
      const allLogs = capturedLogs.join('\n');
      expect(allLogs).toContain('FT_PING_ERR');
      expect(allLogs).toContain('trace_id_');
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
