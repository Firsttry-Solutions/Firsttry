# API Surface Inventory

**Generated:** 2025-12-18  
**Evidence:** Web framework scan (rg_apps.txt - 209 occurrences)

## Summary

| Aspect | Status | Details |
|--------|--------|---------|
| API Framework | ✅ Found | FastAPI, Flask references |
| Routes Defined | ? | Manual audit needed |
| Auth Enforcement | ? | Unknown - needs code review |
| Schema Versioning | ? | Unknown |
| Rate Limiting | ? | Unknown |
| Documentation | ? | Unknown |

## Web Frameworks Detected

### FastAPI (Primary)
- **Status:** Present (209 framework refs found)
- **Pattern:** `FastAPI()` instantiation and `APIRouter()` usage
- **Modern:** Supports async/await, auto OpenAPI docs

### Flask (Legacy?)
- **Status:** May be present
- **Pattern:** Decorator-based routing
- **Note:** May be legacy or for specific endpoints

### Django
- **Status:** Unknown if actually used
- **Evidence:** grep keyword found but may be false positive

## To Complete This Audit

Run these commands to identify all API endpoints:

```bash
# Find FastAPI app instances
grep -rn "app = FastAPI\|APIRouter()" src/ --include="*.py"

# Find all route decorators
grep -rn "@.*\.get\|@.*\.post\|@.*\.put\|@.*\.delete" src/ --include="*.py"

# Identify auth checks
grep -rn "Depends\|Authorization\|oauth" src/ --include="*.py"

# Find schema definitions
grep -rn "BaseModel\|Pydantic" src/ --include="*.py"
```

## Known Gaps

- ❌ Route list not enumerated
- ❌ Auth mechanisms not verified
- ❌ Bypassable endpoints not identified
- ❌ Schema versioning not documented
- ❌ Rate limiting rules not found
- ❌ API documentation completeness unknown

## Next Steps

1. Manually run commands above to extract all routes
2. Verify auth on each endpoint
3. Check for unauthenticated/public endpoints
4. Document schema versions
5. Verify rate limiting implementation
