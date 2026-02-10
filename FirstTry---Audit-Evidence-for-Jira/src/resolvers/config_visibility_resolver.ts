/**
 * CONFIG VISIBILITY RESOLVER
 * 
 * Fetches Jira configuration complexity metrics via READ-ONLY (GET-only) API calls.
 * 
 * Contract:
 * - Requires valid tenant identity (cloudId). If missing -> return degraded snapshot.
 * - ALL Jira calls use HTTP GET only (enforced via safeRequestJiraGET).
 * - If any metric fetch fails (403/401/timeout/parse) -> set null, add MetricIssue, continue.
 * - No throws except for missing tenant identity.
 * - Returns ConfigRiskSnapshot with computed risk band.
 * 
 * Boundaries:
 * - No POST/PUT/PATCH/DELETE to Jira
 * - No configuration changes
 * - No enforcement or recommendations
 */

import api from '@forge/api';
import { resolveTenantIdentity } from '../core/tenant_identity';
import { ConfigMetrics, ConfigRiskSnapshot, MetricIssue } from '../core/config_visibility/types';
import { computeConfigRisk } from '../core/config_visibility/computeConfigRisk';

/**
 * Safe GET-only wrapper for requestJira
 * Enforces that only GET requests are made.
 * Throws NON_GET_BLOCKED if non-GET is attempted.
 */
async function safeRequestJiraGET(path: string, options?: any): Promise<any> {
  // Default to GET if not specified
  const method = (options?.method || 'GET').toUpperCase();

  if (method !== 'GET') {
    throw new Error('NON_GET_BLOCKED');
  }

  return api
    .asApp()
    .requestJira(path, {
      ...(options || {}),
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {}),
      },
    });
}

/**
 * Fetch custom field count
 */
async function fetchCustomFieldCount(): Promise<{ count: number | null; issue?: MetricIssue }> {
  try {
    const response = await safeRequestJiraGET('/rest/api/3/field');

    if (!response.ok) {
      const errorCode =
        response.status === 403
          ? 'JIRA_403'
          : response.status === 404
            ? 'JIRA_404'
            : `JIRA_${response.status}`;
      return {
        count: null,
        issue: {
          metric: 'customFieldCount',
          reason: `Jira API returned HTTP ${response.status}`,
          errorCode,
        },
      };
    }

    const data = await response.json();
    const count = Array.isArray(data) ? data.length : null;

    return { count };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT');
    const errorCode = isTimeout ? 'JIRA_TIMEOUT' : 'JIRA_UNKNOWN';

    return {
      count: null,
      issue: {
        metric: 'customFieldCount',
        reason: `Failed to fetch custom fields: ${errorMsg}`,
        errorCode,
      },
    };
  }
}

/**
 * Fetch workflow count
 */
async function fetchWorkflowCount(): Promise<{ count: number | null; issue?: MetricIssue }> {
  try {
    const response = await safeRequestJiraGET('/rest/api/3/workflow/search?maxResults=1000');

    if (!response.ok) {
      const errorCode =
        response.status === 403
          ? 'JIRA_403'
          : response.status === 404
            ? 'JIRA_404'
            : `JIRA_${response.status}`;
      return {
        count: null,
        issue: {
          metric: 'workflowCount',
          reason: `Jira API returned HTTP ${response.status}`,
          errorCode,
        },
      };
    }

    const data = await response.json();
    // Support both response formats: { values: [...] } or { workflows: [...] }
    const count = data.values?.length ?? data.workflows?.length ?? null;

    return { count };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT');
    const errorCode = isTimeout ? 'JIRA_TIMEOUT' : 'JIRA_UNKNOWN';

    return {
      count: null,
      issue: {
        metric: 'workflowCount',
        reason: `Failed to fetch workflows: ${errorMsg}`,
        errorCode,
      },
    };
  }
}

/**
 * Fetch workflow scheme count and max workflows per scheme
 */
