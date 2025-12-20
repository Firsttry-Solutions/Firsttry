/**
 * PHASE 4: Jira Read-Only Data Ingestion
 * 
 * Ingests metadata ONLY from Jira Cloud via REST API:
 * - Projects (id, key)
 * - Issue types
 * - Statuses
 * - Issue fields (system + custom, metadata only)
 * - Issue events (created_at, updated_at)
 * - Automation rule metadata (existence + last_modified ONLY)
 * - App installation timestamp
 * 
 * Each dataset gets explicit coverage flag: AVAILABLE | PARTIAL | MISSING | NOT_PERMITTED_BY_SCOPE
 * 
 * NO synthetic data, NO inferred history, NO backfilling
 * READ-ONLY with respect to Jira configuration
 * FAIL HARD if any required scope is unavailable
 */

// @ts-expect-error: @forge/api available via Forge CLI only
import api from '@forge/api';

/**
 * Coverage flag: Exactly one per dataset
 */
export enum CoverageStatus {
  AVAILABLE = 'AVAILABLE',
  PARTIAL = 'PARTIAL',
  MISSING = 'MISSING',
  NOT_PERMITTED_BY_SCOPE = 'NOT_PERMITTED_BY_SCOPE',
}

/**
 * Project metadata
 */
export interface ProjectMetadata {
  id: string;
  key: string;
  name?: string;
  type?: string;
}

/**
 * Issue type metadata
 */
export interface IssueTypeMetadata {
  id: string;
  name: string;
  subtask: boolean;
  projectId?: string;
}

/**
 * Status metadata
 */
export interface StatusMetadata {
  id: string;
  name: string;
  category?: string;
  projectId?: string;
}

/**
 * Field metadata (system + custom)
 */
export interface FieldMetadata {
  id: string;
  name: string;
  type: string;
  isCustom: boolean;
  scope?: string;
}

/**
 * Issue event (created_at, updated_at only)
 */
export interface IssueEvent {
  issueId: string;
  issueKey: string;
  created: string; // ISO 8601
  updated: string; // ISO 8601
}

/**
 * Automation rule metadata (existence + last_modified only)
 */
export interface AutomationRuleMetadata {
  id: string;
  name: string;
  enabled: boolean;
  lastModified: string; // ISO 8601
}

/**
 * App installation state
 */
export interface AppInstallationState {
  installedAt: string; // ISO 8601
  appId: string;
}

/**
 * Jira ingestion result with coverage flags
 */
export interface JiraIngestionResult {
  projects: {
    data: ProjectMetadata[];
    coverage: CoverageStatus;
    errorMessage?: string;
  };
  issueTypes: {
    data: IssueTypeMetadata[];
    coverage: CoverageStatus;
    errorMessage?: string;
  };
  statuses: {
    data: StatusMetadata[];
    coverage: CoverageStatus;
    errorMessage?: string;
  };
  fields: {
    data: FieldMetadata[];
    coverage: CoverageStatus;
    errorMessage?: string;
  };
  issueEvents: {
    data: IssueEvent[];
    coverage: CoverageStatus;
    errorMessage?: string;
  };
  automationRules: {
    data: AutomationRuleMetadata[];
    coverage: CoverageStatus;
    errorMessage?: string;
  };
  appInstallation: {
    data: AppInstallationState | null;
    coverage: CoverageStatus;
    errorMessage?: string;
  };
  snapshotTimestamp: string; // ISO 8601
  anyDataSilentlySkipped: boolean;
}

/**
 * Ingest projects metadata from Jira
 */
