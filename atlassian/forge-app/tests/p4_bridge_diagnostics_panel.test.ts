/**
 * Bridge Diagnostics Panel Tests
 * 
 * Verifies:
 * - Early identity marker prints even when bridge fails
 * - probeForgeBridge() returns factual structured evidence
 * - ensureForgeBridgeOrRenderFatal() never throws (no uncaught errors)
 * - Fatal panel displays probe JSON with copy button
 * - All probe fields are present (not missing/undefined)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  probeForgeBridge,
  ensureForgeBridgeOrRenderFatal,
  type ForgeBridgePresenceProof,
  type BridgeCheckResult,
} from '../src/gadget-ui/src/_FATAL_MISSING_FORGE_BRIDGE';

describe('p4_bridge_diagnostics_panel', () => {
  let containerDiv: HTMLElement;

  beforeEach(() => {
    containerDiv = document.createElement('div');
    document.body.appendChild(containerDiv);
  });

  afterEach(() => {
    if (containerDiv && containerDiv.parentNode) {
      document.body.removeChild(containerDiv);
    }
    vi.clearAllMocks();
  });

  describe('probeForgeBridge() structured probe', () => {
    it('TEST 1: returns all required fields even when invoke is missing', async () => {
      // Mock: invoke is not a function (or undefined)
      const savedInvoke = (global as any).invoke;
      (global as any).invoke = undefined;

      try {
        const proof = await probeForgeBridge('test-ui-req-id');

        // Verify all fields exist
        expect(proof).toHaveProperty('uiReqId');
        expect(proof).toHaveProperty('ts');
        expect(proof).toHaveProperty('href');
        expect(proof).toHaveProperty('referrer');
        expect(proof).toHaveProperty('inIframe');
        expect(proof).toHaveProperty('invokeType');
        expect(proof).toHaveProperty('hasForgeGlobalBridgeScript');
        expect(proof).toHaveProperty('hasIframeResizerScript');
        expect(proof).toHaveProperty('pingAttempted');
        expect(proof).toHaveProperty('pingOk');
        expect(proof).toHaveProperty('pingErr');

        // Verify correct values
        expect(proof.uiReqId).toBe('test-ui-req-id');
        expect(proof.invokeType).toBe('undefined');
        expect(proof.pingAttempted).toBe(false);
        expect(proof.pingOk).toBe(false);
        expect(proof.pingErr).toBeNull();
      } finally {
        (global as any).invoke = savedInvoke;
      }
    });

    it('TEST 2: returns pingAttempted:true when invoke is a function', async () => {
      // Mock: invoke is a function that rejects
      const mockInvoke = vi.fn().mockRejectedValue(new Error('resolver-not-found'));
      (global as any).invoke = mockInvoke;

      try {
        const proof = await probeForgeBridge('test-ui-req-2');

        expect(proof.invokeType).toBe('function');
        expect(proof.pingAttempted).toBe(true);
        expect(proof.pingOk).toBe(false);
        expect(proof.pingErr).toBe('resolver-not-found');
      } finally {
        delete (global as any).invoke;
      }
    });

    it('TEST 3: returns pingOk:true when ping succeeds', async () => {
      // Mock: invoke is a function that resolves
      const mockInvoke = vi.fn().mockResolvedValue({ success: true });
      (global as any).invoke = mockInvoke;

      try {
        const proof = await probeForgeBridge('test-ui-req-3');

        expect(proof.invokeType).toBe('function');
        expect(proof.pingAttempted).toBe(true);
        expect(proof.pingOk).toBe(true);
        expect(proof.pingErr).toBeNull();
      } finally {
        delete (global as any).invoke;
      }
    });

    it('TEST 4: captures iframe context correctly', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({});
      (global as any).invoke = mockInvoke;

      try {
        const proof = await probeForgeBridge('test-ui-req-4');

        // window.self === window in test environment
        expect(proof.inIframe).toBe(false);
        expect(proof.href).toEqual(expect.stringContaining('http'));
      } finally {
        delete (global as any).invoke;
      }
    });

    it('TEST 5: ping timeout produces consistent error message', async () => {
      const mockInvoke = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000)) // Never resolves
      );
      (global as any).invoke = mockInvoke;

      try {
        const proof = await probeForgeBridge('test-ui-req-5');

        expect(proof.pingAttempted).toBe(true);
        expect(proof.pingOk).toBe(false);
        expect(proof.pingErr).toBe('ping-timeout');
      } finally {
        delete (global as any).invoke;
      }
    }, { timeout: 5000 });
  });

  describe('ensureForgeBridgeOrRenderFatal() contract', () => {
    it('TEST 6: returns { ok: true, probe } when bridge works', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({});
      (global as any).invoke = mockInvoke;

      try {
        const result = await ensureForgeBridgeOrRenderFatal(containerDiv);

        expect(result).toHaveProperty('ok');
        expect(result).toHaveProperty('probe');
        expect(result.ok).toBe(true);
        expect(result.probe.pingOk).toBe(true);
      } finally {
        delete (global as any).invoke;
      }
    });

    it('TEST 7: returns { ok: false, probe } when bridge fails (no throw)', async () => {
      const mockInvoke = vi.fn().mockRejectedValue(new Error('bridge-error'));
      (global as any).invoke = mockInvoke;

      try {
        const result = await ensureForgeBridgeOrRenderFatal(containerDiv);

        expect(result.ok).toBe(false);
        expect(result.probe.pingOk).toBe(false);
        expect(result.probe.pingErr).toBe('bridge-error');
      } finally {
        delete (global as any).invoke;
      }
    });

    it('TEST 8: renders fatal panel when bridge fails', async () => {
      const mockInvoke = vi.fn().mockRejectedValue(new Error('fatal-test'));
      (global as any).invoke = mockInvoke;

      try {
        await ensureForgeBridgeOrRenderFatal(containerDiv);

        // Panel should be rendered
        const panel = containerDiv.querySelector('#forge-bridge-fatal-error-panel');
        expect(panel).toBeTruthy();

        // Panel should contain title
        const title = panel?.querySelector('h1');
        expect(title?.textContent).toContain('Forge Bridge Unavailable');

        // Panel should contain JSON diagnostics
        const pre = panel?.querySelector('pre');
        expect(pre?.textContent).toContain('"uiReqId"');
        expect(pre?.textContent).toContain('"pingOk"');
      } finally {
        delete (global as any).invoke;
      }
    });

    it('TEST 9: fatal panel includes copy button', async () => {
      const mockInvoke = vi.fn().mockRejectedValue(new Error('copy-test'));
      (global as any).invoke = mockInvoke;

      try {
        await ensureForgeBridgeOrRenderFatal(containerDiv);

        const copyBtn = containerDiv.querySelector('button');
        expect(copyBtn?.textContent).toContain('Copy');
      } finally {
        delete (global as any).invoke;
      }
    });

    it('TEST 10: copy button works (clipboard)', async () => {
      const mockInvoke = vi.fn().mockRejectedValue(new Error('clipboard-test'));
      (global as any).invoke = mockInvoke;

      // Mock clipboard
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
      });

      try {
        await ensureForgeBridgeOrRenderFatal(containerDiv);

        const copyBtn = containerDiv.querySelector('button') as HTMLButtonElement;
        expect(copyBtn).toBeTruthy();

        // Simulate click
        copyBtn.click();

        // Verify clipboard was called
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(writeTextMock).toHaveBeenCalled();
      } finally {
        delete (global as any).invoke;
      }
    });
  });

  describe('console logging', () => {
    it('TEST 11: logs [UI_BRIDGE_RUNTIME_PROOF] marker', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log');
      const mockInvoke = vi.fn().mockResolvedValue({});
      (global as any).invoke = mockInvoke;

      try {
        await ensureForgeBridgeOrRenderFatal(containerDiv);

        const proofLogs = consoleLogSpy.mock.calls.filter(
          call => typeof call[0] === 'string' && call[0].includes('[UI_BRIDGE_RUNTIME_PROOF]')
        );
        expect(proofLogs.length).toBeGreaterThan(0);
      } finally {
        delete (global as any).invoke;
        consoleLogSpy.mockRestore();
      }
    });

    it('TEST 12: logs [FORGE_BRIDGE_FATAL] marker when bridge fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const mockInvoke = vi.fn().mockRejectedValue(new Error('fatal-marker-test'));
      (global as any).invoke = mockInvoke;

      try {
        await ensureForgeBridgeOrRenderFatal(containerDiv);

        const fatalLogs = consoleErrorSpy.mock.calls.filter(
          call => typeof call[0] === 'string' && call[0].includes('[FORGE_BRIDGE_FATAL]')
        );
        expect(fatalLogs.length).toBeGreaterThan(0);
      } finally {
        delete (global as any).invoke;
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe('TypeScript contract enforcement', () => {
    it('TEST 13: ForgeBridgePresenceProof type has all required fields', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({});
      (global as any).invoke = mockInvoke;

      try {
        const proof = await probeForgeBridge('test-contract');

        // This test primarily checks TypeScript compilation
        // At runtime, we verify the shape
        const expectedFields = [
          'uiReqId', 'ts', 'href', 'referrer', 'inIframe',
          'invokeType', 'hasForgeGlobalBridgeScript', 'hasIframeResizerScript',
          'pingAttempted', 'pingOk', 'pingErr'
        ];

        for (const field of expectedFields) {
          expect(proof).toHaveProperty(field);
        }
      } finally {
        delete (global as any).invoke;
      }
    });

    it('TEST 14: BridgeCheckResult type has ok and probe', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({});
      (global as any).invoke = mockInvoke;

      try {
        const result = await ensureForgeBridgeOrRenderFatal(containerDiv);

        expect(result).toHaveProperty('ok');
        expect(result).toHaveProperty('probe');
        expect(typeof result.ok).toBe('boolean');
        expect(result.probe).toHaveProperty('uiReqId');
      } finally {
        delete (global as any).invoke;
      }
    });
  });
});
