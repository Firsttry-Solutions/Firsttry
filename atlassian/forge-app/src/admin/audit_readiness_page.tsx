/**
 * Phase 9.5-D: Audit Readiness Admin Page
 *
 * Displays audit readiness information in the admin interface.
 * Designed for procurement and audit teams.
 *
 * KEY RULE: Text only. No scores. No grades. Facts only.
 * The only metric displayed is: "X days of verifiable governance evidence"
 */

import React, { useMemo } from 'react';
import { view } from "@forge/ui";
import { AuditReadinessMap } from '../phase9_5d/audit_readiness';

interface AuditReadinessPageProps {
  auditReadinessMap: AuditReadinessMap;
  onExportJson?: () => void;
  onExportReport?: () => void;
}

/**
 * Main audit readiness admin page component.
 */
export const AuditReadinessAdminPage: React.FC<AuditReadinessPageProps> = ({
  auditReadinessMap,
  onExportJson,
  onExportReport,
}) => {
  return (
    <div className="audit-readiness-admin-page">
      <h1>Audit Readiness</h1>
      <p className="subtitle">
        Procurement-grade proof of audit defensibility over time.
      </p>

      <div className="tabs">
        <AuditReadinessSummaryCard map={auditReadinessMap} />
        <AuditReadinessDetailsCard map={auditReadinessMap} />
        <AuditReadinessExportCard
          onExportJson={onExportJson}
          onExportReport={onExportReport}
        />
      </div>
    </div>
  );
};

/**
 * Summary card: displays the core fact in prominent text.
 */
