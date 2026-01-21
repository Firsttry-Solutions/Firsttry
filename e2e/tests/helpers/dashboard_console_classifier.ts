/**
 * dashboard_console_classifier.ts
 * 
 * Shared E2E helper: Classify console messages as OURS (from our gadget bundle)
 * or HOST NOISE (from Jira, Atlassian internal systems, deprecated libraries).
 * 
 * Rules:
 * - OURS: Contains our markers like [UI_, FT_IDENTITY_ANCHOR, BACKBONE_, DASH_, PROD_GREEN
 *   OR stack trace contains our hashed bundle entry (app.XXXX.js)
 * - HOST NOISE: Atlassian internal messages, batch.js, AJS, iframeResizer deprecation, etc.
 * - UNCLASSIFIED: Messages we haven't yet categorized (should be minimal)
 * 
 * Does NOT collect sensitive data: no cookie values, tokens, localStorage values.
 * Collects: message text, console type, URLs, stack traces (if available).
 */

import { Page, Frame } from '@playwright/test';

export interface ConsoleRecord {
  ts: string;
  type: 'log' | 'error' | 'warning' | 'info' | 'debug';
  text: string;
  url?: string;
  line?: number;
  column?: number;
}

export interface PageErrorRecord {
  ts: string;
  name: string;
  message: string;
  stack?: string;
}

export interface NetworkRecord {
  ts: string;
  url: string;
  status: number;
  method: string;
  initiator?: string;
}

export interface ClassifierSummary {
  ourConsoleErrors: ConsoleRecord[];
  ourConsoleWarnings: ConsoleRecord[];
  ourConsoleLogs: ConsoleRecord[];
  ourPageErrors: PageErrorRecord[];
  hostNoiseErrors: ConsoleRecord[];
  hostNoiseWarnings: ConsoleRecord[];
  requestFailedOur: NetworkRecord[];
  requestFailedHost: NetworkRecord[];
  http4xx5xxOur: NetworkRecord[];
  http4xx5xxHost: NetworkRecord[];
  detectedOurBundleUrls: string[];
  rawCounts: {
    totalConsoleMessages: number;
    totalPageErrors: number;
    totalRequestsFailed: number;
    totalHttp4xx5xx: number;
  };
}

export interface ConsoleCollectorController {
  getSummary(): ClassifierSummary;
  reset(): void;
  detach(): void;
  getDetectedBundleUrl(): string | null;
}

// Our markers: these indicate messages from our gadget bundle
const OUR_MARKERS = [
  '[UI_',
  'FT_IDENTITY_ANCHOR',
  'BACKBONE_',
  'DASH_',
  'PROD_GREEN',
  '[PROD_GREEN]',
  '[UI_ENTRY_RUNTIME_PROOF]',
  '[UI_SERVE_OK]',
  '[UI_BUILD_IDENTITY_CONFIRMED]',
  '[UI_BTN_CLICK]',
  '[UI_BTN_DONE]',
  '[UI_PROBE_INVOKE_START]',
  '[UI_PROBE_INVOKE_OK]',
];

// Host noise patterns: Atlassian internal systems, deprecated libraries
const HOST_NOISE_PATTERNS = [
  'batch.js?jag=true',
  'AJS.',
  'FeatureGateClients',
  'Deprecated: iframeResizer',
  'get-paint-metrics.ts:35',
  '/gateway/api/',
  'Deprecated:',
  'watermelon',
  'existsWithWorkspaceType',
  'townsquare',
];

// Critical errors we must fail on (from backbone issues)
const CRITICAL_OUR_ERRORS = [
  'ReferenceError: UI_BUILD_TIME_UTC is not defined',
  'DASH_ENVELOPE_MAP_FAILED',
  'DASH_SCHEMA_VERSION_UNSUPPORTED_FAIL_CLOSED',
  'Dashboard state loaded: ERROR ENVELOPE_MAPPING_FAILED',
  'UNHANDLED_REJECTION',
];

function isOurMessage(text: string, stackTrace?: string, bundleUrls: string[] = []): boolean {
  // Check for our explicit markers
  for (const marker of OUR_MARKERS) {
    if (text.includes(marker)) {
      return true;
    }
  }

  // Check if stack trace contains our bundle URL
  if (stackTrace && bundleUrls.length > 0) {
    for (const url of bundleUrls) {
      if (stackTrace.includes(url)) {
        return true;
      }
    }
  }

  // Check for hashed app entry: app.XXXX.js
  if (/app\.[a-z0-9]+\.(js|mjs)/i.test(text) || /app\.[a-z0-9]+\.(js|mjs)/i.test(stackTrace || '')) {
    return true;
  }

  return false;
}

function isHostNoise(text: string): boolean {
  for (const pattern of HOST_NOISE_PATTERNS) {
    if (text.includes(pattern)) {
      return true;
    }
  }
  return false;
}

