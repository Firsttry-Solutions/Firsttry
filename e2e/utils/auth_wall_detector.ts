import type { Page } from "@playwright/test";

/**
 * Shared auth-wall detection helper extracted from prod_dashboard_green.spec.ts
 * 
 * This helper encapsulates the EXACT same detection logic used in
 * enforceAuthenticatedJiraSession() to determine if an auth wall is present.
 * 
 * NO behavior change from original implementation - pure extraction.
 * 
 * Detection rules:
 * - Rule A: Main frame URL contains "id.atlassian.com/login"
 * - Rule B: Main frame URL contains "/login.jsp"
 * - Rule C: Redirect (302/303/307/308) with Location header to auth URL
 * - DOM-based: Password input fields or "log in" text detected
 * - Title-based: Title contains "log in", "login", "sign in", or "verify"
 */

// URL pattern checkers (copied from prod_dashboard_green.spec.ts)
function isIdLoginUrl(u: string): boolean {
  return (u || '').includes("id.atlassian.com/login");
}

function isLoginJspUrl(u: string): boolean {
  return (u || '').includes("/login.jsp");
}

function isAuthWallUrl(u: string): boolean {
  return isIdLoginUrl(u) || isLoginJspUrl(u);
}

function isAuthUrl(u: string): boolean {
  const s = (u || "").toLowerCase();
  if (!s) return false;
  return (
    s.startsWith("https://id.atlassian.com/") ||
    s.startsWith("https://auth.atlassian.com/") ||
    s.includes("/login") ||
    s.includes("user-access") ||
    s.includes("saml") ||
    s.includes("oauth")
  );
}

function isAuthWallTitle(title: string): boolean {
  const t = (title || '').toLowerCase();
  return t.includes('log in') || t.includes('login') || t.includes('sign in') || t.includes('verify');
}

async function collectDomFingerprint(page: Page) {
  return await page.evaluate(() => {
    const q = (sel: string) => document.querySelectorAll(sel).length;
    const text1 = (sel: string) => (document.querySelector(sel)?.textContent || '').trim().slice(0, 120);
    return {
      readyState: (document as any).readyState,
      counts: {
        main: q('main'),
        nav: q('nav'),
        header: q('header'),
        form: q('form'),
        iframe: q('iframe'),
        input_password: q('input[type="password"]'),
        input_email: q('input[type="email"]'),
        input_text: q('input[type="text"]'),
        h1: q('h1'),
      },
      h1: text1('h1'),
      title: document.title,
      body_snippet: document.body?.textContent?.slice(0, 500) || ''
    };
  });
}

export interface AuthWallDetectionResult {
  detected: boolean;
  evidenceLines: string[];
  rule?: 'A' | 'B' | 'C' | 'top_level_auth_url' | 'auth_wall_title' | 'auth_wall_dom';
  pageUrl?: string;
  title?: string;
}

/**
 * Detect auth wall evidence using the same logic as enforceAuthenticatedJiraSession.
 * 
 * This function is a pure extraction - it MUST maintain identical detection semantics
 * to the original implementation in prod_dashboard_green.spec.ts.
 * 
 * Returns:
 * - detected: true if auth wall is present
 * - evidenceLines: array of safe strings describing detection (NO secrets)
 * - rule: which detection rule triggered (A/B/C or other)
 * - pageUrl: current page URL (safe to log)
 * - title: page title (safe to log)
 */
export async function detectAuthWallEvidence(page: Page): Promise<AuthWallDetectionResult> {
  const evidenceLines: string[] = [];
  const pageUrl = page.url();
  const title = await page.title().catch(() => 'TITLE_UNAVAILABLE');

  // Check 1: Top-level auth URL (fail-fast)
  if (isAuthUrl(pageUrl)) {
    evidenceLines.push(`Top-level auth URL detected: ${pageUrl}`);
    evidenceLines.push(`Rule: top_level_auth_url`);
    return {
      detected: true,
      evidenceLines,
      rule: 'top_level_auth_url',
      pageUrl,
      title
    };
  }

  // Check 2: Auth wall title (fail-fast)
  if (isAuthWallTitle(title)) {
    evidenceLines.push(`Auth wall title detected: ${title}`);
    evidenceLines.push(`Rule: auth_wall_title`);
    return {
      detected: true,
      evidenceLines,
      rule: 'auth_wall_title',
      pageUrl,
      title
    };
  }

  // Check 3: Rule A (id.atlassian.com/login in main frame URL)
  if (isIdLoginUrl(pageUrl)) {
    evidenceLines.push(`Rule A: Main frame URL contains id.atlassian.com/login`);
    evidenceLines.push(`URL: ${pageUrl}`);
    return {
      detected: true,
      evidenceLines,
      rule: 'A',
      pageUrl,
      title
    };
  }

  // Check 4: Rule B (/login.jsp in main frame URL)
  if (isLoginJspUrl(pageUrl)) {
    evidenceLines.push(`Rule B: Main frame URL contains /login.jsp`);
    evidenceLines.push(`URL: ${pageUrl}`);
    return {
      detected: true,
      evidenceLines,
      rule: 'B',
      pageUrl,
      title
    };
  }

  // Check 5: DOM-based auth wall detection
  const domFingerprint = await collectDomFingerprint(page);
  const authWallByDom =
    (domFingerprint.counts?.input_password > 0) ||
    (domFingerprint.h1?.toLowerCase()?.includes('log in')) ||
    (domFingerprint.body_snippet?.toLowerCase()?.includes('log in'));

  if (authWallByDom) {
    evidenceLines.push(`DOM-based auth wall detected`);
    evidenceLines.push(`Password inputs: ${domFingerprint.counts?.input_password || 0}`);
    evidenceLines.push(`H1 text: ${domFingerprint.h1?.slice(0, 80) || 'none'}`);
    evidenceLines.push(`Rule: auth_wall_dom`);
    return {
      detected: true,
      evidenceLines,
      rule: 'auth_wall_dom',
      pageUrl,
      title
    };
  }

  // No auth wall detected
  evidenceLines.push(`No auth wall detected`);
  evidenceLines.push(`Page URL: ${pageUrl}`);
  evidenceLines.push(`Page title: ${title}`);
  return {
    detected: false,
    evidenceLines,
    pageUrl,
    title
  };
}
