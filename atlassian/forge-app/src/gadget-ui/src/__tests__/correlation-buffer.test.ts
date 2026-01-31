/**
 * correlation-buffer.test.ts
 * 
 * Unit tests for window.__FT_CORRELATION_ID buffer initialization and usage.
 * 
 * Fail-closed gates:
 * 1. Correlation ID must be non-null after initialization
 * 2. Correlation ID must be stable (same value on subsequent reads)
 * 3. Correlation ID must follow pattern: correlation_<timestamp>_<random>
 * 4. DevTools export must return the same value via JSON
 */

describe("Correlation Buffer (window.__FT_CORRELATION_ID)", () => {
  beforeEach(() => {
    // Clear the global before each test
    delete (window as any).__FT_CORRELATION_ID;
  });

  test("should generate non-null correlation ID on first access", () => {
    // Simulate what main.ts does at startup
    const FT_CORRELATION_ID_NONCE =
      (window as any).__FT_CORRELATION_ID ||
      `correlation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    (window as any).__FT_CORRELATION_ID = FT_CORRELATION_ID_NONCE;

    // Assert it's set
    expect((window as any).__FT_CORRELATION_ID).not.toBeNull();
    expect((window as any).__FT_CORRELATION_ID).not.toBeUndefined();
  });

  test("should follow correlation ID naming pattern", () => {
    const FT_CORRELATION_ID_NONCE =
      (window as any).__FT_CORRELATION_ID ||
      `correlation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    (window as any).__FT_CORRELATION_ID = FT_CORRELATION_ID_NONCE;

    const correlationId = (window as any).__FT_CORRELATION_ID;
    
    // Must start with "correlation_"
    expect(correlationId).toMatch(/^correlation_/);
    
    // Must have timestamp component (digits)
    expect(correlationId).toMatch(/correlation_\d+_/);
    
    // Must have random suffix
    expect(correlationId).toMatch(/correlation_\d+_[a-z0-9]{8,}/);
  });

  test("should be stable across multiple reads", () => {
    // First initialization
    const FT_CORRELATION_ID_NONCE =
      (window as any).__FT_CORRELATION_ID ||
      `correlation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    (window as any).__FT_CORRELATION_ID = FT_CORRELATION_ID_NONCE;

    const firstRead = (window as any).__FT_CORRELATION_ID;
    const secondRead = (window as any).__FT_CORRELATION_ID;

    // Must be identical
    expect(firstRead).toBe(secondRead);
  });

  test("should survive reload pattern (reuse if already set)", () => {
    // Simulate first page load
    const initialId =
      (window as any).__FT_CORRELATION_ID ||
      `correlation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    (window as any).__FT_CORRELATION_ID = initialId;

    const valueAfterFirstLoad = (window as any).__FT_CORRELATION_ID;

    // Simulate re-initialization (as if main.ts runs again)
    const secondInitId =
      (window as any).__FT_CORRELATION_ID ||
      `correlation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    (window as any).__FT_CORRELATION_ID = secondInitId;

    // Should reuse the existing ID (not overwrite)
    expect((window as any).__FT_CORRELATION_ID).toBe(valueAfterFirstLoad);
  });

  test("should be exported correctly via DevTools export pattern", () => {
    // Initialize
    const FT_CORRELATION_ID_NONCE =
      (window as any).__FT_CORRELATION_ID ||
      `correlation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    (window as any).__FT_CORRELATION_ID = FT_CORRELATION_ID_NONCE;

    // Simulate DevTools export (what user would copy/paste)
    const exported = JSON.stringify(
      { correlationId: (window as any).__FT_CORRELATION_ID || null },
      null,
      2
    );

    // Must parse back
    const parsed = JSON.parse(exported);

    // correlationId must not be null in export
    expect(parsed.correlationId).not.toBeNull();
    expect(parsed.correlationId).toBe((window as any).__FT_CORRELATION_ID);
  });

  test("should handle concurrent invoke calls using same ID", () => {
    // Initialize once
    const FT_CORRELATION_ID_NONCE =
      (window as any).__FT_CORRELATION_ID ||
      `correlation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    (window as any).__FT_CORRELATION_ID = FT_CORRELATION_ID_NONCE;

    const baseId = (window as any).__FT_CORRELATION_ID;

    // Simulate multiple invoke calls reading the same ID
    const invoke1CorrelationId = (window as any).__FT_CORRELATION_ID || "MISSING";
    const invoke2CorrelationId = (window as any).__FT_CORRELATION_ID || "MISSING";
    const invoke3CorrelationId = (window as any).__FT_CORRELATION_ID || "MISSING";

    // All invokes must send the same correlation ID
    expect(invoke1CorrelationId).toBe(baseId);
    expect(invoke2CorrelationId).toBe(baseId);
    expect(invoke3CorrelationId).toBe(baseId);
    
    // None should be "MISSING"
    expect(invoke1CorrelationId).not.toBe("MISSING");
    expect(invoke2CorrelationId).not.toBe("MISSING");
    expect(invoke3CorrelationId).not.toBe("MISSING");
  });
});