async function fetchWorkflowSchemeData(): Promise<{
  schemeCount: number | null;
  maxWorkflows: number | null;
  issues: MetricIssue[];
}> {
  const issues: MetricIssue[] = [];

  try {
    const response = await safeRequestJiraGET('/rest/api/3/workflowscheme?maxResults=1000');

    if (!response.ok) {
      const errorCode =
        response.status === 403
          ? 'JIRA_403'
          : response.status === 404
            ? 'JIRA_404'
            : `JIRA_${response.status}`;

      issues.push({
        metric: 'workflowSchemeCount',
        reason: `Jira API returned HTTP ${response.status}`,
        errorCode,
      });

      issues.push({
        metric: 'maxWorkflowsPerScheme',
        reason: `Jira API returned HTTP ${response.status}`,
        errorCode,
      });

      return { schemeCount: null, maxWorkflows: null, issues };
    }

    const data = await response.json();
    const schemes = data.values || [];
    const schemeCount = schemes.length;

    let maxWorkflows = 0;
    for (const scheme of schemes) {
      const workflows = scheme.workflows || [];
      const count = Array.isArray(workflows) ? workflows.length : Object.keys(workflows).length;
      maxWorkflows = Math.max(maxWorkflows, count);
    }

    return { schemeCount, maxWorkflows: maxWorkflows > 0 ? maxWorkflows : null, issues };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT');
    const errorCode = isTimeout ? 'JIRA_TIMEOUT' : 'JIRA_UNKNOWN';

    issues.push({
      metric: 'workflowSchemeCount',
      reason: `Failed to fetch workflow schemes: ${errorMsg}`,
      errorCode,
    });

    issues.push({
      metric: 'maxWorkflowsPerScheme',
      reason: `Failed to fetch workflow schemes: ${errorMsg}`,
      errorCode,
    });

    return { schemeCount: null, maxWorkflows: null, issues };
  }
}

/**
 * Fetch screen count
 */
async function fetchScreenCount(): Promise<{ count: number | null; issue?: MetricIssue }> {
  try {
    const response = await safeRequestJiraGET('/rest/api/3/screens?maxResults=1000');

    if (!response.ok) {
      const errorCode =
        response.status === 403
          ? 'JIRA_403'
          : response.status === 404
            ? 'JIRA_404'
            : `JIRA_${response.status}`;
      return {
        count: null,
        issue: {
          metric: 'screenCount',
          reason: `Jira API returned HTTP ${response.status}`,
          errorCode,
        },
      };
    }

    const data = await response.json();
    const count = data.values?.length ?? null;

    return { count };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT');
    const errorCode = isTimeout ? 'JIRA_TIMEOUT' : 'JIRA_UNKNOWN';

    return {
      count: null,
      issue: {
        metric: 'screenCount',
        reason: `Failed to fetch screens: ${errorMsg}`,
        errorCode,
      },
    };
  }
}

/**
 * Fetch permission scheme count (and project mapping if available)
 */
async function fetchPermissionSchemeData(): Promise<{
  schemeCount: number | null;
  maxProjects: number | null;
  issues: MetricIssue[];
}> {
  const issues: MetricIssue[] = [];

  try {
    const response = await safeRequestJiraGET('/rest/api/3/permissionscheme?maxResults=1000');

    if (!response.ok) {
      const errorCode =
        response.status === 403
          ? 'JIRA_403'
          : response.status === 404
            ? 'JIRA_404'
            : `JIRA_${response.status}`;

      issues.push({
        metric: 'permissionSchemeCount',
        reason: `Jira API returned HTTP ${response.status}`,
        errorCode,
      });

      issues.push({
        metric: 'maxProjectsPerPermissionScheme',
        reason: `Jira API returned HTTP ${response.status}`,
        errorCode,
      });

      return { schemeCount: null, maxProjects: null, issues };
    }

    const data = await response.json();
    // Support both response formats
    const schemes = data.permissionSchemes || data.values || [];
    const schemeCount = schemes.length;

    // Project mapping is not available from this endpoint per Jira API design
    issues.push({
      metric: 'maxProjectsPerPermissionScheme',
      reason: 'Project mapping not available from this endpoint',
      errorCode: 'ENDPOINT_LIMITATION',
    });

    return { schemeCount, maxProjects: null, issues };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT');
    const errorCode = isTimeout ? 'JIRA_TIMEOUT' : 'JIRA_UNKNOWN';

    issues.push({
      metric: 'permissionSchemeCount',
      reason: `Failed to fetch permission schemes: ${errorMsg}`,
      errorCode,
    });

    issues.push({
      metric: 'maxProjectsPerPermissionScheme',
      reason: `Failed to fetch permission schemes: ${errorMsg}`,
      errorCode,
    });

    return { schemeCount: null, maxProjects: null, issues };
  }
}

