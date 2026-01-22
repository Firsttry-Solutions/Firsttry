import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const DASH_URL = process.env.JIRA_DASHBOARD_URL || "https://firsttry.atlassian.net/jira/dashboards/10102";
const USER = process.env.JIRA_USER;
const PASS = process.env.JIRA_PASSWORD;

if (!USER || !PASS) {
  console.error("[AUTH_FRESH] Missing JIRA_USER or JIRA_PASSWORD in env.");
  process.exit(2);
}

const OUT = process.env.STORAGE_STATE || path.resolve(process.cwd(), ".auth/storageState.json");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

function now() { return new Date().toISOString(); }

(async () => {
  console.log(`[AUTH_FRESH] ${now()} Starting fresh UI login with forced logout`);
  console.log(`[AUTH_FRESH] Dashboard URL: ${DASH_URL}`);
  console.log(`[AUTH_FRESH] Output storageState: ${OUT}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(45_000);

  // First, go to logout to clear any existing session
  console.log("[AUTH_FRESH] Step 1: Clearing any existing session (logout)...");
  await page.goto("https://firsttry.atlassian.net/login", { waitUntil: "domcontentloaded" })
    .catch(() => console.log("[AUTH_FRESH] Logout page load skipped"));

  // Now go to login explicitly
  console.log("[AUTH_FRESH] Step 2: Navigate to login page...");
  await page.goto("https://id.atlassian.com/login", { waitUntil: "domcontentloaded" });
  
  const url1 = page.url();
  console.log(`[AUTH_FRESH] Login page URL: ${url1}`);

  // Find and fill username
  console.log("[AUTH_FRESH] Step 3: Filling username field...");
  const userSelectorCandidates = [
    'input#username',
    'input[name="username"]',
    'input[type="email"]'
  ];
  let userSel = null;
  for (const sel of userSelectorCandidates) {
    try {
      const count = await page.locator(sel).count();
      if (count > 0) { userSel = sel; break; }
    } catch (e) {}
  }
  
  if (!userSel) {
    console.error("[AUTH_FRESH] Cannot find username/email input field!");
    console.log("[AUTH_FRESH] Available form inputs:");
    const inputs = await page.locator("input").all();
    for (let i = 0; i < inputs.length; i++) {
      const id = await inputs[i].getAttribute("id");
      const name = await inputs[i].getAttribute("name");
      const type = await inputs[i].getAttribute("type");
      console.log(`  [${i}] id=${id} name=${name} type=${type}`);
    }
    await page.screenshot({ path: "/tmp/ft_e2e_auth_real/auth_blocker_no_username_field.png", fullPage: true });
    process.exit(10);
  }

  await page.fill(userSel, USER);
  console.log(`[AUTH_FRESH] Filled username: ${USER}`);

  // Click continue
  console.log("[AUTH_FRESH] Step 4: Clicking continue button...");
  const nextBtn = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
  if (await nextBtn.count()) {
    await nextBtn.click();
  } else {
    console.error("[AUTH_FRESH] No continue button found!");
    await page.screenshot({ path: "/tmp/ft_e2e_auth_real/auth_blocker_no_continue_btn.png", fullPage: true });
    process.exit(11);
  }

  // Wait for password field
  console.log("[AUTH_FRESH] Step 5: Waiting for password field...");
  const passSelCandidates = [
    'input#password',
    'input[name="password"]',
    'input[type="password"]'
  ];
  let passSel = null;
  let attempts = 0;
  while (!passSel && attempts < 10) {
    await page.waitForTimeout(500);
    for (const sel of passSelCandidates) {
      try {
        const count = await page.locator(sel).count();
        if (count > 0) { passSel = sel; break; }
      } catch (e) {}
    }
    attempts++;
  }
  
  if (!passSel) {
    console.error("[AUTH_FRESH] Password field never appeared after continue!");
    console.log("[AUTH_FRESH] Current URL: " + page.url());
    console.log("[AUTH_FRESH] Available form inputs:");
    const inputs = await page.locator("input").all();
    for (let i = 0; i < inputs.length; i++) {
      const id = await inputs[i].getAttribute("id");
      const name = await inputs[i].getAttribute("name");
      const type = await inputs[i].getAttribute("type");
      console.log(`  [${i}] id=${id} name=${name} type=${type}`);
    }
    await page.screenshot({ path: "/tmp/ft_e2e_auth_real/auth_blocker_no_password_field.png", fullPage: true });
    process.exit(12);
  }

  await page.fill(passSel, PASS);
  console.log("[AUTH_FRESH] Filled password");

  // Submit login
  console.log("[AUTH_FRESH] Step 6: Submitting login form...");
  const loginBtn = page.locator('button:has-text("Log in"), button:has-text("Continue")').first();
  if (await loginBtn.count()) {
    await loginBtn.click();
  }

  // Wait for redirect away from id.atlassian.com
  console.log("[AUTH_FRESH] Step 7: Waiting for redirect back to firsttry.atlassian.net...");
  let redirected = false;
  let redirectAttempts = 0;
  while (!redirected && redirectAttempts < 30) {
    const currentUrl = page.url();
    if (!currentUrl.includes("id.atlassian.com")) {
      redirected = true;
      console.log(`[AUTH_FRESH] Redirected to: ${currentUrl}`);
      break;
    }
    await page.waitForTimeout(1000);
    redirectAttempts++;
  }

  if (!redirected) {
    console.error("[AUTH_FRESH] Still on id.atlassian.com after 30s - likely MFA/SSO approval required!");
    await page.screenshot({ path: "/tmp/ft_e2e_auth_real/auth_blocker_mfa_required.png", fullPage: true });
    process.exit(13);
  }

  // Navigate to dashboard
  console.log("[AUTH_FRESH] Step 8: Navigating to dashboard...");
  await page.goto(process.env.JIRA_DASHBOARD_URL || "https://firsttry.atlassian.net/jira/dashboards/10102", { waitUntil: "domcontentloaded" });
  console.log(`[AUTH_FRESH] Dashboard URL: ${page.url()}`);

  // Save storage state
  console.log("[AUTH_FRESH] Step 9: Saving storageState...");
  await context.storageState({ path: OUT });
  console.log(`[AUTH_FRESH] ✓ Saved storageState: ${OUT}`);

  await browser.close();
  console.log(`[AUTH_FRESH] ${now()} Done - login flow complete`);
  process.exit(0);
})();
