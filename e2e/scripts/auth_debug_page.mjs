import fs from "node:fs";
import { chromium } from "playwright";

(async () => {
  console.log("[DEBUG] Starting page inspection");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.setDefaultTimeout(30_000);

  console.log("[DEBUG] Navigate to login page...");
  await page.goto("https://id.atlassian.com/login", { waitUntil: "domcontentloaded" });
  
  const url = page.url();
  const title = await page.title();
  console.log(`[DEBUG] URL: ${url}`);
  console.log(`[DEBUG] Title: ${title}`);

  // Wait a bit for JS to load
  await page.waitForTimeout(3000);

  // Get page HTML
  const html = await page.content();
  console.log(`[DEBUG] Page HTML length: ${html.length}`);
  
  // Save to file
  fs.writeFileSync("/tmp/ft_e2e_auth_real/login_page.html", html);
  console.log("[DEBUG] Saved HTML to /tmp/ft_e2e_auth_real/login_page.html");

  // List all forms
  const forms = await page.locator("form").count();
  console.log(`[DEBUG] Number of forms: ${forms}`);

  // List all inputs
  const inputs = await page.locator("input").all();
  console.log(`[DEBUG] Number of inputs: ${inputs.length}`);
  for (let i = 0; i < inputs.length; i++) {
    const id = await inputs[i].getAttribute("id");
    const name = await inputs[i].getAttribute("name");
    const type = await inputs[i].getAttribute("type");
    const dataTestId = await inputs[i].getAttribute("data-testid");
    console.log(`  [${i}] id=${id} name=${name} type=${type} data-testid=${dataTestId}`);
  }

  // Take screenshot
  await page.screenshot({ path: "/tmp/ft_e2e_auth_real/login_page.png", fullPage: true });
  console.log("[DEBUG] Screenshot saved to /tmp/ft_e2e_auth_real/login_page.png");

  await browser.close();
  process.exit(0);
})();
