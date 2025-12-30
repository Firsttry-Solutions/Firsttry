/**
 * PHASE 7 v2: DRIFT DETECTION COMPUTATION ENGINE
 * 
 * Computes observed changes (drift) between consecutive Phase-6 snapshots.
 * 
 * Principles:
 * - No Jira API calls (uses stored snapshots only)
 * - Deterministic: same inputs → identical drift list
 * - Never guesses actor/source (defaults to unknown)
 * - Stable ordering (deterministic sort)
 * - Tenant-isolated (all operations scoped to tenant_id)
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import {
  DriftEvent,
  ChangeType,
  Classification,
  ObjectType,
  TimeWindow,
  CanonicalField,
  CanonicalWorkflow,
  CanonicalAutomationRule,
  CanonicalProject,
  DriftComputeResult,
  ChangePatch,
} from './drift_model';

/**
 * Main drift computation function
 * 
 * @param tenantId - Tenant ID for isolation
 * @param cloudId - Jira Cloud ID
 * @param snapshotA - Older snapshot
 * @param snapshotB - Newer snapshot
 * @returns DriftComputeResult with drift events
 * 
 * NOTE: This function DOES NOT call Jira APIs. All data comes from stored snapshots.
 */
export function computeDrift(
  tenantId: string,
  cloudId: string,
  snapshotA: any,
  snapshotB: any
): DriftComputeResult {
  try {
    // Validate inputs
    if (!snapshotA || !snapshotB) {
      return {
        events: [],
        error: { code: 'INVALID_SNAPSHOT', message: 'Both snapshots required' },
      };
    }

    // Return early if snapshots are identical
    if (snapshotA.canonical_hash === snapshotB.canonical_hash) {
      return { events: [] };
    }

    const events: DriftEvent[] = [];

    // Extract canonical subsets from each snapshot
    const fieldsA = extractFields(snapshotA.payload);
    const fieldsB = extractFields(snapshotB.payload);

    const workflowsA = extractWorkflows(snapshotA.payload);
    const workflowsB = extractWorkflows(snapshotB.payload);

    const automationA = extractAutomationRules(snapshotA.payload);
    const automationB = extractAutomationRules(snapshotB.payload);

    const projectsA = extractProjects(snapshotA.payload);
    const projectsB = extractProjects(snapshotB.payload);

    // Compute field diffs
    events.push(
      ...computeObjectDiffs(
        tenantId,
        cloudId,
        snapshotA,
        snapshotB,
        ObjectType.FIELD,
        fieldsA,
        fieldsB
      )
    );

    // Compute workflow diffs
    events.push(
      ...computeObjectDiffs(
        tenantId,
        cloudId,
        snapshotA,
        snapshotB,
        ObjectType.WORKFLOW,
        workflowsA,
        workflowsB
      )
    );

    // Compute automation rule diffs
    events.push(
      ...computeObjectDiffs(
        tenantId,
        cloudId,
        snapshotA,
        snapshotB,
        ObjectType.AUTOMATION_RULE,
        automationA,
        automationB
      )
    );

    // Compute project diffs
    events.push(
      ...computeObjectDiffs(
        tenantId,
        cloudId,
        snapshotA,
        snapshotB,
        ObjectType.PROJECT,
        projectsA,
        projectsB
      )
    );

    // Check for scope changes (via missing_data differences)
    events.push(...detectScopeChanges(tenantId, cloudId, snapshotA, snapshotB));

    // Sort deterministically
    const sortedEvents = stableSortDriftEvents(events);

    // Hash each event for integrity
    const hashedEvents = sortedEvents.map((event) =>
      hashDriftEvent(event)
    );

    return { events: hashedEvents };
  } catch (error: any) {
    return {
      events: [],
      error: { code: 'COMPUTE_ERROR', message: error.message },
    };
  }
}

/**
 * Extract fields from payload as canonical map
 */
