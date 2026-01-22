import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL || "https://firsttry.atlassian.net/jira/dashboards/10102";
const OUT_STATE = process.env.STORAGE_STATE || "/workspaces/Firsttry/.auth/storageState.json";
const USER = process.env.JIRA_USER;
const API_TOKEN = process.env.JIRA_API_TOKEN;

if (!USER || !API_TOKEN) {
  console.error("[AUTH_TOKEN] Missing JIRA_USER or JIRA_API_TOKEN");
  process.exit(2);
}

fs.mkdirSync(path.dirname(OUT_STATE), { recursive: true });

(async () => {
  console.log(`[AUTH_TOKEN] Using API token for authentication`);
  console.log(`[AUTH_TOKEN] User: ${USER}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Set Authorization header using API token (Basic auth)
  await page.setExtraHTTPHeaders({
    "Authorization": "Basic " + Buffer.from(`${USER}:${API_TOKEN}`).toString("base64"),
  });

  // Navigate to dashboard with the Authorization header
  const resp = await page.goto(DASHBOARD_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  console.log(`[AUTH_TOKEN] Initial response: ${resp?.status()}`);

  // Make an authenticated API call to validate
  const myselfResp = await page.evaluate(async () => {
    const r = await fetch("/rest/api/3/myself");
    return { status: r.status, ok: r.ok };
  });

  console.log(`[AUTH_TOKEN] /myself status: ${myselfResp.status}`);

  if (myselfResp.status === 200) {
    console.log(`[AUTH_TOKEN] ✅ Authenticated successfully`);
    
    // Get the cookies that were set
    const cookies = await context.cookies();
    console.log(`[AUTH_TOKEN] Captured ${cookies.length} cookies`);
    cookies.forEach(c => console.log(`  - ${c.name}`));
  } else {
    console.error(`[AUTH_TOKEN] ❌ Authentication failed (status ${myselfResp.status})`);
  }

  // Save storage state
  await context.storageState({ path: OUT_STATE });
  console.log(`[AUTH_TOKEN] Saved storageState to ${OUT_STATE}`);

  await browser.close();
  
  process.exit(myselfResp.status === 200 ? 0 : 1);
})();