const AuditReadinessSummaryCard: React.FC<{ map: AuditReadinessMap }> = ({
  map,
}) => {
  const daysText = useMemo(() => {
    if (map.audit_coverage_duration_days === 1) {
      return '1 day';
    }
    return `${map.audit_coverage_duration_days} days`;
  }, [map.audit_coverage_duration_days]);

  return (
    <div className="audit-summary-card">
      <div className="summary-statement">
        <p className="main-text">
          An audit conducted today would have{' '}
          <strong className="emphasis">{daysText}</strong> of verifiable
          governance evidence.
        </p>
      </div>

      <div className="summary-stats">
        <div className="stat-item">
          <span className="stat-label">Audit Ready Since</span>
          <span className="stat-value">
            {map.audit_ready_since
              ? new Date(map.audit_ready_since).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'No evidence'}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Coverage of Lifecycle</span>
          <span className="stat-value">{map.audit_coverage_percentage}%</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Data Completeness</span>
          <span className="stat-value">{map.completeness_percentage}%</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Details card: shows supporting context and evidence sources.
 */
const AuditReadinessDetailsCard: React.FC<{ map: AuditReadinessMap }> = ({
  map,
}) => {
  const reasonText = {
    first_install: 'FirstTry installation date',
    first_snapshot: 'First successful snapshot run',
    first_evidence: 'First governance evidence recorded',
    no_evidence: 'No governance evidence available',
  }[map.audit_ready_reason];

  return (
    <div className="audit-details-card">
      <h3>Evidence Details</h3>

      <table className="details-table">
        <tbody>
          <tr>
            <td className="label">Evidence Start Reason</td>
            <td className="value">{reasonText}</td>
          </tr>
          <tr>
            <td className="label">FirstTry Installed</td>
            <td className="value">
              {new Date(map.first_install_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </td>
          </tr>
          {map.first_snapshot_at && (
            <tr>
              <td className="label">First Snapshot</td>
              <td className="value">
                {new Date(map.first_snapshot_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </td>
            </tr>
          )}
          {map.first_governance_evidence_at && (
            <tr>
              <td className="label">First Evidence (Phase 9.5-A)</td>
              <td className="value">
                {new Date(map.first_governance_evidence_at).toLocaleDateString(
                  'en-US',
                  {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  }
                )}
              </td>
            </tr>
          )}
          <tr>
            <td className="label">Current Date</td>
            <td className="value">
              {new Date(map.current_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </td>
          </tr>
        </tbody>
      </table>

      {map.missing_inputs && map.missing_inputs.length > 0 && (
        <div className="missing-data-note">
          <p>
            <strong>Note:</strong> Missing data: {map.missing_inputs.join(', ')}
          </p>
          <p>
            These missing inputs may affect completeness of this calculation.
          </p>
        </div>
      )}

      <div className="integrity-section">
        <h4>Data Integrity</h4>
        <div className="hash-display">
          <span className="hash-label">Canonical Hash (SHA-256):</span>
          <code className="hash-value">{map.canonical_hash}</code>
        </div>
        <p className="integrity-note">
          Use this hash to verify data integrity in storage.
        </p>
      </div>
    </div>
  );
};

/**
 * Export card: provides download options for audit/procurement teams.
 */
const AuditReadinessExportCard: React.FC<{
  onExportJson?: () => void;
  onExportReport?: () => void;
}> = ({ onExportJson, onExportReport }) => {
  return (
    <div className="audit-export-card">
      <h3>Export for Audit</h3>

      <div className="export-buttons">
        <button
          className="export-button json-button"
          onClick={onExportJson}
          title="Export audit readiness data as JSON"
        >
          📥 Export JSON
        </button>

        <button
          className="export-button report-button"
          onClick={onExportReport}
          title="Export audit readiness report as Markdown"
        >
          📄 Export Report
        </button>
      </div>

      <div className="export-info">
        <p>
          Use these exports for audit packets, procurement documentation, and
          SLA compliance reports.
        </p>
        <ul>
          <li>
            <strong>JSON:</strong> Machine-readable format for integration
          </li>
          <li>
            <strong>Report:</strong> Markdown format for documentation
          </li>
        </ul>
      </div>
    </div>
  );
};

/**
 * Standalone card component for audit readiness display.
 * Can be embedded in dashboards.
 */
export const AuditReadinessCard: React.FC<{ map: AuditReadinessMap }> = ({
  map,
}) => {
  const daysText = useMemo(() => {
    if (map.audit_coverage_duration_days === 1) {
      return '1 day';
    }
    return `${map.audit_coverage_duration_days} days`;
  }, [map.audit_coverage_duration_days]);

  return (
    <div className="audit-readiness-card">
      <div className="card-header">
        <h4>Audit Readiness</h4>
      </div>

      <div className="card-content">
        <p className="card-statement">
          An audit conducted today would have <strong>{daysText}</strong> of
          verifiable governance evidence.
        </p>

        <div className="card-metrics">
          <div className="metric">
            <span className="metric-value">
              {map.audit_coverage_percentage}%
            </span>
            <span className="metric-label">of Lifecycle</span>
          </div>

          <div className="metric">
            <span className="metric-value">
              {map.audit_ready_since
                ? new Date(map.audit_ready_since).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'N/A'}
            </span>
            <span className="metric-label">Ready Since</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Simple text summary for embedding in reports.
 */
export const AuditReadinessTextSummary: React.FC<{ map: AuditReadinessMap }> =
  ({ map }) => {
    const daysText =
      map.audit_coverage_duration_days === 1
        ? '1 day'
        : `${map.audit_coverage_duration_days} days`;

    const readyDate = map.audit_ready_since
      ? new Date(map.audit_ready_since).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Never';

    return (
      <div className="audit-text-summary">
        <p>
          An audit conducted today would have <strong>{daysText}</strong> of
          verifiable governance evidence, from {readyDate}.
        </p>
      </div>
    );
  };

// CSS Styles (would be in separate stylesheet in real app)
const styles = `
.audit-readiness-admin-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.audit-readiness-admin-page h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: #161a1d;
}

.audit-readiness-admin-page .subtitle {
  color: #626f86;
  margin-bottom: 2rem;
  font-size: 0.95rem;
}

.tabs {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Summary Card */
.audit-summary-card {
  background: #ffffff;
  border: 1px solid #dfe1e6;
  border-radius: 4px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.summary-statement {
  margin-bottom: 1.5rem;
}

.summary-statement .main-text {
  font-size: 1.2rem;
  line-height: 1.6;
  color: #161a1d;
  margin: 0;
}

.summary-statement .emphasis {
  font-size: 1.4rem;
  font-weight: 600;
  color: #0052cc;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  background: #f7f8fa;
  border-radius: 3px;
}

.stat-label {
  font-size: 0.85rem;
  color: #626f86;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: #0052cc;
}

/* Details Card */
.audit-details-card {
  background: #ffffff;
  border: 1px solid #dfe1e6;
  border-radius: 4px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.audit-details-card h3 {
  margin-top: 0;
  color: #161a1d;
}

.details-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;
}

.details-table tr {
  border-bottom: 1px solid #dfe1e6;
}

.details-table tr:last-child {
  border-bottom: none;
}

.details-table td {
  padding: 0.75rem;
  text-align: left;
}

.details-table .label {
  font-weight: 600;
  color: #626f86;
  width: 30%;
}

.details-table .value {
  color: #161a1d;
}

.missing-data-note {
  background: #fff7d6;
  border-left: 4px solid #974f0c;
  padding: 1rem;
  margin: 1rem 0;
  border-radius: 3px;
}

.missing-data-note p {
  margin: 0.5rem 0;
  font-size: 0.95rem;
}

.integrity-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #dfe1e6;
}

.integrity-section h4 {
  margin-top: 0;
  color: #161a1d;
}

.hash-display {
  background: #f7f8fa;
  padding: 1rem;
  border-radius: 3px;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.hash-label {
  font-weight: 600;
  color: #626f86;
  white-space: nowrap;
}

.hash-value {
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  color: #161a1d;
  word-break: break-all;
  flex: 1;
}

.integrity-note {
  font-size: 0.9rem;
  color: #626f86;
  margin-top: 0.5rem;
}

/* Export Card */
.audit-export-card {
  background: #ffffff;
  border: 1px solid #dfe1e6;
  border-radius: 4px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.audit-export-card h3 {
  margin-top: 0;
  color: #161a1d;
}

.export-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.export-button {
  padding: 0.75rem 1.5rem;
  font-size: 0.95rem;
  border: 1px solid #dfe1e6;
  border-radius: 3px;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s;
}

.export-button:hover {
  background: #0052cc;
  color: #ffffff;
  border-color: #0052cc;
}

.export-info {
  background: #f7f8fa;
  padding: 1rem;
  border-radius: 3px;
}

.export-info ul {
  margin: 0.5rem 0 0 1.5rem;
  padding: 0;
}

.export-info li {
  margin: 0.5rem 0;
}

/* Standalone Card */
.audit-readiness-card {
  background: #ffffff;
  border: 1px solid #dfe1e6;
  border-radius: 4px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  min-width: 300px;
}

.card-header {
  margin-bottom: 1rem;
  border-bottom: 1px solid #dfe1e6;
  padding-bottom: 0.75rem;
}

.card-header h4 {
  margin: 0;
  color: #161a1d;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-statement {
  margin: 0;
  color: #161a1d;
  font-size: 0.95rem;
}

.card-statement strong {
  font-weight: 600;
  color: #0052cc;
}

.card-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: #f7f8fa;
  border-radius: 3px;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: #0052cc;
}

.metric-label {
  font-size: 0.8rem;
  color: #626f86;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 0.5rem;
}

/* Text Summary */
.audit-text-summary {
  color: #161a1d;
  line-height: 1.5;
}

.audit-text-summary p {
  margin: 0;
}
`;

// Export styles for use in app
export const auditReadinessStyles = styles;

export default AuditReadinessAdminPage;
