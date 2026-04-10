/**
 * Dispute SLA Manager
 *
 * Creates and manages SLA timers for disputes. All deadlines are sourced from
 * platform_settings -- never hardcoded. SLA breach detection is designed to
 * be called from a BullMQ repeatable job (cron-compatible).
 */

import { db } from '@twicely/db';
import { disputeSla } from '@twicely/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { SlaStage } from './types';
import { SLA_STAGE_SETTINGS_KEY, SLA_STAGE_DEFAULTS } from './types';

/**
 * Compute the SLA deadline for a given stage by reading the configured
 * hours from platform_settings.
 */
export async function getSlaDeadline(
  stage: Exclude<SlaStage, 'final'>
): Promise<Date> {
  const settingsKey = SLA_STAGE_SETTINGS_KEY[stage];
  const defaultHours = SLA_STAGE_DEFAULTS[stage];
  const hours = await getPlatformSetting<number>(settingsKey, defaultHours);

  const deadline = new Date();
  deadline.setTime(deadline.getTime() + hours * 60 * 60 * 1000);
  return deadline;
}

/**
 * Create an SLA record for a dispute at a given stage.
 * Returns the created SLA id.
 */
export async function createDisputeSla(
  disputeId: string,
  stage: Exclude<SlaStage, 'final'>
): Promise<{ id: string; slaDeadline: Date }> {
  const now = new Date();
  const slaDeadline = await getSlaDeadline(stage);

  const [row] = await db
    .insert(disputeSla)
    .values({
      disputeId,
      currentStage:   stage,
      stageStartedAt: now,
      slaDeadline,
      escalationLevel: 0,
    })
    .returning({ id: disputeSla.id });

  return { id: row.id, slaDeadline };
}

/**
 * Advance the SLA to a new stage with a fresh deadline.
 * Updates the existing SLA record in-place.
 */
export async function advanceSlaStage(
  disputeId: string,
  newStage: SlaStage
): Promise<{ success: boolean; error?: string }> {
  const [existing] = await db
    .select({ id: disputeSla.id, currentStage: disputeSla.currentStage })
    .from(disputeSla)
    .where(eq(disputeSla.disputeId, disputeId))
    .limit(1);

  if (!existing) {
    return { success: false, error: 'SLA_NOT_FOUND' };
  }

  if (existing.currentStage === 'final') {
    return { success: false, error: 'SLA_ALREADY_FINAL' };
  }

  const now = new Date();

  if (newStage === 'final') {
    await db
      .update(disputeSla)
      .set({
        currentStage:   'final',
        stageStartedAt: now,
        slaDeadline:    now, // terminal — deadline is moot
        isOverdue:      false,
      })
      .where(eq(disputeSla.id, existing.id));
    return { success: true };
  }

  const slaDeadline = await getSlaDeadline(newStage);

  await db
    .update(disputeSla)
    .set({
      currentStage:   newStage,
      stageStartedAt: now,
      slaDeadline,
      isOverdue:      false,
    })
    .where(eq(disputeSla.id, existing.id));

  return { success: true };
}

/**
 * Find all SLAs that have breached their deadline but haven't been
 * marked overdue yet. Designed to be called from the SLA monitor cron job.
 */
export async function checkSlaBreaches() {
  const now = new Date();
  return db
    .select({
      id:              disputeSla.id,
      disputeId:       disputeSla.disputeId,
      currentStage:    disputeSla.currentStage,
      slaDeadline:     disputeSla.slaDeadline,
      escalationLevel: disputeSla.escalationLevel,
    })
    .from(disputeSla)
    .where(
      and(
        lt(disputeSla.slaDeadline, now),
        eq(disputeSla.isOverdue, false),
        sql`${disputeSla.currentStage} != 'final'`
      )
    );
}

/**
 * Mark an SLA as overdue.
 */
export async function markSlaOverdue(slaId: string): Promise<void> {
  await db
    .update(disputeSla)
    .set({ isOverdue: true })
    .where(eq(disputeSla.id, slaId));
}

/**
 * Get the SLA record for a dispute.
 */
export async function getDisputeSla(disputeId: string) {
  const [row] = await db
    .select()
    .from(disputeSla)
    .where(eq(disputeSla.disputeId, disputeId))
    .limit(1);
  return row ?? null;
}
