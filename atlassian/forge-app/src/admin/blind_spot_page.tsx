/**
 * PHASE 9.5-B: BLIND-SPOT MAP ADMIN UI
 *
 * Admin page component for visualizing historical blind spots.
 * Shows time ranges where governance evidence is missing.
 *
 * Displays:
 * - Timeline view (visual)
 * - Table view (detailed)
 * - Blind spot periods with reason codes
 * - Coverage percentage
 * - Tooltips explaining each reason code
 */

import React, { useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface BlindSpotPeriod {
  start_time: string;
  end_time: string;
  reason: 'not_installed' | 'permission_missing' | 'snapshot_failed' | 'unknown';
  reason_description: string;
  duration_days: number;
  severity: 'critical' | 'high' | 'medium';
}

export interface BlindSpotMap {
  tenant_id: string;
  computed_at: string;
  analysis_start: string;
  analysis_end: string;
  blind_spot_periods: BlindSpotPeriod[];
  total_blind_days: number;
  coverage_percentage: number;
  canonical_hash: string;
  schema_version: string;
}

// ============================================================================
// COLOR & ICON MAPPINGS
// ============================================================================

const SEVERITY_COLORS = {
  critical: '#d32f2f', // Red
  high: '#f57c00',     // Orange
  medium: '#fbc02d',   // Yellow
};

const REASON_COLORS = {
  not_installed: '#bdbdbd',  // Grey - no install
  permission_missing: '#f57c00', // Orange - permission issue
  snapshot_failed: '#d32f2f',    // Red - failed execution
  unknown: '#9c27b0',            // Purple - unknown cause
};

const REASON_TOOLTIPS = {
  not_installed: 'FirstTry was not installed during this period. No governance evidence was captured.',
  permission_missing: 'Insufficient Jira permissions to capture snapshots during this period.',
  snapshot_failed: 'FirstTry snapshot execution failed during this period. No governance evidence was captured.',
  unknown: 'No governance evidence available for this period. Reason not explicitly determined.',
};

// ============================================================================
// TIMELINE VIEW COMPONENT
// ============================================================================

/**
 * Timeline visualization of blind spots over time
 */
export function BlindSpotTimeline(props: {
  blindSpotMap: BlindSpotMap;
}) {
  const { blindSpotMap } = props;

  const analysisStart = new Date(blindSpotMap.analysis_start);
  const analysisEnd = new Date(blindSpotMap.analysis_end);
  const totalDays = (analysisEnd.getTime() - analysisStart.getTime()) / (1000 * 60 * 60 * 24);

  return (
    <div style={styles.timelineContainer}>
      <div style={styles.timelineLabel}>
        <strong>Timeline ({blindSpotMap.coverage_percentage.toFixed(1)}% Coverage)</strong>
      </div>

      <div style={styles.timelineBar}>
        {blindSpotMap.blind_spot_periods.map((period, idx) => {
          const periodStart = new Date(period.start_time);
          const periodEnd = new Date(period.end_time);

          // Calculate position and width
          const daysFromStart =
            (periodStart.getTime() - analysisStart.getTime()) / (1000 * 60 * 60 * 24);
          const left = (daysFromStart / totalDays) * 100;
          const width = (period.duration_days / totalDays) * 100;

          return (
            <div
              key={idx}
              style={{
                ...styles.timelineSegment,
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: REASON_COLORS[period.reason],
                cursor: 'pointer',
                title: REASON_TOOLTIPS[period.reason],
              }}
              title={REASON_TOOLTIPS[period.reason]}
            />
          );
        })}
      </div>

      <div style={styles.timelineAxis}>
        <span>{analysisStart.toLocaleDateString()}</span>
        <span>{analysisEnd.toLocaleDateString()}</span>
      </div>
    </div>
  );
}

// ============================================================================
// TABLE VIEW COMPONENT
// ============================================================================

/**
 * Detailed table view of blind spots
 */
export function BlindSpotTable(props: {
  blindSpotMap: BlindSpotMap;
}) {
  const { blindSpotMap } = props;

  return (
    <div style={styles.tableContainer}>
      <table style={styles.table}>
        <thead>
          <tr style={styles.tableHeaderRow}>
            <th style={styles.tableHeader}>Start Time</th>
            <th style={styles.tableHeader}>End Time</th>
            <th style={styles.tableHeader}>Duration (Days)</th>
            <th style={styles.tableHeader}>Reason</th>
            <th style={styles.tableHeader}>Severity</th>
            <th style={styles.tableHeader}>Description</th>
          </tr>
        </thead>
        <tbody>
          {blindSpotMap.blind_spot_periods.map((period, idx) => (
            <tr key={idx} style={styles.tableRow}>
              <td style={styles.tableCell}>
                {new Date(period.start_time).toLocaleString()}
              </td>
              <td style={styles.tableCell}>
                {new Date(period.end_time).toLocaleString()}
              </td>
              <td style={styles.tableCell}>{period.duration_days.toFixed(2)}</td>
              <td style={styles.tableCell}>
                <ReasonBadge reason={period.reason} />
              </td>
              <td style={styles.tableCell}>
                <SeverityBadge severity={period.severity} />
              </td>
              <td style={{ ...styles.tableCell, fontSize: '0.9em' }}>
                <span title={REASON_TOOLTIPS[period.reason]}>
                  {period.reason_description}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// BADGE COMPONENTS
// ============================================================================

function ReasonBadge(props: { reason: string }) {
  const { reason } = props;

  const labels = {
    not_installed: 'Not Installed',
    permission_missing: 'Permission Issue',
    snapshot_failed: 'Snapshot Failed',
    unknown: 'Unknown',
  };

  return (
    <span
      style={{
        ...styles.badge,
        backgroundColor: REASON_COLORS[reason as keyof typeof REASON_COLORS],
        color: '#fff',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.85em',
      }}
      title={REASON_TOOLTIPS[reason as keyof typeof REASON_TOOLTIPS]}
    >
      {labels[reason as keyof typeof labels] || reason}
    </span>
  );
}

function SeverityBadge(props: { severity: string }) {
  const { severity } = props;

  const labels = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
  };

  return (
    <span
      style={{
        ...styles.badge,
        backgroundColor: SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS],
        color: '#fff',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.85em',
      }}
    >
      {labels[severity as keyof typeof labels] || severity}
    </span>
  );
}

// ============================================================================
// SUMMARY CARD COMPONENT
// ============================================================================

/**
 * Summary statistics card
 */
export function BlindSpotSummary(props: {
  blindSpotMap: BlindSpotMap;
}) {
  const { blindSpotMap } = props;

  const criticalCount = blindSpotMap.blind_spot_periods.filter(
    (p) => p.severity === 'critical'
  ).length;
  const highCount = blindSpotMap.blind_spot_periods.filter((p) => p.severity === 'high').length;
  const mediumCount = blindSpotMap.blind_spot_periods.filter(
    (p) => p.severity === 'medium'
  ).length;

  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryRow}>
        <div style={styles.summaryItem}>
          <div style={styles.summaryLabel}>Coverage</div>
          <div style={styles.summaryValue}>
            {blindSpotMap.coverage_percentage.toFixed(1)}%
          </div>
        </div>

        <div style={styles.summaryItem}>
          <div style={styles.summaryLabel}>Total Blind Days</div>
          <div style={styles.summaryValue}>{blindSpotMap.total_blind_days.toFixed(1)}</div>
        </div>

        <div style={styles.summaryItem}>
          <div style={styles.summaryLabel}>Blind Spot Periods</div>
          <div style={styles.summaryValue}>{blindSpotMap.blind_spot_periods.length}</div>
        </div>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.severityItem}>
          <span style={{ color: SEVERITY_COLORS.critical, fontWeight: 'bold' }}>
            ● Critical: {criticalCount}
          </span>
        </div>
        <div style={styles.severityItem}>
          <span style={{ color: SEVERITY_COLORS.high, fontWeight: 'bold' }}>
            ● High: {highCount}
          </span>
        </div>
        <div style={styles.severityItem}>
          <span style={{ color: SEVERITY_COLORS.medium, fontWeight: 'bold' }}>
            ● Medium: {mediumCount}
          </span>
        </div>
      </div>

      <div style={styles.summaryMetadata}>
        <small>Computed at {new Date(blindSpotMap.computed_at).toLocaleString()}</small>
        <br />
        <small>Hash: {blindSpotMap.canonical_hash.substring(0, 16)}...</small>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN ADMIN PAGE COMPONENT
// ============================================================================

/**
 * Full blind-spot admin page
 */
export function BlindSpotAdminPage(props: {
  blindSpotMap: BlindSpotMap;
}) {
  const { blindSpotMap } = props;
  const [activeTab, setActiveTab] = useState<'timeline' | 'table'>('timeline');

  return (
    <div style={styles.pageContainer}>
      <div style={styles.header}>
        <h1>Historical Blind-Spot Map</h1>
        <p>
          Time ranges where governance evidence is missing, and the reason why.
        </p>
      </div>

      <BlindSpotSummary blindSpotMap={blindSpotMap} />

      <div style={styles.tabContainer}>
        <button
          style={{
            ...styles.tabButton,
            borderBottom: activeTab === 'timeline' ? '2px solid #1976d2' : 'none',
          }}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline View
        </button>
        <button
          style={{
            ...styles.tabButton,
            borderBottom: activeTab === 'table' ? '2px solid #1976d2' : 'none',
          }}
          onClick={() => setActiveTab('table')}
        >
          Table View
        </button>
      </div>

      {activeTab === 'timeline' && <BlindSpotTimeline blindSpotMap={blindSpotMap} />}
      {activeTab === 'table' && <BlindSpotTable blindSpotMap={blindSpotMap} />}

      <div style={styles.legend}>
        <h3>Reason Codes</h3>
        <div style={styles.legendGrid}>
          {Object.entries(REASON_COLORS).map(([reason, color]) => (
            <div key={reason} style={styles.legendItem}>
              <span
                style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  backgroundColor: color,
                  marginRight: '8px',
                  borderRadius: '2px',
                }}
              />
              <strong>{reason}:</strong> {REASON_TOOLTIPS[reason as keyof typeof REASON_TOOLTIPS]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles: { [key: string]: React.CSSProperties } = {
  pageContainer: {
    padding: '24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#333',
  },
  header: {
    marginBottom: '32px',
  },
  summaryCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    backgroundColor: '#f5f5f5',
  },
  summaryRow: {
    display: 'flex',
    gap: '24px',
    marginBottom: '16px',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: '0.9em',
    color: '#666',
    marginBottom: '4px',
  },
  summaryValue: {
    fontSize: '1.8em',
    fontWeight: 'bold',
    color: '#1976d2',
  },
  severityItem: {
    flex: 1,
    fontSize: '0.95em',
  },
  summaryMetadata: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #ddd',
    color: '#999',
  },
  tabContainer: {
    display: 'flex',
    borderBottom: '1px solid #ddd',
    marginBottom: '16px',
  },
  tabButton: {
    padding: '12px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '1em',
    fontWeight: '500',
  },
  timelineContainer: {
    marginBottom: '32px',
  },
  timelineLabel: {
    marginBottom: '12px',
    fontSize: '1.1em',
  },
  timelineBar: {
    display: 'flex',
    height: '40px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px',
    position: 'relative',
  },
  timelineSegment: {
    position: 'absolute',
    height: '100%',
    opacity: 0.8,
  },
  timelineAxis: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9em',
    color: '#666',
  },
  tableContainer: {
    overflowX: 'auto',
    marginBottom: '32px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    border: '1px solid #ddd',
  },
  tableHeaderRow: {
    backgroundColor: '#f5f5f5',
  },
  tableHeader: {
    padding: '12px',
    textAlign: 'left',
    fontWeight: 'bold',
    borderBottom: '2px solid #ddd',
    fontSize: '0.95em',
  },
  tableRow: {
    borderBottom: '1px solid #eee',
  },
  tableCell: {
    padding: '12px',
    fontSize: '0.95em',
  },
  badge: {
    display: 'inline-block',
  },
  legend: {
    marginTop: '32px',
    padding: '16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
  },
  legendGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '16px',
  },
  legendItem: {
    fontSize: '0.95em',
  },
};
