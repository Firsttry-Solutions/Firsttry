/**
 * TRACE DIAGNOSTICS UI MODULE
 * 
 * Provides structured display of resolver trace information in the UI.
 * Shows:
 * 1. Resolver name
 * 2. Execution steps with IDs
 * 3. Error codes and messages
 * 4. Storage state and verification status
 * 5. Build SHA and Forge request ID
 * 6. Execution timing
 */

/**
 * Display representation of a trace step
 */
export interface DisplayTraceStep {
  stepId: string;
  label: string;
  success: boolean;
  errorCode?: string | null;
  message: string;
}

/**
 * Complete trace display model
 */
export interface TraceDisplayModel {
  resolverName: string;
  uiReqId: string;
  traceId?: string | null;
  forgeRequestId?: string | null;
  steps: DisplayTraceStep[];
  failedStepId?: string | null;
  storageState?: {
    state: string;
    details: string;
  } | null;
  buildSha?: string | null;
  executionTimeMs?: number | null;
  errorCode?: string | null;
}

/**
 * Human-readable step labels
 */
const STEP_LABELS: Record<string, string> = {
  REQUEST_RECEIVED: 'Request Received',
  REQUEST_PARSED: 'Request Parsed',
  EXTRACT_UI_REQ_ID: 'Extract UI Request ID',
  VALIDATE_UI_REQ_ID: 'Validate UI Request ID',
  EXTRACT_TENANT_CONTEXT: 'Extract Tenant Context',
  VALIDATE_TENANT_CONTEXT: 'Validate Tenant Context',
  CHECK_STORAGE_AVAILABILITY: 'Check Storage Availability',
  STORAGE_READ_INITIATED: 'Storage Read Initiated',
  STORAGE_READ_COMPLETED: 'Storage Read Completed',
  STORAGE_WRITE_INITIATED: 'Storage Write Initiated',
  STORAGE_WRITE_COMPLETED: 'Storage Write Completed',
  STORAGE_DELETE_FAILED: 'Storage Delete Failed',
  STORAGE_VERIFICATION_INITIATED: 'Storage Verification Initiated',
  STORAGE_VERIFICATION_COMPLETED: 'Storage Verification Completed',
  JIRA_API_CALL_INITIATED: 'Jira API Call Initiated',
  JIRA_API_RESPONSE_RECEIVED: 'Jira API Response Received',
  DATA_PROCESSING_STARTED: 'Data Processing Started',
  DATA_NORMALIZATION_STARTED: 'Data Normalization Started',
  DATA_NORMALIZATION_COMPLETED: 'Data Normalization Completed',
  TRUTH_ENVELOPE_BUILDING: 'Truth Envelope Building',
  RESPONSE_SERIALIZATION: 'Response Serialization',
  ERROR_CLASSIFIED: 'Error Classified',
  ERROR_RESPONSE_BUILDING: 'Error Response Building',
};

/**
 * Build trace display model from error response details
 */
export function buildTraceDisplayModel(
  resolverName: string,
  uiReqId: string,
  traceId: string | null | undefined,
  forgeRequestId: string | null | undefined,
  errorCode: string,
  steps?: Array<{ stepId: string; success: boolean; errorCode?: string }>,
  storageState?: string | null,
  executionTimeMs?: number | null,
  buildSha?: string | null
): TraceDisplayModel {
  const displaySteps: DisplayTraceStep[] = (steps || []).map(step => ({
    stepId: step.stepId,
    label: STEP_LABELS[step.stepId] || step.stepId,
    success: step.success,
    errorCode: step.errorCode,
    message: step.success ? 'OK' : `Failed with ${step.errorCode}`,
  }));

  return {
    resolverName,
    uiReqId,
    traceId: traceId || undefined,
    forgeRequestId: forgeRequestId || undefined,
    steps: displaySteps,
    failedStepId: displaySteps.find(s => !s.success)?.stepId,
    storageState: storageState
      ? {
          state: storageState,
          details: getStorageStateDetails(storageState),
        }
      : null,
    buildSha,
    executionTimeMs,
    errorCode,
  };
}

