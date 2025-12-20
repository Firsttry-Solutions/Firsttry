# CANONICALIZATION SPECIFICATION

**Normative Definition** (not descriptive)

Version: 9.0  
Purpose: Ensure deterministic, reproducible hash verification across all metrics runs and procurement packets.

---

## 1. Scope

This specification defines the exact transformation rules for converting Phase-8 metrics runs and Phase-9 procurement packets into canonical form prior to SHA-256 hashing.

**Canonical form ensures:**
- Same inputs always produce identical JSON
- Hash verification is deterministic and testable
- Reproducibility across time, systems, and teams
- Procurement packet integrity

---

## 2. JSON Canonicalization Rules

### 2.1 Key Ordering (MANDATORY)

All object keys must be sorted **alphabetically (ASCII order)**.

```json
NOT CANONICAL: { "value": 5, "confidence": "HIGH", "available": true }
CANONICAL:    { "available": true, "confidence": "HIGH", "value": 5 }
```

### 2.2 Whitespace (MANDATORY)

- No spaces after `:` or `,`
- No newlines
- No indentation
- Single space only between adjacent values in arrays

```json
NOT CANONICAL: { "values": [1, 2, 3] }
CANONICAL:    {"values":[1,2,3]}
```

### 2.3 String Escaping (MANDATORY)

- Use `\uXXXX` for all control characters (U+0000 to U+001F)
- Use `\"` for literal quotes
- Use `\\` for literal backslashes
- UTF-8 characters remain unescaped if valid

```json
NOT CANONICAL: { "note": "Line\nBreak" }
CANONICAL:    {"note":"Line\u000aBreak"}
```

### 2.4 Numeric Normalization (MANDATORY)

#### For Integers
- Always emit as integer (no decimal point)
- No leading zeros except for `0` itself
- No exponential notation

```
NOT CANONICAL: 5.0, 05, 5.0e0
CANONICAL:    5
```

#### For Floats
- Always emit with decimal point
- At most 6 fractional digits (rounded, not truncated)
- No trailing zeros after decimal point (except `.0` if needed for distinction)
- No exponential notation

```
NOT CANONICAL: 0.3333333333, 3.14159265e-1
CANONICAL:    0.333333
```

