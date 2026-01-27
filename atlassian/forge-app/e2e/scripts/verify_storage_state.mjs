import fs from "node:fs";

const STORAGE_STATE = process.env.STORAGE_STATE;
if (!STORAGE_STATE) {
  console.error("ERROR: STORAGE_STATE env var is required");
  process.exit(1);
}
if (!fs.existsSync(STORAGE_STATE)) {
  console.error(`ERROR: storageState file not found: ${STORAGE_STATE}`);
  process.exit(1);
}

let state;
try {
  state = JSON.parse(fs.readFileSync(STORAGE_STATE, "utf8"));
} catch (e) {
  console.error(`ERROR: failed to parse storageState JSON: ${String(e)}`);
  process.exit(1);
}

const cookies = Array.isArray(state.cookies) ? state.cookies : [];
const domains = cookies.map(c => String(c.domain || "")).filter(Boolean);

const hasJira = domains.some(d => d.includes("firsttry.atlassian.net"));
const hasAtlassianId = domains.some(d => d.includes("atlassian.com") || d.includes("id.atlassian.com"));

if (!hasJira) {
  console.error("ERROR: storageState missing Jira site cookies for firsttry.atlassian.net");
  console.error("Domains seen:", [...new Set(domains)].slice(0, 50));
  process.exit(1);
}
if (!hasAtlassianId) {
  console.error("ERROR: storageState missing Atlassian ID cookies (*.atlassian.com / id.atlassian.com)");
  console.error("Domains seen:", [...new Set(domains)].slice(0, 50));
  process.exit(1);
}

console.log("PASS: storageState contains Jira + Atlassian ID cookie domains");
console.log("Cookie domains (unique, sample):", [...new Set(domains)].slice(0, 20));
process.exit(0);
