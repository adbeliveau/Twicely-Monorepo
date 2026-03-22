/**
 * Local Safety Timer Jobs (G2.6)
 *
 * Two-stage safety escalation when BOTH_CHECKED_IN status persists:
 *  - Nudge (30 min): send safety alert notifications, flag safetyAlertSent
 *  - Escalation (15 min after nudge): create helpdesk case, notify user
 *
 * BullMQ queue names: 'local-safety-nudge', 'local-safety-escalation' (hyphens)
 */

import { createQueue, createWorker } from '@twicely/jobs/queue';
import { db } from '@twicely/db';
import { localTransaction, helpdeskCase } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import { createId } from '@paralleldrive/cuid2';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SafetyNudgeData {
  localTransactionId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
}

interface SafetyEscalationData {
  localTransactionId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
}

// ─── Queue Names ──────────────────────────────────────────────────────────────

const NUDGE_QUEUE = 'local-safety-nudge';
const ESCALATION_QUEUE = 'local-safety-escalation';

// ─── Queues ───────────────────────────────────────────────────────────────────

export const localSafetyNudgeQueue = createQueue<SafetyNudgeData>(NUDGE_QUEUE);
export const localSafetyEscalationQueue = createQueue<SafetyEscalationData>(ESCALATION_QUEUE);

// ─── Enqueue Helpers ─────────────────────────────────────────────────────────

/**
 * Enqueue a safety nudge after BOTH_CHECKED_IN.
 * Delay is read from commerce.local.safetyNudgeMinutes (default: 30).
 */
export async function enqueueSafetyNudge(data: SafetyNudgeData): Promise<void> {
  const nudgeMinutes = await getPlatformSetting<number>(
    'commerce.local.safetyNudgeMinutes',
    30,
  );
  const delayMs = nudgeMinutes * 60 * 1000;

  await localSafetyNudgeQueue.add('nudge', data, {
    delay: delayMs,
    jobId: `safety-nudge-${data.localTransactionId}`,
    removeOnComplete: true,
    removeOnFail: { count: 100 },
  });

  logger.info('[local-safety-nudge] Enqueued safety nudge', {
    localTransactionId: data.localTransactionId,
    nudgeMinutes,
  });
}

/**
 * Enqueue a safety escalation after the nudge.
 * Delay read from commerce.local.safetyEscalationMinutes (default 15 min).
 */
export async function enqueueSafetyEscalation(data: SafetyEscalationData): Promise<void> {
  const escalationMinutes = await getPlatformSetting<number>(
    'commerce.local.safetyEscalationMinutes', 15
  );
  const escalationDelayMs = escalationMinutes * 60 * 1000;

  await localSafetyEscalationQueue.add('escalate', data, {
    delay: escalationDelayMs,
    jobId: `safety-escalation-${data.localTransactionId}`,
    removeOnComplete: true,
    removeOnFail: { count: 100 },
  });

  logger.info('[local-safety-escalation] Enqueued safety escalation', {
    localTransactionId: data.localTransactionId,
  });
}

// ─── Nudge Processor ─────────────────────────────────────────────────────────

async function processNudge(data: SafetyNudgeData): Promise<void> {
  const [tx] = await db
    .select({
      status: localTransaction.status,
      safetyAlertSent: localTransaction.safetyAlertSent,
    })
    .from(localTransaction)
    .where(eq(localTransaction.id, data.localTransactionId))
    .limit(1);

  if (!tx) {
    logger.warn('[local-safety-nudge] Transaction not found', { id: data.localTransactionId });
    return;
  }

  if (tx.status !== 'BOTH_CHECKED_IN') {
    // Transaction resolved — skip
    logger.info('[local-safety-nudge] Transaction resolved, skipping nudge', {
      id: data.localTransactionId,
      status: tx.status,
    });
    return;
  }

  const now = new Date();

  await db
    .update(localTransaction)
    .set({ safetyAlertSent: true, safetyAlertAt: now, updatedAt: now })
    .where(
      and(
        eq(localTransaction.id, data.localTransactionId),
        eq(localTransaction.status, 'BOTH_CHECKED_IN'),
      ),
    );

  // Notify both parties
  void notify(data.buyerId, 'local.safety.nudge', {
    orderId: data.orderId,
    supportUrl: 'https://twicely.co/h/contact',
  });
  void notify(data.sellerId, 'local.safety.nudge', {
    orderId: data.orderId,
    supportUrl: 'https://twicely.co/h/contact',
  });

  // Enqueue escalation
  await enqueueSafetyEscalation(data);

  logger.info('[local-safety-nudge] Nudge sent, escalation enqueued', {
    localTransactionId: data.localTransactionId,
  });
}

// ─── Escalation Processor ────────────────────────────────────────────────────

async function processEscalation(data: SafetyEscalationData): Promise<void> {
  const [tx] = await db
    .select({
      status: localTransaction.status,
      safetyAlertSent: localTransaction.safetyAlertSent,
    })
    .from(localTransaction)
    .where(eq(localTransaction.id, data.localTransactionId))
    .limit(1);

  if (!tx) {
    logger.warn('[local-safety-escalation] Transaction not found', { id: data.localTransactionId });
    return;
  }

  if (!tx.safetyAlertSent || tx.status !== 'BOTH_CHECKED_IN') {
    // Not eligible or already resolved
    logger.info('[local-safety-escalation] Skipping escalation', {
      id: data.localTransactionId,
      status: tx.status,
      safetyAlertSent: tx.safetyAlertSent,
    });
    return;
  }

  // Generate case number
  const caseNumber = `CASE-${Date.now()}`;

  await db.insert(helpdeskCase).values({
    id: createId(),
    caseNumber,
    type: 'ORDER',
    priority: 'HIGH',
    subject: `Safety alert: local meetup — order ${data.orderId}`,
    description:
      'Both buyer and seller checked in but no receipt confirmation within safety window. Support review required.',
    status: 'NEW',
    channel: 'SYSTEM',
    requesterId: data.sellerId,
    requesterType: 'seller',
    orderId: data.orderId,
  });

  // Notify both parties
  void notify(data.buyerId, 'local.safety.escalated', {
    orderId: data.orderId,
    supportUrl: 'https://twicely.co/h/contact',
  });
  void notify(data.sellerId, 'local.safety.escalated', {
    orderId: data.orderId,
    supportUrl: 'https://twicely.co/h/contact',
  });

  logger.info('[local-safety-escalation] Helpdesk case created', {
    localTransactionId: data.localTransactionId,
    caseNumber,
  });
}

// ─── Workers ─────────────────────────────────────────────────────────────────

export const localSafetyNudgeWorker = createWorker<SafetyNudgeData>(
  NUDGE_QUEUE,
  async (job) => processNudge(job.data),
  1,
);

export const localSafetyEscalationWorker = createWorker<SafetyEscalationData>(
  ESCALATION_QUEUE,
  async (job) => processEscalation(job.data),
  1,
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await localSafetyNudgeWorker.close();
  await localSafetyEscalationWorker.close();
});
