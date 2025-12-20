/**
 * PHASE 6 v2: SNAPSHOT CAPTURE
 * 
 * Core logic to capture Jira state for daily/weekly snapshots.
 * 
 * Daily snapshot includes:
 * - Project inventory (IDs + names)
 * - Field metadata (IDs + basic info)
 * - Workflow inventory (names/IDs)
 * - Automation inventory (IDs + names only)
 * 
 * Weekly snapshot includes daily PLUS:
 * - Workflow structures (full definitions)
 * - Field requirements
 * - Automation definitions
 */

import { api } from '@forge/api';
import {
  Snapshot,
  SnapshotRun,
  MissingDataItem,
  InputProvenance,
} from './snapshot_model';
import {
  SnapshotType,
  ErrorCode,
  CoverageStatus,
  MissingDataReasonCode,
  TIMEOUT_LIMITS,
  API_CALL_TIMEOUT,
  DAILY_SNAPSHOT_DATASETS,
  WEEKLY_SNAPSHOT_DATASETS,
} from './constants';
import {
  computeCanonicalHash,
} from './canonicalization';

/**
 * Snapshot capturer
 * Queries Jira API and builds snapshot payloads
 */
export class SnapshotCapturer {
  private apiCallsMade: number = 0;
  private rateLimitHits: number = 0;
  private missingData: MissingDataItem[] = [];

  constructor(
    private tenantId: string,
    private cloudId: string,
    private snapshotType: SnapshotType,
  ) {}

  /**
   * Capture a snapshot
   * Returns SnapshotRun + Snapshot if successful
   */
  async capture(): Promise<{
    run: SnapshotRun;
    snapshot?: Snapshot;
  }> {
    const runId = this.generateUUID();
    const snapshotId = this.generateUUID();
    const startTime = Date.now();
    const scheduledFor = new Date().toISOString();

    try {
      const payload = await this.buildPayload();
      const endTime = Date.now();
      const durationMs = endTime - startTime;

      // Compute hash
      const canonicalHash = computeCanonicalHash(payload);

      // Create snapshot
      const snapshot: Snapshot = {
        tenant_id: this.tenantId,
        cloud_id: this.cloudId,
        snapshot_id: snapshotId,
        captured_at: new Date().toISOString(),
        snapshot_type: this.snapshotType,
        schema_version: '1.0.0',
        canonical_hash: canonicalHash,
        hash_algorithm: 'sha256',
        clock_source: 'system',
        scope: {
          projects_included: ['ALL'],
          projects_excluded: [],
        },
        input_provenance: {
          endpoints_queried: this.getEndpointsQueried(),
          available_scopes: this.getAvailableScopes(),
          filters_applied: [],
        },
        missing_data: this.missingData,
        payload,
      };

      // Create run record
      const run: SnapshotRun = {
        tenant_id: this.tenantId,
        cloud_id: this.cloudId,
        run_id: runId,
        scheduled_for: scheduledFor,
        snapshot_type: this.snapshotType,
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date(endTime).toISOString(),
        status: this.missingData.length > 0 ? 'partial' : 'success',
        error_code: ErrorCode.NONE,
        api_calls_made: this.apiCallsMade,
        rate_limit_hits_count: this.rateLimitHits,
        duration_ms: durationMs,
        produced_snapshot_id: snapshotId,
        schema_version: '1.0.0',
        produced_canonical_hash: canonicalHash,
        hash_algorithm: 'sha256',
        clock_source: 'system',
      };

      return { run, snapshot };
    } catch (error: any) {
      const endTime = Date.now();
      const durationMs = endTime - startTime;

      const run: SnapshotRun = {
        tenant_id: this.tenantId,
        cloud_id: this.cloudId,
        run_id: runId,
        scheduled_for: scheduledFor,
        snapshot_type: this.snapshotType,
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date(endTime).toISOString(),
        status: 'failed',
        error_code: this.categorizeError(error),
        error_detail: error.message,
        api_calls_made: this.apiCallsMade,
        rate_limit_hits_count: this.rateLimitHits,
        duration_ms: durationMs,
        schema_version: '1.0.0',
        hash_algorithm: 'sha256',
        clock_source: 'system',
      };

      return { run };
    }
  }

  /**
   * Build snapshot payload
   */
  private async buildPayload(): Promise<Record<string, any>> {
    const payload: Record<string, any> = {};
    const datasets = this.snapshotType === 'daily' ? DAILY_SNAPSHOT_DATASETS : WEEKLY_SNAPSHOT_DATASETS;

    for (const dataset of datasets) {
      try {
        payload[dataset] = await this.captureDataset(dataset);
      } catch (error: any) {
        this.recordMissingData(dataset, error);
      }
    }

    return payload;
  }

  /**
   * Capture a single dataset
   */
  private async captureDataset(datasetName: string): Promise<any> {
    switch (datasetName) {
      case 'project_inventory':
        return this.captureProjects();
      case 'field_metadata':
        return this.captureFields();
      case 'workflow_inventory':
        return this.captureWorkflowInventory();
      case 'workflow_structures':
        return this.captureWorkflowStructures();
      case 'automation_inventory':
        return this.captureAutomationInventory();
      case 'automation_definitions':
        return this.captureAutomationDefinitions();
      case 'field_requirements':
        return this.captureFieldRequirements();
      default:
        throw new Error(`Unknown dataset: ${datasetName}`);
    }
  }

