import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const DASHBOARD_URL =
  process.env.JIRA_DASHBOARD_URL || "https://firsttry.atlassian.net/jira/dashboards/10102";

const OUT_STATE =
  process.env.STORAGE_STATE || "/workspaces/Firsttry/e2e/.auth/storageState.json";

const USER = process.env.JIRA_USER;
const PASS = process.env.JIRA_PASSWORD;

if (!USER) {
  console.error("[AUTH_UI] Missing env: JIRA_USER");
  process.exit(2);
}
if (!PASS) {
  console.error("[AUTH_UI] Missing env: JIRA_PASSWORD");
  process.exit(2);
}

fs.mkdirSync(path.dirname(OUT_STATE), { recursive: true });

const ART_DIR = process.env.AUTH_ART_DIR || "/tmp/ft_e2e_auth_ui";
fs.mkdirSync(ART_DIR, { recursive: true });

function nowTag() {
  return new Date().toISOString().replace(/[:+]/g, "_");
}
const runDir = path.join(ART_DIR, nowTag());
fs.mkdirSync(runDir, { recursive: true });

function isAtlassianLoginUrl(u) {
  return /id\.atlassian\.com\/login/i.test(u) || /auth\./i.test(u);
}

function looksLikeMfaOrSso(pageContent, url) {
  const s = (pageContent || "").toLowerCase();
  const u = (url || "").toLowerCase();
  // very broad heuristics: we WANT to fail if we see signs of OTP / SSO enforcement
  const indicators = [
    "one-time", "one time", "verification code", "enter code", "two-step", "two step",
    "multi-factor", "mfa", "authenticator", "security key", "passkey", "sso", "single sign-on",
    "verify it's you", "check your phone", "use your mobile", "approve sign in"
  ];
  return indicators.some(k => s.includes(k)) || u.includes("login/verify") || u.includes("login/otp");
}

async function snap(page, name) {
  const p = path.join(runDir, name);
  await page.screenshot({ path: p, fullPage: true }).catch(() => {});
  return p;
}

