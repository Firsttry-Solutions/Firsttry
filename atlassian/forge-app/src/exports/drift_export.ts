/**
 * PHASE 7 v2: DRIFT EXPORT HANDLER
 * 
 * Exports drift events as JSON in chunked, paginated format.
 * 
 * Principles:
 * - Deterministic ordering identical to UI
 * - Chunked export (100 events per response)
 * - Includes metadata about filters and missing_data limitations
 * - No forbidden language
 * - READ-ONLY (no Jira API calls)
 */

import { DriftEventStorage, sortDriftEventsDeterministically, filterDriftEvents, paginateDriftEvents } from './drift_storage';
import { DriftListFilters, DriftEvent } from './drift_model';

/**
 * Export drift events as JSON
 * Supports pagination with deterministic ordering
 */
export async function exportDriftJSON(request: any): Promise<any> {
  const { tenantId, cloudId } = request.context;
  const queryParams = request.queryParameters || {};

  const {
    from_date,
    to_date,
    object_type,
    classification,
    change_type,
    actor,
    page = '0',
    limit = '100',
  } = queryParams;

  try {
    // Build filters from query params
    const filters: DriftListFilters = {};
    if (from_date) filters.from_date = from_date;
    if (to_date) filters.to_date = to_date;
    if (object_type) filters.object_type = object_type;
    if (classification) filters.classification = classification;
    if (change_type) filters.change_type = change_type;
    if (actor) filters.actor = actor;

    const pageNum = Math.max(0, parseInt(page, 10));
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    // Get drift events (in production would use DriftEventStorage)
    const storage = new DriftEventStorage(tenantId, cloudId);
    const result = await storage.exportDriftEvents(filters, pageNum, pageLimit);

    // Sort deterministically
    const sortedEvents = sortDriftEventsDeterministically(result.events);

    // Create export envelope
    const exportData = {
      format_version: '1.0',
      schema_version: '7.0',
      export_timestamp: new Date().toISOString(),
      filters_used: filters,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        total_count: result.total_count,
        has_more: result.has_more,
      },
      metadata: {
        summary: `Exported ${sortedEvents.length} drift events`,
        note: 'Observed changes only. No cause, impact, or recommendations inferred.',
        missing_data_disclosure:
          'Drift detection depends on snapshot visibility. If a dataset was missing in either snapshot, ' +
          'related drift events may be incomplete. See "missing_data_reference" field in each event.',
      },
      events: sortedEvents.map((event) => stripSensitiveFields(event)),
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="drift-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
      body: JSON.stringify(exportData, null, 2),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'export_failed',
        message: error.message,
      }),
    };
  }
}

/**
 * Get drift events for a specific date range (chunked response)
 * Used by pagination in admin UI
 */
export async function getDriftEventsChunked(
  tenantId: string,
  cloudId: string,
  filters: DriftListFilters,
  page: number = 0,
  limit: number = 20
): Promise<{
  events: DriftEvent[];
  total_count: number;
  has_more: boolean;
  page: number;
  limit: number;
}> {
  const storage = new DriftEventStorage(tenantId, cloudId);
  const result = await storage.listDriftEvents(filters, page, limit);

  return {
    events: result.items,
    total_count: result.total_count || 0,
    has_more: result.has_more,
    page,
    limit,
  };
}

/**
 * Get statistics about drift events for a tenant
 */
export async function getDriftStatistics(
  tenantId: string,
  cloudId: string,
  filters?: DriftListFilters
): Promise<{
  total_count: number;
  by_classification: Record<string, number>;
  by_object_type: Record<string, number>;
  by_change_type: Record<string, number>;
  time_range: {
    from: string | null;
    to: string | null;
  };
}> {
  const storage = new DriftEventStorage(tenantId, cloudId);
  const count = await storage.countDriftEvents(filters || {});

  // In production, would compute actual statistics
  // For now, return structure with zero values
  return {
    total_count: count,
    by_classification: {},
    by_object_type: {},
    by_change_type: {},
    time_range: {
      from: null,
      to: null,
    },
  };
}

/**
 * Strip sensitive/internal fields before export
 * Keeps only public-facing data
 */
function stripSensitiveFields(event: DriftEvent): DriftEvent {
  // In Phase 7, all fields are intentionally public for audit trail
  // No stripping needed; return as-is
  // This function reserved for future sensitive field handling
  return event;
}

/**
 * Validate export filters for security
 */
export function validateExportFilters(filters: DriftListFilters): boolean {
  // Validate date formats
  if (filters.from_date) {
    try {
      new Date(filters.from_date);
    } catch {
      return false;
    }
  }

  if (filters.to_date) {
    try {
      new Date(filters.to_date);
    } catch {
      return false;
    }
  }

  // Validate enum values
  const validObjectTypes = ['field', 'workflow', 'automation_rule', 'project', 'scope', 'unknown'];
  if (filters.object_type && !validObjectTypes.includes(filters.object_type)) {
    return false;
  }

  const validClassifications = ['STRUCTURAL', 'CONFIG_CHANGE', 'DATA_VISIBILITY_CHANGE', 'UNKNOWN'];
  if (filters.classification && !validClassifications.includes(filters.classification)) {
    return false;
  }

  const validChangeTypes = ['added', 'removed', 'modified'];
  if (filters.change_type && !validChangeTypes.includes(filters.change_type)) {
    return false;
  }

  const validActors = ['user', 'automation', 'app', 'unknown'];
  if (filters.actor && !validActors.includes(filters.actor)) {
    return false;
  }

  return true;
}