/**
 * Get human-readable description of storage state
 */
function getStorageStateDetails(state: string): string {
  const details: Record<string, string> = {
    EXISTS: 'Data exists in storage',
    EMPTY: 'Storage is empty (no data found)',
    UNKNOWN: 'Unable to determine storage state',
    NOT_AVAILABLE: 'Storage is not available',
  };

  return details[state] || `Storage state: ${state}`;
}

/**
 * Format trace for display in error dialog/modal
 */
export function formatTraceForErrorDisplay(model: TraceDisplayModel): string {
  const lines: string[] = [
    '📊 Resolver Trace Diagnostics',
    '─'.repeat(40),
    `Resolver: ${model.resolverName}`,
    `UI Request ID: ${model.uiReqId}`,
  ];

  if (model.traceId) {
    lines.push(`Trace ID: ${model.traceId}`);
  }

  if (model.forgeRequestId) {
    lines.push(`Forge Request ID: ${model.forgeRequestId}`);
  }

  if (model.buildSha) {
    lines.push(`Build SHA: ${model.buildSha}`);
  }

  lines.push('');
  lines.push('Execution Steps:');

  model.steps.forEach((step, idx) => {
    const status = step.success ? '✓' : '✗';
    lines.push(
      `  ${status} [${idx + 1}/${model.steps.length}] ${step.label}`
    );

    if (!step.success && step.errorCode) {
      lines.push(`      Error: ${step.errorCode}`);
    }
  });

  if (model.storageState) {
    lines.push('');
    lines.push(`Storage State: ${model.storageState.state}`);
    lines.push(`  ${model.storageState.details}`);
  }

  if (model.executionTimeMs) {
    lines.push('');
    lines.push(`Execution Time: ${model.executionTimeMs}ms`);
  }

  return lines.join('\n');
}

/**
 * Compact trace summary for inline display (e.g., in error toast)
 */
export function formatTraceForToast(model: TraceDisplayModel): string {
  const failedStep = model.steps.find(s => !s.success);

  let summary = `${model.resolverName}: `;

  if (failedStep) {
    summary += `Failed at "${failedStep.label}"`;

    if (failedStep.errorCode) {
      summary += ` (${failedStep.errorCode})`;
    }
  } else {
    summary += 'Failed';
  }

  if (model.executionTimeMs) {
    summary += ` [${model.executionTimeMs}ms]`;
  }

  return summary;
}

/**
 * Create structured trace info block for diagnostics panel
 */
export interface TraceInfoBlock {
  label: string;
  value: string;
  highlighted?: boolean;
}

export function getTraceInfoBlocks(model: TraceDisplayModel): TraceInfoBlock[] {
  const blocks: TraceInfoBlock[] = [];

  blocks.push({
    label: 'Resolver',
    value: model.resolverName,
  });

  blocks.push({
    label: 'UI Request ID',
    value: model.uiReqId.substring(0, 16) + '...',
    highlighted: true,
  });

  if (model.traceId) {
    blocks.push({
      label: 'Trace ID',
      value: model.traceId.substring(0, 16) + '...',
    });
  }

  if (model.forgeRequestId) {
    blocks.push({
      label: 'Forge Request ID',
      value: model.forgeRequestId.substring(0, 16) + '...',
    });
  }

  blocks.push({
    label: 'Error Code',
    value: model.errorCode || 'UNKNOWN',
    highlighted: true,
  });

  blocks.push({
    label: 'Steps Executed',
    value: `${model.steps.length}${model.failedStepId ? ` (failed at step ${model.steps.findIndex(s => s.stepId === model.failedStepId) + 1})` : ''}`,
  });

  if (model.storageState) {
    blocks.push({
      label: 'Storage State',
      value: model.storageState.state,
      highlighted: model.storageState.state !== 'EXISTS',
    });
  }

  if (model.executionTimeMs) {
    blocks.push({
      label: 'Execution Time',
      value: `${model.executionTimeMs}ms`,
    });
  }

  if (model.buildSha) {
    blocks.push({
      label: 'Build SHA',
      value: model.buildSha.substring(0, 8),
    });
  }

  return blocks;
}
