import fs from "fs";
import path from "path";
import type { Page, Request, Response } from "@playwright/test";

/**
 * Safe Rule-C observer:
 * - NEVER stores cookies/authorization headers
 * - Stores bounded redirect chain + minimal request/response metadata
 * - Writes required files into the provided bundleDir
 */
function safeHeaders(h: Record<string, string | undefined>) {
  const out: Record<string, string> = {};
  for (const [k0, v0] of Object.entries(h || {})) {
    const k = String(k0).toLowerCase();
    if (!v0) continue;
    if (
      k === "cookie" ||
      k === "set-cookie" ||
      k === "authorization" ||
      k.startsWith("x-auth") ||
      k.includes("token") ||
      k.includes("session")
    ) {
      continue;
    }
    out[k] = String(v0);
  }
  return out;
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function writeText(filePath: string, s: string) {
  fs.writeFileSync(filePath, s, { encoding: "utf8" });
}

function writeJson(filePath: string, o: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(o, null, 2), { encoding: "utf8" });
}

export async function captureRuleCArtifactsSafe(opts: {
  page: Page;
  bundleDir: string;
  triggerUrlContains: string; // substring to identify the Rule-C trigger request
  maxRedirectLines?: number;
}) {
  const { page, bundleDir, triggerUrlContains } = opts;
  const maxRedirectLines = opts.maxRedirectLines ?? 200;

  ensureDir(bundleDir);

  const redirectLines: string[] = [];
  let capturedReq: Request | null = null;
  let capturedRes: Response | null = null;

  page.on("response", async (res) => {
    try {
      const req = res.request();
      const url = req.url();
      if (!url.includes(triggerUrlContains)) return;

      capturedReq = req;
      capturedRes = res;

      // Redirect chain (bounded)
      const status = res.status();
      const loc = (await res.headerValue("location")) || "";
      const line = `${status} ${url}${loc ? " -> " + loc : ""}`;
      redirectLines.push(line);
      if (redirectLines.length > maxRedirectLines) redirectLines.splice(0, redirectLines.length - maxRedirectLines);
    } catch {
      // swallow: observer must never fail the test
    }
  });

  // At end, write required files (even if partial)
  async function flush() {
    // 25 redirect chain
    writeText(path.join(bundleDir, "25_ruleC_redirect_chain.txt"), redirectLines.length ? redirectLines.join("\n") + "\n" : "NO_REDIRECTS_CAPTURED\n");

    // 23 request json (safe)
    if (capturedReq) {
      writeJson(path.join(bundleDir, "23_ruleC_trigger_request.json"), {
        url: capturedReq.url(),
        method: capturedReq.method(),
        headers: safeHeaders(capturedReq.headers()),
        postData: capturedReq.postData() ? "[REDACTED_BODY_PRESENT]" : "[NO_BODY]",
      });
    } else {
      writeJson(path.join(bundleDir, "23_ruleC_trigger_request.json"), { note: "REQUEST_NOT_CAPTURED" });
    }

    // 24 response json (safe)
    if (capturedRes) {
      writeJson(path.join(bundleDir, "24_ruleC_trigger_response.json"), {
        url: capturedRes.url(),
        status: capturedRes.status(),
        statusText: capturedRes.statusText(),
        headers: safeHeaders(capturedRes.headers()),
      });
    } else {
      writeJson(path.join(bundleDir, "24_ruleC_trigger_response.json"), { note: "RESPONSE_NOT_CAPTURED" });
    }

    // 22 summary
    const summary = [
      `bundleDir=${bundleDir}`,
      `capturedReq=${capturedReq ? "YES" : "NO"}`,
      `capturedRes=${capturedRes ? "YES" : "NO"}`,
      `redirectLines=${redirectLines.length}`,
      `safeHeaderPolicy=cookie/authorization/set-cookie/token/session removed`,
    ].join("\n") + "\n";
    writeText(path.join(bundleDir, "22_auth_wall_detector_summary.txt"), summary);
  }

  return { flush };
}
