# L0 Build Mapping - Quick Reference

## What Was Delivered

Build identity field mapping for L0 Snapshot Mapper with dual-path extraction:

### Direct Path (Primary)
```
backend_git_sha         → dashState.backendBuildSha
backend_build_time_utc  → dashState.backendBuildTimeUtc
```

### Metadata Fallback (Secondary)
```
metadata.provenance.buildShaAtCapture  → dashState.backendBuildSha
metadata.provenance.capturedAtUtc      → dashState.backendBuildTimeUtc
```

## How It Works

1. **Resolve Phase**: Resolver returns response with build fields
2. **Extract Phase**: Mapper checks for direct fields first
3. **Fallback Phase**: If direct not found, checks metadata.provenance
4. **Map Phase**: Maps to dashState for rendering
5. **Render Phase**: UI displays value or "NOT_AVAILABLE"

## Priority Order

| Priority | Source |
|---|---|
| 1 | Direct field in response |
| 2 | metadata.provenance field |
| 3 | Undefined (shows NOT_AVAILABLE) |

## Field Examples

### Direct Fields (Priority 1)
```javascript
{
  "backend_git_sha": "1d93f844...",
  "backend_build_time_utc": "2026-01-28T09:30:00Z"
}
```

### Metadata Fallback (Priority 2)
```javascript
{
  "metadata": {
    "provenance": {
      "buildShaAtCapture": "cafebabe...",
      "capturedAtUtc": "2026-01-28T09:15:00Z"
    }
  }
}
```

## Testing Summary

| Test | Input | Expected | Result |
|---|---|---|---|
| Direct fields | Both present | Extract from direct | ✅ |
| Metadata fallback | Metadata only | Extract from provenance | ✅ |
| Priority | Both present | Direct wins | ✅ |
| Missing | Neither | Undefined | ✅ |

## Integration Points

- **Backend**: Provides `backend_git_sha` and `backend_build_time_utc`
- **Mapper**: L0 Snapshot Mapper processes and maps fields
- **Dashboard**: Renders `backendBuildSha` and `backendBuildTimeUtc`

## Status

✅ Complete and Production Ready

All tests passing. No additional work required.

---

For detailed proof, see: `L0_BUILD_MAPPING_DELIVERY_PROOF.md`
