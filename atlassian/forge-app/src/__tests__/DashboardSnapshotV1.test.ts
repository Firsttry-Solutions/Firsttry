/**
 * DashboardSnapshotV1 Contract Validation Tests
 *
 * Tests the contract schema, validation logic, and fail-closed patterns
 */

import {
  DashboardSnapshotV1,
  validateDashboardSnapshotV1,
  createFailStateContract,
  createInitializingStateContract,
} from '../src/shared/DashboardSnapshotV1';

describe('DashboardSnapshotV1 Contract', () => {
  describe('validateDashboardSnapshotV1', () => {
    // Helper: Create a valid contract
    function createValidContract(): DashboardSnapshotV1 {
      return {
        schemaVersion: 'v1',
        contractType: 'DashboardSnapshotV1',
        generatedAtUtc: new Date().toISOString(),
        state: 'OK',
        readOnly: {
          guaranteed: true,
          reason: 'Read-only test',
          scope: {
            canRead: true,
            canWrite: false,
            canExecuteJql: false,
            canCallApis: false,
          },
        },
        evidence: {
          schemaVersion: 'v1',
          capturedAtUtc: new Date().toISOString(),
          buildIdentifier: {
            gitSha: 'abc123def456abc123def456abc123def456abc1',
            gitShaShort: 'abc123d',
            buildTimeUtc: new Date().toISOString(),
            appVersion: '1.0.0',
          },
          uiBundleIdentity: {
            gitSha: 'xyz789uvw012xyz789uvw012xyz789uvw012xyz7',
            gitShaShort: 'xyz789u',
            buildTimeUtc: new Date().toISOString(),
          },
        },
        integrity: {
          type: 'SNAPSHOT_BASED',
          method: 'git HEAD at build time',
          frozenAt: new Date().toISOString(),
        },
        health: {
          status: 'OK',
          resolverLatencyMs: 150,
          backendAvailable: true,
          storageAvailable: true,
          uiConnected: true,
          errors: [],
          warnings: [],
        },
        actions: [],
        correlationId: 'test-correlation-123',
      };
    }

    it('should accept a valid contract', () => {
      const contract = createValidContract();
      const result = validateDashboardSnapshotV1(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid schemaVersion', () => {
      const contract = createValidContract();
      contract.schemaVersion = 'v2';
      const result = validateDashboardSnapshotV1(contract);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/schemaVersion/);
    });

    it('should reject invalid contractType', () => {
      const contract = createValidContract();
      contract.contractType = 'WrongType';
      const result = validateDashboardSnapshotV1(contract);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/contractType/);
    });

    it('should reject readOnly.guaranteed === false', () => {
      const contract = createValidContract();
      contract.readOnly.guaranteed = false;
      const result = validateDashboardSnapshotV1(contract);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/readOnly\.guaranteed/);
    });

    it('should reject missing generatedAtUtc', () => {
      const contract = createValidContract();
      (contract as any).generatedAtUtc = undefined;
      const result = validateDashboardSnapshotV1(contract);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/generatedAtUtc/);
    });

    it('should reject invalid state value', () => {
      const contract = createValidContract();
      (contract as any).state = 'INVALID_STATE';
      const result = validateDashboardSnapshotV1(contract);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/state/);
    });

    it('should validate all valid state values', () => {
      const validStates = ['OK', 'DEGRADED', 'FAIL', 'INITIALIZING'];
      for (const state of validStates) {
        const contract = createValidContract();
        (contract as any).state = state;
        const result = validateDashboardSnapshotV1(contract);
        expect(result.valid).toBe(true);
      }
    });

    it('should require evidence.schemaVersion', () => {
      const contract = createValidContract();
      (contract.evidence as any).schemaVersion = undefined;
      const result = validateDashboardSnapshotV1(contract);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/evidence\.schemaVersion/);
    });

    it('should require health.status', () => {
      const contract = createValidContract();
      (contract.health as any).status = undefined;
      const result = validateDashboardSnapshotV1(contract);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/health\.status/);
    });

    it('should require correlationId', () => {
      const contract = createValidContract();
      (contract as any).correlationId = undefined;
      const result = validateDashboardSnapshotV1(contract);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/correlationId/);
    });
  });

  describe('createFailStateContract', () => {
    it('should create a FAIL state contract', () => {
      const contract = createFailStateContract(
        'TEST_ERROR',
        'Test error message',
        'corr-123'
      );

      expect(contract.schemaVersion).toBe('v1');
      expect(contract.contractType).toBe('DashboardSnapshotV1');
      expect(contract.state).toBe('FAIL');
      expect(contract.readOnly.guaranteed).toBe(true);
      expect(contract.correlationId).toBe('corr-123');
    });

    it('fail state should pass validation', () => {
      const contract = createFailStateContract(
        'TEST_ERROR',
        'Test message',
        'corr-abc'
      );
      const result = validateDashboardSnapshotV1(contract);
      expect(result.valid).toBe(true);
    });

    it('fail state should have health.status = FAIL', () => {
      const contract = createFailStateContract(
        'TEST_ERROR',
        'Test',
        'corr-xyz'
      );
      expect(contract.health.status).toBe('FAIL');
      expect(contract.health.errors).toHaveLength(1);
      expect(contract.health.errors[0].code).toBe('TEST_ERROR');
      expect(contract.health.errors[0].message).toBe('Test');
    });

    it('fail state should have backendAvailable = false', () => {
      const contract = createFailStateContract(
        'ERROR_CODE',
        'msg',
        'id'
      );
      expect(contract.health.backendAvailable).toBe(false);
      expect(contract.health.storageAvailable).toBe(false);
    });
  });

  describe('createInitializingStateContract', () => {
    it('should create an INITIALIZING state contract', () => {
      const contract = createInitializingStateContract('init-123');

      expect(contract.schemaVersion).toBe('v1');
      expect(contract.contractType).toBe('DashboardSnapshotV1');
      expect(contract.state).toBe('INITIALIZING');
      expect(contract.readOnly.guaranteed).toBe(true);
      expect(contract.correlationId).toBe('init-123');
    });

    it('initializing state should pass validation', () => {
      const contract = createInitializingStateContract('id-abc');
      const result = validateDashboardSnapshotV1(contract);
      expect(result.valid).toBe(true);
    });

    it('initializing state should have health.status = INITIALIZING', () => {
      const contract = createInitializingStateContract('id-xyz');
      expect(contract.health.status).toBe('INITIALIZING');
      expect(contract.health.warnings).toHaveLength(1);
      expect(contract.health.warnings[0].code).toBe('SNAPSHOT_LOADING');
    });

    it('initializing state should have uiConnected = true', () => {
      const contract = createInitializingStateContract('id-123');
      expect(contract.health.uiConnected).toBe(true);
      expect(contract.health.backendAvailable).toBe(false);
    });
  });

  describe('Contract Properties', () => {
    it('readOnly scope must be consistent', () => {
      const contract = createFailStateContract('err', 'msg', 'id');
      expect(contract.readOnly.scope.canRead).toBe(true);
      expect(contract.readOnly.scope.canWrite).toBe(false);
      expect(contract.readOnly.scope.canExecuteJql).toBe(false);
      expect(contract.readOnly.scope.canCallApis).toBe(false);
    });

    it('all contracts must have generatedAtUtc as valid ISO-8601', () => {
      const contract = createFailStateContract('err', 'msg', 'id');
      const timestamp = new Date(contract.generatedAtUtc);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });

    it('correlationId should be non-empty string', () => {
      const contract = createFailStateContract('err', 'msg', 'my-corr-id');
      expect(typeof contract.correlationId).toBe('string');
      expect(contract.correlationId.length).toBeGreaterThan(0);
    });

    it('evidence.buildIdentifier should have full 40-char git SHA', () => {
      const contract = createFailStateContract('err', 'msg', 'id');
      // UNKNOWN is allowed for fail state
      if (contract.evidence.buildIdentifier.gitSha !== 'UNKNOWN') {
        expect(
          contract.evidence.buildIdentifier.gitSha.length
        ).toBeGreaterThanOrEqual(40);
      }
    });
  });

  describe('Multiple Errors/Warnings', () => {
    it('health.errors should be an array', () => {
      const contract = createFailStateContract('err', 'msg', 'id');
      expect(Array.isArray(contract.health.errors)).toBe(true);
    });

    it('health.warnings should be an array', () => {
      const contract = createInitializingStateContract('id');
      expect(Array.isArray(contract.health.warnings)).toBe(true);
    });

    it('error items should have code, message, timestamp', () => {
      const contract = createFailStateContract('TEST_CODE', 'test msg', 'id');
      const error = contract.health.errors[0];
      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('test msg');
      expect(typeof error.timestamp).toBe('string');
    });

    it('warning items should have code and message', () => {
      const contract = createInitializingStateContract('id');
      const warning = contract.health.warnings[0];
      expect(typeof warning.code).toBe('string');
      expect(typeof warning.message).toBe('string');
    });
  });

  describe('Actions Array', () => {
    it('actions should be an array', () => {
      const contract = createFailStateContract('err', 'msg', 'id');
      expect(Array.isArray(contract.actions)).toBe(true);
    });

    it('action items should have required fields', () => {
      const contract = createFailStateContract('err', 'msg', 'id');
      if (contract.actions.length > 0) {
        const action = contract.actions[0];
        expect(typeof action.id).toBe('string');
        expect(typeof action.label).toBe('string');
        expect(typeof action.description).toBe('string');
        expect(['INTERNAL', 'EXTERNAL']).toContain(action.action);
      }
    });
  });
});
