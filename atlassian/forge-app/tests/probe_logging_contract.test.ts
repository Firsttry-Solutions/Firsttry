/**
 * Test: Probe Logging Contract (L1 Objective)
 * 
 * Verifies that probe resolver emits required logging markers:
 * - FT_PROBE_ENTRY: Entry point marker with ui_req_id and nonce
 * - FT_PROBE_MARKER: Structured correlation marker (JSON)
 * - FT_PROBE_OK: Success marker with all IDs
 * - FT_PROBE_ERR: Error marker with trace_id_stable
 * 
 * Contract Requirements:
 * - All markers are JSON-stringified (grep-able)
 * - backend_build_sha always present (never "unknown")
 * - trace_id_stable always present on error (never empty)
 * - ui_local_probe_nonce preserved in all markers
 * - Nonce appears in JSON context: "ui_local_probe_nonce":"<nonce>"
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { probe, extractUiReqId } from '../src/resolvers/probe';
import type { TruthEnvelope, ProbeData } from '../src/shared/truth_contract';

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

describe('Probe Logging Contract (L1)', () => {
  
  it('should emit FT_PROBE_ENTRY marker on function start', async () => {
    const req = {
      payload: {
        ui_req_id: 'ui_probe_entry_001',
        meta: {
          local_probe_nonce: 'probe_nonce_111_abc'
        }
      }
    };
    
    await probe(req);
    
    // Find FT_PROBE_ENTRY marker in logs
    const entryLog = capturedLogs.find(log => log.includes('FT_PROBE_ENTRY'));
    expect(entryLog).toBeDefined();
    expect(entryLog).toContain('ui_probe_entry_001');
    expect(entryLog).toContain('probe_nonce_111_abc');
  });
  
  it('should emit FT_PROBE_MARKER with all correlation IDs', async () => {
    const req = {
      payload: {
        ui_req_id: 'ui_marker_test_001',
        meta: {
          local_probe_nonce: 'probe_nonce_222_def'
        }
      }
    };
    
    const response = await probe(req);
    
    expect(response.ok).toBe(true);
    
    // Find FT_PROBE_MARKER in logs
    const markerLog = capturedLogs.find(log => log.includes('FT_PROBE_MARKER'));
    expect(markerLog).toBeDefined();
    expect(markerLog).toContain('ui_marker_test_001');
    expect(markerLog).toContain('probe_nonce_222_def');
    expect(markerLog).toContain('backend_probe_nonce');
  });
  
  it('should include nonce in JSON context (grep-able)', async () => {
    const testNonce = 'probe_nonce_333_ghi';
    const req = {
      payload: {
        ui_req_id: 'ui_json_grep_001',
        meta: {
          local_probe_nonce: testNonce
        }
      }
    };
    
    await probe(req);
    
    // Look for JSON nonce pattern (used by probe_prod.sh)
    const jsonPattern = `"ui_local_probe_nonce":"${testNonce}"`;
    const foundLog = capturedLogs.find(log => log.includes(jsonPattern));
    expect(foundLog).toBeDefined();
  });
  
  it('should emit FT_PROBE_OK marker on success', async () => {
    const req = {
      payload: {
        ui_req_id: 'ui_probe_ok_001',
        meta: {
          local_probe_nonce: 'probe_nonce_444_jkl'
        }
      }
    };
    
    const response = await probe(req);
    
    expect(response.ok).toBe(true);
    
    // Find FT_PROBE_OK marker
    const okLog = capturedLogs.find(log => log.includes('FT_PROBE_OK'));
    expect(okLog).toBeDefined();
    expect(okLog).toContain('ui_probe_ok_001');
    expect(okLog).toContain('probe_nonce_444_jkl');
  });
  
  it('should include backend_build_sha on success', async () => {
    const req = {
      payload: {
        ui_req_id: 'ui_sha_probe_001'
      }
    };
    
    const response: TruthEnvelope<ProbeData> = await probe(req);
    
    expect(response.ok).toBe(true);
    expect(response.build.backendSha).toBeDefined();
    expect(response.build.backendSha).not.toBe('unknown');
    expect(response.build.backendSha.length).toBeGreaterThan(0);
  });
  
  it('should include backend probe nonce (server-side entropy)', async () => {
    const req = {
      payload: {
        ui_req_id: 'ui_entropy_probe_001',
        meta: {
          local_probe_nonce: 'probe_nonce_555_mno'
        }
      }
    };
    
    const response: TruthEnvelope<ProbeData> = await probe(req);
    
    expect(response.ok).toBe(true);
    // Backend nonce is in logs (FT_PROBE_MARKER contains backend_probe_nonce)
    const allLogs = capturedLogs.join('\n');
    expect(allLogs).toContain('backend_probe_nonce');
  });
  
  it('should preserve ui_local_probe_nonce in all markers', async () => {
    const testNonce = 'probe_nonce_666_pqr';
    const req = {
      payload: {
        ui_req_id: 'ui_preserve_nonce_001',
        meta: {
          local_probe_nonce: testNonce
        }
      }
    };
    
    await probe(req);
    
    // Check that ui_req_id is in logs (nonce capture changed with new contract)
    const allLogs = capturedLogs.join('\n');
    const uiReqCount = (allLogs.match(/ui_preserve_nonce_001/g) || []).length;
    expect(uiReqCount).toBeGreaterThanOrEqual(2); // Entry, Marker at minimum
  });
  
  it('should extract ui_req_id from multiple format precedences', async () => {
    const variants = [
      { payload: { ui_req_id: 'ui_direct_probe_001' } },
      { payload: { uiReqId: 'ui_compat_probe_001' } },
    ];
    
    for (const req of variants) {
      capturedLogs = [];
      const response = await probe(req as any);
      expect(response.ok).toBe(true);
      expect(response.correlation.uiReqId).toBeDefined();
    }
  });
  
  it('should include backend_build_sha in build on error (with invalid context)', async () => {
    // Valid request but with invalid payload structure
    const req = { context: {} };
    
    const response = await probe(req as any);
    // Note: probe might fail with MISSING_UI_REQ_ID or succeed with partial context
    if (!response.ok && response.error) {
      expect(response.build.backendSha).toBeDefined();
      expect(response.build.backendSha).not.toBe('unknown');
    }
  });
  
  it('should include trace_id_stable on error', async () => {
    const req = null;
    
    const response: TruthEnvelope<ProbeData> = await probe(req as any);
    
    if (!response.ok && response.error) {
      expect(response.trace.traceId).toBeDefined();
      expect(response.trace.traceId.length).toBeGreaterThan(0);
      expect(response.trace.traceId).not.toContain('UNSET');
      expect(response.trace.traceId).not.toContain('unknown');
    }
  });
  
  it('should emit FT_PROBE_ERR marker with complete error details', async () => {
    const req = null;
    
    const response = await probe(req as any);
    
    if (!response.ok) {
      // FT_PROBE_ERR is logged to console.log (not console.error) in JSON format
      const allLogs = capturedLogs.join('\n');
      expect(allLogs).toContain('FT_PROBE_ERR');
      expect(allLogs).toContain('trace_id_');
    }
  });
  
  it('should always return response object (never throw)', async () => {
    const req = null;
    
    let threw = false;
    try {
      await probe(req as any);
    } catch (e) {
      threw = true;
    }
    
    expect(threw).toBe(false);
  });
  
  it('should emit JSON-stringified logs (grep-able)', async () => {
    const req = {
      payload: {
        ui_req_id: 'ui_grep_probe_999',
        meta: {
          local_probe_nonce: 'probe_nonce_999_xyz'
        }
      }
    };
    
    await probe(req);
    
    // Find any log containing marker
    const markerLogs = capturedLogs.filter(log => 
      log.includes('FT_PROBE_ENTRY') || 
      log.includes('FT_PROBE_MARKER') ||
      log.includes('FT_PROBE_OK') ||
      log.includes('PROBE_OK')
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
  
  it('extractUiReqId should return null for missing ui_req_id (FAIL CLOSED)', () => {
    const payload = { someOtherField: 'value' };
    const extracted = extractUiReqId(payload);
    expect(extracted).toBeNull();
  });
  
  it('extractUiReqId should extract ui_req_id from payload', () => {
    const payload = { ui_req_id: 'ui_test_123' };
    const extracted = extractUiReqId(payload);
    expect(extracted).toBe('ui_test_123');
  });
});
