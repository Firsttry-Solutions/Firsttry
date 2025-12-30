/**
 * PHASE-9: PROCUREMENT PACKET
 *
 * Generates procurement-grade evidence packets for marketplace/security review.
 *
 * Includes:
 * - Exact data handling practices (not aspirational)
 * - Jira API scope declarations
 * - Determinism proof reference
 * - Missing-data disclosure
 * - Historical blind spot notice
 * - Retention policy
 * - Uninstall behavior
 * - Counterfactual proof ledger (Phase 9.5-A)
 *
 * This is the single source of truth for product capabilities.
 */

import { createHash } from 'crypto';
import type { CounterfactualProof } from '../phase9_5a/counterfactual_ledger';

/**
 * Procurement Packet: Factual product capabilities
 */
export interface ProcurementPacket {
  packet_id: string;
  tenant_id: string;
  cloud_id: string;
  generated_at: string;
  schema_version: string;

  // Data Handling (FACTUAL)
  data_handling: DataHandling;

  // Determinism Proof Reference
  determinism_proof: DeterminismProof;

  // Missing Data Disclosure
  missing_data_disclosure: MissingDataDisclosure;

  // Historical Context
  historical_blind_spots: HistoricalBlindSpot[];

  // Counterfactual Proof Ledger (Phase 9.5-A)
  counterfactual_proof?: CounterfactualProof;

  // Canonical Hash (for integrity)
  packet_hash?: string;
}

export interface DataHandling {
  // Exact list of data collected (no "might", "could", "may")
  collected_data: string[];

  // Exact list of data NEVER collected (explicit exclusions)
  never_collected: string[];

  // Where data lives
  storage_location: string;

  // How long it's kept
  retention_policy: string;

  // What happens on uninstall
  uninstall_behavior: string;

  // Jira API scopes used (exact scopes from manifest)
  jira_scopes_used: string[];

  // Read-only guarantees
  read_only_guarantees: string[];

  // API rate limit behavior
  rate_limit_behavior: string;

  // When collection started (to disclose blind spots)
  recording_started_at?: string;
}

export interface DeterminismProof {
  // Reference to canonicalization spec
  canonicalization_spec: string;

  // Reference to determinism test
  determinism_test_location: string;

  // Statement of guarantee
  guarantee: string;

  // How to verify
  verification_method: string;
}

export interface MissingDataDisclosure {
  // What we don't have for each metric
  metric_gaps: MetricGap[];

  // Conditions that cause NOT_AVAILABLE
  not_available_conditions: string[];

  // What would improve metric quality
  data_requirements: string[];
}

export interface MetricGap {
  metric: string;
  available_when: string;
  not_available_when: string;
}

export interface HistoricalBlindSpot {
  metric: string;
  blind_spot_description: string;
  starts_recording_after: string;
}

/**
 * Create procurement packet for a tenant
 */