function extractFields(payload: any): Map<string, CanonicalField> {
  const fieldsData = payload.fields || [];
  const map = new Map<string, CanonicalField>();

  if (!Array.isArray(fieldsData)) {
    return map;
  }

  fieldsData.forEach((field: any) => {
    if (field.id) {
      const canonical: CanonicalField = {
        id: field.id,
        name: field.name || 'unknown',
        type: field.type || 'unknown',
        custom: field.custom === true,
        searchable: field.searchable === true,
      };
      map.set(field.id, canonical);
    }
  });

  return map;
}

/**
 * Extract workflows from payload as canonical map
 * Key: workflow name (stable identifier in Jira)
 */
function extractWorkflows(payload: any): Map<string, CanonicalWorkflow> {
  const workflowsData = payload.workflows || [];
  const map = new Map<string, CanonicalWorkflow>();

  if (!Array.isArray(workflowsData)) {
    return map;
  }

  workflowsData.forEach((workflow: any) => {
    if (workflow.name) {
      const key = workflow.name; // Workflow name is stable
      const canonical: CanonicalWorkflow = {
        name: workflow.name,
        scope: workflow.scope || 'unknown',
        is_default: workflow.is_default === true,
        status_count: (workflow.statuses || []).length,
      };
      map.set(key, canonical);
    }
  });

  return map;
}

/**
 * Extract automation rules from payload as canonical map
 */
function extractAutomationRules(payload: any): Map<string, CanonicalAutomationRule> {
  const automationData = payload.automation || [];
  const map = new Map<string, CanonicalAutomationRule>();

  if (!Array.isArray(automationData)) {
    return map;
  }

  automationData.forEach((rule: any) => {
    if (rule.id) {
      const canonical: CanonicalAutomationRule = {
        id: rule.id,
        name: rule.name || 'unknown',
        enabled: rule.enabled === true,
        trigger_type: rule.trigger_type || 'unknown',
      };
      map.set(rule.id, canonical);
    }
  });

  return map;
}

/**
 * Extract projects from payload as canonical map
 */
function extractProjects(payload: any): Map<string, CanonicalProject> {
  const projectsData = payload.projects || [];
  const map = new Map<string, CanonicalProject>();

  if (!Array.isArray(projectsData)) {
    return map;
  }

  projectsData.forEach((project: any) => {
    if (project.key) {
      const canonical: CanonicalProject = {
        key: project.key,
        name: project.name || 'unknown',
        type: project.type || 'unknown',
      };
      map.set(project.key, canonical);
    }
  });

  return map;
}

/**
 * Compute diffs for a single object type
 */
function computeObjectDiffs(
  tenantId: string,
  cloudId: string,
  snapshotA: any,
  snapshotB: any,
  objectType: ObjectType,
  mapA: Map<string, any>,
  mapB: Map<string, any>
): DriftEvent[] {
  const events: DriftEvent[] = [];
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

  allKeys.forEach((key) => {
    const stateA = mapA.get(key) || null;
    const stateB = mapB.get(key) || null;

    let changeType: ChangeType;
    let beforeState = stateA;
    let afterState = stateB;

    if (!stateA && stateB) {
      changeType = ChangeType.ADDED;
    } else if (stateA && !stateB) {
      changeType = ChangeType.REMOVED;
    } else if (stateA && stateB && JSON.stringify(stateA) !== JSON.stringify(stateB)) {
      changeType = ChangeType.MODIFIED;
    } else {
      // Identical, no drift
      return;
    }

    // Determine classification
    const classification = classifyChange(objectType, changeType);

    // Generate patch if modified
    const changePatch = changeType === ChangeType.MODIFIED
      ? generateChangePatch(stateA, stateB)
      : undefined;

    // Compute completeness
    const completeness = computeCompleteness(
      changeType,
      beforeState !== null,
      afterState !== null,
      snapshotA.missing_data,
      snapshotB.missing_data
    );

    // Create drift event
    const event: DriftEvent = {
      tenant_id: tenantId,
      cloud_id: cloudId,
      drift_event_id: uuidv4(),
      from_snapshot_id: snapshotA.snapshot_id,
      to_snapshot_id: snapshotB.snapshot_id,
      time_window: {
        from_captured_at: snapshotA.captured_at,
        to_captured_at: snapshotB.captured_at,
      },
      object_type: objectType,
      object_id: key,
      change_type: changeType,
      classification,
      before_state: beforeState,
      after_state: afterState,
      change_patch: changePatch,
      actor: 'unknown', // Never guessed
      source: 'unknown', // Never guessed
      actor_confidence: 'none',
      completeness_percentage: completeness,
      repeat_count: 1,
      schema_version: '7.0',
      canonical_hash: '', // Will be computed below
      hash_algorithm: 'sha256',
      created_at: new Date().toISOString(),
    };

    events.push(event);
  });

  return events;
}

