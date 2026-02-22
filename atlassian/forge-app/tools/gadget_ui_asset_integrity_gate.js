#!/usr/bin/env node
/**
 * Gadget-UI Asset Integrity Gate (fail-closed)
 *
 * Usage:  node tools/gadget_ui_asset_integrity_gate.js
 *
 * Parses src/gadget-ui/dist/index.html and asserts that every locally-referenced
 * asset (<script src="...">, <link href="...">) exists on disk in dist/.
 *
 * Exit 0 + marker  FT_PROOF_GADGET_UI_ASSET_INTEGRITY_v1 ok=true   on success.
 * Exit 1 + marker  FT_FAIL_GADGET_UI_ASSET_MISSING file=<path>     on failure.
 *
 * Pure Node (fs/path only). No external deps.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const DIST_DIR = path.resolve(__dirname, "..", "src", "gadget-ui", "dist");
const INDEX_HTML = path.join(DIST_DIR, "index.html");

function main() {
  // 1. Fail-closed: index.html must exist
  if (!fs.existsSync(INDEX_HTML)) {
    console.error(`FT_FAIL_GADGET_UI_ASSET_MISSING file=${INDEX_HTML}`);
    console.error("FAIL: dist/index.html does not exist");
    process.exit(1);
  }

  const html = fs.readFileSync(INDEX_HTML, "utf8");

  // 2. Extract all asset references
  //    <script ... src="...">  and  <link ... href="...">
  const refs = [];

  // script src
  const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    refs.push(m[1]);
  }

  // link href (stylesheets, icons, etc.)
  const linkRe = /<link[^>]+href=["']([^"']+)["']/gi;
  while ((m = linkRe.exec(html)) !== null) {
    refs.push(m[1]);
  }

  console.log(`[ASSET_GATE] Found ${refs.length} asset reference(s) in index.html`);

  // 3. Filter to local-only (skip http://, https://, data:, //)
  const localRefs = refs.filter((r) => {
    if (/^https?:\/\//i.test(r)) return false;
    if (/^data:/i.test(r)) return false;
    if (r.startsWith("//")) return false;
    return true;
  });

  console.log(`[ASSET_GATE] ${localRefs.length} local asset(s) to verify`);

  // 4. Verify each local asset exists
  let failures = 0;
  for (const ref of localRefs) {
    // Strip query string and fragment
    const cleaned = ref.split("?")[0].split("#")[0];
    // Resolve relative to dist dir
    const resolved = path.resolve(DIST_DIR, cleaned);

    if (fs.existsSync(resolved)) {
      console.log(`[ASSET_GATE] ✓ ${cleaned}`);
    } else {
      console.error(`FT_FAIL_GADGET_UI_ASSET_MISSING file=${cleaned}`);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`FAIL: ${failures} asset(s) missing from dist/`);
    process.exit(1);
  }

  // 5. Pass
  console.log("FT_PROOF_GADGET_UI_ASSET_INTEGRITY_v1 ok=true");
  process.exit(0);
}

main();