(async () => {
  console.log(`[AUTH_UI] Dashboard URL: ${DASHBOARD_URL}`);
  console.log(`[AUTH_UI] Output storageState: ${OUT_STATE}`);
  console.log(`[AUTH_UI] Artifacts: ${runDir}`);

  const browser = await chromium.launch({
    headless: true, // codespaces-friendly
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  page.on("console", (msg) => {
    try {
      fs.appendFileSync(path.join(runDir, "browser_console.log"), `[${msg.type()}] ${msg.text()}\n`);
    } catch {}
  });

  page.on("pageerror", (err) => {
    try {
      fs.appendFileSync(path.join(runDir, "browser_pageerror.log"), `${String(err)}\n`);
    } catch {}
  });

  // 1) Navigate to dashboard
  const resp = await page.goto(DASHBOARD_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  console.log(`[AUTH_UI] Initial response status: ${resp ? resp.status() : "NO_RESPONSE"}`);
  console.log(`[AUTH_UI] Initial URL: ${page.url()}`);

  await snap(page, "01_initial.png");

  // 2) If we're on Atlassian login, do email+password flow
  if (isAtlassianLoginUrl(page.url())) {
    console.log("[AUTH_UI] Detected Atlassian login page. Attempting automated login...");

    // Email / username field variants
    const emailSelectors = [
      'input[type="email"]',
      'input[name="username"]',
      'input#username',
      'input[name="email"]',
    ];
    let emailFound = false;
    for (const sel of emailSelectors) {
      const loc = page.locator(sel);
      if (await loc.count()) {
        await loc.first().fill(USER, { timeout: 30_000 });
        emailFound = true;
        break;
      }
    }
    if (!emailFound) {
      await snap(page, "E_no_email_field.png");
      throw new Error("Could not find email/username input on Atlassian login page.");
    }

    // "Continue" / submit
    const continueSelectors = [
      'button[type="submit"]',
      'button:has-text("Continue")',
      'button:has-text("Log in")',
      'input[type="submit"]',
    ];
    let clicked = false;
    for (const sel of continueSelectors) {
      const loc = page.locator(sel);
      if (await loc.count()) {
        await loc.first().click({ timeout: 30_000 });
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      await snap(page, "E_no_continue_button.png");
      throw new Error("Could not find Continue/submit button on Atlassian login page.");
    }

    await page.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => {});
    await snap(page, "02_after_email.png");

    // Password field variants
    const passSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input#password',
    ];

    // Wait for password field OR detect that we're blocked by SSO/MFA
    const content1 = await page.content().catch(() => "");
    if (looksLikeMfaOrSso(content1, page.url())) {
      await snap(page, "E_mfa_or_sso_detected.png");
      throw new Error(
        "MFA/SSO detected after email step. Automated login cannot proceed in a non-interactive environment."
      );
    }

    let passFound = false;
    for (const sel of passSelectors) {
      const loc = page.locator(sel);
      if (await loc.count()) {
        await loc.first().fill(PASS, { timeout: 30_000 });
        passFound = true;
        break;
      }
    }
    if (!passFound) {
      await snap(page, "E_no_password_field.png");
      throw new Error("Could not find password input on Atlassian login page.");
    }

    // Submit password
    clicked = false;
    for (const sel of continueSelectors) {
      const loc = page.locator(sel);
      if (await loc.count()) {
        await loc.first().click({ timeout: 30_000 });
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      await snap(page, "E_no_submit_after_password.png");
      throw new Error("Could not find submit button after entering password.");
    }

    await page.waitForLoadState("domcontentloaded", { timeout: 120_000 }).catch(() => {});
    await snap(page, "03_after_password_submit.png");

    // 3) Post-login: must end up back on Jira domain (dashboard)
    // Jira sometimes does an intermediate hop; we allow some time.
    const start = Date.now();
    const deadline = start + 120_000;

    while (Date.now() < deadline) {
      const u = page.url();
      if (!isAtlassianLoginUrl(u) && /firsttry\.atlassian\.net\/jira\/dashboards\/\d+/i.test(u)) {
        break;
      }
      // detect MFA/SSO or bad creds
      const c = await page.content().catch(() => "");
      if (looksLikeMfaOrSso(c, u)) {
        await snap(page, "E_mfa_or_sso_post_password.png");
        throw new Error("MFA/SSO detected after password submit. Cannot proceed automatically.");
      }
      if (c.toLowerCase().includes("incorrect") || c.toLowerCase().includes("wrong password")) {
        await snap(page, "E_bad_credentials.png");
        throw new Error("Login failed: incorrect username/password (detected on page).");
      }
      await page.waitForTimeout(1000);
    }

    console.log(`[AUTH_UI] Post-login URL: ${page.url()}`);
    await snap(page, "04_post_login.png");

    if (isAtlassianLoginUrl(page.url())) {
      throw new Error("Still on Atlassian login domain after attempted login. Session not established.");
    }
    if (!/firsttry\.atlassian\.net\/jira\/dashboards\/\d+/i.test(page.url())) {
      throw new Error(`Unexpected post-login URL: ${page.url()}`);
    }
  } else {
    console.log("[AUTH_UI] Not on Atlassian login domain initially. Continuing.");
  }

  // 4) Save storage state
  await context.storageState({ path: OUT_STATE });
  console.log(`[AUTH_UI] ✅ Saved storageState to: ${OUT_STATE}`);

  // 5) Quick REST probe using browser cookies via fetch inside page context (SESSION-based)
  // This is not the same as API token basic auth. This validates SESSION.
  const myselfStatus = await page.evaluate(async () => {
    const r = await fetch("/rest/api/3/myself", { credentials: "include" });
    return r.status;
  }).catch(() => -1);

  console.log(`[AUTH_UI] SESSION probe /rest/api/3/myself status (via cookies): ${myselfStatus}`);
  fs.writeFileSync(path.join(runDir, "session_probe_status.txt"), String(myselfStatus));

  await browser.close();

  if (myselfStatus !== 200) {
    console.error("[AUTH_UI] ❌ Session probe failed; storageState may not be sufficient.");
    process.exit(3);
  }

  console.log("[AUTH_UI] ✅ SESSION established and validated (200).");
})();