export function attachCollectors(page: Page): ConsoleCollectorController {
  const ourConsoleErrors: ConsoleRecord[] = [];
  const ourConsoleWarnings: ConsoleRecord[] = [];
  const ourConsoleLogs: ConsoleRecord[] = [];
  const ourPageErrors: PageErrorRecord[] = [];
  const hostNoiseErrors: ConsoleRecord[] = [];
  const hostNoiseWarnings: ConsoleRecord[] = [];
  const requestFailedOur: NetworkRecord[] = [];
  const requestFailedHost: NetworkRecord[] = [];
  const http4xx5xxOur: NetworkRecord[] = [];
  const http4xx5xxHost: NetworkRecord[] = [];
  const detectedOurBundleUrls: Set<string> = new Set();

  let totalConsoleMessages = 0;
  let totalPageErrors = 0;
  let totalRequestsFailed = 0;
  let totalHttp4xx5xx = 0;

  // Attach console message listener
  page.on('console', (msg) => {
    totalConsoleMessages++;
    const record: ConsoleRecord = {
      ts: new Date().toISOString(),
      type: (msg.type() as 'log' | 'error' | 'warning' | 'info' | 'debug') || 'log',
      text: msg.text(),
      url: msg.location()?.url,
      line: msg.location()?.lineNumber,
      column: msg.location()?.columnNumber,
    };

    // Detect bundle URLs from location
    if (msg.location()?.url) {
      const url = msg.location().url;
      const match = url.match(/\/app\.[a-z0-9]+\.(js|mjs)/i);
      if (match) {
        detectedOurBundleUrls.add(url);
      }
    }

    // Classify
    if (isOurMessage(record.text, undefined, Array.from(detectedOurBundleUrls))) {
      if (record.type === 'error') {
        ourConsoleErrors.push(record);
      } else if (record.type === 'warning') {
        ourConsoleWarnings.push(record);
      } else {
        ourConsoleLogs.push(record);
      }
    } else if (isHostNoise(record.text)) {
      if (record.type === 'error') {
        hostNoiseErrors.push(record);
      } else {
        hostNoiseWarnings.push(record);
      }
    }
  });

  // Attach page error listener (unhandled exceptions)
  page.on('pageerror', (error) => {
    totalPageErrors++;
    const record: PageErrorRecord = {
      ts: new Date().toISOString(),
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack,
    };

    // Classify
    if (isOurMessage(record.message, record.stack, Array.from(detectedOurBundleUrls))) {
      ourPageErrors.push(record);
    }
  });

  // Attach request failed listener
  page.on('requestfailed', (request) => {
    totalRequestsFailed++;
    const record: NetworkRecord = {
      ts: new Date().toISOString(),
      url: request.url(),
      status: 0, // requestfailed doesn't have a status
      method: request.method(),
      initiator: request.postDataJSON()?.initiator || 'unknown',
    };

    // Classify
    if (isOurMessage(record.url)) {
      requestFailedOur.push(record);
    } else {
      requestFailedHost.push(record);
    }
  });

  // Attach response listener for 4xx/5xx
  page.on('response', (response) => {
    if (response.status() >= 400) {
      totalHttp4xx5xx++;
      const record: NetworkRecord = {
        ts: new Date().toISOString(),
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
      };

      // Classify
      if (isOurMessage(record.url)) {
        http4xx5xxOur.push(record);
      } else {
        http4xx5xxHost.push(record);
      }
    }
  });

  return {
    getSummary(): ClassifierSummary {
      return {
        ourConsoleErrors,
        ourConsoleWarnings,
        ourConsoleLogs,
        ourPageErrors,
        hostNoiseErrors,
        hostNoiseWarnings,
        requestFailedOur,
        requestFailedHost,
        http4xx5xxOur,
        http4xx5xxHost,
        detectedOurBundleUrls: Array.from(detectedOurBundleUrls),
        rawCounts: {
          totalConsoleMessages,
          totalPageErrors,
          totalRequestsFailed,
          totalHttp4xx5xx,
        },
      };
    },

    reset(): void {
      ourConsoleErrors.length = 0;
      ourConsoleWarnings.length = 0;
      ourConsoleLogs.length = 0;
      ourPageErrors.length = 0;
      hostNoiseErrors.length = 0;
      hostNoiseWarnings.length = 0;
      requestFailedOur.length = 0;
      requestFailedHost.length = 0;
      http4xx5xxOur.length = 0;
      http4xx5xxHost.length = 0;
      totalConsoleMessages = 0;
      totalPageErrors = 0;
      totalRequestsFailed = 0;
      totalHttp4xx5xx = 0;
    },

    detach(): void {
      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');
      page.removeAllListeners('requestfailed');
      page.removeAllListeners('response');
    },

    getDetectedBundleUrl(): string | null {
      const urls = Array.from(detectedOurBundleUrls);
      return urls.length > 0 ? urls[0] : null;
    },
  };
}

export function getCriticalOurErrors(summary: ClassifierSummary): ConsoleRecord[] {
  return summary.ourConsoleErrors.filter((rec) => {
    for (const critical of CRITICAL_OUR_ERRORS) {
      if (rec.text.includes(critical)) {
        return true;
      }
    }
    return false;
  });
}
