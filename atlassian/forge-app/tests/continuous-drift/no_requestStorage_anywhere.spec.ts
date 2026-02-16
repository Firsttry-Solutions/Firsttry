import fs from "fs";
import path from "path";

function walk(dir: string, out: string[] = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("ban requestStorage() in src", () => {
  it("should not contain requestStorage() anywhere in src/", () => {
    const files = walk(path.join(process.cwd(), "src"));
    const hits: string[] = [];
    for (const f of files) {
      const txt = fs.readFileSync(f, "utf8");
      if (txt.includes("requestStorage(")) hits.push(f);
    }
    expect(hits).toEqual([]);
    console.log("[FT_PROOF_NO_REQUESTSTORAGE_ANYWHERE_PASS]");
  });
});
