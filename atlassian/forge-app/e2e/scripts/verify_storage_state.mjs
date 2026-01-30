import fs from "node:fs";

const STORAGE_STATE = process.env.STORAGE_STATE;
if (!STORAGE_STATE) {
  console.error("ERROR: STORAGE_STATE env var is required");
  process.exit(1);
}

// A) File exists + valid JSON
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

// B) cookies array exists and length >= 5
const cookies = Array.isArray(state.cookies) ? state.cookies : [];
if (cookies.length < 5) {
  console.error(`ERROR: storageState has insufficient cookies (found ${cookies.length}, need >= 5)`);
  process.exit(1);
}

// Extract domains and names for validation
const domains = cookies.map(c => String(c.domain || "")).filter(Boolean);
const names = cookies.map(c => String(c.name || "")).filter(Boolean);
const uniqueDomains = [...new Set(domains)];
const uniqueNames = [...new Set(names)];

// C) Must include at least one cookie domain containing ".atlassian.net" OR "firsttry.atlassian.net"
const hasJiraDomain = uniqueDomains.some(
  d => d.includes("atlassian.net") || d.includes("firsttry.atlassian.net")
);
if (!hasJiraDomain) {
  console.error("ERROR: storageState missing Jira site cookies (need .atlassian.net or firsttry.atlassian.net domain)");
  console.error("Domains seen:", uniqueDomains.slice(0, 30));
  process.exit(1);
}

// D) Must include at least one cookie domain containing ".atlassian.com" OR "id.atlassian.com"
const hasAtlassianIdDomain = uniqueDomains.some(
  d => d.includes("atlassian.com") || d.includes("id.atlassian.com")
);
if (!hasAtlassianIdDomain) {
  console.error("ERROR: storageState missing Atlassian ID cookies (need .atlassian.com or id.atlassian.com domain)");
  console.error("Domains seen:", uniqueDomains.slice(0, 30));
  process.exit(1);
}

// E) Must include at least ONE non-expired cookie
const now = Date.now() / 1000;
const hasValidCookie = cookies.some(
  c => c.expires === undefined || c.expires === null || c.expires > now
);
if (!hasValidCookie) {
  console.error("ERROR: storageState has no non-expired cookies (all cookies have expired)");
  process.exit(1);
}

// F) Print summary
console.log("PASS: storageState verification successful");
console.log(`  Cookies: ${cookies.length} total, ${uniqueDomains.length} unique domains, ${uniqueNames.length} unique names`);
console.log(`  Domains (sample, max 30):`, uniqueDomains.slice(0, 30));
console.log(`  Names (sample, max 30):`, uniqueNames.slice(0, 30));

// G) Exit 0 only on full compliance
process.exit(0);
