# Ledger Cryptographic Specification

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## Ledger Hash Chain Formula

The immutable audit ledger uses a cryptographic hash chain to detect tampering.

**Exact formula**:
```
H_n = SHA256(H_{n-1} || canonical_record_n || nonce_n || timestamp_n)
```

Where:
- **H_n** = Hash of record n
- **H_{n-1}** = Hash of previous record (H_0 = SHA256("") for genesis block)
- **||** = Byte concatenation (no separators)
- **canonical_record_n** = JSON record n serialized per SERIALIZATION_SCHEMA.md
- **nonce_n** = Cryptographically random 32 bytes (base64 encoded in storage)
- **timestamp_n** = UTC ISO8601 timestamp of record creation

---

## Canonical JSON Rules

Records MUST be serialized deterministically for hash stability:

1. **Field ordering**: Alphabetical order by key name (ascending)
2. **No whitespace**: No spaces, tabs, or line breaks (compact JSON)
3. **No null coercion**: Omit fields with null values; do not include "null"
4. **String encoding**: UTF-8; escape Unicode as \uXXXX where necessary
5. **Number precision**: 64-bit float (14 significant digits); no exponential notation unless |n| < 0.0001
6. **Boolean encoding**: Lowercase "true" or "false"
7. **Array ordering**: Preserve input order; no sorting unless specified in schema
8. **Object nesting**: Apply rules recursively

**Example canonical record**:
```json
{"action":"snapshot","hash":"abc123","timestamp":"2026-02-26T10:30:45Z","user":"user123"}
```

**NOT canonical** (extra whitespace):
```json
{
  "action": "snapshot",
  "hash": "abc123"
}
```

---

## Nonce Definition

**Nonce** = Per-record random value to:
- Prevent hash collision attacks if two records have identical content
- Add entropy to consecutive records with same timestamp
- Enable replay resistance

**Generation**:
- Cryptographically secure random 32 bytes (256 bits)
- Generated at record creation time by Node.js `crypto.randomBytes(32)`
- Stored base64-encoded in record JSON
- Field name: `"nonce"`

**Example**:
```json
{
  "action": "export",
  "nonce": "mK3j2xzA+b4Z8y=",
  "timestamp": "2026-02-26T10:30:45Z"
}
```

---

## Timestamp Definition

**Timestamp**:
- **Format**: UTC ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)
- **Timezone**: Always UTC (Z suffix mandatory)
- **Precision**: Seconds (no milliseconds unless provided by runtime; milliseconds allowed for monotonicity)
- **Source**: `new Date().toISOString()` in Node.js (UTC guaranteed)
- **Field name**: `"timestamp"`

**Example**: `"2026-02-26T10:30:45.123Z"`

---

## Replay Resistance

The hash chain prevents replay attacks because:

1. **Immutability**: H_{n-1} is included in H_n; changing any prior record breaks all subsequent hashes
2. **Nonce uniqueness**: Replaying a record verbatim (including nonce) is cryptographically unlikely (2^256 entropy)
3. **Timestamp sequencing**: Ledger reader can verify timestamps are monotonically increasing
4. **Order dependency**: Records must be played in sequence; reordering breaks hashes

**Verification algorithm** (pseudocode):
```
function verify_ledger(records):
  H_prev = SHA256("")
  for each record in records:
    timestamp_current = record.timestamp
    if timestamp_current < timestamp_prev:
      FAIL "Timestamp violation"
    
    H_computed = SHA256(H_prev || canonical(record without "hash" field) || record.nonce || record.timestamp)
    if H_computed != record.hash:
      FAIL "Hash mismatch at record " + record.index
    
    H_prev = H_computed
    timestamp_prev = timestamp_current
  
  SUCCESS
```

---

## Tamper Detection Pseudocode

```
function detect_tampering(stored_ledger, expected_root_hash):
  """
  Detect if ledger has been modified since root anchor was set.
  """
  computed_hash = NULL
  
  for record in stored_ledger:
    if computed_hash is NULL:
      # Genesis block
      computed_hash = SHA256(SHA256("") || canonical(record) || record.nonce || record.timestamp)
    else:
      computed_hash = SHA256(computed_hash || canonical(record) || record.nonce || record.timestamp)
  
  if computed_hash != expected_root_hash:
    return TAMPERED
  else:
    return INTEGRITY_VERIFIED
  
  exception if ANY RECORD MISSING or RECORDS REORDERED:
    return TAMPERED
```

---

## Root Anchor Definition

A root anchor is a cryptographic anchor (hash snapshot) taken at a known point in time to verify no ledger modification occurred subsequently.

**Root anchor components**:
- **Anchor hash**: H_n of the latest record at anchor time
- **Anchor timestamp**: ISO8601 timestamp of anchor generation
- **Anchor context**: Build identity (git SHA, UI bundle hash, version)

**Use case**: Offline verification
- Customer downloads export ZIP (contains ledger + root anchor inside)
- Offline verification tool (tools/verify_ecl_state.mjs) recomputes ledger hash chain
- If computed hash matches anchor hash, ledger is unmodified

**Export signature** (in manifest file inside ZIP):
```json
{
  "audit_root_hash": "abc123def456...",
  "audit_root_timestamp": "2026-02-26T10:30:45Z",
  "build_git_sha": "aabbccdd1122...",
  "build_ui_bundle_hash": "xyz789",
  "export_timestamp": "2026-02-26T11:00:00Z"
}
```

---

## Implementation Notes

**Hash function**: SHA256 (FIPS 180-4 standard)
- **Algorithm**: Secure Hash Algorithm 2 (256-bit variant)
- **Library**: Node.js `crypto.createHash('sha256')`
- **Output**: 64 hexadecimal characters (256 bits)

**Canonical record**: MUST exclude the ledger entry's own hash field when computing the next hash
```json
// Record stored in ledger
{
  "hash": "abc123...",     ← This field excluded when computing next H_n
  "action": "export",
  "nonce": "xyz...",
  "timestamp": "2026-02-26T10:30:45Z"
}
```

---

## References

- [EXPORT_SPEC.md](EXPORT_SPEC.md): Export archive format and manifest
- [SERIALIZATION_SCHEMA.md](SERIALIZATION_SCHEMA.md): JSON serialization rules
- [DATA_FLOW.md](DATA_FLOW.md): Ledger storage and access
