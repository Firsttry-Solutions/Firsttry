/**
 * PHASE-9: DATA HANDLING ADMIN PAGE
 *
 * Displays factual product capabilities:
 * - What data is collected (exact)
 * - What data is never collected (explicit)
 * - Where data is stored
 * - Retention policy
 * - Uninstall behavior
 * - Jira scopes
 * - Read-only guarantees
 * - Rate limit behavior
 * - Missing-data disclosure
 * - Historical blind spots
 *
 * No marketing language. No aspirational claims.
 */

import { htmlEscape } from './data_handling_page';
import type { ProcurementPacket } from './procurement_packet';

export interface DataHandlingPageOptions {
  packet: ProcurementPacket;
  recordingSinceDate?: string;
}

/**
 * Render data handling admin page
 *
 * This page answers:
 * "What does FirstTry actually do with my data?"
 *
 * Factually.
 */
export function renderDataHandlingPage(options: DataHandlingPageOptions): string {
  const { packet, recordingSinceDate } = options;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Data Handling &amp; Privacy</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #0052cc; }
    h2 { margin-top: 40px; border-bottom: 2px solid #0052cc; padding-bottom: 10px; }
    .section { margin: 30px 0; }
    .list { list-style: none; padding-left: 0; }
    .list li { padding: 8px 0; padding-left: 24px; position: relative; }
    .list li:before { content: "✓"; position: absolute; left: 0; color: #36b37e; font-weight: bold; }
    .never-list li:before { content: "✗"; color: #ae2a19; }
    .info-box { background: #f5f5f5; border-left: 4px solid #0052cc; padding: 12px; margin: 20px 0; }
    .timestamp { color: #626f86; font-size: 0.9em; }
    code { background: #f1f2f4; padding: 2px 6px; border-radius: 3px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    table th { background: #f5f5f5; text-align: left; padding: 8px; }
    table td { padding: 8px; border-bottom: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>Data Handling &amp; Privacy Policy</h1>
  
  <div class="info-box">
    <strong>This page answers:</strong> What data does FirstTry collect, store, and how long?
    <br/>
    <strong>Policy:</strong> This is our actual behavior, verified by automated tests.
    ${recordingSinceDate ? `<br/><strong>Recording since:</strong> <code>${htmlEscape(recordingSinceDate)}</code>` : ''}
  </div>

  <!-- DATA COLLECTED -->
  <div class="section">
    <h2>✓ Data We Collect</h2>
    <p>Exact data types collected:</p>
    <ul class="list">
      ${packet.data_handling.collected_data.map(item => `<li>${htmlEscape(item)}</li>`).join('')}
    </ul>
  </div>

  <!-- DATA NOT COLLECTED -->
  <div class="section">
    <h2>✗ Data We Explicitly Do NOT Collect</h2>
    <p>We never collect these data types:</p>
    <ul class="list never-list">
      ${packet.data_handling.never_collected.map(item => `<li>${htmlEscape(item)}</li>`).join('')}
    </ul>
  </div>

  <!-- STORAGE -->
  <div class="section">
    <h2>Storage Location</h2>
    <div class="info-box">
      ${htmlEscape(packet.data_handling.storage_location)}
    </div>
  </div>

  <!-- RETENTION -->
  <div class="section">
    <h2>Data Retention</h2>
    <div class="info-box">
      ${htmlEscape(packet.data_handling.retention_policy)}
    </div>
  </div>

  <!-- UNINSTALL -->
  <div class="section">
    <h2>Uninstall Behavior</h2>
    <div class="info-box">
      <strong>What happens when you uninstall FirstTry:</strong>
      <br/><br/>
      ${htmlEscape(packet.data_handling.uninstall_behavior)}
    </div>
  </div>

  <!-- JIRA SCOPES -->
  <div class="section">
    <h2>Jira API Scopes Used</h2>
    <p>FirstTry uses these Jira Cloud scopes (declared in app manifest):</p>
    <ul class="list">
      ${packet.data_handling.jira_scopes_used.map(scope => {
        const description = getScopeDescription(scope);
        return `<li><code>${htmlEscape(scope)}</code> — ${description}</li>`;
      }).join('')}
    </ul>
    <p><strong>What this means:</strong> These are the only permissions FirstTry can use.</p>
  </div>

  <!-- READ-ONLY GUARANTEES -->
  <div class="section">
    <h2>Read-Only Guarantees</h2>
    <p>FirstTry makes these guarantees about data modification:</p>
    <ul class="list">
      ${packet.data_handling.read_only_guarantees.map(guarantee => `<li>${htmlEscape(guarantee)}</li>`).join('')}
    </ul>
  </div>

  <!-- RATE LIMITS -->
  <div class="section">
    <h2>API Rate Limit Behavior</h2>
    <div class="info-box">
      ${htmlEscape(packet.data_handling.rate_limit_behavior)}
    </div>
  </div>

  <!-- METRIC GAPS -->
  <div class="section">
    <h2>When Metrics Are Not Available</h2>
    <p>Some metrics cannot be computed without required data:</p>
    <table>
      <tr>
        <th>Metric</th>
        <th>Available When</th>
        <th>Not Available When</th>
      </tr>
      ${packet.missing_data_disclosure.metric_gaps.map(gap => `
        <tr>
          <td><code>${htmlEscape(gap.metric)}</code></td>
          <td>${htmlEscape(gap.available_when)}</td>
          <td>${htmlEscape(gap.not_available_when)}</td>
        </tr>
      `).join('')}
    </table>
  </div>

  <!-- BLIND SPOTS -->
  <div class="section">
    <h2>Historical Blind Spots</h2>
    <p>These metrics cannot measure periods before data collection started:</p>
    <ul>
      ${packet.historical_blind_spots.map(blindSpot => `
        <li>
          <strong>${htmlEscape(blindSpot.metric)}:</strong> ${htmlEscape(blindSpot.blind_spot_description)}
          <br/>
          Recording from: <code>${htmlEscape(blindSpot.starts_recording_after)}</code>
        </li>
      `).join('')}
    </ul>
  </div>

  <!-- DETERMINISM -->
  <div class="section">
    <h2>Determinism &amp; Reproducibility</h2>
    <div class="info-box">
      <strong>Every metric computation is deterministic.</strong>
      <br/><br/>
      Same data + same time window = identical results (always).
      <br/>
      This is verified by automated tests: <code>${htmlEscape(packet.determinism_proof.determinism_test_location)}</code>
      <br/><br/>
      <strong>How to verify:</strong> ${htmlEscape(packet.determinism_proof.verification_method)}
    </div>
  </div>

  <!-- NOT AVAILABLE CONDITIONS -->
  <div class="section">
    <h2>When You See "Not Available"</h2>
    <p>If a metric shows "Not Available", one of these is the reason:</p>
    <ul>
      ${packet.missing_data_disclosure.not_available_conditions.map(condition => {
        const [code, reason] = condition.split(': ');
        return `<li><code>${htmlEscape(code)}</code> — ${htmlEscape(reason)}</li>`;
      }).join('')}
    </ul>
  </div>

  <!-- DATA QUALITY -->
  <div class="section">
    <h2>Improving Metric Quality</h2>
    <p>To ensure metrics are always available:</p>
    <ul class="list">
      ${packet.missing_data_disclosure.data_requirements.map(req => {
        // Extract action from requirement
        const action = req.split(': ')[1] || req;
        return `<li>${htmlEscape(action)}</li>`;
      }).join('')}
    </ul>
  </div>

  <!-- TRANSPARENCY -->
  <div class="section">
    <h2>Transparency &amp; Verification</h2>
    <div class="info-box">
      <p><strong>This page is verified by automated tests.</strong></p>
      <p>We cannot make claims about data handling that aren't enforced by tests. If something on this page changes, tests fail and the build blocks.</p>
      <p><strong>You can verify:</strong></p>
      <ul>
        <li>Every claim is enforced by a test in <code>src/phase9/</code></li>
        <li>The canonicalization spec is defined in <code>docs/CANONICALIZATION_SPEC.md</code></li>
        <li>Determinism proof exists in <code>${htmlEscape(packet.determinism_proof.determinism_test_location)}</code></li>
        <li>All metrics are formally defined in <code>docs/PHASE_8_V2_SPEC.md</code></li>
      </ul>
    </div>
  </div>

  <!-- PACKET INFO -->
  <div class="section" style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.85em; color: #626f86;">
    <p>
      Procurement Packet Generated: ${htmlEscape(packet.generated_at)}<br/>
      Packet ID: <code>${htmlEscape(packet.packet_id)}</code><br/>
      Packet Hash: <code>${htmlEscape(packet.packet_hash || 'not computed')}</code>
    </p>
  </div>

</body>
</html>
  `;

  return html;
}

/**
 * Helper: Get human-readable description of Jira scope
 */
function getScopeDescription(scope: string): string {
  const descriptions: { [key: string]: string } = {
    'read:jira-work': 'Read access to issues, projects, and issue metadata',
    'read:configuration:jira': 'Read access to configuration schemes and field mappings',
    'read:webhook:jira': 'Read access to webhook management (for monitoring)',
  };

  return descriptions[scope] || 'Jira Cloud API access';
}

/**
 * HTML escape helper
 */
export function htmlEscape(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Error response helper
 */
export function errorResponse(message: string, backLink?: string): string {
  return `
    <html>
      <head><title>Error</title></head>
      <body>
        <h1>Error</h1>
        <p>${htmlEscape(message)}</p>
        ${backLink ? `<p><a href="${htmlEscape(backLink)}">← Back</a></p>` : ''}
      </body>
    </html>
  `;
}
