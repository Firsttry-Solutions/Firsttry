import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const RUN_DIR = process.env.RUN_DIR;
const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL;
const STORAGE_STATE = process.env.STORAGE_STATE;

if (!RUN_DIR) throw new Error("RUN_DIR env var is required");
if (!JIRA_DASHBOARD_URL) throw new Error("JIRA_DASHBOARD_URL env var is required");
if (!STORAGE_STATE) throw new Error("STORAGE_STATE env var is required");

const outFile = path.join(RUN_DIR, "20_dashboard_console.txt");
const gadgetForbidden = [
  "status=undefined",
  "reason=undefined",
  "FATAL_",
  "Uncaught"
];

function append(line) {
  fs.appendFileSync(outFile, line + "\n");
}

function isGadgetFrame(url) {
  return url && (url.includes("govGadget") || (url.includes("atlassian-dev.net") && url.includes("govGadget")));
}

(async () => {
  fs.writeFileSync(outFile, `=== DASHBOARD SMOKE PROBE ===\nURL=${JIRA_DASHBOARD_URL}\nSTATE=${STORAGE_STATE}\n\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STORAGE_STATE });

  const page = await context.newPage();
  let sawSuccessMarker = false;
  let sawForbidden = false;
  let sawPageError = false;
  let gadgetFrameUrl = null;

  page.on("console", (msg) => {
    const line = `[console.${msg.type()}] ${msg.text()}`;
    const msgUrl = msg.location()?.url || "";
    append(line);
    
    // Check for success marker (any frame)
    if (line.includes("[UI_FT_GETDASHBOARDSTATE_SUCCESS]")) sawSuccessMarker = true;
    
    // Check for L0_DASHBOARD_RENDERED + HARD_ERROR (gadget frame only)
    if (isGadgetFrame(msgUrl) && line.includes("[L0_DASHBOARD_RENDERED]") && line.includes("HARD_ERROR")) {
      sawForbidden = true;
      append(`[gadget-frame-error] L0_DASHBOARD_RENDERED with HARD_ERROR detected`);
    }
    
    // Check for forbidden markers in gadget frame only
    if (isGadgetFrame(msgUrl) && gadgetForbidden.some(f => line.includes(f))) sawForbidden = true;
  });

  page.on("pageerror", (err) => {
    sawPageError = true;
    append(`[pageerror] ${String(err)}`);
  });
  
  page.on("response", (resp) => {
    const respUrl = resp.url();
    const status = resp.status();
    if ((status === 401 || status === 403) && isGadgetFrame(respUrl)) {
      sawForbidden = true;
      append(`[gadget-frame-auth-fail] ${status} ${respUrl}`);
    }
  });
  
  page.on("requestfailed", (req) => {
    const reqUrl = req.url();
    if (isGadgetFrame(reqUrl)) {
      sawForbidden = true;
      append(`[gadget-frame-request-failed] ${reqUrl}`);
    }
  });

  // Do NOT use networkidle (Atlassian often never becomes idle). Use domcontentloaded.
  await page.goto(JIRA_DASHBOARD_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (sawForbidden || sawPageError) break;
    if (sawSuccessMarker) break;
    await page.waitForTimeout(500);
  }

  const finalUrl = page.url();
  await context.close();
  await browser.close();

  // Check for login redirect
  if (finalUrl.includes("id.atlassian.com") || finalUrl.toLowerCase().includes("/login")) {
    append("FAIL: redirected to login page (NOT_LOGGED_IN)");
    console.log("PROBE_FAIL: redirected to login page");
    process.exit(1);
  }

  if (!sawSuccessMarker) {
    append("FAIL: did not observe [UI_FT_GETDASHBOARDSTATE_SUCCESS] within 120s");
    console.log("PROBE_FAIL: did not observe success marker within 120s");
    process.exit(1);
  }
  if (sawForbidden) {
    append("FAIL: forbidden console markers detected");
    console.log("PROBE_FAIL: forbidden console markers detected");
    process.exit(1);
  }
  if (sawPageError) {
    append("FAIL: pageerror detected");
    console.log("PROBE_FAIL: pageerror detected");
    process.exit(1);
  }

  append("PASS: success marker observed, no forbidden markers, no pageerror");
  console.log("PROBE_PASS: success marker observed, no forbidden markers, no pageerror");
  process.exit(0);
})();
