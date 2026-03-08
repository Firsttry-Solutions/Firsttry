import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL;
const STORAGE_STATE = process.env.STORAGE_STATE;

if (!JIRA_DASHBOARD_URL) throw new Error("JIRA_DASHBOARD_URL env var is required");
if (!STORAGE_STATE) throw new Error("STORAGE_STATE env var is required");

const dir = path.dirname(STORAGE_STATE);
fs.mkdirSync(dir, { recursive: true });

const TIMEOUT_MS = 600000; // 10 min

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  const page = await context.newPage();
  await page.goto(JIRA_DASHBOARD_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const u = page.url();
    const onId = u.includes("id.atlassian.com");
    const onLogin = u.toLowerCase().includes("/login");
    const onJira = u.includes("firsttry.atlassian.net") && u.includes("/jira");

    if (onJira && !onId && !onLogin) {
      await context.storageState({ path: STORAGE_STATE });
      await context.close();
      await browser.close();
      console.log("AUTH_REFRESH_PASS: storageState saved to", STORAGE_STATE);
      process.exit(0);
    }
    await page.waitForTimeout(1000);
  }

  const finalUrl = page.url();
  await context.close();
  await browser.close();
  console.log("AUTH_REFRESH_FAIL: did not reach Jira authenticated URL within timeout");
  console.log("Final URL:", finalUrl);
  process.exit(1);
})();
