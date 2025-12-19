/**
 * FirstTry Governance - Ingestion Endpoint Handler
 * PHASE 1: Webtrigger for EventV1 ingestion with auth, validation, idempotency, storage
 * PHASE 2: Wire ingest timeline + storage index ledger writes
 *
 * Endpoint: POST /webhook/ingest
 * Auth: Header X-FT-INGEST-TOKEN
 * Request body: EventV1 JSON
 * Response codes:
 *   200: Event accepted (new or duplicate)
 *   400: Validation error (schema, fields)
 *   401: Authentication failed
 *   500: Internal error
 */

import api from '@forge/api';
import { validateEventV1, redactSecret, extractDateFromTimestamp } from './validators';
import { isEventSeen, markEventSeen, storeRawEvent } from './storage';
import { markLastIngest } from './storage_debug';
import { update_ingest_timeline } from './ingest_timeline';
import { index_raw_shard } from './storage_index';
import { add_org_to_index } from './run_ledgers';

/**
 * Webtrigger handler for /webhook/ingest
 */
export async function ingestEventHandler(request: any) {
  try {
    // 1. Extract and validate token header
    const tokenHeader = request.headers['X-FT-INGEST-TOKEN'] || request.headers['x-ft-ingest-token'];
    
    if (!tokenHeader) {
      console.warn('[Ingest] Missing token header');
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Missing X-FT-INGEST-TOKEN header',
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // 2. Get stored token from environment secrets
    const storedToken = process.env.FIRSTRY_INGEST_TOKEN;
    if (!storedToken) {
      console.error('[Ingest] FIRSTRY_INGEST_TOKEN not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'CONFIGURATION_ERROR',
          message: 'Ingest token not configured',
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // 3. Validate token (compare as strings; no hashing for simplicity in PHASE 1)
    if (tokenHeader !== storedToken) {
      console.warn(`[Ingest] Invalid token attempt: ${redactSecret(tokenHeader)}`);
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Invalid X-FT-INGEST-TOKEN',
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // 4. Parse and validate JSON body
    let eventData: unknown;
    try {
      eventData = JSON.parse(request.body);
    } catch (e) {
      console.error('[Ingest] Invalid JSON:', e);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'INVALID_JSON',
          message: 'Request body must be valid JSON',
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // 5. Validate EventV1 schema
    const validationError = validateEventV1(eventData);
    if (validationError) {
      console.warn('[Ingest] Validation error:', validationError.code);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: validationError.code,
          message: validationError.message,
          fields: validationError.fields || {},
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // At this point, eventData is typed correctly (we validated it)
    const event = eventData as Record<string, unknown>;
    const eventId = event.event_id as string;
    const orgKey = event.org_key as string;
    const repoKey = event.repo_key as string;
    const timestamp = event.timestamp as string;

    // 6. Check idempotency (duplicate detection)
    const alreadySeen = await isEventSeen(orgKey, repoKey, eventId);
    if (alreadySeen) {
      console.info(`[Ingest] Duplicate event (idempotent): event_id=${eventId}`);
      // Mark debug for duplicate (PHASE 1.1 only)
      const dateStr = extractDateFromTimestamp(timestamp);
      // Estimate shard (typically shard_0 unless very high volume)
      await markLastIngest(orgKey, repoKey, eventId, 'shard_0', 'duplicate');
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'duplicate',
          event_id: eventId,
          message: 'Event already processed (idempotent)',
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // 7. Store raw event
    const dateStr = extractDateFromTimestamp(timestamp);
    const { shardId, storageKey } = await storeRawEvent(orgKey, dateStr, eventId, event);

    // 8. Mark event as seen (idempotency)
    await markEventSeen(orgKey, repoKey, eventId);

    // 8.5. Mark last ingest for debug snapshot (PHASE 1.1 only)
    await markLastIngest(orgKey, repoKey, eventId, shardId, 'success');

    // 9. PHASE 2: Wire timeline + storage index
    try {
      // Update ingest timeline (first/last event timestamp per org)
      await update_ingest_timeline(orgKey, timestamp);
      
      // Index the raw shard for safe enumeration and deletion
      await index_raw_shard(orgKey, dateStr, storageKey);
    } catch (phase2Error) {
      console.warn('[Ingest] Phase 2 wiring error (non-fatal):', phase2Error);
      // Don't fail ingest if Phase 2 fails; these are best-effort enhancements
    }

    // 9.5. PHASE 3: Wire org index for pipeline discovery
    try {
      await add_org_to_index(orgKey);
    } catch (phase3Error) {
      console.warn('[Ingest] Phase 3 wiring error (non-fatal):', phase3Error);
      // Don't fail ingest if Phase 3 fails; best-effort
    }

    // 10. Success response
    console.info(`[Ingest] Event stored: event_id=${eventId}, shard=${shardId}`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'accepted',
        event_id: eventId,
        shard_id: shardId,
        storage_key: storageKey,
        message: 'Event ingested successfully',
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('[Ingest] Unhandled error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: 'Failed to process event',
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}