export function createProcurementPacket(
  tenantId: string,
  cloudId: string,
  recordingStartedAt?: string,
  counterfactualProof?: CounterfactualProof
): ProcurementPacket {
  const packet: ProcurementPacket = {
    packet_id: generateUUID(),
    tenant_id: tenantId,
    cloud_id: cloudId,
    generated_at: new Date().toISOString().split('T')[0] + 'T' + new Date().toISOString().split('T')[1].split('.')[0] + 'Z',
    schema_version: '9.0',

    data_handling: {
      collected_data: [
        'Jira issue keys (e.g., PROJ-123)',
        'Jira issue summary (title only)',
        'Configuration field names (e.g., "Custom Field X")',
        'Configuration field value types (not values)',
        'Field usage counts (per field, aggregated across projects)',
        'Configuration change timestamps (not change content)',
        'Project identifiers (not names)',
        'Automation rule names and enabled/disabled status',
        'Rule execution counts (anonymous)',
      ],
      never_collected: [
        'Issue descriptions or content',
        'Issue comments or discussion',
        'Attachment contents or file data',
        'User names or user IDs (Atlassian Cloud IDs)',
        'Custom field values (only field names)',
        'Custom JQL queries or filters',
        'Webhooks or notification content',
        'Audit log details',
        'Issue history or change records',
        'Permission schemes or security levels',
      ],
      storage_location: 'Atlassian Forge storage (encrypted at rest)',
      retention_policy: 'Retained until workspace uninstalls app. Deleted on uninstall (all records purged within 24 hours).',
      uninstall_behavior: 'All stored data deleted. No backups retained. No recovery available after deletion.',
      jira_scopes_used: [
        'read:jira-work (issue and project access)',
        'read:configuration:jira (configuration schemes)',
        'read:webhook:jira (webhook management)',
      ],
      read_only_guarantees: [
        'No modifications to Jira issues',
        'No modifications to projects',
        'No modifications to configurations',
        'No modification of permissions',
        'All API calls are read-only GET requests',
      ],
      rate_limit_behavior: 'Respects Jira Cloud rate limits (100 requests/minute). Backs off on 429 responses.',
      recording_started_at: recordingStartedAt,
    },

    determinism_proof: {
      canonicalization_spec: 'docs/CANONICALIZATION_SPEC.md',
      determinism_test_location: 'src/phase9/determinism.test.ts',
      guarantee: 'Same metrics run input always produces identical canonical hash. Verified by automated tests.',
      verification_method: 'Load any stored metrics_run, recompute canonical_hash, compare to stored value. Must match exactly.',
    },

    missing_data_disclosure: {
      metric_gaps: [
        {
          metric: 'M1 (Required Fields Never Used)',
          available_when: 'Usage logs present for time window',
          not_available_when: 'No usage data collected for period',
        },
        {
          metric: 'M2 (Inconsistent Field Usage)',
          available_when: 'Project usage data available',
          not_available_when: 'Usage gaps in projects',
        },
        {
          metric: 'M3 (Automation Execution Gap)',
          available_when: 'Execution logs present',
          not_available_when: 'No execution data recorded',
        },
        {
          metric: 'M4 (Configuration Churn)',
          available_when: 'Drift events recorded',
          not_available_when: 'No Phase-7 drift events',
        },
        {
          metric: 'M5 (Visibility Gap)',
          available_when: 'Always',
          not_available_when: 'Never',
        },
      ],
      not_available_conditions: [
        'MISSING_USAGE_DATA: No field usage logs for metric M1',
        'MISSING_PROJECT_USAGE_DATA: No per-project usage breakdown for M2',
        'MISSING_EXECUTION_LOGS: No automation execution records for M3',
        'MISSING_DRIFT_DATA: No Phase-7 drift events for M4',
      ],
      data_requirements: [
        'To improve M1: Enable and maintain field usage logging',
        'To improve M2: Ensure per-project usage tracking across all projects',
        'To improve M3: Enable automation rule execution logging',
        'To improve M4: Ensure Phase-7 drift detection is running',
        'M5: Always accurate (no dependencies)',
      ],
    },

    historical_blind_spots: [
      {
        metric: 'M1',
        blind_spot_description: 'Cannot compute for time before Phase-6 was enabled',
        starts_recording_after: 'Phase-6 first snapshot',
      },
      {
        metric: 'M2',
        blind_spot_description: 'Cannot compute for time before per-project usage data available',
        starts_recording_after: 'First usage aggregate for multiple projects',
      },
      {
        metric: 'M3',
        blind_spot_description: 'Cannot compute for time before execution logs captured',
        starts_recording_after: 'First automation rule execution recorded',
      },
      {
        metric: 'M4',
        blind_spot_description: 'Cannot compute for time before Phase-7 drift detection',
        starts_recording_after: 'Phase-7 first drift event',
      },
    ],

    // Counterfactual Proof Ledger (Phase 9.5-A) - optional if provided
    counterfactual_proof: counterfactualProof,
  };

  return packet;
}

/**
 * Canonicalize procurement packet for hashing
 */
function canonicalizeProcurementPacket(packet: ProcurementPacket): string {
  // Remove packet_hash before canonicalizing (circular ref prevention)
  const { packet_hash, ...forHashing } = packet;

  // Convert to canonical JSON (sorted keys, minimal whitespace)
  return JSON.stringify(forHashing, Object.keys(forHashing).sort(), 0);
}

/**
 * Generate canonical hash for packet (SHA-256)
 */
