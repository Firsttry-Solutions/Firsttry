# Runtime Verification Script Guide - PHASE 1.1

**Purpose:** Verify Phase 1 ingestion endpoint works end-to-end with real HTTP calls.

**Status:** Runtime verification using curl (no synthetic data)

---

## Prerequisites

Before running the script, ensure:

1. **Environment variables set:**
   ```bash
   export FORGE_EMAIL=your-email@example.com
   export FORGE_API_TOKEN=your-forge-api-token
   export FIRSTRY_INGEST_TOKEN=your-ingest-token-from-phase-1
   ```

2. **Tools available:**
   - `forge` CLI (v12+)
   - `curl`
   - `jq` (optional, for JSON parsing)

3. **App deployed:**
   ```bash
   cd /workspaces/Firstry/atlassian/forge-app
   forge deploy --environment development
   ```

---

## Step 1: Verify Forge CLI

**Command:**
```bash
forge --version
```

**Expected Output:**
```
@forge/cli/12.X.X
```

**What it checks:** Forge CLI is v12+

---

## Step 2: Check App Installation

**Command:**
```bash
forge install list
```

**Expected Output (Sample):**
```
firsttry
├─ Jira (development)
│  ├─ firsttry.atlassian.net
│  └─ Installed
```

**What it checks:** App is installed in development environment

---

## Step 3: Get Webtrigger URL

**Command:**
```bash
forge install list --json 2>/dev/null | jq '.[] | select(.displayName == "firsttry")'
```

**Expected Output (Sample):**
```json
{
  "displayName": "firsttry",
  "environment": "development",
  "appUrl": "https://firsttry.atlassian.net/extensions/app/firsttry"
}
```

**What it checks:** Extracts app installation URL

**Note:** For direct webtrigger URL construction, append `/webhook/ingest`

---

## Step 4: Send First Event (New)

**Command:**
```bash
curl -X POST \
  -H "X-FT-INGEST-TOKEN: <REDACTED>" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_version": "event.v1",
    "event_id": "test-event-001-'$(date +%s)'",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "org_key": "testorg",
    "repo_key": "testrepo",
    "profile": "strict",
    "gates": ["lint", "test"],
    "duration_ms": 1500,
    "status": "success",
    "cache_hit": true,
    "retry_count": 0
  }' \
  https://[APP_URL]/webhook/ingest
```

**Expected Response:**
```json
{
  "status": "accepted",
  "event_id": "test-event-001-[timestamp]",
  "shard_id": "shard_0",
  "storage_key": "raw/testorg/2025-12-19/shard_0",
  "message": "Event ingested successfully"
}
```

**HTTP Status:** 200 OK

**What it checks:** Event ingestion works; returns accepted status

---

## Step 5: Send Duplicate Event (Idempotency Check)

**Command:**
```bash
# Save the event_id from Step 4, then re-send with same ID:

curl -X POST \
  -H "X-FT-INGEST-TOKEN: <REDACTED>" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_version": "event.v1",
    "event_id": "test-event-001-[SAME_AS_STEP_4]",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "org_key": "testorg",
    "repo_key": "testrepo",
    "profile": "strict",
    "gates": ["lint", "test"],
    "duration_ms": 1500,
    "status": "success",
    "cache_hit": true,
    "retry_count": 0
  }' \
  https://[APP_URL]/webhook/ingest
```

**Expected Response:**
```json
{
  "status": "duplicate",
  "event_id": "test-event-001-[SAME_ID]",
  "message": "Event already processed (idempotent)"
}
```

**HTTP Status:** 200 OK

**What it checks:** Duplicate detection works; idempotency enforced

---

## Step 6: Fetch Storage Proof Snapshot

**Command:**
```bash
curl -X GET \
  -H "X-Debug-Token: <REDACTED>" \
  https://[APP_URL]/admin/storage-proof?org_key=testorg&repo_key=testrepo
```

**Expected Response:**
```json
{
  "org_key": "testorg",
  "repo_key": "testrepo",
  "status": "success",
  "message": "Storage proof snapshot retrieved successfully (1 events ingested today)",
  "total_ingested_today": 1,
  "recent_event_ids": ["test-event-001-[timestamp]"],
  "shards_touched_today": ["shard_0"],
  "idempotency_hits_count": 1,
  "last_ingest_timestamp": "2025-12-19T[TIME]Z"
}
```

**HTTP Status:** 200 OK

**What it checks:** 
- Admin endpoint accessible
- Event ID from Step 4 appears in snapshot
- Shard key visible (shard_0)
- Idempotency hit count recorded

---

## Final Verification

**All PASS if:**

1. ✓ forge --version shows 12.X.X
2. ✓ forge install list shows app in development
3. ✓ Step 4 returns HTTP 200 with status "accepted"
4. ✓ Step 5 returns HTTP 200 with status "duplicate"
5. ✓ Step 6 returns HTTP 200 with event IDs and shard keys visible
6. ✓ Event ID from Step 4 appears in Step 6 snapshot
7. ✓ No secrets/tokens in any response bodies

---

## Troubleshooting

### "Command not found: forge"
- Install Forge CLI: `npm install -g @forge/cli`
- Verify: `forge --version`

### "FIRSTRY_INGEST_TOKEN not configured"
- In manifest, ensure webtrigger reads from env: `process.env.FIRSTRY_INGEST_TOKEN`
- Set env var: `export FIRSTRY_INGEST_TOKEN=your-token`
- Redeploy: `forge deploy --environment development`

### "403 Forbidden" on /admin/storage-proof
- Check X-Debug-Token header value matches `FIRSTRY_DEBUG_VIEW_TOKEN`
- Or verify admin context in Forge app

### "404 Not Found" on webtrigger URL
- Check manifest.yml has webtrigger module defined
- Verify function handler path is correct (src/ingest.ingestEventHandler)
- Redeploy and check for lint errors: `forge lint`

### "400 Bad Request" on POST /webhook/ingest
- Validate JSON is well-formed
- Check all required EventV1 fields present
- Verify X-FT-INGEST-TOKEN header included
- Check for forbidden fields (log, secrets, token, etc.)

---

## Expected Test Duration

- Step 1-2: < 1 second
- Step 3: < 2 seconds
- Step 4: 1-2 seconds
- Step 5: 1-2 seconds (duplicate, fast response)
- Step 6: 1-2 seconds
- **Total: ~5-10 seconds**

---

## Data Captured in Evidence

Script should capture (redacted):

1. forge --version output
2. forge install list output
3. Curl command for Step 4 (X-FT-INGEST-TOKEN hidden)
4. HTTP 200 response with event_id
5. Curl command for Step 5 (same event_id)
6. HTTP 200 response with "duplicate" status
7. Curl command for Step 6 (X-Debug-Token hidden)
8. HTTP 200 response with event ID, shard key, counts
9. Final exit code (0 = all pass)

---

## Next Steps

Once verification passes:

1. Commit and push to origin main
2. Update phase_1_1_evidence.md with script output
3. Mark PHASE 1.1 DONE MEANS checklist
4. Ready for Phase 2 (aggregation, reporting)

---

**Script Version:** 1.0  
**Last Updated:** 2025-12-19
