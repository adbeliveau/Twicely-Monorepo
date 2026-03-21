/**
 * Meetup Reminder BullMQ Job (G2.13)
 *
 * Sends reminder notifications to both buyer and seller 24 hours and 1 hour
 * before their scheduled local meetup. Enqueued when scheduledAt is confirmed
 * and re-enqueued on reschedule.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A10
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { localTransaction, orderItem, listing, safeMeetupLocation } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';

const QUEUE_NAME = 'local-meetup-reminder';

// ─── Job Data ─────────────────────────────────────────────────────────────────

export interface LocalMeetupReminderData {
  localTransactionId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  itemTitle: string;
  location: string;
  scheduledAtIso: string;
  reminderType: '24hr' | '1hr';
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export const localMeetupReminderQueue =
  createQueue<LocalMeetupReminderData>(QUEUE_NAME);

// ─── Delay Calculation ────────────────────────────────────────────────────────

function calculateReminderDelay(
  scheduledAt: Date,
  offsetHours: number,
): number | null {
  const reminderTime = new Date(scheduledAt);
  reminderTime.setHours(reminderTime.getHours() - offsetHours);
  const delayMs = reminderTime.getTime() - Date.now();
  if (delayMs <= 0) return null;
  return delayMs;
}

// ─── Enqueue Helper ───────────────────────────────────────────────────────────

export async function enqueueLocalMeetupReminders(
  data: Omit<LocalMeetupReminderData, 'reminderType'>,
): Promise<void> {
  const scheduledAt = new Date(data.scheduledAtIso);

  const delay24hr = calculateReminderDelay(scheduledAt, 24);
  if (delay24hr !== null) {
    await localMeetupReminderQueue.add(
      'reminder',
      { ...data, reminderType: '24hr' },
      {
        delay: delay24hr,
        jobId: `local-reminder-24hr-${data.localTransactionId}`,
        removeOnComplete: true,
        removeOnFail: { count: 100 },
      },
    );
    logger.info('[local-meetup-reminder] Enqueued 24hr reminder', {
      localTransactionId: data.localTransactionId,
      delayMs: delay24hr,
    });
  } else {
    logger.info('[local-meetup-reminder] Skipping 24hr reminder (window passed)', {
      localTransactionId: data.localTransactionId,
    });
  }

  const delay1hr = calculateReminderDelay(scheduledAt, 1);
  if (delay1hr !== null) {
    await localMeetupReminderQueue.add(
      'reminder',
      { ...data, reminderType: '1hr' },
      {
        delay: delay1hr,
        jobId: `local-reminder-1hr-${data.localTransactionId}`,
        removeOnComplete: true,
        removeOnFail: { count: 100 },
      },
    );
    logger.info('[local-meetup-reminder] Enqueued 1hr reminder', {
      localTransactionId: data.localTransactionId,
      delayMs: delay1hr,
    });
  } else {
    logger.info('[local-meetup-reminder] Skipping 1hr reminder (window passed)', {
      localTransactionId: data.localTransactionId,
    });
  }
}

// ─── Remove Helper ────────────────────────────────────────────────────────────

export async function removeLocalMeetupReminders(
  localTransactionId: string,
): Promise<void> {
  for (const suffix of ['24hr', '1hr'] as const) {
    const jobId = `local-reminder-${suffix}-${localTransactionId}`;
    try {
      const job = await localMeetupReminderQueue.getJob(jobId);
      if (job) await job.remove();
    } catch (err) {
      logger.warn('[local-meetup-reminder] Could not remove reminder job', {
        jobId,
        error: String(err),
      });
    }
  }
}

// ─── Terminal Status Guard ────────────────────────────────────────────────────

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELED', 'NO_SHOW', 'DISPUTED'] as const;

function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

// ─── DB Resolvers ─────────────────────────────────────────────────────────────

async function resolveItemTitle(orderId: string): Promise<string> {
  const [row] = await db
    .select({ title: listing.title })
    .from(orderItem)
    .innerJoin(listing, eq(orderItem.listingId, listing.id))
    .where(eq(orderItem.orderId, orderId))
    .limit(1);
  return row?.title ?? 'your item';
}

async function resolveLocation(meetupLocationId: string | null): Promise<string> {
  if (meetupLocationId === null) return 'the meetup location';
  const [row] = await db
    .select({ name: safeMeetupLocation.name })
    .from(safeMeetupLocation)
    .where(eq(safeMeetupLocation.id, meetupLocationId))
    .limit(1);
  return row?.name ?? 'the meetup location';
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ─── Processing Logic ─────────────────────────────────────────────────────────

async function processMeetupReminder(data: LocalMeetupReminderData): Promise<void> {
  const { localTransactionId } = data;

  const [tx] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, localTransactionId))
    .limit(1);

  if (!tx) {
    logger.warn('[local-meetup-reminder] Transaction not found', { localTransactionId });
    return;
  }

  if (isTerminalStatus(tx.status)) {
    logger.info('[local-meetup-reminder] Transaction in terminal status, skipping', {
      localTransactionId,
      status: tx.status,
    });
    return;
  }

  if (tx.scheduledAtConfirmedAt === null) {
    logger.info('[local-meetup-reminder] scheduledAtConfirmedAt is null, skipping', {
      localTransactionId,
    });
    return;
  }

  // Stale job guard: verify scheduledAt matches job payload
  const jobTime = new Date(data.scheduledAtIso).getTime();
  const dbTime = tx.scheduledAt ? new Date(tx.scheduledAt).getTime() : 0;
  if (Math.abs(jobTime - dbTime) > 1000) {
    logger.info('[local-meetup-reminder] Stale job — scheduledAt changed, skipping', {
      localTransactionId,
      jobScheduledAt: data.scheduledAtIso,
      currentScheduledAt: tx.scheduledAt?.toISOString() ?? null,
    });
    return;
  }

  const templateKey =
    data.reminderType === '24hr' ? 'local.reminder.24hr' : 'local.reminder.1hr';

  const itemTitle = await resolveItemTitle(data.orderId);
  const location = await resolveLocation(tx.meetupLocationId ?? null);

  const scheduledAtDate = new Date(data.scheduledAtIso);
  const date = formatDate(scheduledAtDate);
  const time = formatTime(scheduledAtDate);

  void notify(data.buyerId, templateKey, { itemTitle, location, date, time });
  void notify(data.sellerId, templateKey, { itemTitle, location, date, time });

  logger.info('[local-meetup-reminder] Reminder notifications sent', {
    localTransactionId,
    reminderType: data.reminderType,
    templateKey,
  });
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const localMeetupReminderWorker =
  createWorker<LocalMeetupReminderData>(
    QUEUE_NAME,
    async (job) => {
      await processMeetupReminder(job.data);
    },
    1,
  );

// Graceful shutdown
process.on('SIGTERM', async () => {
  await localMeetupReminderWorker.close();
});
