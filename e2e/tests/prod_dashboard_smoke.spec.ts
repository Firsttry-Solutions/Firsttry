import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const storageStatePath = "/workspaces/Firsttry/e2e/.auth/storageState.json";

// Use storage state for all tests in this file
test.use({
  storageState: storageStatePath,
});

test("prod dashboard smoke: authenticated access + evidence bundle", async ({ page }) => {
  // Increase test timeout for network operations
  test.setTimeout(180_000);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const evidenceDir = `/tmp/ft_dashboard_smoke_${ts}`;
  fs.mkdirSync(evidenceDir, { recursive: true });

  const targetUrl = "https://firsttry.atlassian.net/jira/dashboards/10102";

  // Fail-closed if storageState missing
  if (!fs.existsSync(storageStatePath)) {
    fs.writeFileSync(path.join(evidenceDir, "FAIL.txt"), "storageState.json missing\n");
    throw new Error("storageState.json missing");
  }

  // Hash storageState for proof
  const stateBytes = fs.readFileSync(storageStatePath);
  const sha = crypto.createHash("sha256").update(stateBytes).digest("hex");
  fs.writeFileSync(path.join(evidenceDir, "storageState.sha256.txt"), `${sha}\n`);
  fs.writeFileSync(path.join(evidenceDir, "storageState.bytes.txt"), `${stateBytes.length}\n`);

  const consoleLines: string[] = [];
  page.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
    // Skip networkidle - SPAs often have continuous background requests
    // Instead, wait for the ajs-base-url meta tag which indicates Jira is ready
    await page.waitForSelector('meta[name="ajs-base-url"]', { timeout: 30_000 }).catch(() => {});

    const finalUrl = page.url();
    fs.writeFileSync(path.join(evidenceDir, "final_url.txt"), `${finalUrl}\n`);

    // Fail-closed URL domain/path checks
    const u = new URL(finalUrl);
    const host = u.hostname.toLowerCase();
    const pathname = u.pathname.toLowerCase();
    
    fs.writeFileSync(path.join(evidenceDir, "host.txt"), `${host}\n`);
    fs.writeFileSync(path.join(evidenceDir, "path.txt"), `${pathname}\n`);

    const redirectedToId = host.includes("id.atlassian.com");
    const looksLikeLoginPath = pathname.includes("/login");

    expect(redirectedToId).toBeFalsy();
    expect(looksLikeLoginPath).toBeFalsy();

    // Auth/login negative checks
    const bodyText = await page.textContent("body");
    const hasLoginClue =
      (bodyText || "").toLowerCase().includes("atlassian account") ||
      (bodyText || "").toLowerCase().includes("log in") ||
      (await page.locator("#username").count()) > 0;

    // Logged-in Jira clue: check for any ajs-* meta tag which indicates Jira is loaded
    // ajs-base-url may be lazy-loaded, so check for other ajs-* indicators
    const hasJiraMetaTags =
      (await page.locator('meta[name^="ajs-"]').count()) > 0;

    expect(finalUrl).toContain("/jira/dashboards/10102");
    expect(hasLoginClue).toBeFalsy();
    expect(hasJiraMetaTags).toBeTruthy();

    // Optional proof snapshot on success
    await page.screenshot({ path: path.join(evidenceDir, "success.png"), fullPage: true });
    fs.writeFileSync(path.join(evidenceDir, "SUCCESS.txt"), `OK\nfinalUrl=${finalUrl}\nsha256=${sha}\n`);
  } catch (err) {
    // Failure evidence
    await page.screenshot({ path: path.join(evidenceDir, "failure.png"), fullPage: true }).catch(() => {});
    const html = await page.content().catch(() => "(content unavailable)");
    fs.writeFileSync(path.join(evidenceDir, "failure.html"), html);
    fs.writeFileSync(path.join(evidenceDir, "console.txt"), consoleLines.join("\n") + "\n");
    fs.writeFileSync(path.join(evidenceDir, "ERROR.txt"), String(err) + "\n");
    throw err;
  } finally {
    // Always write console log
    fs.writeFileSync(path.join(evidenceDir, "console.txt"), consoleLines.join("\n") + "\n");
  }
});
