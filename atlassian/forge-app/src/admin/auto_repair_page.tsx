/**
 * Phase 9.5-E: Auto-Repair Admin Page
 *
 * Read-only informational display of FirstTry's self-recovery events.
 * Shows that FirstTry self-heals, without claiming to "fix" anything.
 */

import React, { useMemo, useState } from 'react';
import { AutoRepairLog, AutoRepairEvent } from '../phase9_5e/auto_repair_log';

interface AutoRepairPageProps {
  autoRepairLog: AutoRepairLog;
  onExportJson?: () => void;
  onExportReport?: () => void;
}

/**
 * Main auto-repair admin page.
 */
export const AutoRepairAdminPage: React.FC<AutoRepairPageProps> = ({
  autoRepairLog,
  onExportJson,
  onExportReport,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'table' | 'breakdown'>('timeline');

  return (
    <div className="auto-repair-admin-page">
      <h1>System Self-Recovery Events</h1>
      <p className="subtitle">
        FirstTry's automatic resilience mechanisms in response to transient issues
      </p>

      <div className="page-content">
        <AutoRepairSummaryCard log={autoRepairLog} />

        <div className="tabs">
          <div className="tab-buttons">
            <button
              className={`tab-button ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              Timeline
            </button>
            <button
              className={`tab-button ${activeTab === 'table' ? 'active' : ''}`}
              onClick={() => setActiveTab('table')}
            >
              Details
            </button>
            <button
              className={`tab-button ${activeTab === 'breakdown' ? 'active' : ''}`}
              onClick={() => setActiveTab('breakdown')}
            >
              Breakdown
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'timeline' && <AutoRepairTimeline log={autoRepairLog} />}
            {activeTab === 'table' && <AutoRepairTable log={autoRepairLog} />}
            {activeTab === 'breakdown' && <AutoRepairBreakdown log={autoRepairLog} />}
          </div>
        </div>

        <AutoRepairExportCard onExportJson={onExportJson} onExportReport={onExportReport} />
      </div>
    </div>
  );
};

/**
 * Summary card showing key metrics.
 */
const AutoRepairSummaryCard: React.FC<{ log: AutoRepairLog }> = ({ log }) => {
  return (
    <div className="auto-repair-summary-card">
      <div className="summary-intro">
        <h3>Self-Recovery Overview</h3>
        <p>
          FirstTry successfully self-recovered from <strong>{log.events_by_outcome.success}</strong> transient issues
          with a <strong>{log.success_rate.toFixed(1)}%</strong> success rate.
        </p>
      </div>

      <div className="summary-grid">
        <div className="metric-card">
          <div className="metric-number">{log.total_events}</div>
          <div className="metric-label">Total Events</div>
        </div>

        <div className="metric-card success">
          <div className="metric-number">{log.events_by_outcome.success}</div>
          <div className="metric-label">Successful</div>
        </div>

        <div className="metric-card partial">
          <div className="metric-number">{log.events_by_outcome.partial}</div>
          <div className="metric-label">Partial</div>
        </div>

        <div className="metric-card failed">
          <div className="metric-number">{log.events_by_outcome.failed}</div>
          <div className="metric-label">Failed</div>
        </div>

        <div className="metric-card">
          <div className="metric-number">{log.success_rate.toFixed(1)}%</div>
          <div className="metric-label">Success Rate</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Period</div>
          <div className="metric-value">
            {new Date(log.time_period_start).toLocaleDateString()} -
            <br />
            {new Date(log.time_period_end).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="summary-note">
        <p>
          <strong>Note:</strong> These are automatic recovery mechanisms within FirstTry. They represent FirstTry's
          resilience, not modifications to your Jira configuration.
        </p>
      </div>
    </div>
  );
};

/**
 * Timeline view of recovery events.
 */
const AutoRepairTimeline: React.FC<{ log: AutoRepairLog }> = ({ log }) => {
  const eventsByDate = useMemo(() => {
    return log.events.reduce(
      (acc, event) => {
        const date = new Date(event.timestamp).toLocaleDateString();
        if (!acc[date]) acc[date] = [];
        acc[date].push(event);
        return acc;
      },
      {} as Record<string, AutoRepairEvent[]>
    );
  }, [log.events]);

  const sortedDates = useMemo(() => {
    return Object.keys(eventsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [eventsByDate]);

  return (
    <div className="auto-repair-timeline">
      <h3>Recovery Timeline</h3>

      {sortedDates.map((date) => (
        <div key={date} className="timeline-date-group">
          <h4 className="date-header">{date}</h4>
          <div className="events-list">
            {eventsByDate[date].map((event) => (
              <AutoRepairEventCard key={event.event_id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Single event card in timeline.
 */
const AutoRepairEventCard: React.FC<{ event: AutoRepairEvent }> = ({ event }) => {
  const time = new Date(event.timestamp).toLocaleTimeString();
  const outcomeColor = {
    success: '#216e4e',
    partial: '#974f0c',
    failed: '#ae2a19',
  }[event.outcome];

  return (
    <div className="event-card" style={{ borderLeftColor: outcomeColor }}>
      <div className="event-header">
        <span className="event-time">{time}</span>
        <span className={`event-outcome outcome-${event.outcome}`}>{event.outcome.toUpperCase()}</span>
      </div>

      <div className="event-body">
        <div className="event-row">
          <span className="label">Repair Type:</span>
          <span className="value">{event.repair_type}</span>
        </div>
        <div className="event-row">
          <span className="label">Trigger:</span>
          <span className="value">{event.trigger_reason}</span>
        </div>
        <div className="event-row">
          <span className="label">Operation:</span>
          <span className="value">{event.affected_operation}</span>
        </div>
        <div className="event-row">
          <span className="label">Duration:</span>
          <span className="value">{event.details.repair_duration_ms}ms</span>
        </div>
        <div className="event-row">
          <span className="label">Attempt:</span>
          <span className="value">#{event.attempt_number}</span>
        </div>
        {event.linked_snapshot_run_id && (
          <div className="event-row">
            <span className="label">Linked Run:</span>
            <span className="value code">{event.linked_snapshot_run_id}</span>
          </div>
        )}
        {event.details.original_error && (
          <div className="event-row">
            <span className="label">Original Error:</span>
            <span className="value code">{event.details.original_error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Table view of all events.
 */
const AutoRepairTable: React.FC<{ log: AutoRepairLog }> = ({ log }) => {
  const sortedEvents = useMemo(() => {
    return [...log.events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [log.events]);

  return (
    <div className="auto-repair-table-view">
      <h3>Recovery Events Detail</h3>
      <table className="repair-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Repair Type</th>
            <th>Trigger</th>
            <th>Operation</th>
            <th>Outcome</th>
            <th>Duration</th>
            <th>Attempt</th>
          </tr>
        </thead>
        <tbody>
          {sortedEvents.map((event) => (
            <tr key={event.event_id} className={`outcome-${event.outcome}`}>
              <td>{new Date(event.timestamp).toLocaleString()}</td>
              <td>{event.repair_type}</td>
              <td>{event.trigger_reason}</td>
              <td>{event.affected_operation}</td>
              <td>
                <strong>{event.outcome}</strong>
              </td>
              <td>{event.details.repair_duration_ms}ms</td>
              <td>#{event.attempt_number}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Breakdown view showing distribution by type and reason.
 */
const AutoRepairBreakdown: React.FC<{ log: AutoRepairLog }> = ({ log }) => {
  return (
    <div className="auto-repair-breakdown">
      <div className="breakdown-section">
        <h3>By Repair Type</h3>
        <div className="breakdown-list">
          {Object.entries(log.repair_type_breakdown).map(([type, count]) => (
            <div key={type} className="breakdown-item">
              <span className="label">{type}</span>
              <div className="bar-container">
                <div
                  className="bar"
                  style={{
                    width: `${(count / log.total_events) * 100}%`,
                  }}
                />
              </div>
              <span className="count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="breakdown-section">
        <h3>By Trigger Reason</h3>
        <div className="breakdown-list">
          {Object.entries(log.trigger_reason_breakdown).map(([reason, count]) => (
            <div key={reason} className="breakdown-item">
              <span className="label">{reason}</span>
              <div className="bar-container">
                <div
                  className="bar"
                  style={{
                    width: `${(count / log.total_events) * 100}%`,
                  }}
                />
              </div>
              <span className="count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="breakdown-section">
        <h3>By Outcome</h3>
        <div className="breakdown-list">
          {Object.entries(log.events_by_outcome).map(([outcome, count]) => (
            <div key={outcome} className={`breakdown-item outcome-${outcome}`}>
              <span className="label">{outcome}</span>
              <div className="bar-container">
                <div
                  className="bar"
                  style={{
                    width: `${(count / log.total_events) * 100}%`,
                  }}
                />
              </div>
              <span className="count">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Export card with download options.
 */
const AutoRepairExportCard: React.FC<{
  onExportJson?: () => void;
  onExportReport?: () => void;
}> = ({ onExportJson, onExportReport }) => {
  return (
    <div className="auto-repair-export-card">
      <h3>Export Data</h3>

      <div className="export-buttons">
        <button
          className="export-button json-button"
          onClick={onExportJson}
          title="Export recovery events as JSON"
        >
          📥 Export JSON
        </button>

        <button
          className="export-button report-button"
          onClick={onExportReport}
          title="Export recovery report as Markdown"
        >
          📄 Export Report
        </button>
      </div>

      <p className="export-info">
        Use these exports for operational monitoring, compliance documentation, and incident analysis.
      </p>
    </div>
  );
};

/**
 * Embedded card for dashboards.
 */
export const AutoRepairCard: React.FC<{ log: AutoRepairLog }> = ({ log }) => {
  return (
    <div className="auto-repair-card">
      <div className="card-header">
        <h4>System Self-Recovery</h4>
      </div>

      <div className="card-content">
        <p className="card-statement">
          FirstTry successfully self-recovered from <strong>{log.events_by_outcome.success}</strong> transient
          issues.
        </p>

        <div className="card-stats">
          <div className="stat">
            <span className="stat-value">{log.success_rate.toFixed(1)}%</span>
            <span className="stat-label">Success Rate</span>
          </div>

          <div className="stat">
            <span className="stat-value">{log.total_events}</span>
            <span className="stat-label">Total Events</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoRepairAdminPage;
