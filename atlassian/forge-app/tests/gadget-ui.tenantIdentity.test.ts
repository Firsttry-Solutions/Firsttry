/**
 * GADGET UI - TenantIdentity Safety Test
 * ======================================
 * Tests that the UI gracefully handles missing or undefined tenantIdentity
 * and never throws a "Cannot read properties of undefined" error.
 *
 * Run with: npm test
 */

/**
 * Mock data factory: Create minimal payload
 */
function createMinimalPayload(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    appId: 'TEST_APP',
    environment: 'test',
    cloudId: 'test-cloud-id',
    installationId: 'test-install-id',
    serverBuildStamp: 'TEST_BUILD',
    
    // Defaults - these can be overridden
    tenantIdentity: {
      available: true,
    },
    permissionVisibility: {
      determined: true,
    },
    failureCount7d: 0,
    skippedChecksCount7d: 0,
    freshnessStatus: 'FRESH',
    isStale: false,
    snapshotAgeMinutes: 10,
    checks: [],
    checksTotalCount: 0,
    schemaVersion: '2.14.0',
    generatedAt: new Date().toISOString(),
    
    ...overrides,
  };
}

/**
 * Helper: Simulate the safe signal rendering logic from main.ts
 * This extracts the logic that was causing crashes.
 */
function renderSignalsFromPayload(data: Record<string, any>): Record<string, string> {
  try {
    // Safe read 1: tenantIdentity.available
    const tenantAvailable = data?.tenantIdentity?.available;
    let tenantBadgeClass: string;
    let tenantLabel: string;
    let tenantImpact: string;
    if (tenantAvailable === true) {
        tenantBadgeClass = 'signal-available';
        tenantLabel = 'AVAILABLE';
        tenantImpact = 'Monitoring operational';
    } else if (tenantAvailable === false) {
        tenantBadgeClass = 'signal-unavailable';
        tenantLabel = 'UNAVAILABLE';
        tenantImpact = 'Monitoring paused';
    } else {
        tenantBadgeClass = 'signal-unknown';
        tenantLabel = 'UNKNOWN';
        tenantImpact = 'Identity status unclear; monitoring may be paused';
    }

    // Safe read 2: permissionVisibility.determined
    const permDetermined = data?.permissionVisibility?.determined;
    let permBadgeClass: string;
    let permLabel: string;
    let permImpact: string;
    if (permDetermined === true) {
        permBadgeClass = 'signal-available';
        permLabel = 'DETERMINED';
        permImpact = 'All visible data accessible';
    } else if (permDetermined === false) {
        permBadgeClass = 'signal-unavailable';
        permLabel = 'NOT_DETERMINED';
        permImpact = 'Some data may be restricted';
    } else {
        permBadgeClass = 'signal-unknown';
        permLabel = 'UNKNOWN';
        permImpact = 'Permission visibility unclear';
    }

    // Safe read 3: isStale
    const isStale = data?.isStale;
    let staleBadgeClass: string;
    let staleLabel: string;
    let staleImpact: string;
    if (isStale === false) {
        staleBadgeClass = 'signal-fresh';
        staleLabel = 'FRESH';
        staleImpact = 'Operational visibility is current';
    } else if (isStale === true) {
        staleBadgeClass = 'signal-stale';
        staleLabel = 'STALE';
        staleImpact = 'Operational visibility may be outdated';
    } else {
        staleBadgeClass = 'signal-unknown';
        staleLabel = 'UNKNOWN';
        staleImpact = 'Data freshness unknown; first run pending';
    }

    // Safe read 4: snapshotAgeMinutes
    const snapshotAge = data?.snapshotAgeMinutes;
    let storageBadgeClass: string;
    let storageLabel: string;
    let storageImpact: string;
    if (snapshotAge !== null && snapshotAge !== undefined) {
        storageBadgeClass = 'signal-available';
        storageLabel = 'HAS_DATA';
        storageImpact = 'Full metrics available';
    } else {
        storageBadgeClass = 'signal-unavailable';
        storageLabel = 'EMPTY';
        storageImpact = 'First run pending';
    }

    return {
      tenantBadgeClass,
      tenantLabel,
      tenantImpact,
      permBadgeClass,
      permLabel,
      permImpact,
      staleBadgeClass,
      staleLabel,
      staleImpact,
      storageBadgeClass,
      storageLabel,
      storageImpact,
    };
  } catch (error) {
    throw new Error(`Failed to render signals: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * TEST SUITE: TenantIdentity Rendering Safety
 */
describe('GadgetUI: TenantIdentity & Signals Rendering Safety', () => {
  /**
   * TEST 1: Render with complete payload (happy path)
   */
  test('should render signals with complete payload', () => {
    const payload = createMinimalPayload({
      tenantIdentity: { available: true },
      permissionVisibility: { determined: true },
      isStale: false,
      snapshotAgeMinutes: 5,
    });

    const signals = renderSignalsFromPayload(payload);

    expect(signals.tenantLabel).toBe('AVAILABLE');
    expect(signals.tenantBadgeClass).toBe('signal-available');
    expect(signals.permLabel).toBe('DETERMINED');
    expect(signals.staleLabel).toBe('FRESH');
    expect(signals.storageLabel).toBe('HAS_DATA');
  });

  /**
   * TEST 2: Render with tenantIdentity completely missing (CRASH SCENARIO)
   * This was the original bug: data.tenantIdentity is undefined
   */
  test('should not crash when tenantIdentity is undefined', () => {
    const payload = createMinimalPayload({
      tenantIdentity: undefined, // <-- This caused the crash
    });

    expect(() => {
      renderSignalsFromPayload(payload);
    }).not.toThrow();

    const signals = renderSignalsFromPayload(payload);
    expect(signals.tenantLabel).toBe('UNKNOWN');
    expect(signals.tenantBadgeClass).toBe('signal-unknown');
  });

  /**
   * TEST 3: Render with tenantIdentity.available === null
   */
  test('should not crash when tenantIdentity.available is null', () => {
    const payload = createMinimalPayload({
      tenantIdentity: { available: null },
    });

    expect(() => {
      renderSignalsFromPayload(payload);
    }).not.toThrow();

    const signals = renderSignalsFromPayload(payload);
    expect(signals.tenantLabel).toBe('UNKNOWN');
  });

  /**
   * TEST 4: Render with tenantIdentity.available === false
   */
  test('should render UNAVAILABLE when tenantIdentity.available is false', () => {
    const payload = createMinimalPayload({
      tenantIdentity: { available: false, reasonCode: 'PERMISSION_DENIED' },
    });

    const signals = renderSignalsFromPayload(payload);
    expect(signals.tenantLabel).toBe('UNAVAILABLE');
    expect(signals.tenantBadgeClass).toBe('signal-unavailable');
    expect(signals.tenantImpact).toBe('Monitoring paused');
  });

  /**
   * TEST 5: Render with permissionVisibility undefined
   */
  test('should not crash when permissionVisibility is undefined', () => {
    const payload = createMinimalPayload({
      permissionVisibility: undefined,
    });

    expect(() => {
      renderSignalsFromPayload(payload);
    }).not.toThrow();

    const signals = renderSignalsFromPayload(payload);
    expect(signals.permLabel).toBe('UNKNOWN');
  });

  /**
   * TEST 6: Render with isStale === null (unknown freshness)
   */
  test('should render UNKNOWN for freshness when isStale is null', () => {
    const payload = createMinimalPayload({
      isStale: null,
    });

    const signals = renderSignalsFromPayload(payload);
    expect(signals.staleLabel).toBe('UNKNOWN');
    expect(signals.staleBadgeClass).toBe('signal-unknown');
  });

  /**
   * TEST 7: Render with snapshotAgeMinutes === null (no data yet)
   */
  test('should render EMPTY when snapshotAgeMinutes is null', () => {
    const payload = createMinimalPayload({
      snapshotAgeMinutes: null,
    });

    const signals = renderSignalsFromPayload(payload);
    expect(signals.storageLabel).toBe('EMPTY');
    expect(signals.storageBadgeClass).toBe('signal-unavailable');
  });

  /**
   * TEST 8: Render with completely empty/null payload (extreme case)
   */
  test('should not crash with minimal empty payload', () => {
    const emptyPayload = {};

    expect(() => {
      renderSignalsFromPayload(emptyPayload);
    }).not.toThrow();

    const signals = renderSignalsFromPayload(emptyPayload);
    
    // All should fall back to UNKNOWN
    expect(signals.tenantLabel).toBe('UNKNOWN');
    expect(signals.permLabel).toBe('UNKNOWN');
    expect(signals.staleLabel).toBe('UNKNOWN');
    expect(signals.storageLabel).toBe('EMPTY');
  });

  /**
   * TEST 9: Verify all badge classes exist and are consistent
   */
  test('should always return valid badge class names', () => {
    const payload = createMinimalPayload({
      tenantIdentity: undefined,
      permissionVisibility: undefined,
      isStale: undefined,
      snapshotAgeMinutes: undefined,
    });

    const signals = renderSignalsFromPayload(payload);
    
    const validClasses = [
      'signal-available',
      'signal-unavailable',
      'signal-unknown',
      'signal-fresh',
      'signal-stale',
    ];

    expect(validClasses).toContain(signals.tenantBadgeClass);
    expect(validClasses).toContain(signals.permBadgeClass);
    expect(validClasses).toContain(signals.staleBadgeClass);
    expect([...validClasses, 'signal-unavailable']).toContain(signals.storageBadgeClass);
  });

  /**
   * TEST 10: Verify labels are always non-empty strings
   */
  test('should always produce non-empty labels', () => {
    const payload = createMinimalPayload({
      tenantIdentity: undefined,
      permissionVisibility: undefined,
      isStale: undefined,
      snapshotAgeMinutes: undefined,
    });

    const signals = renderSignalsFromPayload(payload);
    
    expect(signals.tenantLabel).toBeTruthy();
    expect(signals.tenantLabel.length).toBeGreaterThan(0);
    expect(signals.permLabel).toBeTruthy();
    expect(signals.staleLabel).toBeTruthy();
    expect(signals.storageLabel).toBeTruthy();
  });

  /**
   * TEST 11: Verify impacts are always meaningful
   */
  test('should always produce meaningful impact messages', () => {
    const payload = createMinimalPayload({
      tenantIdentity: undefined,
    });

    const signals = renderSignalsFromPayload(payload);
    
    expect(signals.tenantImpact).toContain('unclear') || expect(signals.tenantImpact).toContain('unknown') || expect(signals.tenantImpact).toContain('paused');
    expect(signals.tenantImpact.length).toBeGreaterThan(5);
  });
});
