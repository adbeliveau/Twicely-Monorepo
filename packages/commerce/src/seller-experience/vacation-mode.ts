import { db } from '@twicely/db';
import { vacationModeSchedule, listing, sellerProfile } from '@twicely/db/schema';
import { eq, and, lte, isNotNull, isNull } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { VacationModeInput } from './types';

interface VacationRow {
  id: string;
  sellerId: string;
  isActive: boolean;
  startAt: Date | null;
  endAt: Date | null;
  mode: string;
  autoReplyMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Set or update vacation mode configuration for a seller.
 */
export async function setVacationMode(
  sellerId: string,
  input: VacationModeInput
): Promise<{ id: string }> {
  const maxChars = await getPlatformSetting<number>('seller.vacation.autoReplyMaxChars', 500);

  if (input.autoReplyMessage && input.autoReplyMessage.length > maxChars) {
    throw new Error('AUTO_REPLY_TOO_LONG');
  }

  // Check if schedule already exists (upsert)
  const [existing] = await db
    .select({ id: vacationModeSchedule.id })
    .from(vacationModeSchedule)
    .where(eq(vacationModeSchedule.sellerId, sellerId))
    .limit(1);

  if (existing) {
    await db
      .update(vacationModeSchedule)
      .set({
        isActive: true,
        mode: input.mode ?? 'HARD_AWAY',
        startAt: input.startAt ?? new Date(),
        endAt: input.endAt ?? null,
        autoReplyMessage: input.autoReplyMessage ?? null,
        updatedAt: new Date(),
      })
      .where(eq(vacationModeSchedule.id, existing.id));
    return { id: existing.id };
  }

  const id = createId();
  await db.insert(vacationModeSchedule).values({
    id,
    sellerId,
    isActive: true,
    mode: input.mode ?? 'HARD_AWAY',
    startAt: input.startAt ?? new Date(),
    endAt: input.endAt ?? null,
    autoReplyMessage: input.autoReplyMessage ?? null,
  });

  return { id };
}

/**
 * Get vacation mode settings for a seller.
 */
export async function getVacationMode(sellerId: string): Promise<VacationRow | null> {
  const [row] = await db
    .select({
      id: vacationModeSchedule.id,
      sellerId: vacationModeSchedule.sellerId,
      isActive: vacationModeSchedule.isActive,
      startAt: vacationModeSchedule.startAt,
      endAt: vacationModeSchedule.endAt,
      mode: vacationModeSchedule.mode,
      autoReplyMessage: vacationModeSchedule.autoReplyMessage,
      createdAt: vacationModeSchedule.createdAt,
      updatedAt: vacationModeSchedule.updatedAt,
    })
    .from(vacationModeSchedule)
    .where(eq(vacationModeSchedule.sellerId, sellerId))
    .limit(1);

  return (row as unknown as VacationRow) ?? null;
}

/**
 * Deactivate vacation mode for a seller.
 */
export async function deactivateVacationMode(sellerId: string): Promise<void> {
  await db
    .update(vacationModeSchedule)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(vacationModeSchedule.sellerId, sellerId));

  // Also update sellerProfile
  await db
    .update(sellerProfile)
    .set({
      vacationMode: false,
      vacationModeType: null,
      vacationMessage: null,
      vacationAutoReplyMessage: null,
      vacationStartAt: null,
      vacationEndAt: null,
      updatedAt: new Date(),
    })
    .where(eq(sellerProfile.userId, sellerId));
}

/**
 * Get all active vacation schedules (for cron processing).
 */
export async function getActiveVacations(): Promise<VacationRow[]> {
  const rows = await db
    .select({
      id: vacationModeSchedule.id,
      sellerId: vacationModeSchedule.sellerId,
      isActive: vacationModeSchedule.isActive,
      startAt: vacationModeSchedule.startAt,
      endAt: vacationModeSchedule.endAt,
      mode: vacationModeSchedule.mode,
      autoReplyMessage: vacationModeSchedule.autoReplyMessage,
      createdAt: vacationModeSchedule.createdAt,
      updatedAt: vacationModeSchedule.updatedAt,
    })
    .from(vacationModeSchedule)
    .where(eq(vacationModeSchedule.isActive, true));

  return rows as unknown as VacationRow[];
}

/**
 * Apply vacation effects: update sellerProfile and optionally hide listings.
 * Called when a vacation mode is activated.
 */
export async function applyVacationEffects(sellerId: string): Promise<void> {
  const schedule = await getVacationMode(sellerId);
  if (!schedule || !schedule.isActive) return;

  // Update seller profile
  await db
    .update(sellerProfile)
    .set({
      vacationMode: true,
      vacationModeType: schedule.mode,
      vacationMessage: schedule.autoReplyMessage,
      vacationAutoReplyMessage: schedule.autoReplyMessage,
      vacationStartAt: schedule.startAt ?? new Date(),
      vacationEndAt: schedule.endAt,
      updatedAt: new Date(),
    })
    .where(eq(sellerProfile.userId, sellerId));
}
