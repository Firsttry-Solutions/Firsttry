import fs from "node:fs";
import path from "node:path";

const STORAGE_STATE = process.env.STORAGE_STATE;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_USER = process.env.JIRA_USER;

if (!STORAGE_STATE) throw new Error("STORAGE_STATE env var is required");
if (!JIRA_API_TOKEN) throw new Error("JIRA_API_TOKEN env var is required");
if (!JIRA_USER) throw new Error("JIRA_USER env var is required");

const dir = path.dirname(STORAGE_STATE);
fs.mkdirSync(dir, { recursive: true });

// Create a synthetic storage state with API token as Bearer auth
// This allows the probe to work even if browser-based auth is not available
const storageState = {
  cookies: [
    {
      name: "firsttry-jira-auth-token",
      value: JIRA_API_TOKEN,
      domain: ".firsttry.atlassian.net",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
      httpOnly: true,
      secure: true,
      sameSite: "Strict"
    },
    {
      name: "atlassian-id-auth",
      value: JIRA_API_TOKEN,
      domain: ".atlassian.com",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 86400 * 30,
      httpOnly: true,
      secure: true,
      sameSite: "Strict"
    }
  ],
  origins: [
    {
      origin: "https://firsttry.atlassian.net",
      localStorage: [
        {
          name: "JIRA_USER",
          value: JIRA_USER
        },
        {
          name: "JIRA_API_TOKEN",
          value: JIRA_API_TOKEN
        }
      ]
    }
  ]
};

fs.writeFileSync(STORAGE_STATE, JSON.stringify(storageState, null, 2));
console.log("REGENERATED_STORAGE_STATE: synth etic storage state created from env tokens");
console.log("File:", STORAGE_STATE);
console.log("User:", JIRA_USER);
console.log("Domains: .firsttry.atlassian.net, .atlassian.com");
process.exit(0);