/**
 * Detect scope changes via missing_data differences
 * If dataset visibility changes, it affects what can be observed
 */
function detectScopeChanges(
  tenantId: string,
  cloudId: string,
  snapshotA: any,
  snapshotB: any
): DriftEvent[] {
  const events: DriftEvent[] = [];

  const missingA = new Map<string, any>(
    (snapshotA.missing_data || []).map((item: any) => [String(item.dataset_name), item])
  );
  const missingB = new Map<string, any>(
    (snapshotB.missing_data || []).map((item: any) => [String(item.dataset_name), item])
  );

  // Check for datasets that became visible or invisible
  const allDatasets = new Set<string>([...Array.from(missingA.keys()).map(k => String(k)), ...Array.from(missingB.keys()).map(k => String(k))]);

  allDatasets.forEach((datasetName) => {
    const itemA = missingA.get(datasetName);
    const itemB = missingB.get(datasetName);

    if (itemA && !itemB) {
      // Dataset is now visible (was missing, now not)
      const reasonCode: string = ((itemA && typeof itemA === 'object' && 'reason_code' in itemA) ? (itemA as any).reason_code : 'unknown') as string;
      const event: DriftEvent = {
        tenant_id: tenantId,
        cloud_id: cloudId,
        drift_event_id: uuidv4(),
        from_snapshot_id: snapshotA.snapshot_id,
        to_snapshot_id: snapshotB.snapshot_id,
        time_window: {
          from_captured_at: snapshotA.captured_at,
          to_captured_at: snapshotB.captured_at,
        },
        object_type: ObjectType.SCOPE,
        object_id: datasetName,
        change_type: ChangeType.ADDED, // Became visible
        classification: Classification.DATA_VISIBILITY_CHANGE,
        before_state: { status: 'missing', reason: reasonCode },
        after_state: { status: 'visible' },
        actor: 'unknown',
        source: 'unknown',
        actor_confidence: 'none',
        completeness_percentage: 90,
        missing_data_reference: {
          dataset_keys: [datasetName],
          reason_codes: [reasonCode],
        },
        repeat_count: 1,
        schema_version: '7.0',
        canonical_hash: '',
        hash_algorithm: 'sha256',
        created_at: new Date().toISOString(),
      };
      events.push(event);
    } else if (!itemA && itemB) {
      // Dataset is now missing (was visible, now not)
      const reasonCodeB: string = ((itemB && typeof itemB === 'object' && 'reason_code' in itemB) ? (itemB as any).reason_code : 'unknown') as string;
      const event: DriftEvent = {
        tenant_id: tenantId,
        cloud_id: cloudId,
        drift_event_id: uuidv4(),
        from_snapshot_id: snapshotA.snapshot_id,
        to_snapshot_id: snapshotB.snapshot_id,
        time_window: {
          from_captured_at: snapshotA.captured_at,
          to_captured_at: snapshotB.captured_at,
        },
        object_type: ObjectType.SCOPE,
        object_id: datasetName,
        change_type: ChangeType.REMOVED, // Became invisible
        classification: Classification.DATA_VISIBILITY_CHANGE,
        before_state: { status: 'visible' },
        after_state: { status: 'missing', reason: reasonCodeB },
        actor: 'unknown',
        source: 'unknown',
        actor_confidence: 'none',
        completeness_percentage: 90,
        missing_data_reference: {
          dataset_keys: [datasetName],
          reason_codes: [reasonCodeB],
        },
        repeat_count: 1,
        schema_version: '7.0',
        canonical_hash: '',
        hash_algorithm: 'sha256',
        created_at: new Date().toISOString(),
      };
      events.push(event);
    }
  });

  return events;
}

