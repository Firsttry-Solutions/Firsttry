/**
 * PHASE 5 ADMIN PAGE HANDLER
 * 
 * Forge function handler for the admin page.
 * 
 * Responsibilities:
 * 1. Load admin page state (report + scheduler state)
 * 2. Render the admin page template
 * 3. Handle "Generate Now" button via web route
 * 4. Call handleManualTrigger() on demand (same code path as scheduler)
 * 
 * Design:
 * - Admin page is read-only by default
 * - "Generate Now" button calls handleManualTrigger() (single code path)
 * - No alternate generation logic
 * - All values displayed include disclosure envelopes
 * - No interpretation, no adjectives, no scoring
 */

// @ts-expect-error: @forge/api available via Forge CLI only
import api from '@forge/api';
import { loadAdminPageState, saveLatestReport, AdminPageState } from './admin_page_loader';
import { handleManualTrigger, handleAutoTrigger } from '../phase5_report_generator';
import { STATIC_UI_STRINGS } from './language_safety_guard';
import { PHASE5_SECTION_HEADINGS } from '../phase5/phase5_headings';
import { exportPhase5ReportAsJSON, generateJSONExportResponse } from '../exports/phase5_export_json';
import { generatePDFExportResponse } from '../exports/phase5_export_pdf';
import { validateReportBeforeExport, generateExportErrorResponse, logExportAction } from '../exports/export_utils';

/**
 * Admin page handler.
 * 
 * This is the main entry point for the Jira admin page.
 * Forge calls this function to render the page.
 * 
 * Routes:
 * - GET with no action: Render admin page
 * - POST with action=generateNow: Call handleManualTrigger and reload
 * - GET with export=json: Export report as JSON
 * - GET with export=pdf: Export report as PDF
 */
export async function run(request: any): Promise<any> {
  try {
    // Get context (cloudId is required)
    const context = request.context;
    const cloudId = context?.cloudId;

    if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'TENANT_CONTEXT_UNAVAILABLE',
          message: STATIC_UI_STRINGS.TENANT_CONTEXT_ERROR,
        }),
      };
    }

    // Check if this is an export request
    if (request.queryParameters?.export === 'json') {
      return await handleJSONExportRequest(cloudId);
    }

    if (request.queryParameters?.export === 'pdf') {
      return await handlePDFExportRequest(cloudId);
    }

    // Load current admin page state
    const state = await loadAdminPageState(cloudId);

    // Check if this is a "Generate Now" request
    if (request.queryParameters?.action === 'generateNow') {
      return await handleGenerateNowRequest(cloudId, state);
    }

    // Otherwise, render the admin page with current state
    return await renderAdminPage(state);
  } catch (error) {
    console.error('[AdminPageHandler] Unexpected error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'ADMIN_PAGE_ERROR',
        message: 'An unexpected error occurred. Please contact support.',
      }),
    };
  }
}

/**
 * Handle JSON export request.
 * 
 * Load report from Storage and export as canonical JSON.
 * 
 * @param cloudId - Tenant identifier
 */
async function handleJSONExportRequest(cloudId: string): Promise<any> {
  try {
    // Load admin page state (which includes report)
    const state = await loadAdminPageState(cloudId);

    if (!state.latestReport) {
      return generateExportErrorResponse(
        404,
        'NO_REPORT_AVAILABLE',
        'No report available for export. Generate a report first.'
      );
    }

    // Validate report before export
    try {
      validateReportBeforeExport(state.latestReport);
    } catch (error) {
      logExportAction(cloudId, 'json', state.latestReport.report_id, false, String(error));
      return generateExportErrorResponse(
        400,
        'REPORT_VALIDATION_FAILED',
        'Report validation failed. Cannot export.'
      );
    }

    // Generate JSON export response
    const response = await generateJSONExportResponse(state.latestReport);

    logExportAction(cloudId, 'json', state.latestReport.report_id, true);
    return response;
  } catch (error) {
    console.error('[AdminPageHandler] Error handling JSON export:', error);
    return generateExportErrorResponse(
      500,
      'JSON_EXPORT_ERROR',
      'Failed to generate JSON export. Please try again.'
    );
  }
}