  /**
   * Capture project inventory
   * GET /rest/api/3/projects
   */
  private async captureProjects(): Promise<any> {
    const response = await this.callJiraAPI('/rest/api/3/projects');
    this.apiCallsMade++;
    return response?.values || [];
  }

  /**
   * Capture field metadata
   * GET /rest/api/3/fields
   */
  private async captureFields(): Promise<any> {
    const response = await this.callJiraAPI('/rest/api/3/fields');
    this.apiCallsMade++;
    return response || [];
  }

  /**
   * Capture workflow inventory (names/IDs only)
   * GET /rest/api/3/workflows
   */
  private async captureWorkflowInventory(): Promise<any> {
    const response = await this.callJiraAPI('/rest/api/3/workflows?expand=transitions');
    this.apiCallsMade++;
    return response?.workflows?.map((w: any) => ({
      id: w.id,
      name: w.name,
    })) || [];
  }

  /**
   * Capture workflow structures (full definitions)
   * GET /rest/api/3/workflows
   */
  private async captureWorkflowStructures(): Promise<any> {
    const response = await this.callJiraAPI('/rest/api/3/workflows?expand=transitions');
    this.apiCallsMade++;
    return response?.workflows || [];
  }

  /**
   * Capture automation inventory (IDs + names only)
   * GET /rest/api/3/automation/rules
   */
  private async captureAutomationInventory(): Promise<any> {
    const response = await this.callJiraAPI('/rest/api/3/automation/rules');
    this.apiCallsMade++;
    return response?.rules?.map((r: any) => ({
      id: r.id,
      name: r.name,
    })) || [];
  }

  /**
   * Capture automation definitions (full)
   * GET /rest/api/3/automation/rules
   */
  private async captureAutomationDefinitions(): Promise<any> {
    const response = await this.callJiraAPI('/rest/api/3/automation/rules');
    this.apiCallsMade++;
    return response?.rules || [];
  }

  /**
   * Capture field requirements
   * GET /rest/api/3/fields with detailed metadata
   */
  private async captureFieldRequirements(): Promise<any> {
    const response = await this.callJiraAPI('/rest/api/3/fields');
    this.apiCallsMade++;
    return response?.map((f: any) => ({
      id: f.id,
      name: f.name,
      required: f.required || false,
    })) || [];
  }

  /**
   * Call Jira API with timeout and error handling
   */
  private async callJiraAPI(endpoint: string): Promise<any> {
    try {
      const response = await api.asUser().requestJira(endpoint, {
        timeout: API_CALL_TIMEOUT,
      });
      
      if (response.status === 429) {
        this.rateLimitHits++;
        throw new Error('Rate limited');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Record missing data item
   */
  private recordMissingData(datasetName: string, error: any): void {
    const item: MissingDataItem = {
      dataset_name: datasetName,
      coverage_status: CoverageStatus.MISSING,
      reason_code: this.categorizeDatasetError(error),
      reason_detail: error.message,
      retry_count: 0,
    };
    this.missingData.push(item);
  }

  /**
   * Categorize error for error_code field
   */
  private categorizeError(error: any): ErrorCode {
    const msg = error.message || '';
    if (msg.includes('Rate limited') || msg.includes('429')) {
      return ErrorCode.RATE_LIMIT;
    }
    if (msg.includes('permission') || msg.includes('401') || msg.includes('403')) {
      return ErrorCode.PERMISSION_REVOKED;
    }
    if (msg.includes('timeout')) {
      return ErrorCode.TIMEOUT;
    }
    return ErrorCode.API_ERROR;
  }

  /**
   * Categorize error for missing_data reason_code
   */
  private categorizeDatasetError(error: any): MissingDataReasonCode {
    const msg = error.message || '';
    if (msg.includes('Rate limited')) {
      return MissingDataReasonCode.RATE_LIMITED;
    }
    if (msg.includes('permission') || msg.includes('401') || msg.includes('403')) {
      return MissingDataReasonCode.PERMISSION_DENIED;
    }
    return MissingDataReasonCode.API_UNAVAILABLE;
  }

  /**
   * Helper: get endpoints queried
   */
  private getEndpointsQueried(): string[] {
    const endpoints = [];
    if (this.snapshotType === 'daily' || this.snapshotType === 'weekly') {
      endpoints.push('/rest/api/3/projects');
      endpoints.push('/rest/api/3/fields');
      endpoints.push('/rest/api/3/workflows');
      endpoints.push('/rest/api/3/automation/rules');
    }
    if (this.snapshotType === 'weekly') {
      endpoints.push('/rest/api/3/workflows?expand=transitions');
    }
    return endpoints;
  }

  /**
   * Helper: get available scopes
   */
  private getAvailableScopes(): string[] {
    return ['read:jira-work', 'read:jira-user'];
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