/**
 * Classify a change deterministically
 */
function classifyChange(objectType: ObjectType, changeType: ChangeType): Classification {
  if (changeType === ChangeType.ADDED || changeType === ChangeType.REMOVED) {
    if (objectType === ObjectType.WORKFLOW || objectType === ObjectType.AUTOMATION_RULE) {
      return Classification.CONFIG_CHANGE;
    } else if (objectType === ObjectType.FIELD || objectType === ObjectType.PROJECT) {
      return Classification.STRUCTURAL;
    }
  }

  if (changeType === ChangeType.MODIFIED) {
    if (objectType === ObjectType.WORKFLOW || objectType === ObjectType.AUTOMATION_RULE) {
      return Classification.CONFIG_CHANGE;
    } else if (objectType === ObjectType.FIELD || objectType === ObjectType.PROJECT) {
      return Classification.STRUCTURAL;
    }
  }

  return Classification.UNKNOWN;
}

/**
 * Generate a deterministic change patch
 */
function generateChangePatch(before: any, after: any): ChangePatch[] {
  const patch: ChangePatch[] = [];

  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const sortedKeys = Array.from(allKeys).sort(); // Stable ordering

  sortedKeys.forEach((key) => {
    const beforeVal = before[key];
    const afterVal = after[key];

    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      if (beforeVal === undefined) {
        patch.push({
          op: 'add',
          path: `/${key}`,
          value: afterVal,
        });
      } else if (afterVal === undefined) {
        patch.push({
          op: 'remove',
          path: `/${key}`,
          from: beforeVal,
        });
      } else {
        patch.push({
          op: 'replace',
          path: `/${key}`,
          from: beforeVal,
          value: afterVal,
        });
      }
    }
  });

  return patch;
}

/**
 * Compute completeness percentage for a drift event
 * 
 * 100 = both states available, no missing_data scope
 * 85 = missing_data referenced but doesn't block visibility
 * 50 = before OR after unavailable
 * 25 = multiple missing_data dependencies
 * 0 = payload incomplete
 */
function computeCompleteness(
  changeType: ChangeType,
  hasBeforeState: boolean,
  hasAfterState: boolean,
  missingDataA: any[],
  missingDataB: any[]
): number {
  if (changeType === ChangeType.ADDED && !hasBeforeState && hasAfterState) {
    return 100;
  }

  if (changeType === ChangeType.REMOVED && hasBeforeState && !hasAfterState) {
    return 100;
  }

  if (changeType === ChangeType.MODIFIED && hasBeforeState && hasAfterState) {
    return 100;
  }

  // Partial visibility
  if (hasBeforeState && hasAfterState) {
    return 85;
  }

  if (hasBeforeState || hasAfterState) {
    return 50;
  }

  return 0;
}

/**
 * Stable sort of drift events (deterministic ordering)
 * Sort by: object_type, object_id, change_type, classification
 */
function stableSortDriftEvents(events: DriftEvent[]): DriftEvent[] {
  return events.sort((a, b) => {
    if (a.object_type !== b.object_type) {
      return a.object_type.localeCompare(b.object_type);
    }
    if (a.object_id !== b.object_id) {
      return a.object_id.localeCompare(b.object_id);
    }
    if (a.change_type !== b.change_type) {
      return a.change_type.localeCompare(b.change_type);
    }
    return a.classification.localeCompare(b.classification);
  });
}

/**
 * Hash a drift event canonically
 */
function hashDriftEvent(event: DriftEvent): DriftEvent {
  const canonical = {
    tenant_id: event.tenant_id,
    cloud_id: event.cloud_id,
    from_snapshot_id: event.from_snapshot_id,
    to_snapshot_id: event.to_snapshot_id,
    object_type: event.object_type,
    object_id: event.object_id,
    change_type: event.change_type,
    classification: event.classification,
    before_state: event.before_state,
    after_state: event.after_state,
    actor: event.actor,
    source: event.source,
  };

  const canonicalJson = JSON.stringify(canonical);
  const hash = createHash('sha256').update(canonicalJson).digest('hex');

  return {
    ...event,
    canonical_hash: hash,
  };
}
