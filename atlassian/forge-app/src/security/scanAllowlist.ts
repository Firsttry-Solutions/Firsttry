/* FT_PROOF:SCAN_ALLOWLIST_V1 */

export type AllowlistedMatch = {
  // Which scan this applies to (outbound or mutation)
  family: "outbound" | "mutation";
  // The scan rule id (must match ids in sourceScan.ts)
  ruleId: string;
  // File path relative to app root, using forward slashes
  fileRel: string;
  // Exact line number (1-based). If the code moves, allowlist must be updated deliberately.
  line: number;
  // Substring that must appear in the matched line (defensive)
  lineMustInclude: string;
  // Human-auditable justification (short, factual)
  justification: string;
};

export const SCAN_ALLOWLIST_VERSION = "v1";

/**
 * IMPORTANT:
 * - Keep this list as small as possible.
 * - Every entry is an explicit, auditable exception.
 * - No broad regex allowlisting. No "same-origin" claims. Just explicit known-safe matches.
 */
export const ALLOWLIST: AllowlistedMatch[] = [
  {
    family: "outbound",
    ruleId: "SCAN_NO_FETCH",
    fileRel: "src/admin/phase5_admin_page.ts",
    line: 1138,
    lineMustInclude: "window.location.href",
    justification: "Same-origin fetch to admin page form handler (?action=generateNow). Not external. POST to self."
  },
  {
    family: "outbound",
    ruleId: "SCAN_NO_FETCH",
    fileRel: "src/admin/phase5_admin_page.ts",
    line: 1167,
    lineMustInclude: "export=json",
    justification: "Same-origin fetch to admin page JSON export handler (?export=json). Not external. GET from self."
  },
  {
    family: "outbound",
    ruleId: "SCAN_NO_FETCH",
    fileRel: "src/admin/phase5_admin_page.ts",
    line: 1185,
    lineMustInclude: "export=pdf",
    justification: "Same-origin fetch to admin page PDF export handler (?export=pdf). Not external. GET from self."
  }
];
