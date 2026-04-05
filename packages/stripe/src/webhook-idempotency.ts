/**
 * Durable webhook idempotency — two-layer dedup: Valkey (fast) + DB (durable).
 *
 * The stripe_event_log table provides crash-safe persistence beyond Valkey TTL.
 * Valkey is checked first for speed; DB is the authoritative fallback.
 */

import { db } from '@twicely/db';
import { stripeEventLog } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getValkeyClient } from '@twicely/db/cache';
import { logger } from '@twicely/logger';

const VALKEY_TTL_SECONDS = 86400; // 24h
const VALKEY_PREFIX = 'stripe-webhook:';

/**
 * Check if a webhook event has already been processed.
 * Layer 1: Valkey (fast). Layer 2: DB stripe_event_log (durable).
 * If DB hit but Valkey miss, backfills Valkey for subsequent fast-path.
 * Fails open (returns false) if both stores are down.
 */
export async function isWebhookDuplicate(eventId: string): Promise<boolean> {
  // Layer 1: Valkey fast path
  try {
    const valkey = getValkeyClient();
    const exists = await valkey.get(`${VALKEY_PREFIX}${eventId}`);
    if (exists !== null) return true;
  } catch {
    // Valkey down — continue to DB check
  }

  // Layer 2: DB durable check
  try {
    const [row] = await db
      .select({ id: stripeEventLog.id })
      .from(stripeEventLog)
      .where(eq(stripeEventLog.stripeEventId, eventId))
      .limit(1);

    if (row) {
      // Backfill Valkey so subsequent checks are fast
      try {
        const valkey = getValkeyClient();
        await valkey.set(`${VALKEY_PREFIX}${eventId}`, '1', 'EX', VALKEY_TTL_SECONDS);
      } catch { /* best-effort backfill */ }
      return true;
    }
  } catch (error) {
    // SEC-022: Fail closed — if both Valkey and DB are down, treat as duplicate to prevent double-processing
    logger.error('[webhook-idempotency] DB check failed, failing closed', { eventId, error });
    return true;
  }

  return false;
}

/**
 * Mark a webhook event as processed in both Valkey and DB.
 * Uses onConflictDoNothing to handle races gracefully.
 */
export async function markWebhookProcessed(
  eventId: string,
  eventType: string,
  payload: unknown
): Promise<void> {
  // Valkey: fast-path marker
  try {
    const valkey = getValkeyClient();
    await valkey.set(`${VALKEY_PREFIX}${eventId}`, '1', 'EX', VALKEY_TTL_SECONDS);
  } catch { /* Valkey down — continue to DB */ }

  // DB: durable record
  try {
    await db
      .insert(stripeEventLog)
      .values({
        stripeEventId: eventId,
        eventType,
        processingStatus: 'processed',
        processedAt: new Date(),
        payloadJson: payload,
      })
      .onConflictDoNothing({ target: stripeEventLog.stripeEventId });
  } catch (error) {
    logger.warn('[webhook-idempotency] DB insert failed', { eventId, error });
  }
}
