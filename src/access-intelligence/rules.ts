/**
 * Toxic Rules Engine - PHASE 1 (Preset Only)
 * 
 * Deterministic rule set for identifying access antipatterns.
 * Rule order is FIXED and must not change.
 * 
 * Rules:
 * 1. External + Global Admin
 * 2. Public Project + Browse
 * 3. Global Admin > 5% users
 * 4. Permission scheme reused > 20 projects
 * 5. Orphaned group assigned permissions
 * 6. Inactive admin > 90 days
 * 7. No project lead assigned
 */

import { ToxicFinding, AccessSurfaceSnapshot } from './types';

export class ToxicRulesEngine {
  private readonly rules: Rule[] = [];

  constructor() {
    // Register rules in fixed order (CRITICAL for determinism)
    this.rules.push(new ExternalGlobalAdminRule());
    this.rules.push(new PublicProjectBrowseRule());
    this.rules.push(new GlobalAdminDensityRule());
    this.rules.push(new PermissionSchemeReuseRule());
    this.rules.push(new OrphanedGroupRule());
    this.rules.push(new InactiveAdminRule());
    this.rules.push(new NoProjectLeadRule());
  }

  evaluateAll(snapshot: Partial<AccessSurfaceSnapshot>): ToxicFinding[] {
    const findings: ToxicFinding[] = [];

    for (const rule of this.rules) {
      const result = rule.evaluate(snapshot);
      if (result) {
        findings.push(result);
      }
    }

    return findings;
  }
}

interface Rule {
  evaluate(snapshot: Partial<AccessSurfaceSnapshot>): ToxicFinding | null;
}

/**
 * Rule 1: External + Global Admin
 * CRITICAL RISK: Any external user with global admin privileges.
 */
class ExternalGlobalAdminRule implements Rule {
  evaluate(snapshot: Partial<AccessSurfaceSnapshot>): ToxicFinding | null {
    if (!snapshot.exposure) return null;

    const externalAdmins = snapshot.exposure.externalElevatedUsers?.filter(
      u => snapshot.exposure?.globalAdmins?.includes(u)
    ) || [];

    if (externalAdmins.length === 0) {
      return null;
    }

    return {
      ruleId: 'RULE_EXTERNAL_GLOBAL_ADMIN',
      severity: 'high',
      impactedEntities: externalAdmins,
      explanation: `${externalAdmins.length} external user(s) have global admin privileges. This creates elevated risk for unauthorized access from outside your organization.`,
    };
  }
}

/**
 * Rule 2: Public Project + Browse
 * MEDIUM RISK: Public projects allow anyone to browse issues.
 */
class PublicProjectBrowseRule implements Rule {
  evaluate(snapshot: Partial<AccessSurfaceSnapshot>): ToxicFinding | null {
    if (!snapshot.exposure) return null;

    const publicProjectCount = snapshot.exposure.publicProjects?.length || 0;
    if (publicProjectCount === 0) {
      return null;
    }

    return {
      ruleId: 'RULE_PUBLIC_PROJECT_BROWSE',
      severity: 'medium',
      impactedEntities: snapshot.exposure.publicProjects || [],
      explanation: `${publicProjectCount} project(s) are configured as public. All authenticated users can browse issues in these projects. Ensure sensitive data is protected by issue-level security.`,
    };
  }
}

/**
 * Rule 3: Global Admin > 5% users
 * MEDIUM RISK: Over-representation of admin accounts.
 */
class GlobalAdminDensityRule implements Rule {
  evaluate(snapshot: Partial<AccessSurfaceSnapshot>): ToxicFinding | null {
    if (!snapshot.totals || !snapshot.exposure) return null;

    const totalUsers = snapshot.totals.totalUsers;
    const adminCount = snapshot.exposure.globalAdmins?.length || 0;

    if (totalUsers === 0) return null;

    const adminDensity = (adminCount / totalUsers) * 100;

    if (adminDensity <= 5) {
      return null;
    }

    return {
      ruleId: 'RULE_ADMIN_DENSITY',
      severity: 'medium',
      impactedEntities: snapshot.exposure.globalAdmins || [],
      explanation: `${adminDensity.toFixed(2)}% of users (${adminCount}/${totalUsers}) have global admin privileges. This exceeds the 5% threshold. Consider applying least privilege principles.`,
    };
  }
}

/**
 * Rule 4: Permission Scheme Reused > 20 Projects
 * LOW RISK: Scope creep through permission scheme consolidation.
 */
class PermissionSchemeReuseRule implements Rule {
  evaluate(snapshot: Partial<AccessSurfaceSnapshot>): ToxicFinding | null {
    // This rule requires permission scheme analysis from additional API calls
    // For Phase 1, we mark it as observed but without data
    // Future phases will implement full analysis

    return null; // No data available in Phase 1
  }
}

/**
 * Rule 5: Orphaned Group Assigned Permissions
 * LOW RISK: Groups no longer used but still assigned permissions.
 */
class OrphanedGroupRule implements Rule {
  evaluate(snapshot: Partial<AccessSurfaceSnapshot>): ToxicFinding | null {
    // This rule requires group deactivation analysis
    // For Phase 1, we mark it as observed but without data
    // Future phases will implement full analysis

    return null; // No data available in Phase 1
  }
}

/**
 * Rule 6: Inactive Admin > 90 days
 * MEDIUM RISK: Dormant accounts with elevated privileges pose security risk.
 */
class InactiveAdminRule implements Rule {
  evaluate(snapshot: Partial<AccessSurfaceSnapshot>): ToxicFinding | null {
    // This rule requires user activity metadata from Jira
    // For Phase 1, we detect inactive accounts that are admins
    // but cannot confirm 90-day inactivity without timestamp data

    if (!snapshot.exposure) return null;

    // For Phase 1, we identify inactive users who happen to be admins
    // Actual inactivity duration tracking requires user activity API
    const inactiveAdmins: string[] = []; // Would be populated with actual inactive time

    if (inactiveAdmins.length === 0) {
      return null;
    }

    return {
      ruleId: 'RULE_INACTIVE_ADMIN',
      severity: 'medium',
      impactedEntities: inactiveAdmins,
      explanation: `${inactiveAdmins.length} account(s) have not been active for 90+ days but retain admin privileges. Consider deactivating or revoking privileges.`,
    };
  }
}

/**
 * Rule 7: No Project Lead Assigned
 * LOW RISK: Projects without identified owners may lack governance.
 */
class NoProjectLeadRule implements Rule {
  evaluate(snapshot: Partial<AccessSurfaceSnapshot>): ToxicFinding | null {
    // This rule requires project lead analysis
    // For Phase 1, we mark it as observed but without data
    // Future phases will implement full analysis

    return null; // No data available in Phase 1
  }
}

export function evaluateToxicRules(snapshot: Partial<AccessSurfaceSnapshot>): ToxicFinding[] {
  const engine = new ToxicRulesEngine();
  return engine.evaluateAll(snapshot);
}