/**
 * Compute snapshot for a tenant
 * Fetches all metrics via GET-only, handles failures gracefully.
 */
export async function computeSnapshot(cloudId: string): Promise<ConfigRiskSnapshot> {
  const allIssues: MetricIssue[] = [];
  const nowISO = new Date().toISOString();

  // Fetch all metrics in parallel
  const [customFieldResult, workflowResult, schemeResult, screenResult, permissionResult] =
    await Promise.all([
      fetchCustomFieldCount(),
      fetchWorkflowCount(),
      fetchWorkflowSchemeData(),
      fetchScreenCount(),
      fetchPermissionSchemeData(),
    ]);

  // Collect issues
  if (customFieldResult.issue) allIssues.push(customFieldResult.issue);
  if (workflowResult.issue) allIssues.push(workflowResult.issue);
  schemeResult.issues.forEach((i) => allIssues.push(i));
  if (screenResult.issue) allIssues.push(screenResult.issue);
  permissionResult.issues.forEach((i) => allIssues.push(i));

  // Build metrics object
  const metrics: ConfigMetrics = {
    customFieldCount: customFieldResult.count,
    workflowCount: workflowResult.count,
    workflowSchemeCount: schemeResult.schemeCount,
    maxWorkflowsPerScheme: schemeResult.maxWorkflows,
    screenCount: screenResult.count,
    permissionSchemeCount: permissionResult.schemeCount,
    maxProjectsPerPermissionScheme: permissionResult.maxProjects,
  };

  // Compute snapshot
  const snapshot = computeConfigRisk(metrics, nowISO, allIssues);

  return snapshot;
}

/**
 * Resolver GET function for GraphQL/resolver API
 * Called by dashboard UI to fetch config visibility data
 */
export async function get(request: any, context: any): Promise<ConfigRiskSnapshot> {
  try {
    // Resolve tenant identity
    const tenantId = resolveTenantIdentity(context);

    if (!tenantId || !tenantId.cloudId) {
      // Return empty snapshot with degraded status
      return {
        metrics: {
          customFieldCount: null,
          workflowCount: null,
          workflowSchemeCount: null,
          maxWorkflowsPerScheme: null,
          screenCount: null,
          permissionSchemeCount: null,
          maxProjectsPerPermissionScheme: null,
        },
        riskBand: 'LOW',
        evaluatedAtISO: new Date().toISOString(),
        completeness: 'EMPTY',
        issues: [
          {
            metric: 'customFieldCount', // arbitrary metric to record the issue
            reason: 'Tenant identity is unavailable',
            errorCode: 'TENANT_IDENTITY_UNAVAILABLE',
          },
        ],
        mode: 'scheduled-read-only',
        boundaries: {
          noJiraWrites: true,
          noConfigChanges: true,
          noEnforcement: true,
        },
      };
    }

    // Compute snapshot
    const snapshot = await computeSnapshot(tenantId.cloudId);
    return snapshot;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Return degraded snapshot on error
    return {
      metrics: {
        customFieldCount: null,
        workflowCount: null,
        workflowSchemeCount: null,
        maxWorkflowsPerScheme: null,
        screenCount: null,
        permissionSchemeCount: null,
        maxProjectsPerPermissionScheme: null,
      },
      riskBand: 'LOW',
      evaluatedAtISO: new Date().toISOString(),
      completeness: 'EMPTY',
      issues: [
        {
          metric: 'customFieldCount', // arbitrary metric to record the issue
          reason: `Resolver error: ${errorMsg}`,
          errorCode: 'RESOLVER_ERROR',
        },
      ],
      mode: 'scheduled-read-only',
      boundaries: {
        noJiraWrites: true,
        noConfigChanges: true,
        noEnforcement: true,
      },
    };
  }
}
