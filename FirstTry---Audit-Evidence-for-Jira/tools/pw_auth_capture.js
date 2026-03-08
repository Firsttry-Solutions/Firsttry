const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://firsttry.atlassian.net');
  console.log("LOGIN MANUALLY in the opened browser. After Jira loads, return here and press Enter.");
  process.stdin.resume();
  await new Promise(r => process.stdin.once('data', r));
  await context.storageState({ path: '/tmp/ft_storage_state.json' });
  console.log("Saved /tmp/ft_storage_state.json");
  await browser.close();
})();
