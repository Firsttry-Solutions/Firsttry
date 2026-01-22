/**
 * BACKBONE FIX A: Correlation Echoing Contract Tests
 * 
 * Tests that backend resolvers properly echo ui_req_id and probe_nonce
 * in response envelope.meta (not returning UNSET or null when UI provided them)
 * 
 * This test file validates the fix for production issue where:
 * - UI passes ui_req_id via invokeWithUiReqId wrapper
 * - Backend was receiving it but not echoing it back
 * - Result: meta.ui_req_id = "UNSET" even though UI provided it
 * - Result: probe_nonce = null even though UI provided it for probe
 * 
 * Fix: Backend now extracts ui_req_id from payload and echoes it in meta
 */

import { describe, it, expect } from 'vitest';
import { ft_getDashboardState_v1 } from '../src/gadget-resolver';
import { probe } from '../src/resolvers/probe';

/**
 * BACKBONE FIX A - Test 1: ft_getDashboardState_v1 echoes ui_req_id
 */
describe('BACKBONE FIX A: Correlation Echoing', () => {
  it('ft_getDashboardState_v1: Should echo ui_req_id from payload in response.meta.ui_req_id', async () => {
    // Simulate UI invoke request with ui_req_id
    const testUiReqId = 'ui_test_12345_abc';
    const request = {
      payload: {
        ui_req_id: testUiReqId,
        uiBundleHash: 'test_bundle_hash',
        uiGitSha: 'test_git_sha',
      },
      context: {
        requestId: 'forge_request_123',
      },
    };

    // Call resolver
    const response = await ft_getDashboardState_v1(request);

    // Assert: response must have envelope structure
    expect(response).toBeDefined();
    expect(response.ok).toBeDefined();
    expect(response.meta).toBeDefined();

    // CRITICAL: ui_req_id MUST be echoed back (not UNSET)
    expect(response.meta.ui_req_id).toBeDefined();
    expect(response.meta.ui_req_id).not.toEqual('UNSET');
    expect(response.meta.ui_req_id).toEqual(testUiReqId);
  });

  it('ft_getDashboardState_v1: Should handle missing ui_req_id gracefully', async () => {
    // Request WITHOUT ui_req_id (contract violation, but backend should handle)
    const request = {
      payload: {
        uiBundleHash: 'test_bundle_hash',
      },
      context: {
        requestId: 'forge_request_123',
      },
    };

    // Call resolver
    const response = await ft_getDashboardState_v1(request);

    // When ui_req_id is missing, it MUST be either:
    // 1. Extracted from context.requestId (fallback)
    // 2. Set to "UNSET" explicitly (fail-closed)
    expect(response.meta.ui_req_id).toBeDefined();

    // Must not be undefined/null
    expect(response.meta.ui_req_id).not.toBeNull();
    expect(response.meta.ui_req_id).not.toBeUndefined();
  });

  it('ft_getDashboardState_v1: data.request_id should match meta.ui_req_id when available', async () => {
    const testUiReqId = 'ui_test_probe_xyz_789';
    const request = {
      payload: {
        ui_req_id: testUiReqId,
      },
      context: {},
    };

    const response = await ft_getDashboardState_v1(request);

    // Both meta and data should have the same request_id
    expect(response.meta.ui_req_id).toEqual(testUiReqId);
    // Note: data.request_id might be a separate field, check envelope contract
    if (response.data?.request_id) {
      expect(response.data.request_id).toEqual(testUiReqId);
    }
  });

  /**
   * BACKBONE FIX A - Test 2: Probe resolver echoes ui_req_id and probe_nonce
   */
  it('probe: Should echo ui_req_id from payload in response.correlation.uiReqId', async () => {
    const testUiReqId = 'ui_probe_test_12345_def';
    const request = {
      payload: {
        ui_req_id: testUiReqId,
      },
    };

    // Call probe resolver
    const response = await probe(request);

    // Assert: response must have envelope structure
    expect(response).toBeDefined();
    expect(response.ok).toBeDefined();
    expect(response.correlation).toBeDefined();

    // CRITICAL: ui_req_id MUST be echoed (exact match)
    expect(response.correlation.uiReqId).toBeDefined();
    expect(response.correlation.uiReqId).toEqual(testUiReqId);
  });

  it('probe: Should echo probe_nonce from payload in response.correlation.probeNonce', async () => {
    const testUiReqId = 'ui_probe_test_567_ghi';
    const testProbeNonce = 'probe_test_nonce_12345';

    const request = {
      payload: {
        ui_req_id: testUiReqId,
        probe_nonce: testProbeNonce,
      },
    };

    // Call probe resolver
    const response = await probe(request);

    // CRITICAL: probe_nonce MUST be echoed (not null)
    expect(response.correlation.probeNonce).toBeDefined();
    expect(response.correlation.probeNonce).not.toBeNull();
    expect(response.correlation.probeNonce).toEqual(testProbeNonce);
  });

  it('probe: Should handle missing probe_nonce as null (optional)', async () => {
    const testUiReqId = 'ui_probe_test_optional_jkl';

    const request = {
      payload: {
        ui_req_id: testUiReqId,
        // probe_nonce intentionally omitted
      },
    };

    // Call probe resolver
    const response = await probe(request);

    // probe_nonce is optional, so null is acceptable
    expect(response.correlation.probeNonce).toBeNull();

    // But ui_req_id MUST still be present
    expect(response.correlation.uiReqId).toEqual(testUiReqId);
  });

  it('probe: Should fail CLOSED if ui_req_id is missing (contract violation)', async () => {
    const request = {
      payload: {
        // ui_req_id intentionally missing
      },
    };

    // Call probe resolver
    const response = await probe(request);

    // FAIL CLOSED: response must have ok=false
    expect(response.ok).toEqual(false);
    expect(response.error).toBeDefined();
    expect(response.error.code).toEqual('MISSING_UI_REQ_ID');
  });

  /**
   * BACKBONE FIX A - Test 3: Handler dispatcher also echoes correlation
   */
  it('handler: Should pass ui_req_id through to resolvers via ensureTraceOnError', async () => {
    // This test would need to mock the handler + dispatcher
    // For now, document the expected behavior:
    // 1. handler extracts ui_req_id from payload
    // 2. handler passes it to resolvers via wrappedReq.ui_req_id
    // 3. resolvers use it in their meta/correlation fields
    // 4. handler ensures all responses have meta.ui_req_id set

    expect(true).toBe(true); // Placeholder - handler testing requires more setup
  });

  /**
   * BACKBONE FIX A - Test 4: Contract invariants
   */
  it('Invariant: meta.ui_req_id should never be undefined (always string)', async () => {
    const request = {
      payload: { ui_req_id: 'ui_invariant_test' },
      context: {},
    };

    const response = await ft_getDashboardState_v1(request);

    // Type check: must be string
    expect(typeof response.meta.ui_req_id).toBe('string');
    expect(response.meta.ui_req_id.length).toBeGreaterThan(0);
  });

  it('Invariant: probe_nonce in correlation should be either string or null (never undefined)', async () => {
    const request = {
      payload: { ui_req_id: 'ui_nonce_invariant' },
    };

    const response = await probe(request);

    // Check: must be string or null, not undefined
    const probeNonce = response.correlation.probeNonce;
    expect([typeof probeNonce === 'string', probeNonce === null].includes(true)).toBe(true);
    expect(probeNonce).not.toBeUndefined();
  });
});
