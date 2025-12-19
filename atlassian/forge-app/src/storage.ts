/**
 * Storage Layer with Bounded Sharding
 * PHASE 1: Raw event storage with automatic shard rollover at 200 events
 *
 * Storage key hierarchy:
 * - seen/{org_key}/{repo_key}/{event_id} → true (idempotency marker)
 * - raw/{org_key}/{yyyy-mm-dd}/{shard_id} → event data
 * - rawshard/{org_key}/{yyyy-mm-dd}/current → current shard counter
 * - rawshard/{org_key}/{yyyy-mm-dd}/{shard_id}/count → events in shard
 *
 * Shard rollover happens when count reaches 200 events.
 */

import api from '@forge/api';

const SHARD_SIZE_LIMIT = 200;

/**
 * Check if event has already been seen (idempotency)
 */
export async function isEventSeen(orgKey: string, repoKey: string, eventId: string): Promise<boolean> {
  try {
    const storageKey = `seen/${orgKey}/${repoKey}/${eventId}`;
    const result = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(storageKey);
    });
    return result !== undefined;
  } catch (error) {
    console.error('[Storage] Error checking if event seen:', error);
    throw error;
  }
}

/**
 * Mark event as seen (idempotency)
 */
export async function markEventSeen(orgKey: string, repoKey: string, eventId: string): Promise<void> {
  try {
    const storageKey = `seen/${orgKey}/${repoKey}/${eventId}`;
    await api.asApp().requestStorage(async (storage) => {
      // Store with 90-day TTL (in seconds)
      await storage.set(storageKey, true, { ttl: 7776000 });
    });
  } catch (error) {
    console.error('[Storage] Error marking event as seen:', error);
    throw error;
  }
}

/**
 * Get current shard ID for today's date (with automatic rollover)
 */
export async function getCurrentShardId(orgKey: string, dateStr: string): Promise<string> {
  try {
    const counterKey = `rawshard/${orgKey}/${dateStr}/current`;
    
    return await api.asApp().requestStorage(async (storage) => {
      let currentShardId: string = await storage.get(counterKey) || '0';
      
      // Check if current shard is full
      const shardCountKey = `rawshard/${orgKey}/${dateStr}/${currentShardId}/count`;
      const shardCount = (await storage.get(shardCountKey) || 0) as number;
      
      // If shard is full, increment to next shard
      if (shardCount >= SHARD_SIZE_LIMIT) {
        const nextShardId = String(Number(currentShardId) + 1);
        await storage.set(counterKey, nextShardId);
        return nextShardId;
      }
      
      return currentShardId;
    });
  } catch (error) {
    console.error('[Storage] Error getting current shard ID:', error);
    throw error;
  }
}

/**
 * Store raw event and increment shard counter
 */
export async function storeRawEvent(
  orgKey: string,
  dateStr: string,
  eventId: string,
  event: Record<string, unknown>
): Promise<{ shardId: string; storageKey: string }> {
  try {
    return await api.asApp().requestStorage(async (storage) => {
      // Get current shard (handles rollover if needed)
      const shardId = await getCurrentShardId(orgKey, dateStr);
      
      // Store raw event
      const storageKey = `raw/${orgKey}/${dateStr}/${shardId}`;
      const existingEvents = (await storage.get(storageKey) || []) as Record<string, unknown>[];
      existingEvents.push({
        ...event,
        _stored_at: new Date().toISOString(),
      });
      
      // Store with 90-day TTL
      await storage.set(storageKey, existingEvents, { ttl: 7776000 });
      
      // Increment shard count
      const countKey = `rawshard/${orgKey}/${dateStr}/${shardId}/count`;
      const currentCount = (await storage.get(countKey) || 0) as number;
      await storage.set(countKey, currentCount + 1);
      
      return { shardId, storageKey };
    });
  } catch (error) {
    console.error('[Storage] Error storing raw event:', error);
    throw error;
  }
}

/**
 * Get all events in a shard (for testing/inspection)
 */
export async function getShardEvents(orgKey: string, dateStr: string, shardId: string): Promise<Record<string, unknown>[]> {
  try {
    return await api.asApp().requestStorage(async (storage) => {
      const storageKey = `raw/${orgKey}/${dateStr}/${shardId}`;
      const events = await storage.get(storageKey);
      return (events as Record<string, unknown>[]) || [];
    });
  } catch (error) {
    console.error('[Storage] Error getting shard events:', error);
    throw error;
  }
}

/**
 * Get shard count (for testing)
 */
export async function getShardCount(orgKey: string, dateStr: string, shardId: string): Promise<number> {
  try {
    return await api.asApp().requestStorage(async (storage) => {
      const countKey = `rawshard/${orgKey}/${dateStr}/${shardId}/count`;
      return (await storage.get(countKey)) as number || 0;
    });
  } catch (error) {
    console.error('[Storage] Error getting shard count:', error);
    throw error;
  }
}
