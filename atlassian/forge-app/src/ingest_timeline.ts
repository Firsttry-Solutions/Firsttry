/**
 * Ingestion Timeline Tracking (PHASE 2)
 * 
 * Tracks first and last event timestamps per org for coverage/reporting.
 * 
 * Storage keys:
 * - ingest/{org}/first_event_at (ISO 8601, set once)
 * - ingest/{org}/last_event_at (ISO 8601, always updated)
 * 
 * Thread-safety: Each key update is atomic within Forge storage.
 */

let api: any;
try {
  api = require('@forge/api').default;
} catch (e) {
  // @forge/api only available in Forge runtime, not in tests
}

/**
 * Parse ISO 8601 timestamp safely
 * @param iso ISO 8601 timestamp (e.g., "2025-12-19T10:30:45.123Z")
 * @returns Date object or null if invalid
 */
function parseISO(iso: string): Date | null {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Update ingestion timeline for org
 * - Sets first_event_at if not already set
 * - Always updates last_event_at
 * 
 * @param org Organization key
 * @param eventAtISO Event timestamp (ISO 8601)
 */
export async function update_ingest_timeline(org: string, eventAtISO: string): Promise<void> {
  // Parse timestamp safely
  const eventTime = parseISO(eventAtISO);
  if (!eventTime) {
    console.warn(`[Timeline] Invalid timestamp: ${eventAtISO}`);
    return; // Silently skip if timestamp invalid (Phase 1 validation should have caught it)
  }

  try {
    await api.asApp().requestStorage(async (storage) => {
      const firstKey = `ingest/${org}/first_event_at`;
      const lastKey = `ingest/${org}/last_event_at`;

      // Get current first_event_at
      const currentFirst = await storage.get(firstKey) as string | undefined;

      // Set first_event_at only if not already set OR if eventAtISO is earlier
      if (!currentFirst) {
        await storage.set(firstKey, eventAtISO);
      } else {
        const currentFirstTime = parseISO(currentFirst);
        if (currentFirstTime && eventTime < currentFirstTime) {
          // Only overwrite if new event is earlier (optional correction)
          await storage.set(firstKey, eventAtISO);
        }
      }

      // Get current last_event_at
      const currentLast = await storage.get(lastKey) as string | undefined;

      // Set/update last_event_at if eventAtISO is later
      if (!currentLast) {
        await storage.set(lastKey, eventAtISO);
      } else {
        const currentLastTime = parseISO(currentLast);
        if (currentLastTime && eventTime > currentLastTime) {
          await storage.set(lastKey, eventAtISO);
        }
      }
    });
  } catch (error) {
    console.error('[Timeline] Error updating ingest timeline:', error);
    // Do not throw; timeline update is optional for Phase 2
  }
}

/**
 * Get ingestion timeline for org (for testing/inspection)
 */
export async function get_ingest_timeline(org: string): Promise<{ first_event_at?: string; last_event_at?: string }> {
  try {
    return await api.asApp().requestStorage(async (storage) => {
      const firstKey = `ingest/${org}/first_event_at`;
      const lastKey = `ingest/${org}/last_event_at`;

      const first = await storage.get(firstKey) as string | undefined;
      const last = await storage.get(lastKey) as string | undefined;

      return {
        first_event_at: first,
        last_event_at: last,
      };
    });
  } catch (error) {
    console.error('[Timeline] Error getting ingest timeline:', error);
    return {};
  }
}