export function computeProcurementPacketHash(packet: ProcurementPacket): string {
  const canonical = canonicalizeProcurementPacket(packet);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Generate and hash procurement packet
 */
export function generateProcurementPacket(
  tenantId: string,
  cloudId: string,
  recordingStartedAt?: string
): ProcurementPacket {
  const packet = createProcurementPacket(tenantId, cloudId, recordingStartedAt);
  packet.packet_hash = computeProcurementPacketHash(packet);
  return packet;
}

/**
 * Verify procurement packet integrity
 */
export function verifyProcurementPacketHash(packet: ProcurementPacket): boolean {
  const storedHash = packet.packet_hash;
  if (!storedHash) return false;

  const recomputedHash = computeProcurementPacketHash(packet);
  return storedHash === recomputedHash;
}

/**
 * Export packet as JSON (for marketplace/security review)
 */
export function exportProcurementPacketJson(packet: ProcurementPacket): string {
  return JSON.stringify(packet, null, 2);
}

/**
 * Generate human-readable report from packet
 */
export function generateProcurementReport(packet: ProcurementPacket): string {
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    'PROCUREMENTGRADE EVIDENCE PACKET',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Generated: ${packet.generated_at}`,
    `Tenant: ${packet.tenant_id}`,
    `Cloud: ${packet.cloud_id}`,
    `Packet ID: ${packet.packet_id}`,
    '',
    '───────────────────────────────────────────────────────────────',
    'DATA HANDLING',
    '───────────────────────────────────────────────────────────────',
    '',
    '✓ DATA COLLECTED:',
  ];

  for (const data of packet.data_handling.collected_data) {
    lines.push(`  • ${data}`);
  }

  lines.push('');
  lines.push('✗ DATA NEVER COLLECTED:');
  for (const data of packet.data_handling.never_collected) {
    lines.push(`  • ${data}`);
  }

  lines.push('');
  lines.push('STORAGE:', `  ${packet.data_handling.storage_location}`);
  lines.push('');
  lines.push('RETENTION:', `  ${packet.data_handling.retention_policy}`);
  lines.push('');
  lines.push('UNINSTALL:', `  ${packet.data_handling.uninstall_behavior}`);
  lines.push('');

  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('JIRA API SCOPES USED');
  lines.push('───────────────────────────────────────────────────────────────');
  for (const scope of packet.data_handling.jira_scopes_used) {
    lines.push(`  • ${scope}`);
  }

  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('READ-ONLY GUARANTEES');
  lines.push('───────────────────────────────────────────────────────────────');
  for (const guarantee of packet.data_handling.read_only_guarantees) {
    lines.push(`  ✓ ${guarantee}`);
  }

  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('METRIC GAPS & MISSING DATA');
  lines.push('───────────────────────────────────────────────────────────────');
  for (const gap of packet.missing_data_disclosure.metric_gaps) {
    lines.push(`  ${gap.metric}`);
    lines.push(`    Available: ${gap.available_when}`);
    lines.push(`    Not Available: ${gap.not_available_when}`);
  }

  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('DETERMINISM PROOF');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`  Spec: ${packet.determinism_proof.canonicalization_spec}`);
  lines.push(`  Test: ${packet.determinism_proof.determinism_test_location}`);
  lines.push(`  Verify: ${packet.determinism_proof.verification_method}`);

  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('HISTORICAL BLIND SPOTS');
  lines.push('───────────────────────────────────────────────────────────────');
  for (const blindSpot of packet.historical_blind_spots) {
    lines.push(`  ${blindSpot.metric}: ${blindSpot.blind_spot_description}`);
    lines.push(`    Recording from: ${blindSpot.starts_recording_after}`);
  }

  // Counterfactual Proof Ledger section (Phase 9.5-A)
  if (packet.counterfactual_proof) {
    lines.push('');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('COUNTERFACTUAL PROOF LEDGER (Phase 9.5-A)');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`  FirstTry Installed: ${packet.counterfactual_proof.first_install_detected_at}`);
    lines.push(`  First Governance Evidence: ${packet.counterfactual_proof.first_snapshot_at}`);
    lines.push(`  First Drift Detected: ${packet.counterfactual_proof.first_drift_detected_at}`);
    lines.push(`  First Metrics Available: ${packet.counterfactual_proof.first_metrics_available_at}`);
    lines.push(`  Earliest Evidence Date: ${packet.counterfactual_proof.earliest_governance_evidence_at}`);
    lines.push('');
    lines.push('  Pre-install Gap:');
    lines.push(`    Exists: ${packet.counterfactual_proof.pre_install_gap.exists ? 'Yes' : 'No'}`);
    if (packet.counterfactual_proof.pre_install_gap.missing_permission_gaps.length > 0) {
      lines.push('    Missing Permissions:');
      for (const gap of packet.counterfactual_proof.pre_install_gap.missing_permission_gaps) {
        lines.push(`      • ${gap}`);
      }
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Generate UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
