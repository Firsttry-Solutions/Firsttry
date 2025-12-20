/**
 * Phase 9.5-F: Silence-as-Success Indicator UI
 *
 * React admin UI component for displaying silence indicator badge.
 * Subtle, informational design. No risk colors. Read-only.
 *
 * "FirstTry operating normally" vs "Issues detected"
 */

import React, { useMemo } from 'react';
import {
  SilenceIndicatorReport,
  SilenceTimeline,
  createSilenceIndicatorReport,
  renderSilenceIndicatorHtml,
  renderSilenceTimelineHtml,
  generateSilenceIndicatorReport,
  exportSilenceIndicatorJson,
} from '../phase9_5f/silence_indicator';

/**
 * Main silence indicator badge component
 * Displays current status: "FirstTry operating normally" or "Issues detected"
 *
 * Minimal, informational design - no action buttons
 */
export interface SilenceIndicatorBadgeProps {
  snapshotSuccessRate: number;      // 0-100
  pendingFailures: number;
  activeAlerts: number;
  lastStateChange?: string;
  lastSilenceStart?: string;
  tenantId: string;
}

export const SilenceIndicatorBadge: React.FC<SilenceIndicatorBadgeProps> = ({
  snapshotSuccessRate,
  pendingFailures,
  activeAlerts,
  lastStateChange,
  lastSilenceStart,
  tenantId,
}) => {
  const report = useMemo(
    () =>
      createSilenceIndicatorReport({
        tenant_id: tenantId,
        recent_snapshot_count: 100, // For display purposes
        recent_snapshot_success_count: Math.round((snapshotSuccessRate / 100) * 100),
        pending_failures: pendingFailures,
        active_alerts: activeAlerts,
        last_state_change_timestamp: lastStateChange,
        last_silence_start_timestamp: lastSilenceStart,
      }),
    [snapshotSuccessRate, pendingFailures, activeAlerts, lastStateChange, lastSilenceStart, tenantId]
  );

  const isOperatingNormally = report.indicator_state === 'operating_normally';
  const bgColor = isOperatingNormally ? '#f0f4f8' : '#fff7e6';
  const textColor = isOperatingNormally ? '#0052cc' : '#974f0c';
  const icon = isOperatingNormally ? '✓' : '⚠';

  return (
    <div
      className="silence-indicator-badge"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '13px',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        border: '1px solid rgba(0, 0, 0, 0.1)',
      }}
    >
      <span className="silence-indicator-icon" style={{ fontSize: '16px' }}>
        {icon}
      </span>
      <span className="silence-indicator-message">{report.message}</span>
    </div>
  );
};

/**
 * Silence indicator card component
 * Shows status + conditions + metrics
 *
 * Read-only display (no action buttons)
 */
export interface SilenceIndicatorCardProps {
  snapshotSuccessRate: number;
  pendingFailures: number;
  activeAlerts: number;
  recentSnapshotCount: number;
  recentSnapshotSuccessCount: number;
  lastStateChange?: string;
  lastSilenceStart?: string;
  tenantId: string;
  onExportJson?: (json: Record<string, any>) => void;
  onExportReport?: (report: string) => void;
}