/**
 * Handle PDF export request.
 * 
 * Load report from Storage and export as PDF.
 * 
 * @param cloudId - Tenant identifier
 */
async function handlePDFExportRequest(cloudId: string): Promise<any> {
  try {
    // Load admin page state (which includes report and scheduler state)
    const state = await loadAdminPageState(cloudId);

    if (!state.latestReport) {
      return generateExportErrorResponse(
        404,
        'NO_REPORT_AVAILABLE',
        'No report available for export. Generate a report first.'
      );
    }

    // Validate report before export
    try {
      validateReportBeforeExport(state.latestReport);
    } catch (error) {
      logExportAction(cloudId, 'pdf', state.latestReport.report_id, false, String(error));
      return generateExportErrorResponse(
        400,
        'REPORT_VALIDATION_FAILED',
        'Report validation failed. Cannot export.'
      );
    }

    // Generate PDF export response
    const response = await generatePDFExportResponse(state.latestReport, state.scheduler);

    logExportAction(cloudId, 'pdf', state.latestReport.report_id, true);
    return response;
  } catch (error) {
    console.error('[AdminPageHandler] Error handling PDF export:', error);
    return generateExportErrorResponse(
      500,
      'PDF_EXPORT_ERROR',
      'Failed to generate PDF export. Please try again.'
    );
  }
}

/**
 * Handle "Generate Now" button click.
 * 
 * This calls handleManualTrigger() which uses the SAME code path as the scheduler.
 * No alternate generation logic allowed.
 * 
 * @param cloudId - Tenant identifier
 * @param currentState - Current admin page state (before generation)
 */
async function handleGenerateNowRequest(cloudId: string, currentState: AdminPageState): Promise<any> {
  try {
    // Call the SINGLE generation code path
    const result = await handleManualTrigger();

    if (result.success) {
      // Save the generated report to storage
      try {
        await saveLatestReport(cloudId, result.report);
      } catch (error) {
        console.error('[AdminPageHandler] Error saving generated report:', error);
        // Continue anyway; report is in memory and can be displayed
      }

      // Reload admin page state with new report
      const newState = await loadAdminPageState(cloudId);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Report generated successfully',
          state: newState,
        }),
      };
    } else if (!result.success) {
      // Generation failed (type narrowing after success check)
      const failedResult = result as { success: false; error: string };
      return {
        statusCode: 202, // Accepted but no report created
        body: JSON.stringify({
          success: false,
          message: STATIC_UI_STRINGS.GENERATION_FAILED,
          error: failedResult.error,
          timestamp: new Date().toISOString(),
        }),
      };
    }
  } catch (error) {
    console.error('[AdminPageHandler] Error during manual generation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Generation encountered an error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

/**
 * Render the admin page template.
 * 
 * This returns HTML that renders the report sections and controls.
 * 
 * @param state - Admin page state (report + scheduler state)
 */
async function renderAdminPage(state: AdminPageState): Promise<any> {
  try {
    const html = buildAdminPageHTML(state);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
      },
      body: html,
    };
  } catch (error) {
    console.error('[AdminPageHandler] Error rendering admin page:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'RENDER_ERROR',
        message: 'Failed to render admin page',
      }),
    };
  }
}

/**
 * Build the admin page HTML.
 * 
 * This constructs the entire page including:
 * - Top banner with metadata
 * - Report sections (A-D) if report exists
 * - "No report yet" message if no report
 * - Scheduler status panel
 * - "Generate Now" button
 */
