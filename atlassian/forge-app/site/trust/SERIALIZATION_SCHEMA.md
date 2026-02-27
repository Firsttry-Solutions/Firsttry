# Serialization Schema

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## Overview

This document specifies how FirstTry serializes objects to JSON for deterministic hashing and reproducible exports.

---

## Canonical JSON Encoding

All JSON serialization follows these strict rules to ensure determinism:

### 1. Encoding
- **Character set**: UTF-8
- **Unicode escaping**: Non-ASCII characters MUST be escaped as \uXXXX (uppercase hex)
- **String quoting**: Double quotes only; no single quotes
- **Whitespace**: None (except within quoted strings)

**Example**:
```json
{"name":"Jörg Müller"}  ❌ Invalid (Unicode unescaped)
{"name":"J\u00f6rg M\u00fcller"}  ✅ Valid (Unicode escaped)
```

### 2. Ordering
- **Fields**: Sorted alphabetically by key name (ascending, case-sensitive)
- **Arrays**: Preserve input order unless schema specifies sorting
- **Objects**: Apply sorting recursively

**Example**:
```json
✅ {"a":"x","b":"y","c":"z"}
❌ {"b":"y","a":"x","c":"z"}  (not sorted)
```

### 3. Number Representation
- **Integers**: No decimal point (e.g., 42, not 42.0)
- **Floats**: Decimal point with up to 14 significant digits
- **Precision**: No exponential notation unless value < 0.0001 or > 10^14
- **NaN/Infinity**: Not permitted; use explicit string or null

**Example**:
```json
{"count":42,"ratio":0.5,"small":0.00001,"large":123456789012345}
```

### 4. Null Handling
- **Explicit null**: Include only if schema requires it
- **Omit or null**: Prefer omission for brevity; null ONLY for explicit empty values

**Example**:
```json
✅ {"name":"Alice","email":null,"phone":null}  (explicit nulls for fields present but empty)
✅ {"name":"Alice"}  (omit absent fields)
❌ {"name":"Alice","email":null,"phone":""}  (inconsistent: null vs empty string)
```

### 5. Boolean Representation
- Lowercase: `true` or `false`
- Never: `True`, `False`, `TRUE`, `FALSE`, `1`, `0`

---

## First-Class Schemas

### Snapshot Schema
```
{
  "snapshot_id": integer,
  "timestamp": ISO8601_UTC_string,
  "projects": [Project],
  "permissions": [Permission]
}
```

### Project Schema
```
{
  "id": string,
  "key": string,
  "name": string,
  "lead": string (user ID)
}
```

### Permission Schema
```
{
  "permission": string (permission name),
  "resource": string (project key or issue key),
  "subject": string (user ID or group name)
}
```

### Ledger Entry Schema
```
{
  "action": string,
  "hash": string (SHA256 hex, 64 chars),
  "nonce": string (base64),
  "timestamp": ISO8601_UTC_string
}
```

### Manifest Schema (in Export)
```
{
  "app_version": string,
  "audit_record_count": integer,
  "audit_root_hash": string,
  "build_git_sha": string,
  "build_ui_bundle_hash": string,
  "customer_jira_site": string,
  "deterministic_zip_hash": string,
  "export_scope": string,
  "export_timestamp": ISO8601_UTC_string,
  "export_version": string,
  "integrity_status": string,
  "snapshot_count": integer
}
```

---

## Type Primitives

| Name | Description | Example |
|------|-------------|---------|
| **ISO8601_UTC_string** | Timestamp in UTC ISO format | "2026-02-26T11:00:00Z" or "2026-02-26T11:00:00.123Z" |
| **string** | UTF-8 text, Unicode escaped, double-quoted | "hello" |
| **integer** | Whole number, no decimal point | 42 |
| **float** | Decimal number | 0.5 |
| **boolean** | true or false (lowercase) | true |
| **hex_string** | Hexadecimal string (lowercase) | "abc123def456" |
| **base64_string** | Base64-encoded bytes (RFC 4648) | "mK3j2xzA+b4Z8y=" |
| **array** | JSON array, preserve order | [item1, item2] |
| **object** | JSON object, fields sorted | {"a":"x","b":"y"} |

---

## Timestamp Specifics

### UTC Mandate
- **Timezone**: Always Z suffix (UTC)
- **Format**: YYYY-MM-DDTHH:MM:SS[.mmm]Z
- **Milliseconds**: Optional; include if available from runtime
- **Leap seconds**: Not supported; use UTC time

**Valid**:
- `"2026-02-26T11:00:00Z"`
- `"2026-02-26T11:00:00.123Z"`

**Invalid**:
- `"2026-02-26T11:00:00+00:00"` (use Z, not +00:00)
- `"2026-02-26 11:00:00"` (use T separator and Z suffix)

### Monotonicity in Ledger
Each successive timestamp in an audit ledger MUST be >= the previous timestamp.
```json
{"timestamp":"2026-02-26T11:00:00Z", ...}   Entry 1
{"timestamp":"2026-02-26T11:00:01Z", ...}   Entry 2  ✅ Later
{"timestamp":"2026-02-26T11:00:01Z", ...}   Entry 3  ✅ Same (OK)
{"timestamp":"2026-02-26T11:00:00Z", ...}   Entry 4  ❌ Earlier (FAIL)
```

---

## Hash Representation

### SHA256 Hash
- **Length**: 64 hexadecimal characters
- **Case**: Lowercase
- **Format**: Unquoted in binary context; quoted in JSON

**Valid**:
```json
{"hash": "7a3b9c2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9"}
```

---

## Determinism Verification

To verify JSON encoding is deterministic:

```bash
# Step 1: Create object twice in code
obj = {"z":"last", "a":"first", "m":"middle"}

# Step 2: Serialize both canonically
json1 = canonicalize(obj)   # {"a":"first","m":"middle","z":"last"}
json2 = canonicalize(obj)   # {"a":"first","m":"middle","z":"last"}

# Step 3: Hash both
hash1 = sha256(json1)
hash2 = sha256(json2)

# Step 4: Verify hashes match
assert hash1 == hash2  # Both are same
```

---

## References

- [LEDGER_CRYPTO_SPEC.md](LEDGER_CRYPTO_SPEC.md): Ledger hash chain (uses this schema)
- [EXPORT_SPEC.md](EXPORT_SPEC.md): Export archive (uses this schema)
