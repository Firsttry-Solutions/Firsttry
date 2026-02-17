/* FT_PROOF:CANONICAL_JSON_V1 */

export function canonicalJsonStringify(value: any): string {
  if (value === null) return "null";

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Non-finite number not allowed in canonical JSON");
    }
    if (Object.is(value, -0)) return "0";
    return String(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map(v => canonicalJsonStringify(v)).join(",") + "]";
  }

  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return (
      "{" +
      keys
        .map(k => JSON.stringify(k) + ":" + canonicalJsonStringify(value[k]))
        .join(",") +
      "}"
    );
  }

  throw new Error("Unsupported type in canonical JSON");
}