function buildAdminPageHTML(state: AdminPageState): string {
  const report = state.latestReport;

  const contentHTML = report
    ? buildReportSections(report)
    : buildNoReportYetMessage();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${STATIC_UI_STRINGS.PAGE_TITLE}</title>
  <style>
    ${getAdminPageStyles()}
  </style>
</head>
<body>
  <div class="admin-page-container">
    ${buildTopBanner(report)}
    
    <div class="admin-page-content">
      ${contentHTML}
      
      ${buildSchedulerStatusPanel(state.scheduler)}
      
      ${buildManualGenerateSection()}
    </div>
  </div>
  
  <script>
    ${getAdminPageScript()}
  </script>
</body>
</html>
  `;
}

/**
 * Build the top banner with metadata.
 */
function buildTopBanner(report: any): string {
  let metadata = '';

  if (report) {
    const window = report.observation_window;
    const fromDate = new Date(window.from).toLocaleString();
    const toDate = new Date(window.to).toLocaleString();

    metadata = `
      <div class="banner-metadata">
        <div class="metadata-row">
          <span class="metadata-label">${STATIC_UI_STRINGS.GENERATED_AT_LABEL}:</span>
          <span class="metadata-value">${new Date(report.generated_at).toLocaleString()}</span>
        </div>
        <div class="metadata-row">
          <span class="metadata-label">${STATIC_UI_STRINGS.TRIGGER_TYPE_LABEL}:</span>
          <span class="metadata-value">${report.trigger}</span>
        </div>
        <div class="metadata-row">
          <span class="metadata-label">${STATIC_UI_STRINGS.OBSERVATION_WINDOW_LABEL}:</span>
          <span class="metadata-value">${fromDate} to ${toDate} (${window.duration_hours} hours)</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="admin-page-banner">
      <h1>${STATIC_UI_STRINGS.PAGE_TITLE}</h1>
      <p class="banner-subtitle">${STATIC_UI_STRINGS.PAGE_SUBTITLE}</p>
      ${metadata}
    </div>
  `;
}

/**
 * Build report sections A-D.
 */
function buildReportSections(report: any): string {
  const sectionA = report.sections.A;
  const sectionB = report.sections.B;
  const sectionC = report.sections.C;
  const sectionD = report.sections.D;

  return `
    <div class="report-sections">
      ${buildSectionA(sectionA)}
      ${buildSectionB(sectionB)}
      ${buildSectionC(sectionC)}
      ${buildSectionD(sectionD)}
    </div>
  `;
}

/**
 * Build Section A: WHAT WE COLLECTED
 */
function buildSectionA(section: any): string {
  return `
    <section class="report-section section-a">
      <h2>${section.section_name}</h2>
      
      ${buildDisclosedCountRow(
        STATIC_UI_STRINGS.PROJECTS_SCANNED,
        section.projects_scanned
      )}
      
      ${buildDisclosedCountRow(
        STATIC_UI_STRINGS.ISSUES_SCANNED,
        section.issues_scanned
      )}
      
      ${buildDisclosedCountRow(
        STATIC_UI_STRINGS.FIELDS_DETECTED,
        section.fields_detected
      )}
    </section>
  `;
}

/**
 * Build a disclosed count row (for Section A).
 */
function buildDisclosedCountRow(label: string, disclosed: any): string {
  const disclosure = disclosed.disclosure;

  return `
    <div class="count-row">
      <div class="count-header">
        <span class="count-label">${label}</span>
        <span class="count-value">${disclosed.count}</span>
      </div>
      <div class="disclosure-drawer">
        <div class="disclosure-item">
          <span class="disclosure-field-name">${STATIC_UI_STRINGS.COMPLETENESS_LABEL}:</span>
          <span class="disclosure-field-value">${disclosure.completeness_percent}%</span>
        </div>
        <div class="disclosure-item">
          <span class="disclosure-field-name">${STATIC_UI_STRINGS.OBSERVATION_WINDOW_SHORT_LABEL}:</span>
          <span class="disclosure-field-value">${disclosure.observation_window_days} day(s)</span>
        </div>
        <div class="disclosure-item">
          <span class="disclosure-field-name">${STATIC_UI_STRINGS.CONFIDENCE_LEVEL_LABEL}:</span>
          <span class="disclosure-field-value">${disclosure.confidence_level}</span>
        </div>
        <div class="disclosure-text">${escapeHTML(disclosure.disclosure_text)}</div>
      </div>
    </div>
  `;
}

/**
 * Build Section B: COVERAGE DISCLOSURE
 */
function buildSectionB(section: any): string {
  const tableRows = section.datasets
    .map((dataset: any) => `
      <tr>
        <td>${escapeHTML(dataset.dataset_name)}</td>
        <td>${dataset.availability_state}</td>
        <td>${dataset.coverage_percent}%</td>
        <td>${escapeHTML(dataset.reason_detail_text)}</td>
        <td>
          <button class="disclosure-expand-btn" onclick="toggleDisclosureRow(this)">+</button>
          <div class="disclosure-details" style="display: none;">
            <div class="disclosure-item">
              <span class="disclosure-field-name">${STATIC_UI_STRINGS.COMPLETENESS_LABEL}:</span>
              <span class="disclosure-field-value">${dataset.coverage_disclosure.completeness_percent}%</span>
            </div>
            <div class="disclosure-item">
              <span class="disclosure-field-name">${STATIC_UI_STRINGS.CONFIDENCE_LEVEL_LABEL}:</span>
              <span class="disclosure-field-value">${dataset.coverage_disclosure.confidence_level}</span>
            </div>
            ${dataset.mandatory_zero_disclosure ? `
              <div class="disclosure-zero-semantic">
                ${escapeHTML(dataset.mandatory_zero_disclosure)}
              </div>
            ` : ''}
            <div class="disclosure-text">${escapeHTML(dataset.coverage_disclosure.disclosure_text)}</div>
          </div>
        </td>
      </tr>
    `)
    .join('');

  return `
    <section class="report-section section-b">
      <h2>${section.section_name}</h2>
      <table class="coverage-table">
        <thead>
          <tr>
            <th>${STATIC_UI_STRINGS.DATASET_NAME_HEADER}</th>
            <th>${STATIC_UI_STRINGS.AVAILABILITY_STATE_HEADER}</th>
            <th>${STATIC_UI_STRINGS.COVERAGE_PERCENT_HEADER}</th>
            <th>${STATIC_UI_STRINGS.MISSING_REASON_HEADER}</th>
            <th>${STATIC_UI_STRINGS.DISCLOSURE_LABEL}</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </section>
  `;
}

/**
 * Build Section C: PRELIMINARY OBSERVATIONS
 */
function buildSectionC(section: any): string {
  const observations = section.observations
    .map((obs: any) => `
      <div class="observation-row">
        <div class="observation-label">${escapeHTML(obs.label)}</div>
        <div class="observation-value">${obs.value}</div>
        <div class="disclosure-text">${escapeHTML(obs.disclosure.disclosure_text)}</div>
      </div>
    `)
    .join('');

  return `
    <section class="report-section section-c">
      <h2>${section.section_name}</h2>
      <div class="observations-list">
        ${observations}
      </div>
    </section>
  `;
}

/**
 * Build Section D: FORECAST
 */
function buildSectionD(section: any): string {
  if (!section.forecast_available) {
    return `
      <section class="report-section section-d">
        <h2>${section.section_name}</h2>
        <div class="forecast-unavailable">
          <p><strong>${STATIC_UI_STRINGS.FORECAST_UNAVAILABLE_MESSAGE}</strong></p>
          <p class="reason">${STATIC_UI_STRINGS.FORECAST_INSUFFICIENT_WINDOW}</p>
          <div class="disclosure-text">${escapeHTML(section.disclosure_text)}</div>
        </div>
      </section>
    `;
  }

  const forecast = section.forecast;
  return `
    <section class="report-section section-d">
      <h2>${section.section_name}</h2>
      <div class="forecast-available">
        <div class="forecast-chip">${STATIC_UI_STRINGS.FORECAST_AVAILABLE_CHIP}</div>
        <div class="forecast-details">
          <div class="forecast-item">
            <span class="forecast-label">Forecast type:</span>
            <span class="forecast-value">${forecast.forecast_type}</span>
          </div>
          <div class="forecast-item">
            <span class="forecast-label">${STATIC_UI_STRINGS.CONFIDENCE_LEVEL_LABEL}:</span>
            <span class="forecast-value">${forecast.confidence_level}</span>
          </div>
          <div class="forecast-disclaimer">${STATIC_UI_STRINGS.FORECAST_DISCLAIMER}</div>
          <div class="disclosure-text">${escapeHTML(forecast.disclosure_text)}</div>
        </div>
      </div>
    </section>
  `;
}

/**
 * Build "No report yet" message.
 */
function buildNoReportYetMessage(): string {
  return `
    <div class="no-report-message">
      <h2>${STATIC_UI_STRINGS.NO_REPORT_YET}</h2>
      <p class="eligibility-explanation">${STATIC_UI_STRINGS.NEXT_ELIGIBILITY}</p>
    </div>
  `;
}

/**
 * Build scheduler status panel.
 */
function buildSchedulerStatusPanel(scheduler: any): string {
  const statusRows = `
    ${scheduler.last_run_at ? `
      <div class="status-row">
        <span class="status-label">${STATIC_UI_STRINGS.LAST_RUN_AT}</span>
        <span class="status-value">${new Date(scheduler.last_run_at).toLocaleString()}</span>
      </div>
    ` : ''}
    
    <div class="status-row">
      <span class="status-label">${STATIC_UI_STRINGS.AUTO_12H_DONE_AT}</span>
      <span class="status-value">${
        scheduler.auto_12h_done
          ? new Date(scheduler.auto_12h_done).toLocaleString()
          : STATIC_UI_STRINGS.NOT_DONE_YET
      }</span>
    </div>
    
    <div class="status-row">
      <span class="status-label">${STATIC_UI_STRINGS.AUTO_24H_DONE_AT}</span>
      <span class="status-value">${
        scheduler.auto_24h_done
          ? new Date(scheduler.auto_24h_done).toLocaleString()
          : STATIC_UI_STRINGS.NOT_DONE_YET
      }</span>
    </div>
    
    ${scheduler.last_error ? `
      <div class="status-error">
        <strong>${STATIC_UI_STRINGS.LAST_ERROR_HEADER}</strong>
        <div class="error-details">
          <span class="error-code">${escapeHTML(scheduler.last_error.code)}</span>
          <span class="error-message">${escapeHTML(scheduler.last_error.message)}</span>
          <span class="error-at">${new Date(scheduler.last_error.at).toLocaleString()}</span>
        </div>
      </div>
    ` : ''}
    
    <p class="scheduler-note">${STATIC_UI_STRINGS.SCHEDULER_RUNS_PERIODICALLY}</p>
  `;

  return `
    <div class="scheduler-status-panel">
      <h3>${STATIC_UI_STRINGS.SCHEDULER_STATUS_HEADER}</h3>
      <div class="status-content">
        ${statusRows}
      </div>
    </div>
  `;
}

/**
 * Build manual generate section with button and export options.
 */
function buildManualGenerateSection(): string {
  return `
    <div class="manual-generate-section">
      <div class="generate-controls">
        <button 
          class="generate-now-btn" 
          onclick="handleGenerateNow()"
        >
          ${STATIC_UI_STRINGS.GENERATE_NOW_BUTTON}
        </button>
      </div>
      
      <div class="export-controls">
        <p class="export-label">Export report:</p>
        <button 
          class="export-btn export-json-btn" 
          onclick="handleExportJSON()"
        >
          Export as JSON
        </button>
        <button 
          class="export-btn export-pdf-btn" 
          onclick="handleExportPDF()"
        >
          Export as PDF
        </button>
      </div>
      
      <div id="generate-status" class="generate-status" style="display: none;"></div>
    </div>
  `;
}

/**
 * Get CSS styles for the admin page.
 */
function getAdminPageStyles(): string {
  return `
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #f5f5f5;
      margin: 0;
      padding: 0;
      color: #161b22;
    }
    
    .admin-page-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0;
    }
    
    .admin-page-banner {
      background: white;
      border-bottom: 1px solid #e1e4e8;
      padding: 24px;
      margin-bottom: 24px;
    }
    
    .admin-page-banner h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
      font-weight: 600;
    }
    
    .banner-subtitle {
      margin: 0 0 16px 0;
      color: #57606a;
      font-size: 14px;
    }
    
    .banner-metadata {
      background: #f6f8fa;
      border-left: 3px solid #0969da;
      padding: 12px 16px;
      border-radius: 4px;
    }
    
    .metadata-row {
      display: flex;
      gap: 8px;
      margin: 4px 0;
      font-size: 13px;
    }
    
    .metadata-label {
      font-weight: 600;
      min-width: 150px;
    }
    
    .metadata-value {
      color: #57606a;
    }
    
    .admin-page-content {
      padding: 0 24px 24px 24px;
    }
    
    .report-sections {
      background: white;
      border-radius: 4px;
      border: 1px solid #e1e4e8;
      margin-bottom: 24px;
    }
    
    .report-section {
      padding: 24px;
      border-bottom: 1px solid #e1e4e8;
    }
    
    .report-section:last-of-type {
      border-bottom: none;
    }
    
    .report-section h2 {
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
    }
    
    .count-row {
      background: #f6f8fa;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    
    .count-header {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .count-value {
      font-size: 18px;
      font-weight: 700;
    }
    
    .disclosure-drawer {
      background: white;
      border: 1px solid #e1e4e8;
      border-radius: 4px;
      padding: 12px;
      margin-top: 8px;
      font-size: 13px;
    }
    
    .disclosure-item {
      display: flex;
      gap: 8px;
      margin: 4px 0;
    }
    
    .disclosure-field-name {
      font-weight: 600;
      min-width: 120px;
    }
    
    .disclosure-text {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e1e4e8;
      font-style: italic;
      color: #57606a;
      line-height: 1.5;
    }
    
    .coverage-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    
    .coverage-table th {
      background: #f6f8fa;
      border: 1px solid #e1e4e8;
      padding: 8px;
      text-align: left;
      font-weight: 600;
    }
    
    .coverage-table td {
      border: 1px solid #e1e4e8;
      padding: 8px;
    }
    
    .coverage-table tbody tr:nth-child(even) {
      background: #f6f8fa;
    }
    
    .disclosure-expand-btn {
      background: #0969da;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 4px 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
    }
    
    .disclosure-expand-btn:hover {
      background: #0860ca;
    }
    
    .disclosure-details {
      background: white;
      border: 1px solid #e1e4e8;
      border-radius: 4px;
      padding: 8px;
      margin-top: 8px;
      font-size: 12px;
    }
    
    .disclosure-zero-semantic {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 3px;
      padding: 8px;
      margin: 8px 0;
      font-style: italic;
      color: #856404;
    }
    
    .observations-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .observation-row {
      background: #f6f8fa;
      border-left: 3px solid #0969da;
      padding: 12px;
      border-radius: 4px;
    }
    
    .observation-label {
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .observation-value {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    
    .forecast-unavailable {
      background: #f6f8fa;
      padding: 12px;
      border-radius: 4px;
    }
    
    .reason {
      color: #57606a;
      margin: 8px 0;
      font-size: 13px;
    }
    
    .forecast-available {
      background: #f6f8fa;
      padding: 12px;
      border-radius: 4px;
    }
    
    .forecast-chip {
      display: inline-block;
      background: #0969da;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 12px;
    }
    
    .forecast-details {
      background: white;
      border: 1px solid #e1e4e8;
      border-radius: 4px;
      padding: 12px;
    }
    
    .forecast-item {
      display: flex;
      gap: 8px;
      margin: 4px 0;
      font-size: 13px;
    }
    
    .forecast-label {
      font-weight: 600;
      min-width: 120px;
    }
    
    .forecast-disclaimer {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 3px;
      padding: 8px;
      margin: 8px 0;
      font-size: 12px;
      color: #856404;
    }
    
    .no-report-message {
      background: white;
      border: 1px solid #e1e4e8;
      border-radius: 4px;
      padding: 24px;
      text-align: center;
    }
    
    .no-report-message h2 {
      margin: 0 0 12px 0;
    }
    
    .eligibility-explanation {
      color: #57606a;
      font-size: 14px;
      line-height: 1.5;
    }
    
    .scheduler-status-panel {
      background: white;
      border: 1px solid #e1e4e8;
      border-radius: 4px;
      padding: 16px;
      margin-bottom: 24px;
    }
    
    .scheduler-status-panel h3 {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
    }
    
    .status-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 13px;
      border-bottom: 1px solid #e1e4e8;
    }
    
    .status-row:last-child {
      border-bottom: none;
    }
    
    .status-label {
      font-weight: 600;
    }
    
    .status-value {
      color: #57606a;
    }
    
    .status-error {
      background: #ffebee;
      border: 1px solid #ef5350;
      border-radius: 4px;
      padding: 12px;
      margin-top: 12px;
    }
    
    .status-error strong {
      color: #c62828;
    }
    
    .error-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 8px;
      font-size: 12px;
    }
    
    .error-code {
      font-weight: 600;
      font-family: monospace;
    }
    
    .scheduler-note {
      margin-top: 12px;
      padding: 8px;
      background: #f0f7ff;
      border-left: 3px solid #0969da;
      font-size: 13px;
      color: #0550ae;
    }
    
    .manual-generate-section {
      background: white;
      border: 1px solid #e1e4e8;
      border-radius: 4px;
      padding: 24px;
      text-align: center;
    }
    
    .generate-controls {
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e1e4e8;
    }
    
    .generate-now-btn {
      background: #0969da;
      color: white;
      border: none;
      padding: 10px 24px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .generate-now-btn:hover {
      background: #0860ca;
    }
    
    .generate-now-btn:disabled {
      background: #79c0ff;
      cursor: not-allowed;
    }
    
    .export-controls {
      margin-bottom: 16px;
    }
    
    .export-label {
      margin: 0 0 12px 0;
      color: #57606a;
      font-size: 13px;
      font-weight: 600;
    }
    
    .export-btn {
      background: #f6f8fa;
      color: #0969da;
      border: 1px solid #d0d7de;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      margin: 0 8px;
    }
    
    .export-btn:hover {
      background: #eaeef2;
      border-color: #0969da;
    }
    
    .export-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .generate-status {
      margin-top: 12px;
      padding: 12px;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .generate-status.success {
      background: #dafbe1;
      border: 1px solid #34d399;
      color: #065f46;
    }
    
    .generate-status.error {
      background: #ffebee;
      border: 1px solid #ef5350;
      color: #c62828;
    }
  `;
}

/**
 * Get client-side JavaScript for the admin page.
 */
function getAdminPageScript(): string {
  return `
    function toggleDisclosureRow(btn) {
      const details = btn.nextElementSibling;
      if (details.style.display === 'none') {
        details.style.display = 'block';
        btn.textContent = '−';
      } else {
        details.style.display = 'none';
        btn.textContent = '+';
      }
    }
    
    async function handleGenerateNow() {
      const btn = document.querySelector('.generate-now-btn');
      const status = document.getElementById('generate-status');
      
      btn.disabled = true;
      btn.textContent = 'Generating…';
      status.style.display = 'none';
      
      try {
        const response = await fetch(window.location.href + '?action=generateNow', {
          method: 'POST',
        });
        
        const data = await response.json();
        
        if (data.success) {
          status.className = 'generate-status success';
          status.textContent = 'Report generated successfully! Reloading...';
          status.style.display = 'block';
          setTimeout(() => window.location.reload(), 2000);
        } else {
          status.className = 'generate-status error';
          status.textContent = data.message + ' (Error: ' + data.error + ')';
          status.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Generate Now';
        }
      } catch (error) {
        status.className = 'generate-status error';
        status.textContent = 'Generation request failed: ' + error.message;
        status.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Generate Now';
      }
    }
    
    async function handleExportJSON() {
      try {
        const response = await fetch(window.location.href + '?export=json');
        
        if (!response.ok) {
          const error = await response.json();
          alert('Export failed: ' + (error.message || 'Unknown error'));
          return;
        }
        
        // Download the JSON file
        const filename = 'phase5-proof-of-life.json';
        downloadBlob(await response.blob(), filename);
      } catch (error) {
        alert('Export request failed: ' + error.message);
      }
    }
    
    async function handleExportPDF() {
      try {
        const response = await fetch(window.location.href + '?export=pdf');
        
        if (!response.ok) {
          const error = await response.json();
          alert('Export failed: ' + (error.message || 'Unknown error'));
          return;
        }
        
        // Download the PDF file
        const filename = 'phase5-proof-of-life.pdf';
        downloadBlob(await response.blob(), filename);
      } catch (error) {
        alert('Export request failed: ' + error.message);
      }
    }
    
    function downloadBlob(blob, filename) {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  `;
}

/**
 * Escape HTML special characters to prevent injection.
 */
function escapeHTML(text: string): string {
  // Simple HTML escape without DOM dependency
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
