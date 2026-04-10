/**
 * Risk Threshold Query Functions (Canonical 26 §3.3)
 *
 * CRUD operations for riskThreshold rows.
 * These are consumed by hub admin pages for threshold configuration.
 */

import { db } from '@twicely/db';
import { riskThreshold } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { DEFAULT_THRESHOLDS } from './types';
import type { GatedAction } from './types';

/**
 * Get all risk thresholds.
 */
export async function getThresholds() {
  return db.select().from(riskThreshold);
}

/**
 * Get a single risk threshold by action key.
 * Returns null if not found.
 */
export async function getThreshold(action: string) {
  const [row] = await db
    .select()
    .from(riskThreshold)
    .where(eq(riskThreshold.action, action))
    .limit(1);

  return row ?? null;
}

/**
 * Upsert a risk threshold for an action.
 * Used by hub admin to configure per-action thresholds.
 */
export async function upsertThreshold(
  action: string,
  levels: { warnAt: number; stepUpAt: number; blockAt: number },
  staffId?: string
) {
  const existing = await getThreshold(action);

  if (existing) {
    const [updated] = await db
      .update(riskThreshold)
      .set({
        warnAt: levels.warnAt,
        stepUpAt: levels.stepUpAt,
        blockAt: levels.blockAt,
        updatedByStaffId: staffId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(riskThreshold.action, action))
      .returning();

    logger.info('Risk threshold updated', {
      action,
      warnAt: levels.warnAt,
      stepUpAt: levels.stepUpAt,
      blockAt: levels.blockAt,
      staffId,
    });

    return updated;
  }

  const [inserted] = await db
    .insert(riskThreshold)
    .values({
      action,
      warnAt: levels.warnAt,
      stepUpAt: levels.stepUpAt,
      blockAt: levels.blockAt,
      updatedByStaffId: staffId ?? null,
    })
    .returning();

  logger.info('Risk threshold created', {
    action,
    warnAt: levels.warnAt,
    stepUpAt: levels.stepUpAt,
    blockAt: levels.blockAt,
    staffId,
  });

  return inserted;
}

/**
 * Seed default risk thresholds for all gated actions (C26 §11).
 * Only inserts rows that don't already exist.
 */
export async function seedDefaultThresholds() {
  const existing = await getThresholds();
  const existingActions = new Set(existing.map((r: { action: string }) => r.action));

  const entries = Object.entries(DEFAULT_THRESHOLDS) as Array<
    [GatedAction, { warnAt: number; stepUpAt: number; blockAt: number }]
  >;

  let inserted = 0;
  for (const [action, levels] of entries) {
    if (existingActions.has(action)) continue;

    await db.insert(riskThreshold).values({
      action,
      warnAt: levels.warnAt,
      stepUpAt: levels.stepUpAt,
      blockAt: levels.blockAt,
    });

    inserted++;
  }

  if (inserted > 0) {
    logger.info('Seeded default risk thresholds', { count: inserted });
  }

  return inserted;
}