**Rounding:** Use "round half to even" (banker's rounding) for 6 decimal places.

### 2.5 Array Ordering (MANDATORY)

Within a metrics run:

**metric_records array:** Sort by `metric_key` (ascending alphabetical):
- M1
- M2
- M3
- M4
- M5

Within metric_records entries:

**disclosures array:** Sort alphabetically by disclosure text

**dependencies array:** Sort alphabetically by dependency name

Within procurement packet:

**data_handling.collected_data:** Sort alphabetically

**data_handling.never_collected:** Sort alphabetically

---

## 3. Timestamp Normalization (MANDATORY)

All timestamps must be in **ISO 8601 UTC format** (Z suffix, not +00:00).

```
NOT CANONICAL: 2025-12-20T10:30:45+00:00
CANONICAL:    2025-12-20T10:30:45Z
```

Precision: Up to 3 decimal places for milliseconds, no microseconds.

```
NOT CANONICAL: 2025-12-20T10:30:45.123456Z
CANONICAL:    2025-12-20T10:30:45.123Z
```

---

## 4. Null and Boolean Normalization (MANDATORY)

- `null` → always lowercase `null` (not `Null`, not `nil`)
- `true` → always lowercase `true`
- `false` → always lowercase `false`
- No JSON5 extensions (no unquoted keys, no trailing commas)

---

## 5. Hash Input Boundaries (MANDATORY)

### 5.1 Metrics Run Hash (SHA-256)

**Included in canonical_hash:**
- `id` (UUID)
- `tenant_id`
- `cloud_id`
- `time_window` (from, to)
- `computed_at`
- `metric_records` (all 5 metrics, sorted by metric_key)
  - Each record: metric_key, availability, value, confidence_score, confidence_label, completeness_percentage, numerator, denominator, missing_inputs (sorted), disclosures (sorted), dependencies (sorted)
- `data_quality` (missing_datasets sorted)

**Excluded from canonical_hash:**
- `created_at`
- `updated_at`
- `expires_at`
- `canonical_hash` itself (circular reference prevention)
- `version` (hashing not version-dependent)

### 5.2 Procurement Packet Hash (SHA-256)

**Included in canonical_hash:**
- `packet_id` (UUID)
- `tenant_id`
- `cloud_id`
- `generated_at`
- `data_handling` (all fields, arrays sorted)
  - `collected_data` (sorted)
  - `never_collected` (sorted)
  - `storage_location`
  - `retention_policy`
  - `uninstall_behavior`
  - `jira_scopes_used` (sorted)
  - `read_only_guarantees` (sorted)
  - `rate_limit_behavior`
- `determinism_proof` (reference hash, not recursive)
- `missing_data_disclosure` (sorted)
- `historical_blind_spots` (sorted)

**Excluded from canonical_hash:**
- `packet_hash` itself (circular reference prevention)
- `audit_timestamp` (hashing not time-dependent)
- `signature` (if signed, signature is separate)

---

## 6. Version Transitions (MANDATORY)

If schema version changes:

1. Old version hash remains valid for old records
2. New version hash is computed only for new records
3. Migration does NOT recompute old hashes
4. Hash verification checks version before comparing

```
IF metrics_run.schema_version == "8.0" {
  use canonicalization 8.0 rules
} ELSE IF metrics_run.schema_version == "9.0" {
  use canonicalization 9.0 rules
}
```

---

## 7. NOT_AVAILABLE Representation (MANDATORY)

When a metric is NOT_AVAILABLE:

```json
{
  "metric_key": "M1",
  "availability": "NOT_AVAILABLE",
  "not_available_reason": "MISSING_USAGE_DATA",
  "value": null,
  "confidence_score": null,
  "confidence_label": "NONE",
  "completeness_percentage": null,
  "numerator": null,
  "denominator": null,
  "missing_inputs": ["usage_logs"],
  "disclosures": ["Metric computation blocked by missing usage logs"],
  "dependencies": ["usage_logs"]
}
```

**In canonical form:**
- Keys always present (not omitted)
- Order by alphabetical key order
- `null` always written as `null` (not omitted)
- `missing_inputs` array sorted alphabetically

---

## 8. Canonical Serialization Algorithm (NORMATIVE)

```pseudocode
function canonicalize(obj):
  IF obj is null:
    return "null"
  
  IF obj is boolean:
    return "true" or "false"
  
  IF obj is number:
    IF is_integer(obj) and no_overflow(obj):
      return format_as_integer(obj)
    ELSE:
      return format_float_6_digits(obj)
  
  IF obj is string:
    return '"' + escape_string(obj) + '"'
  
  IF obj is array:
    IF is_metric_records_array(obj):
      sort by metric_key
    ELSE IF is_simple_array(obj):
      keep order
    ELSE IF is_disclosure_array(obj):
      sort alphabetically
    ELSE IF is_dependency_array(obj):
      sort alphabetically
    ELSE IF is_data_array(obj):
      sort alphabetically
    
    items = [canonicalize(item) for item in sorted_array]
    return "[" + ",".join(items) + "]"
  
  IF obj is object:
    keys = sort_keys_alphabetically(obj.keys())
    pairs = []
    FOR each key in keys:
      canonicalized_value = canonicalize(obj[key])
      pairs.append(key + ":" + canonicalized_value)
    return "{" + ",".join(pairs) + "}"
```

---

## 9. Hash Computation (MANDATORY)

```pseudocode
function compute_canonical_hash(metrics_run):
  canonical_json = canonicalize_metrics_run(metrics_run)
  return SHA256(canonical_json).hex_lowercase()
```

**SHA-256 Output:**
- 64 hexadecimal characters (lowercase)
- Computed on exact byte sequence of canonical JSON
- No additional encoding layers

---

## 10. Verification Algorithm (MANDATORY)

```pseudocode
function verify_canonical_hash(metrics_run):
  stored_hash = metrics_run.canonical_hash
  recomputed_hash = compute_canonical_hash(metrics_run)
  return stored_hash == recomputed_hash
```

**Failure Cases:**
- Hash mismatch → Raise `HASH_VERIFICATION_FAILED`
- Metrics run modified since computation → Raise `INTEGRITY_VIOLATION`
- Schema version mismatch → Raise `SCHEMA_VERSION_MISMATCH`

---

## 11. Escaping Examples (NORMATIVE)

### String Escaping
```
Input:  The product "improved" by 50%
Canon:  "The product \"improved\" by 50%"

Input:  Line\nBreak\tTab
Canon:  "Line\u000aBreak\u0009Tab"

Input:  Raw backslash \
Canon:  "Raw backslash \\"
```

### Float Normalization
```
Input:  0.33333333  →  Canon: 0.333333 (rounded)
Input:  1.5         →  Canon: 1.5
Input:  1.50        →  Canon: 1.5
Input:  2.0         →  Canon: 2.0 (kept for distinction from int 2)
Input:  3e-1        →  Canon: 0.3 (no exponential)
```

---

## 12. Testing Canonicalization (NORMATIVE)

Every canonicalization implementation MUST pass:

```
TEST: Same input → Same canonical output (idempotent)
TEST: Different order → Same canonical output
TEST: Escaped strings → Byte-exact match
TEST: Float precision → Rounded consistently
TEST: Version transitions → Hash changes on version bump
TEST: Empty collections → Canonical form present
TEST: Null values → Preserved, not omitted
```

---

## 13. Procurement Packet Specific Rules (MANDATORY)

In addition to base canonicalization:

**data_handling.collected_data:** Must list exact data collected by the product (factual, not aspirational)

```json
{
  "collected_data": [
    "Jira issue keys",
    "Jira issue summary",
    "Configuration field names",
    "Configuration field values",
    "Field usage count (anonymous aggregate)"
  ]
}
```

**data_handling.never_collected:** Must list what the product explicitly does NOT collect

```json
{
  "never_collected": [
    "User names or IDs",
    "Custom JQL queries",
    "Issue descriptions or content",
    "Attachment contents",
    "Comment text"
  ]
}
```

---

## 14. Non-Negotiable Guarantees

This specification guarantees:

✅ **Determinism:** Same inputs → Identical hash (every time)

✅ **Reproducibility:** Can recompute hash at any time in the future

✅ **Transparency:** Hash input is fully specified and auditable

✅ **Immutability:** Once computed, hash changes iff metrics run changes

✅ **Scalability:** Algorithm is O(n) where n = JSON size

✅ **Testability:** Hash verification can be automated and blocking

---

## 15. Version History

| Version | Date | Changes |
|---------|------|---------|
| 9.0 | 2025-12-20 | Initial specification (Phase-9 v2) |

---

## 16. Compliance Checklist

- [ ] All object keys sorted alphabetically
- [ ] All whitespace normalized
- [ ] All strings properly escaped
- [ ] All numbers normalized (int vs float, precision)
- [ ] All timestamps in ISO 8601 UTC
- [ ] All booleans and nulls lowercase
- [ ] Array ordering rules applied per array type
- [ ] Hash input boundaries respected (includes / excludes explicit)
- [ ] Version transition rules implemented
- [ ] NOT_AVAILABLE representation canonical
- [ ] SHA-256 output lowercase hex
- [ ] Verification algorithm blocks on mismatch
- [ ] Test coverage for all normalization rules

---

**This specification is normative. Implementation must follow exactly.**

**Any deviation requires change to this document first.**

**Determinism is non-negotiable.**
