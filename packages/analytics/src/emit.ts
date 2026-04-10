/**
 * @twicely/analytics — Event Emitter
 *
 * Canonical 15 Section 7: Idempotent event ingestion via ON CONFLICT DO NOTHING.
 * Checks analytics.event.enabled kill switch before writing.
 * No raw PII — use ipHash (SHA-256) for IPs, IDs only in properties.
 */

import { db } from '@twicely/db';
import { analyticsEvent } from '@twicely/db/schema';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { EventEmitInput } from './types';

/**
 * Validate event input before writing.
 * Throws on invalid input to catch bugs early.
 */
function validateEventInput(input: EventEmitInput): void {
  if (!input.eventName || input.eventName.trim() === '') {
    throw new Error('eventName is required');
  }
  if (!input.idempotencyKey || input.idempotencyKey.trim() === '') {
    throw new Error('idempotencyKey is required');
  }
}

/**
 * Emit a single analytics event. Idempotent — duplicate idempotencyKey
 * is silently ignored via ON CONFLICT DO NOTHING.
 *
 * Returns { created: true } if the event was written, { created: false }
 * if it was deduplicated or the kill switch is off.
 */
export async function emitEvent(input: EventEmitInput): Promise<{ created: boolean }> {
  validateEventInput(input);

  // Kill switch check
  const enabled = await getPlatformSetting<boolean>('analytics.event.enabled', true);
  if (!enabled) {
    return { created: false };
  }

  const result = await db.insert(analyticsEvent).values({
    eventName:      input.eventName,
    idempotencyKey: input.idempotencyKey,
    actorUserId:    input.actorUserId ?? null,
    sessionId:      input.sessionId ?? null,
    sellerId:       input.sellerId ?? null,
    entityType:     input.entityType ?? null,
    entityId:       input.entityId ?? null,
    source:         input.source ?? null,
    medium:         input.medium ?? null,
    campaign:       input.campaign ?? null,
    deviceType:     input.deviceType ?? null,
    platform:       input.platform ?? null,
    ipHash:         input.ipHash ?? null,
    country:        input.country ?? null,
    propertiesJson: input.properties ?? {},
    occurredAt:     input.occurredAt ?? new Date(),
  }).onConflictDoNothing({ target: analyticsEvent.idempotencyKey });

  // postgres-js returns .count with affected row count (0 = conflict skipped, 1 = inserted)
  const created = (result as unknown as { count: number }).count > 0;
  if (created) {
    logger.debug('analytics.event.emitted', {
      eventName: input.eventName,
      idempotencyKey: input.idempotencyKey,
    });
  }
  return { created };
}

/**
 * Idempotent wrapper for emitEvent. If the event already exists
 * (unique constraint violation), returns { created: false } instead
 * of throwing. Useful when caller cannot guarantee ON CONFLICT is
 * handled at the DB layer (e.g. concurrent batch inserts).
 */
export async function emitEventIfNew(input: EventEmitInput): Promise<{ created: boolean }> {
  try {
    return await emitEvent(input);
  } catch (err: unknown) {
    // Catch unique constraint violation (Postgres error code 23505)
    if (
      err instanceof Error &&
      'code' in err &&
      (err as Record<string, unknown>).code === '23505'
    ) {
      return { created: false };
    }
    throw err;
  }
}

/**
 * Batch emit events. Deduplicates via ON CONFLICT DO NOTHING.
 * Respects analytics.event.batchSize setting.
 */
export async function emitEventsBatch(
  events: EventEmitInput[]
): Promise<{ created: number; skipped: number }> {
  if (events.length === 0) return { created: 0, skipped: 0 };

  // Kill switch check
  const enabled = await getPlatformSetting<boolean>('analytics.event.enabled', true);
  if (!enabled) {
    return { created: 0, skipped: events.length };
  }

  // Validate all events
  for (const event of events) {
    validateEventInput(event);
  }

  // Respect batch size cap
  const batchSize = await getPlatformSetting<number>('analytics.event.batchSize', 100);
  const capped = events.slice(0, batchSize);

  const result = await db.insert(analyticsEvent).values(
    capped.map((e) => ({
      eventName:      e.eventName,
      idempotencyKey: e.idempotencyKey,
      actorUserId:    e.actorUserId ?? null,
      sessionId:      e.sessionId ?? null,
      sellerId:       e.sellerId ?? null,
      entityType:     e.entityType ?? null,
      entityId:       e.entityId ?? null,
      source:         e.source ?? null,
      medium:         e.medium ?? null,
      campaign:       e.campaign ?? null,
      deviceType:     e.deviceType ?? null,
      platform:       e.platform ?? null,
      ipHash:         e.ipHash ?? null,
      country:        e.country ?? null,
      propertiesJson: e.properties ?? {},
      occurredAt:     e.occurredAt ?? new Date(),
    }))
  ).onConflictDoNothing({ target: analyticsEvent.idempotencyKey });

  // postgres-js returns .count with the number of actually inserted rows
  const created = (result as unknown as { count: number }).count;
  logger.debug('analytics.event.batch_emitted', {
    total: capped.length,
    created,
    skipped: capped.length - created,
  });

  return { created, skipped: capped.length - created };
}
