/**
 * UI State Mapper Contract Test - Fail-Closed Behavior
 *
 * CRITICAL: Ensures UI does NOT show AVAILABLE if backend says NOT_AVAILABLE
 * REGRESSION: Tests for the exact AVAILABLE envelope from seed snapshot + missing field checks
 */

import { describe, it, expect } from "vitest";
import { mapL0SnapshotResponse, type L0DashboardState } from "../src/gadget-ui/src/l0_snapshot_mapper";

describe("L0 Snapshot Mapper - Fail-Closed State Contract", () => {
  describe("AVAILABLE path", () => {
    it("should map AVAILABLE status correctly", () => {
      const response = {
        status: "AVAILABLE",
        snapshotId: "snap-123",
        createdAtUtc: "2026-01-30T12:00:00Z",
        schemaVersion: "L0",
        containsText: "Test snapshot",
      };

      const result = mapL0SnapshotResponse(response);

      expect(result.status).toBe("AVAILABLE");
      expect(result.snapshotId).toBe("snap-123");
      expect(result.createdAtUtc).toBe("2026-01-30T12:00:00Z");
    });

    // REGRESSION TEST: Seed snapshot with exact envelope shape from logs
    it("REGRESSION: AVAILABLE envelope maps to AVAILABLE with snapshotId and createdAtUtc", () => {
      // This is the EXACT envelope from the seed snapshot (from logs)
      const seedEnvelope = {
        envelopeKind: "FT_DASH_ENVELOPE_V1",
        schemaVersion: "v1",
        ok: true,
        status: "AVAILABLE",
        data: {
          status: "AVAILABLE",
          snapshotId: "a5224a163f6e-2026.01.24.01-seed",
          createdAtUtc: "2026-01-24T12:00:00Z",
          schemaVersion: "L0",
          containsText: "Seed snapshot",
        },
      };

      const result = mapL0SnapshotResponse(seedEnvelope);

      // CRITICAL: Must map to AVAILABLE
      expect(result.status).toBe("AVAILABLE");
      expect(result.reasonCode).toBe("PROOF_OK");
      // CRITICAL: snapshotId and createdAtUtc must be preserved
      expect(result.snapshotId).toBe("a5224a163f6e-2026.01.24.01-seed");
      expect(result.createdAtUtc).toBe("2026-01-24T12:00:00Z");
      expect(result.error).toBeNull();
    });

    // REGRESSION TEST: Missing snapshotId fails-closed to INVALID_SNAPSHOT
    it("REGRESSION: AVAILABLE missing snapshotId fails-closed to INVALID_SNAPSHOT", () => {
      const envelopeWithoutSnapshot = {
        ok: true,
        status: "AVAILABLE",
        data: {
          status: "AVAILABLE",
          // snapshotId MISSING
          createdAtUtc: "2026-01-24T12:00:00Z",
          schemaVersion: "L0",
        },
      };

      const result = mapL0SnapshotResponse(envelopeWithoutSnapshot);

      // CRITICAL: Must NOT be AVAILABLE
      expect(result.status).not.toBe("AVAILABLE");
      // Should fail-closed to INVALID_SNAPSHOT
      expect(result.status).toBe("INVALID_SNAPSHOT");
      expect(result.snapshotId).toBeNull();
      expect(result.error).toBe("FT_RESPONSE_MISSING_FIELDS");
    });

    // REGRESSION TEST: Missing createdAtUtc fails-closed to INVALID_SNAPSHOT
    it("REGRESSION: AVAILABLE missing createdAtUtc fails-closed to INVALID_SNAPSHOT", () => {
      const envelopeWithoutTimestamp = {
        ok: true,
        status: "AVAILABLE",
        data: {
          status: "AVAILABLE",
          snapshotId: "snap-123",
          // createdAtUtc MISSING
          schemaVersion: "L0",
        },
      };

      const result = mapL0SnapshotResponse(envelopeWithoutTimestamp);

      // CRITICAL: Must NOT be AVAILABLE
      expect(result.status).not.toBe("AVAILABLE");
      // Should fail-closed to INVALID_SNAPSHOT
      expect(result.status).toBe("INVALID_SNAPSHOT");
      expect(result.createdAtUtc).toBeNull();
      expect(result.error).toBe("FT_RESPONSE_MISSING_FIELDS");
    });

    // REGRESSION TEST: Both missing fields
    it("REGRESSION: AVAILABLE missing both snapshotId and createdAtUtc fails-closed", () => {
      const envelopeWithoutBoth = {
        ok: true,
        status: "AVAILABLE",
        data: {
          status: "AVAILABLE",
          schemaVersion: "L0",
        },
      };

      const result = mapL0SnapshotResponse(envelopeWithoutBoth);

      // CRITICAL: Must NOT be AVAILABLE
      expect(result.status).not.toBe("AVAILABLE");
      expect(result.status).toBe("INVALID_SNAPSHOT");
    });
  });

  describe("NOT_AVAILABLE / FT_SNAPSHOT_INVALID path (FAIL-CLOSED)", () => {
    it("should NOT map NOT_AVAILABLE to AVAILABLE (fail-closed)", () => {
      const response = {
        status: "NOT_AVAILABLE",
        error: {
          code: "FT_SNAPSHOT_INVALID",
        },
        schemaVersion: "L0",
      };

      const result = mapL0SnapshotResponse(response);

      // CRITICAL: Must NOT be AVAILABLE
      expect(result.status).not.toBe("AVAILABLE");
      // Should map to NO_SNAPSHOT or similar non-fatal state
      expect(result.status).toBe("NO_SNAPSHOT");
    });

    it("should handle NOT_AVAILABLE without error code (fail-closed)", () => {
      const response = {
        status: "NOT_AVAILABLE",
        schemaVersion: "L0",
      };

      const result = mapL0SnapshotResponse(response);

      // Should NOT be AVAILABLE - fail-closed
      expect(result.status).not.toBe("AVAILABLE");
    });
  });

  describe("NO_SNAPSHOT path", () => {
    it("should map NO_SNAPSHOT correctly", () => {
      const response = {
        status: "NO_SNAPSHOT",
        error: "NO_DATA",
        schemaVersion: "L0",
      };

      const result = mapL0SnapshotResponse(response);

      expect(result.status).toBe("NO_SNAPSHOT");
      expect(result.snapshotId).toBeNull();
      expect(result.createdAtUtc).toBeNull();
    });
  });

  describe("HARD_ERROR path", () => {
    it("should map HARD_ERROR correctly", () => {
      const response = {
        status: "HARD_ERROR",
        error: "BACKEND_FAILURE",
        schemaVersion: "L0",
      };

      const result = mapL0SnapshotResponse(response);

      expect(result.status).toBe("HARD_ERROR");
    });
  });

  describe("Invalid response handling (fail-closed)", () => {
    it("should return HARD_ERROR for null response", () => {
      const result = mapL0SnapshotResponse(null);

      expect(result.status).toBe("HARD_ERROR");
      expect(result.reasonCode).toBe("ENVELOPE_NOT_OK");
    });

    it("should return HARD_ERROR for undefined response", () => {
      const result = mapL0SnapshotResponse(undefined);

      expect(result.status).toBe("HARD_ERROR");
    });

    it("should return HARD_ERROR for missing status field", () => {
      const response = {
        schemaVersion: "L0",
        snapshotId: "snap-123",
      };

      const result = mapL0SnapshotResponse(response);

      expect(result.status).toBe("HARD_ERROR");
    });

    it("should return HARD_ERROR for unexpected status value", () => {
      const response = {
        status: "UNKNOWN_STATE",
        schemaVersion: "L0",
      };

      const result = mapL0SnapshotResponse(response);

      expect(result.status).toBe("HARD_ERROR");
    });
  });

  describe("Envelope wrapper handling", () => {
    it("should extract data from envelope wrapper", () => {
      const envelope = {
        ok: true,
        status: "AVAILABLE",
        data: {
          status: "AVAILABLE",
          snapshotId: "snap-456",
          createdAtUtc: "2026-01-30T13:00:00Z",
        },
      };

      const result = mapL0SnapshotResponse(envelope);

      expect(result.status).toBe("AVAILABLE");
      expect(result.snapshotId).toBe("snap-456");
    });

    it("should handle envelope with NOT_AVAILABLE data (fail-closed)", () => {
      const envelope = {
        ok: false,
        status: "NOT_AVAILABLE",
        data: {
          status: "NOT_AVAILABLE",
          error: { code: "FT_SNAPSHOT_INVALID" },
        },
      };

      const result = mapL0SnapshotResponse(envelope);

      // CRITICAL: Must NOT show AVAILABLE
      expect(result.status).not.toBe("AVAILABLE");
    });
  });
});

