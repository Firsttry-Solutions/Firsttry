#!/usr/bin/env node
/**
 * Real login script with manual user interaction + automatic detection
 * Saves authenticated storageState after successful login
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const DASHBOARD_URL =
  process.env.JIRA_DASHBOARD_URL ||
  "https://firsttry.atlassian.net/jira/dashboards/10102";
const STORAGE_STATE = path.resolve(
  process.cwd(),
  "e2e/.auth/storageState.json"
);
const AUTH_DIR = path.dirname(STORAGE_STATE);

async function detectSuccessfulLogin(page) {
  const currentUrl = page.url();
  console.log(`[LOGIN_DETECT] URL: ${currentUrl}`);

  if (currentUrl.includes("id.atlassian.com/login")) {
    console.log("[LOGIN_DETECT] ❌ Still on login page");
    return false;
  }

  try {
    const response = await page.request.get(
      `${new URL(DASHBOARD_URL).origin}/rest/api/3/myself`,
      { timeout: 5000 }
    );
    const status = response.status();
    console.log(`[LOGIN_DETECT] /myself status: ${status}`);

    if (status === 200) {
      console.log("[LOGIN_DETECT] ✅ API valid");
      return true;
    } else {
      console.log(`[LOGIN_DETECT] ❌ API returned ${status}`);
      return false;
    }
  } catch (e) {
    console.log(`[LOGIN_DETECT] ❌ API probe failed: ${e.message}`);
    return false;
  }
}

async function main() {
  mkdirSync(AUTH_DIR, { recursive: true });
  console.log("[LOGIN] Starting headed browser...");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`[LOGIN] Navigating to ${DASHBOARD_URL}`);
    await page.goto(DASHBOARD_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log("[LOGIN] If login page appears, please log in now in the browser.");
    console.log("[LOGIN] Waiting for successful login (up to 5 minutes)...");

    let loggedIn = false;
    const maxAttempts = 60;
    let attempt = 0;

    while (!loggedIn && attempt < maxAttempts) {
      await page.waitForTimeout(5000);
      attempt++;

      console.log(`[LOGIN] Check ${attempt}/${maxAttempts}...`);
      loggedIn = await detectSuccessfulLogin(page);

      if (loggedIn) {
        console.log("[LOGIN] ✅ LOGIN SUCCESSFUL");
        break;
      }
    }

    if (!loggedIn) {
      console.error("[LOGIN] ❌ Login timed out after 5 minutes");
      process.exit(1);
    }

    console.log("[LOGIN] Saving storageState...");
    const storageState = await context.storageState();

    const cookieCount = storageState.cookies?.length || 0;
    const originCount = storageState.origins?.length || 0;
    const uniqueDomains = new Set(
      (storageState.cookies || []).map((c) => c.domain)
    ).size;

    writeFileSync(STORAGE_STATE, JSON.stringify(storageState, null, 2));

    console.log("[LOGIN] ═══════════════════════════════════════════");
    console.log(`[LOGIN] Final URL: ${page.url()}`);
    console.log(`[LOGIN] /myself status: 200`);
    console.log(`[LOGIN] Cookies: ${cookieCount}`);
    console.log(`[LOGIN] Domains: ${uniqueDomains}`);
    console.log(`[LOGIN] Origins: ${originCount}`);
    console.log("[LOGIN] ═══════════════════════════════════════════");

    process.exit(0);
  } catch (error) {
    console.error("[LOGIN] Error:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