export const SilenceIndicatorCard: React.FC<SilenceIndicatorCardProps> = ({
  snapshotSuccessRate,
  pendingFailures,
  activeAlerts,
  recentSnapshotCount,
  recentSnapshotSuccessCount,
  lastStateChange,
  lastSilenceStart,
  tenantId,
  onExportJson,
  onExportReport,
}) => {
  const report = useMemo(
    () =>
      createSilenceIndicatorReport({
        tenant_id: tenantId,
        recent_snapshot_count: recentSnapshotCount,
        recent_snapshot_success_count: recentSnapshotSuccessCount,
        pending_failures: pendingFailures,
        active_alerts: activeAlerts,
        last_state_change_timestamp: lastStateChange,
        last_silence_start_timestamp: lastSilenceStart,
      }),
    [
      snapshotSuccessRate,
      pendingFailures,
      activeAlerts,
      recentSnapshotCount,
      recentSnapshotSuccessCount,
      lastStateChange,
      lastSilenceStart,
      tenantId,
    ]
  );

  const isOperatingNormally = report.indicator_state === 'operating_normally';
  const bgColor = isOperatingNormally ? '#f0f4f8' : '#fff7e6';
  const textColor = isOperatingNormally ? '#0052cc' : '#974f0c';
  const icon = isOperatingNormally ? '✓' : '⚠';

  const handleExportJson = () => {
    if (onExportJson) {
      onExportJson(exportSilenceIndicatorJson(report));
    }
  };

  const handleExportReport = () => {
    if (onExportReport) {
      onExportReport(generateSilenceIndicatorReport(report));
    }
  };

  return (
    <div
      className="silence-indicator-card"
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: '#ffffff',
        marginBottom: '16px',
      }}
    >
      {/* Header with status badge */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h3 style={{ margin: '0', fontSize: '16px', fontWeight: 600, color: '#161b22' }}>
            FirstTry System Status
          </h3>
        </div>

        <div
          style={{
            backgroundColor: bgColor,
            color: textColor,
            padding: '12px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: '18px' }}>{icon}</span>
          <span>{report.message}</span>
        </div>
      </div>

      {/* Conditions table */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: '#161b22' }}>
          Conditions
        </h4>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  padding: '8px',
                  borderBottom: '1px solid #e5e7eb',
                  color: '#161b22',
                  fontWeight: 500,
                }}
              >
                Snapshots Succeeding (≥95%)
              </td>
              <td
                style={{
                  padding: '8px',
                  borderBottom: '1px solid #e5e7eb',
                  textAlign: 'right',
                  color: report.conditions.snapshots_succeeding ? '#2d6a4f' : '#ae2e24',
                }}
              >
                {report.conditions.snapshots_succeeding ? '✓ Yes' : '✗ No'}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: '8px',
                  borderBottom: '1px solid #e5e7eb',
                  color: '#161b22',
                  fontWeight: 500,
                }}
              >
                No Failures Pending
              </td>
              <td
                style={{
                  padding: '8px',
                  borderBottom: '1px solid #e5e7eb',
                  textAlign: 'right',
                  color: report.conditions.no_failures_pending ? '#2d6a4f' : '#ae2e24',
                }}
              >
                {report.conditions.no_failures_pending ? '✓ Yes' : '✗ No'}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: '8px',
                  borderBottom: '1px solid #e5e7eb',
                  color: '#161b22',
                  fontWeight: 500,
                }}
              >
                No Alerts Triggered
              </td>
              <td
                style={{
                  padding: '8px',
                  borderBottom: '1px solid #e5e7eb',
                  textAlign: 'right',
                  color: report.conditions.no_alerts_triggered ? '#2d6a4f' : '#ae2e24',
                }}
              >
                {report.conditions.no_alerts_triggered ? '✓ Yes' : '✗ No'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Metrics */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: '#161b22' }}>
          Metrics
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            fontSize: '12px',
          }}
        >
          <div>
            <div style={{ color: '#626f86', marginBottom: '4px' }}>Snapshots Assessed</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#161b22' }}>
              {report.recent_snapshot_success_count}/{report.recent_snapshot_count}
            </div>
          </div>
          <div>
            <div style={{ color: '#626f86', marginBottom: '4px' }}>Success Rate</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#161b22' }}>
              {report.snapshot_success_rate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div style={{ color: '#626f86', marginBottom: '4px' }}>Pending Failures</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#161b22' }}>
              {report.pending_failures}
            </div>
          </div>
          <div>
            <div style={{ color: '#626f86', marginBottom: '4px' }}>Active Alerts</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#161b22' }}>
              {report.active_alerts}
            </div>
          </div>
        </div>
      </div>

      {/* Silence duration (if operating normally) */}
      {isOperatingNormally && report.silence_duration_seconds !== undefined && (
        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0f4f8', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: '#626f86', marginBottom: '4px' }}>
            Operating Normally For
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#0052cc' }}>
            {formatDuration(report.silence_duration_seconds)}
          </div>
        </div>
      )}

      {/* Export buttons (read-only, no modifications) */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        {onExportJson && (
          <button
            onClick={handleExportJson}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              backgroundColor: '#f0f4f8',
              color: '#0052cc',
              border: '1px solid #dfe1e6',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Export JSON
          </button>
        )}
        {onExportReport && (
          <button
            onClick={handleExportReport}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              backgroundColor: '#f0f4f8',
              color: '#0052cc',
              border: '1px solid #dfe1e6',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Export Report
          </button>
        )}
      </div>

      {/* Timestamp */}
      <div
        style={{
          marginTop: '12px',
          fontSize: '11px',
          color: '#626f86',
          borderTop: '1px solid #e5e7eb',
          paddingTop: '12px',
        }}
      >
        <strong>Status as of:</strong> {new Date(report.timestamp).toLocaleString()}
      </div>
    </div>
  );
};

/**
 * Silence indicator summary component
 * Minimal badge suitable for dashboards
 */
export const SilenceIndicatorSummary: React.FC<SilenceIndicatorBadgeProps> = (props) => {
  return <SilenceIndicatorBadge {...props} />;
};

/**
 * Helper: format duration in seconds to readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? '' : 's'}`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return `${days}d ${remainingHours}h`;
}
