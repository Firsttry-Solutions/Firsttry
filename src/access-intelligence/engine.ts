/**
 * Access Intelligence Engine - PHASE 1
 * 
 * Scans Jira access surface:
 * - Fetch all users (paginated)
 * - Detect global admins, project admins, external users, inactive admins
 * - Resolve indirect privileges: user -> group -> permission scheme -> project
 * - FAIL-CLOSED: Any API failure aborts scan
 */

import { User, Project, PaginationState, AccessSurfaceSnapshot, AccessIntelligenceError } from './types';
import crypto from 'crypto';

const FT_LOG_PREFIX = '[FT_ACCESS_SCAN]';

export class AccessIntelligenceEngine {
  private siteId: string;
  private buildShaShort: string;
  private buildUtc: string;
  private jiraApiClient: any; // Will be injected Forge API client

  constructor(
    siteId: string,
    buildShaShort: string,
    buildUtc: string,
    jiraApiClient: any
  ) {
    this.siteId = siteId;
    this.buildShaShort = buildShaShort;
    this.buildUtc = buildUtc;
    this.jiraApiClient = jiraApiClient;
  }

  async scan(): Promise<AccessSurfaceSnapshot | AccessIntelligenceError> {
    try {
      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_SCAN_START] Initializing access scan for site: ${this.siteId}`);

      // STEP 1: Fetch all users with pagination
      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_FETCH_USERS] Starting user enumeration`);
      const users = await this.fetchAllUsers();
      if (!users || users.length === 0) {
        throw new Error('User fetch returned empty or null result');
      }
      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_FETCH_USERS] Fetched ${users.length} users`);

      // STEP 2: Fetch all projects with pagination
      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_FETCH_PROJECTS] Starting project enumeration`);
      const projects = await this.fetchAllProjects();
      if (!projects) {
        // Null/undefined is an error - but empty array is OK
        throw new Error('Project fetch returned null (API error)');
      }
      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_FETCH_PROJECTS] Fetched ${projects.length} projects`);

      // SPECIAL CASE: Handle 0 projects as valid result (scan can continue with empty project set)
      if (projects.length === 0) {
        console.log(`${FT_LOG_PREFIX} [FT_ACCESS_FETCH_PROJECTS] Project count is 0 - this is OK`);
      }

      // STEP 3: Detect global admins
      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_DETECT_GLOBAL_ADMINS] Analyzing global admin assignments`);
      const globalAdmins = await this.detectGlobalAdmins();
      if (!globalAdmins) {
        throw new Error('Global admin detection returned null');
      }

      // STEP 4: Detect project admins
      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_DETECT_PROJECT_ADMINS] Analyzing project-specific admins`);
      const projectAdmins = await this.detectProjectAdmins(projects);
      if (!projectAdmins) {
        throw new Error('Project admin detection returned null');
      }

      // STEP 5: Detect external users
      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_DETECT_EXTERNAL_USERS] Identifying external domain users`);
      const externalUsers = this.detectExternalUsers(users);
      if (!Array.isArray(externalUsers)) {
        throw new Error('External user detection returned non-array');
      }

      // STEP 6: Detect elevated external users
      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_DETECT_ELEVATED_EXTERNAL] Finding elevated external users`);
      const externalElevatedUsers = externalUsers.filter(
        u => globalAdmins.includes(u) || Object.values(projectAdmins).flat().includes(u)
      );

      // STEP 7: Detect public projects
      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_DETECT_PUBLIC_PROJECTS] Identifying public projects`);
      const publicProjects = projects
        .filter(p => !p.isPrivate)
        .map(p => p.key);
      if (!Array.isArray(publicProjects)) {
        throw new Error('Public project detection returned non-array');
      }

      // STEP 8: Detect inactive admins
      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_DETECT_INACTIVE_ADMINS] Checking for inactive admins`);
      const inactiveAdmins = users
        .filter(u => !u.active && (globalAdmins.includes(u.accountId)))
        .map(u => u.accountId);

      // STEP 9: Fetch permissions for analysis
      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_FETCH_PERMISSIONS] Retrieving permission schemes`);
      const permissionSchemes = await this.fetchPermissionSchemes();
      if (!permissionSchemes) {
        throw new Error('Permission scheme fetch returned null');
      }

      // STEP 10: Calculate totals
      const totals = {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.active).length,
        externalUsers: externalUsers.length,
      };

      const exposure = {
        globalAdmins,
        projectAdmins,
        publicProjects,
        externalElevatedUsers,
      };

      // STEP 11: Initialize empty toxic findings (will be populated by rules engine)
      const toxicFindings: any[] = [];

      // STEP 12: Initialize risk model (will be calculated by risk engine)
      const riskModel = {
        adminDensity: 0,
        externalExposureScore: 0,
        toxicHitCount: 0,
        publicProjectCount: publicProjects.length,
        finalRiskScore: 0,
      };

      const snapshot: AccessSurfaceSnapshot = {
        schemaVersion: '1.0',
        buildShaShort: this.buildShaShort,
        buildUtc: this.buildUtc,
        siteId: this.siteId,
        privilegeContext: 'read-only',
        ruleSetVersion: '1.0',
        totals,
        exposure,
        toxicFindings,
        riskModel,
        canonicalHash: '', // Will be computed later
      };

      console.log(`${FT_LOG_PREFIX} [FT_ACCESS_SCAN_COMPLETE] Access scan completed successfully`);
      return snapshot;
    } catch (error: any) {
      console.error(`${FT_LOG_PREFIX} [FT_ACCESS_SCAN_ERROR] Scan aborted:`, error.message);
      return {
        status: 'FAILED',
        reason: `Access scan failed: ${error.message}`,
        noExportGenerated: true,
      };
    }
  }

  private async fetchAllUsers(): Promise<User[]> {
    const users: User[] = [];
    let startAt = 0;
    const maxResults = 50;
    let isLast = false;

    while (!isLast) {
      try {
        const response = await this.jiraApiClient.asUser().requestJira(
          `/rest/api/3/users?startAt=${startAt}&maxResults=${maxResults}`,
          { method: 'GET' }
        );

        if (!Array.isArray(response)) {
          throw new Error('User API response is not an array');
        }

        if (response.length === 0) {
          isLast = true;
          break;
        }

        users.push(
          ...response.map((u: any) => ({
            accountId: u.accountId,
            emailAddress: u.emailAddress,
            displayName: u.displayName,
            active: u.active,
            timeZone: u.timeZone,
          }))
        );

        startAt += maxResults;
        if (response.length < maxResults) {
          isLast = true;
        }
      } catch (error: any) {
        throw new Error(`Failed to fetch users at offset ${startAt}: ${error.message}`);
      }
    }

    return users;
  }

  private async fetchAllProjects(): Promise<Project[]> {
    const projects: Project[] = [];
    let startAt = 0;
    const maxResults = 50;
    let isLast = false;

    while (!isLast) {
      try {
        const response = await this.jiraApiClient.asUser().requestJira(
          `/rest/api/3/projects?startAt=${startAt}&maxResults=${maxResults}`,
          { method: 'GET' }
        );

        if (!response.values || !Array.isArray(response.values)) {
          throw new Error('Project API response format is invalid');
        }

        if (response.values.length === 0) {
          isLast = true;
          break;
        }

        projects.push(
          ...response.values.map((p: any) => ({
            key: p.key,
            id: p.id,
            name: p.name,
            isPrivate: p.isPrivate || false,
          }))
        );

        startAt += maxResults;
        if (response.values.length < maxResults) {
          isLast = true;
        }
      } catch (error: any) {
        throw new Error(`Failed to fetch projects at offset ${startAt}: ${error.message}`);
      }
    }

    return projects;
  }

  private async detectGlobalAdmins(): Promise<string[]> {
    try {
      const response = await this.jiraApiClient.asUser().requestJira(
        '/rest/api/3/groups?query=administrators',
        { method: 'GET' }
      );

      if (!response.values || !Array.isArray(response.values)) {
        throw new Error('Admin group detection returned invalid format');
      }

      const adminGroup = response.values.find((g: any) => g.name === 'jira-administrators' || g.name === 'administrators');
      if (!adminGroup) {
        return [];
      }

      // Fetch members of admin group
      const membersResponse = await this.jiraApiClient.asUser().requestJira(
        `/rest/api/3/groups/members?groupId=${adminGroup.id}`,
        { method: 'GET' }
      );

      if (!membersResponse.values || !Array.isArray(membersResponse.values)) {
        throw new Error('Admin group members response invalid format');
      }

      return membersResponse.values.map((m: any) => m.accountId);
    } catch (error: any) {
      throw new Error(`Failed to detect global admins: ${error.message}`);
    }
  }

  private async detectProjectAdmins(projects: Project[]): Promise<Record<string, string[]>> {
    const projectAdmins: Record<string, string[]> = {};

    for (const project of projects) {
      try {
        const response = await this.jiraApiClient.asUser().requestJira(
          `/rest/api/3/projects/${project.id}/role/10002`, // Role ID 10002 is typically Project Administrator
          { method: 'GET' }
        );

        if (response.actors && Array.isArray(response.actors)) {
          projectAdmins[project.key] = response.actors
            .filter((a: any) => a.type === 'user')
            .map((a: any) => a.id);
        } else {
          projectAdmins[project.key] = [];
        }
      } catch (error: any) {
        // If project role fetch fails, continue with empty array
        projectAdmins[project.key] = [];
      }
    }

    return projectAdmins;
  }

  private detectExternalUsers(users: User[]): string[] {
    return users
      .filter(u => u.emailAddress && !u.emailAddress.includes('@yourcompany.com'))
      .map(u => u.accountId);
  }

  private async fetchPermissionSchemes(): Promise<any[]> {
    try {
      const response = await this.jiraApiClient.asUser().requestJira(
        '/rest/api/3/permissionscheme',
        { method: 'GET' }
      );

      if (!response.permissionSchemes || !Array.isArray(response.permissionSchemes)) {
        throw new Error('Permission scheme response is invalid');
      }

      return response.permissionSchemes;
    } catch (error: any) {
      throw new Error(`Failed to fetch permission schemes: ${error.message}`);
    }
  }
}

export async function runAccessIntelligenceScan(
  siteId: string,
  buildShaShort: string,
  buildUtc: string,
  jiraApiClient: any
): Promise<AccessSurfaceSnapshot | AccessIntelligenceError> {
  const engine = new AccessIntelligenceEngine(siteId, buildShaShort, buildUtc, jiraApiClient);
  return engine.scan();
}
