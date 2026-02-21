/**
 * Headless auth capture for CI / dev containers without a display.
 * Uses JIRA_API_TOKEN + FORGE_EMAIL for Basic auth, saves storageState
 * so Playwright tests can reuse the authenticated session.
 *
 * Usage:
 *   FORGE_EMAIL="contact@firsttry.run" JIRA_API_TOKEN="..." node tools/pw_auth_capture_headless.js
 */
const { chromium } = require('playwright');

(async () => {
  const email = process.env.FORGE_EMAIL || 'contact@firsttry.run';
  const token = process.env.JIRA_API_TOKEN;
  const outPath = process.env.FT_STORAGE_STATE_PATH || '/tmp/ft_storage_state.json';

  if (!token) {
    console.error('FAIL: JIRA_API_TOKEN not set');
    process.exit(1);
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  console.log(`Authenticating as ${email} (headless) ...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    extraHTTPHeaders: {
      'Authorization': `Basic ${auth}`
    }
  });
  const page = await context.newPage();

  // 1) Verify auth via REST API (returns 200 + user info if token is valid)
  const resp = await page.goto('https://firsttry.atlassian.net/rest/api/3/myself', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  const status = resp.status();
  console.log(`Auth check: HTTP ${status}`);

  if (status !== 200) {
    console.error(`FAIL: Auth returned HTTP ${status}`);
    await browser.close();
    process.exit(1);
  }

  const body = await resp.json().catch(() => null);
  if (body && body.displayName) {
    console.log(`Authenticated as: ${body.displayName} (${body.emailAddress})`);
  }

  // 2) Navigate to the Jira site root to establish web session cookies
  console.log('Navigating to site root to capture web cookies...');
  await page.goto('https://firsttry.atlassian.net/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(3000);

  // 3) Save storage state (cookies + localStorage)
  await context.storageState({ path: outPath });
  console.log(`Saved ${outPath}`);

  // 4) Report cookie summary
  const cookies = await context.cookies();
  console.log(`Captured ${cookies.length} cookies`);
  cookies.forEach(c => console.log(`  ${c.name} (${c.domain}) httpOnly=${c.httpOnly}`));

  console.log('PASS: headless auth capture complete');
  await browser.close();
})();
