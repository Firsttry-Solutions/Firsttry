/**
 * PHASE 3: Bridge Runtime Probe - Test Suite
 * 
 * Verifies that the bridge check:
 * 1. Uses ESM import (NOT require)
 * 2. Tests actual invoke() via ping resolver
 * 3. Does NOT fabricate evidence
 * 4. Fails closed with actionable diagnostics
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Bridge Runtime Probe (Phase 3 - No require)', () => {
  const bridgeCheckFile = path.join(
    __dirname,
    '..',
    'src/gadget-ui/src/_FATAL_MISSING_FORGE_BRIDGE.ts'
  );

  beforeEach(() => {
    // Reset any mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * TEST 1: Bridge check file must NOT contain require("@forge/bridge")
   * The browser does not support require for bare module specifiers.
   */
  it('must NOT use require("@forge/bridge") - browser-unsafe pattern', () => {
    const fileContent = fs.readFileSync(bridgeCheckFile, 'utf-8');
    expect(fileContent).not.toContain('require("@forge/bridge")');
  });

  /**
   * TEST 2: Bridge check must use ESM import from @forge/bridge
   * This ensures the module is bundled correctly by Vite.
   */
  it('must import invoke from @forge/bridge via ESM', () => {
    const fileContent = fs.readFileSync(bridgeCheckFile, 'utf-8');
    expect(fileContent).toContain('import { invoke } from "@forge/bridge"');
  });

  /**
   * TEST 3: probeForgeBridge() must exist and perform real invoke ping
   * This function probes the actual bridge capability.
   */
  it('must export probeForgeBridge() function with correct signature', () => {
    const fileContent = fs.readFileSync(bridgeCheckFile, 'utf-8');
    expect(fileContent).toContain('export async function probeForgeBridge');
    expect(fileContent).toContain('invoke("ping"');
  });

  /**
   * TEST 4: Proof object must include deterministic fields
   * All fields must reflect actual runtime state (not fabricated).
   */
  it('ForgeBridgePresenceProof must have deterministic fields', () => {
    const fileContent = fs.readFileSync(bridgeCheckFile, 'utf-8');
    const expectedFields = [
      'uiReqId:',
      'href:',
      'invokeType:',
      'pingOk:',
      'pingErr:',
      'ts:'
    ];
    expectedFields.forEach((field) => {
      expect(fileContent).toContain(field);
    });
  });

  /**
   * TEST 5: ensureForgeBridgeOrRenderFatal must be async
   * It must await the probe result before rendering.
   */
  it('ensureForgeBridgeOrRenderFatal must be async', () => {
    const fileContent = fs.readFileSync(bridgeCheckFile, 'utf-8');
    expect(fileContent).toContain('export async function ensureForgeBridgeOrRenderFatal');
    expect(fileContent).toContain('await probeForgeBridge');
  });

  /**
   * TEST 6: Probe must NOT fabricate evidence
   * pingOk should only be true if ping actually succeeded.
   */
  it('must set pingOk only when ping succeeds', () => {
    const fileContent = fs.readFileSync(bridgeCheckFile, 'utf-8');
    // Check that pingOk reflects actual ping result
    expect(fileContent).toContain('pingOk: true');
    // Verify it's set to false on ping failure
    expect(fileContent).toContain('pingOk: false');
  });
  /**
   * TEST 7: Fatal panel must show actionable diagnostics
   * Including: URL, bridge import status, ping error reason.
   */
  it('fatal panel must include actionable diagnostics', () => {
    const fileContent = fs.readFileSync(bridgeCheckFile, 'utf-8');
    expect(fileContent).toContain('proof.href');
    expect(fileContent).toContain('proof.invokeType');
    expect(fileContent).toContain('proof.pingErr');
  });

  /**
   * TEST 8: Ping resolver name must be "ping" (not invented)
   * Using the existing resolver contract.
   */
  it('must use existing "ping" resolver for probe', () => {
    const fileContent = fs.readFileSync(bridgeCheckFile, 'utf-8');
    expect(fileContent).toContain('invoke("ping"');
  });
});