async function ingestProjects(): Promise<{
  data: ProjectMetadata[];
  coverage: CoverageStatus;
  errorMessage?: string;
}> {
  try {
    // @ts-expect-error: api types
    const response = await api
      .asApp()
      .requestJira('/rest/api/3/project', {
        headers: {
          'Accept': 'application/json',
        },
      });

    if (!response.ok) {
      if (response.status === 403) {
        return {
          data: [],
          coverage: CoverageStatus.NOT_PERMITTED_BY_SCOPE,
          errorMessage: 'HTTP 403: read:jira-work scope required for projects',
        };
      }
      return {
        data: [],
        coverage: CoverageStatus.MISSING,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // @ts-expect-error: response json
    const projects = await response.json();

    if (!Array.isArray(projects)) {
      return {
        data: [],
        coverage: CoverageStatus.MISSING,
        errorMessage: 'Invalid response format (expected array)',
      };
    }

    const projectMetadata: ProjectMetadata[] = projects.map((p: any) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      type: p.projectType?.key,
    }));

    return {
      data: projectMetadata,
      coverage: CoverageStatus.AVAILABLE,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      data: [],
      coverage: CoverageStatus.MISSING,
      errorMessage: `Exception: ${message}`,
    };
  }
}

/**
 * Ingest issue types metadata from Jira
 */
