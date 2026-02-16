/**
 * Tenant Invariant Test
 * Verifies that the tenant invariant check fires on mismatch
 */
import { assertTenantInvariant } from "../../src/security/tenantInvariant";

describe("tenantInvariant", () => {
  test("should not throw when site IDs match", () => {
    expect(() => {
      assertTenantInvariant("site123", "site123");
    }).not.toThrow();
  });

  test("should throw TENANT_INVARIANT_VIOLATION when site IDs mismatch", () => {
    expect(() => {
      assertTenantInvariant("site123", "site456");
    }).toThrow("TENANT_INVARIANT_VIOLATION");
  });

  test("should be fail-closed (non-zero exit semantic)", () => {
    try {
      assertTenantInvariant("siteA", "siteB");
      fail("Should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe("TENANT_INVARIANT_VIOLATION");
    }
    console.log("[FT_TENANT_INVARIANT_ENFORCED]");
  });
});
