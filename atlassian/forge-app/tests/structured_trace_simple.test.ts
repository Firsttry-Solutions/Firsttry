import { describe, it, expect, beforeEach } from 'vitest';
import {
  createStructuredTrace,
  addTraceStep,
  setStorageProof,
  createStorageProof,
  traceToErrorDetails,
  formatTraceForLogging,
  ERROR_CODES,
  STEP_IDS,
  STORAGE_STATES,
} from '../src/ops/structured_trace';

describe('Structured Trace System', () => {
  let trace: any;

  beforeEach(() => {
    trace = createStructuredTrace('ping', 'req-123-abc', 'trace-456-def', 'forge-req-789');
  });

  // ============================================================================
  // Core Initialization
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize trace with all required fields', () => {
      expect(trace.resolverName).toBe('ping');
      expect(trace.uiReqId).toBe('req-123-abc');
      expect(trace.traceId).toBe('trace-456-def');
      expect(trace.forgeRequestId).toBe('forge-req-789');
      expect(trace.steps).toEqual([]);
      expect(trace.finalErrorCode).toBeUndefined();
      expect(trace.storageState).toBeUndefined();
    });

    it('should support optional forgeRequestId', () => {
      const traceNoForge = createStructuredTrace('probe', 'req-456', 'trace-789');
      expect(traceNoForge.forgeRequestId).toBeUndefined();
    });
  });

  // ============================================================================
  // Step Recording
  // ============================================================================

  describe('Step Recording', () => {
    it('should add successful step to trace', () => {
      addTraceStep(trace, STEP_IDS.REQUEST_RECEIVED, true, 'Request received');

      expect(trace.steps).toHaveLength(1);
      const step = trace.steps[0];
      expect(step.stepId).toBe(STEP_IDS.REQUEST_RECEIVED);
      expect(step.success).toBe(true);
      expect(step.message).toBe('Request received');
    });

    it('should add failed step with error code', () => {
      addTraceStep(
        trace,
        STEP_IDS.VALIDATE_UI_REQ_ID,
        false,
        'Invalid UI request ID',
        ERROR_CODES.MISSING_UI_REQ_ID
      );

      const step = trace.steps[0];
      expect(step.success).toBe(false);
      expect(step.errorCode).toBe(ERROR_CODES.MISSING_UI_REQ_ID);
    });

    it('should set finalErrorCode on first failure', () => {
      addTraceStep(
        trace,
        STEP_IDS.STORAGE_READ_INITIATED,
        false,
        'Storage unavailable',
        ERROR_CODES.STORAGE_UNAVAILABLE
      );

      expect(trace.finalErrorCode).toBe(ERROR_CODES.STORAGE_UNAVAILABLE);
    });

    it('should include timestamps in steps', () => {
      const before = Date.now();
      addTraceStep(trace, STEP_IDS.REQUEST_RECEIVED, true, 'Request received');
      const after = Date.now();

      const step = trace.steps[0];
      const stepTime = new Date(step.startedAt).getTime();

      expect(stepTime >= before).toBe(true);
      expect(stepTime <= after).toBe(true);
    });

    it('should support metadata in steps', () => {
      addTraceStep(
        trace,
        STEP_IDS.STORAGE_READ_COMPLETED,
        true,
        'Storage read successful',
        undefined,
        { bytesRead: 256, duration: 42 }
      );

      const step = trace.steps[0];
      expect(step.metadata).toEqual({ bytesRead: 256, duration: 42 });
    });

    it('should maintain step order', () => {
      addTraceStep(trace, STEP_IDS.REQUEST_RECEIVED, true, 'Step 1');
      addTraceStep(trace, STEP_IDS.REQUEST_PARSED, true, 'Step 2');
      addTraceStep(trace, STEP_IDS.EXTRACT_UI_REQ_ID, true, 'Step 3');

      expect(trace.steps).toHaveLength(3);
      expect(trace.steps[0].stepId).toBe(STEP_IDS.REQUEST_RECEIVED);
      expect(trace.steps[1].stepId).toBe(STEP_IDS.REQUEST_PARSED);
      expect(trace.steps[2].stepId).toBe(STEP_IDS.EXTRACT_UI_REQ_ID);
    });
  });

  // ============================================================================
  // Storage Proof
  // ============================================================================

  describe('Storage Proof', () => {
    it('should create proof for existing storage state', () => {
      const proof = createStorageProof(
        STORAGE_STATES.EXISTS,
        'probe:user123:snapshot',
        true,
        'verified write-then-read'
      );

      expect(proof.state).toBe(STORAGE_STATES.EXISTS);
      expect(proof.keyAccessed).toBe('probe:user123:snapshot');
      expect(proof.verificationPassed).toBe(true);
      expect(proof.proofDetails).toBe('verified write-then-read');
    });

    it('should include timestamp in proof', () => {
      const before = Date.now();
      const proof = createStorageProof(STORAGE_STATES.EXISTS);
      const after = Date.now();

      const proofTime = new Date(proof.checkedAt).getTime();

      expect(proofTime >= before).toBe(true);
      expect(proofTime <= after).toBe(true);
    });

    it('should set storage proof on trace', () => {
      const proof = createStorageProof(STORAGE_STATES.EXISTS, 'key123', true);
      setStorageProof(trace, proof);

      expect(trace.storageState).toEqual(proof);
      expect(trace.storageState.state).toBe(STORAGE_STATES.EXISTS);
    });
  });

  // ============================================================================
  // Error Code Coverage
  // ============================================================================

  describe('Error Codes', () => {
    it('should define correlation error codes', () => {
      expect(ERROR_CODES.MISSING_UI_REQ_ID).toBeDefined();
      expect(ERROR_CODES.INVALID_UI_REQ_ID_FORMAT).toBeDefined();
      expect(ERROR_CODES.REQUEST_BODY_PARSING_FAILED).toBeDefined();
    });

    it('should define tenant error codes', () => {
      expect(ERROR_CODES.MISSING_TENANT_CONTEXT).toBeDefined();
      expect(ERROR_CODES.TENANT_CONTEXT_EXTRACTION_FAILED).toBeDefined();
      expect(ERROR_CODES.UNAUTHORIZED_TENANT).toBeDefined();
    });

    it('should define storage error codes', () => {
      expect(ERROR_CODES.STORAGE_UNAVAILABLE).toBeDefined();
      expect(ERROR_CODES.STORAGE_READ_FAILED).toBeDefined();
      expect(ERROR_CODES.STORAGE_WRITE_FAILED).toBeDefined();
      expect(ERROR_CODES.STORAGE_VERIFICATION_FAILED).toBeDefined();
    });

    it('should define external API error codes', () => {
      expect(ERROR_CODES.FORGE_INVOKE_FAILED).toBeDefined();
      expect(ERROR_CODES.JIRA_API_ERROR).toBeDefined();
    });

    it('should define internal error codes', () => {
      expect(ERROR_CODES.INTERNAL_ERROR).toBeDefined();
      expect(ERROR_CODES.INVARIANT_VIOLATED).toBeDefined();
      expect(ERROR_CODES.TIMEOUT).toBeDefined();
    });

    it('should have unique error code values', () => {
      const codes = Object.values(ERROR_CODES);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  // ============================================================================
  // Step ID Coverage
  // ============================================================================

  describe('Step IDs', () => {
    it('should define all request lifecycle step IDs', () => {
      expect(STEP_IDS.REQUEST_RECEIVED).toBeDefined();
      expect(STEP_IDS.REQUEST_PARSED).toBeDefined();
    });

    it('should define validation step IDs', () => {
      expect(STEP_IDS.EXTRACT_UI_REQ_ID).toBeDefined();
      expect(STEP_IDS.VALIDATE_UI_REQ_ID).toBeDefined();
      expect(STEP_IDS.EXTRACT_TENANT_CONTEXT).toBeDefined();
      expect(STEP_IDS.VALIDATE_TENANT_CONTEXT).toBeDefined();
    });

    it('should define storage operation step IDs', () => {
      expect(STEP_IDS.CHECK_STORAGE_AVAILABILITY).toBeDefined();
      expect(STEP_IDS.STORAGE_READ_INITIATED).toBeDefined();
      expect(STEP_IDS.STORAGE_READ_COMPLETED).toBeDefined();
    });

    it('should define verification step IDs', () => {
      expect(STEP_IDS.STORAGE_VERIFICATION_INITIATED).toBeDefined();
      expect(STEP_IDS.STORAGE_VERIFICATION_COMPLETED).toBeDefined();
    });

    it('should define data processing step IDs', () => {
      expect(STEP_IDS.DATA_PROCESSING_STARTED).toBeDefined();
      expect(STEP_IDS.DATA_NORMALIZATION_STARTED).toBeDefined();
      expect(STEP_IDS.DATA_NORMALIZATION_COMPLETED).toBeDefined();
    });

    it('should define response building step IDs', () => {
      expect(STEP_IDS.TRUTH_ENVELOPE_BUILDING).toBeDefined();
      expect(STEP_IDS.RESPONSE_SERIALIZATION).toBeDefined();
    });

    it('should have unique step ID values', () => {
      const steps = Object.values(STEP_IDS);
      const uniqueSteps = new Set(steps);
      expect(uniqueSteps.size).toBe(steps.length);
    });
  });

  // ============================================================================
  // Conversion/Formatting
  // ============================================================================

  describe('Trace Conversion', () => {
    it('should extract error details from trace', () => {
      addTraceStep(trace, STEP_IDS.REQUEST_RECEIVED, true, 'Start');
      addTraceStep(
        trace,
        STEP_IDS.VALIDATE_UI_REQ_ID,
        false,
        'Failed validation',
        ERROR_CODES.MISSING_UI_REQ_ID
      );

      trace.buildSha = 'abc123def';
      trace.executionTimeMs = 45;

      const details = traceToErrorDetails(trace);

      expect(details.resolverName).toBe('ping');
      expect(details.stepCount).toBe(2);
      expect(details.executionTimeMs).toBe(45);
    });

    it('should format trace for logging', () => {
      addTraceStep(trace, STEP_IDS.REQUEST_RECEIVED, true, 'Start');
      trace.executionTimeMs = 123;

      const formatted = formatTraceForLogging(trace);

      expect(typeof formatted).toBe('string');
      expect(() => JSON.parse(formatted)).not.toThrow();

      const parsed = JSON.parse(formatted);
      expect(parsed.resolverName).toBe('ping');
      expect(parsed.stepCount).toBe(1);
    });
  });

  // ============================================================================
  // Complex Flows
  // ============================================================================

  describe('Complete Execution Flows', () => {
    it('should track successful request flow', () => {
      addTraceStep(trace, STEP_IDS.REQUEST_RECEIVED, true, 'Received');
      addTraceStep(trace, STEP_IDS.REQUEST_PARSED, true, 'Parsed');
      addTraceStep(trace, STEP_IDS.VALIDATE_UI_REQ_ID, true, 'Validated');
      addTraceStep(trace, STEP_IDS.STORAGE_READ_INITIATED, true, 'Read initiated');
      addTraceStep(trace, STEP_IDS.STORAGE_READ_COMPLETED, true, 'Read completed');
      addTraceStep(trace, STEP_IDS.TRUTH_ENVELOPE_BUILDING, true, 'Envelope built');

      trace.executionTimeMs = 150;
      trace.buildSha = 'test-sha-123';

      expect(trace.steps).toHaveLength(6);
      expect(trace.finalErrorCode).toBeUndefined();
      expect(trace.executionTimeMs).toBeGreaterThan(0);
    });

    it('should track failed request flow', () => {
      addTraceStep(trace, STEP_IDS.REQUEST_RECEIVED, true, 'Received');
      addTraceStep(trace, STEP_IDS.REQUEST_PARSED, true, 'Parsed');
      addTraceStep(
        trace,
        STEP_IDS.STORAGE_READ_INITIATED,
        false,
        'Storage unavailable',
        ERROR_CODES.STORAGE_UNAVAILABLE
      );
      addTraceStep(trace, STEP_IDS.TRUTH_ENVELOPE_BUILDING, true, 'Error envelope built');

      expect(trace.steps).toHaveLength(4);
      expect(trace.finalErrorCode).toBe(ERROR_CODES.STORAGE_UNAVAILABLE);
    });

    it('should track probe verification flow', () => {
      const probe = createStructuredTrace('probe', 'req-456', 'trace-789');

      addTraceStep(probe, STEP_IDS.REQUEST_RECEIVED, true, 'Start');
      addTraceStep(probe, STEP_IDS.STORAGE_READ_COMPLETED, true, 'Read');
      addTraceStep(
        probe,
        STEP_IDS.STORAGE_VERIFICATION_INITIATED,
        true,
        'Verification started'
      );
      addTraceStep(
        probe,
        STEP_IDS.STORAGE_VERIFICATION_COMPLETED,
        true,
        'Verification completed'
      );

      const proof = createStorageProof(
        STORAGE_STATES.EXISTS,
        'probe:user:data',
        true,
        'write-verify-read successful'
      );
      setStorageProof(probe, proof);

      expect(probe.steps).toHaveLength(4);
      expect(probe.storageState.verificationPassed).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty step message', () => {
      addTraceStep(trace, STEP_IDS.REQUEST_RECEIVED, true, '');
      expect(trace.steps[0].message).toBe('');
    });

    it('should handle large number of steps', () => {
      for (let i = 0; i < 50; i++) {
        addTraceStep(trace, STEP_IDS.DATA_PROCESSING_STARTED, true, `Step ${i}`);
      }

      expect(trace.steps).toHaveLength(50);
    });

    it('should handle very long execution times', () => {
      trace.executionTimeMs = 999999;
      expect(trace.executionTimeMs).toBe(999999);
    });

    it('should allow safe serialization', () => {
      addTraceStep(trace, STEP_IDS.REQUEST_RECEIVED, true, 'Start');

      const serialized = JSON.stringify(trace);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.resolverName).toBe(trace.resolverName);
      expect(deserialized.steps).toHaveLength(trace.steps.length);
    });
  });
});