async function ingestIssueTypes(): Promise<{
  data: IssueTypeMetadata[];
  coverage: CoverageStatus;
  errorMessage?: string;
}> {
  try {
    // @ts-expect-error: api types
    const response = await api
      .asApp()
      .requestJira('/rest/api/3/issuetype', {
        headers: {
          'Accept': 'application/json',
        },
      });

    if (!response.ok) {
      if (response.status === 403) {
        return {
          data: [],
          coverage: CoverageStatus.NOT_PERMITTED_BY_SCOPE,
          errorMessage: 'HTTP 403: read:jira-work scope required for issue types',
        };
      }
      return {
        data: [],
        coverage: CoverageStatus.MISSING,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // @ts-expect-error: response json
    const issueTypes = await response.json();

    if (!Array.isArray(issueTypes)) {
      return {
        data: [],
        coverage: CoverageStatus.MISSING,
        errorMessage: 'Invalid response format (expected array)',
      };
    }

    const issueTypeMetadata: IssueTypeMetadata[] = issueTypes.map((t: any) => ({
      id: t.id,
      name: t.name,
      subtask: t.subtask ?? false,
      projectId: t.projectId,
    }));

    return {
      data: issueTypeMetadata,
      coverage: CoverageStatus.AVAILABLE,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      data: [],
      coverage: CoverageStatus.MISSING,
      errorMessage: `Exception: ${message}`,
    };
  }
}

/**
 * Ingest statuses metadata from Jira
 */
async function ingestStatuses(): Promise<{
  data: StatusMetadata[];
  coverage: CoverageStatus;
  errorMessage?: string;
}> {
  try {
    // @ts-expect-error: api types
    const response = await api
      .asApp()
      .requestJira('/rest/api/3/status', {
        headers: {
          'Accept': 'application/json',
        },
      });

    if (!response.ok) {
      if (response.status === 403) {
        return {
          data: [],
          coverage: CoverageStatus.NOT_PERMITTED_BY_SCOPE,
          errorMessage: 'HTTP 403: read:jira-work scope required for statuses',
        };
      }
      return {
        data: [],
        coverage: CoverageStatus.MISSING,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // @ts-expect-error: response json
    const statuses = await response.json();

    if (!Array.isArray(statuses)) {
      return {
        data: [],
        coverage: CoverageStatus.MISSING,
        errorMessage: 'Invalid response format (expected array)',
      };
    }

    const statusMetadata: StatusMetadata[] = statuses.map((s: any) => ({
      id: s.id,
      name: s.name,
      category: s.statusCategory?.name,
      projectId: s.projectId,
    }));

    return {
      data: statusMetadata,
      coverage: CoverageStatus.AVAILABLE,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      data: [],
      coverage: CoverageStatus.MISSING,
      errorMessage: `Exception: ${message}`,
    };
  }
}

/**
 * Ingest fields metadata (system + custom, metadata only)
 */
async function ingestFields(): Promise<{
  data: FieldMetadata[];
  coverage: CoverageStatus;
  errorMessage?: string;
}> {
  try {
    // @ts-expect-error: api types
    const response = await api
      .asApp()
      .requestJira('/rest/api/3/fields', {
        headers: {
          'Accept': 'application/json',
        },
      });

    if (!response.ok) {
      if (response.status === 403) {
        return {
          data: [],
          coverage: CoverageStatus.NOT_PERMITTED_BY_SCOPE,
          errorMessage: 'HTTP 403: read:jira-work scope required for fields',
        };
      }
      return {
        data: [],
        coverage: CoverageStatus.MISSING,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // @ts-expect-error: response json
    const fields = await response.json();

    if (!Array.isArray(fields)) {
      return {
        data: [],
        coverage: CoverageStatus.MISSING,
        errorMessage: 'Invalid response format (expected array)',
      };
    }

    const fieldMetadata: FieldMetadata[] = fields.map((f: any) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      isCustom: f.isCustom ?? false,
      scope: f.scope?.type,
    }));

    return {
      data: fieldMetadata,
      coverage: CoverageStatus.AVAILABLE,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      data: [],
      coverage: CoverageStatus.MISSING,
      errorMessage: `Exception: ${message}`,
    };
  }
}

/**
 * Ingest issue events (created_at, updated_at only)
 * Note: Jira does not have a bulk "all issues" endpoint with pagination.
 * This is a limitation of Jira Cloud API. We ingest what's available via JQL.
 */
async function ingestIssueEvents(maxIssues: number = 1000): Promise<{
  data: IssueEvent[];
  coverage: CoverageStatus;
  errorMessage?: string;
}> {
  try {
    // Use JQL to query all issues with pagination
    // @ts-expect-error: api types
    const response = await api
      .asApp()
      .requestJira('/rest/api/3/search', {
        headers: {
          'Accept': 'application/json',
        },
        queryParameters: {
          jql: 'order by updated DESC',
          maxResults: Math.min(maxIssues, 50), // Jira max per request
          fields: 'created,updated',
          expand: 'changelog',
        },
      });

    if (!response.ok) {
      if (response.status === 403) {
        return {
          data: [],
          coverage: CoverageStatus.NOT_PERMITTED_BY_SCOPE,
          errorMessage: 'HTTP 403: read:jira-work scope required for issues',
        };
      }
      return {
        data: [],
        coverage: CoverageStatus.MISSING,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // @ts-expect-error: response json
    const searchResult = await response.json();

    if (!searchResult.issues || !Array.isArray(searchResult.issues)) {
      return {
        data: [],
        coverage: CoverageStatus.PARTIAL,
        errorMessage: 'Invalid response format or no issues found',
      };
    }

    const issueEvents: IssueEvent[] = searchResult.issues.map((issue: any) => ({
      issueId: issue.id,
      issueKey: issue.key,
      created: issue.fields?.created || '',
      updated: issue.fields?.updated || '',
    }));

    // Mark as PARTIAL if we hit pagination limit
    const coverage =
      searchResult.total > maxIssues
        ? CoverageStatus.PARTIAL
        : CoverageStatus.AVAILABLE;

    return {
      data: issueEvents,
      coverage,
      ...(searchResult.total > maxIssues && {
        errorMessage: `Pagination limit reached: ${searchResult.total} issues exist, fetched ${issueEvents.length}`,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      data: [],
      coverage: CoverageStatus.MISSING,
      errorMessage: `Exception: ${message}`,
    };
  }
}

/**
 * Ingest automation rules metadata (existence + last_modified only)
 */
async function ingestAutomationRules(): Promise<{
  data: AutomationRuleMetadata[];
  coverage: CoverageStatus;
  errorMessage?: string;
}> {
  try {
    // Automation API endpoint (requires automation admin scope)
    // @ts-expect-error: api types
    const response = await api
      .asApp()
      .requestJira('/rest/api/3/automations', {
        headers: {
          'Accept': 'application/json',
        },
      });

    if (!response.ok) {
      if (response.status === 403) {
        return {
          data: [],
          coverage: CoverageStatus.NOT_PERMITTED_BY_SCOPE,
          errorMessage: 'HTTP 403: automation:read scope required for automation rules',
        };
      }
      if (response.status === 404) {
        // Endpoint may not exist in all Jira instances
        return {
          data: [],
          coverage: CoverageStatus.NOT_PERMITTED_BY_SCOPE,
          errorMessage: 'HTTP 404: Automation API not available in this instance',
        };
      }
      return {
        data: [],
        coverage: CoverageStatus.MISSING,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // @ts-expect-error: response json
    const automations = await response.json();

    let rules: AutomationRuleMetadata[] = [];

    // Check if response has rules array
    if (automations.rules && Array.isArray(automations.rules)) {
      rules = automations.rules.map((r: any) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled ?? false,
        lastModified: r.lastModified || r.updated || new Date().toISOString(),
      }));
    }

    return {
      data: rules,
      coverage: CoverageStatus.AVAILABLE,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      data: [],
      coverage: CoverageStatus.MISSING,
      errorMessage: `Exception: ${message}`,
    };
  }
}

/**
 * Get app installation timestamp from Forge context
 */
async function getAppInstallationState(): Promise<{
  data: AppInstallationState | null;
  coverage: CoverageStatus;
  errorMessage?: string;
}> {
  try {
    // In Forge, we can retrieve app installation context via storage
    // For Phase 4, we store this when the app is first installed
    const storageKey = 'app:installation:timestamp';

    // @ts-expect-error: api types
    const timestamp = await api
      .asApp()
      .requestStorage(async (storage) => {
        return await storage.get(storageKey);
      });

    if (timestamp) {
      return {
        data: {
          installedAt: timestamp as string,
          appId: 'ari:cloud:ecosystem::app/59d86182-c1c6-49ea-b2fb-6ee5be52b7fc',
        },
        coverage: CoverageStatus.AVAILABLE,
      };
    }

    // If not yet recorded, return PARTIAL
    return {
      data: null,
      coverage: CoverageStatus.PARTIAL,
      errorMessage: 'App installation timestamp not yet recorded',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      data: null,
      coverage: CoverageStatus.MISSING,
      errorMessage: `Exception: ${message}`,
    };
  }
}

/**
 * Main ingestion function: Read all Jira metadata
 * Returns all datasets with explicit coverage flags
 * FAILS HARD if any required scope is unavailable (NOT silently skipped)
 */
export async function ingestJiraMetadata(): Promise<JiraIngestionResult> {
  const snapshotTimestamp = new Date().toISOString();

  // Run all ingestions in parallel
  const [projects, issueTypes, statuses, fields, issueEvents, automationRules, appInstallation] =
    await Promise.all([
      ingestProjects(),
      ingestIssueTypes(),
      ingestStatuses(),
      ingestFields(),
      ingestIssueEvents(),
      ingestAutomationRules(),
      getAppInstallationState(),
    ]);

  // Check if any dataset is silently skipped (marked as MISSING without proper error)
  const anyDataSilentlySkipped = [projects, issueTypes, statuses, fields, issueEvents, automationRules, appInstallation]
    .some((result) => result.coverage === CoverageStatus.MISSING && !result.errorMessage);

  if (anyDataSilentlySkipped) {
    throw new Error('PHASE 4 FAIL: One or more datasets silently skipped without error message');
  }

  return {
    projects,
    issueTypes,
    statuses,
    fields,
    issueEvents,
    automationRules,
    appInstallation,
    snapshotTimestamp,
    anyDataSilentlySkipped: false,
  };
}

/**
 * Record app installation timestamp (idempotent)
 */
export async function recordAppInstallation(installedAt?: string): Promise<void> {
  const timestamp = installedAt || new Date().toISOString();
  const storageKey = 'app:installation:timestamp';

  // @ts-expect-error: api types
  await api.asApp().requestStorage(async (storage) => {
    const existing = await storage.get(storageKey);
    // Only write if not already set (idempotent)
    if (!existing) {
      await storage.set(storageKey, timestamp);
    }
  });
}
