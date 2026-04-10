/**
 * Dispute Escalation Service
 *
 * 4-level escalation ladder:
 *   Level 0: Auto-resolution engine (initial)
 *   Level 1: Support agent (assigned via dispute queue)
 *   Level 2: Supervisor (escalated from agent)
 *   Level 3: Platform decision (senior staff, final authority)
 *
 * Escalation is strict: no skipping levels (D-12).
 */

import { db } from '@twicely/db';
import { disputeSla, dispute } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { addTimelineEvent } from './timeline-service';
import { advanceSlaStage } from './sla-manager';
import { MAX_ESCALATION_LEVEL } from './types';
import type { EscalateDisputeInput, SlaStage } from './types';

/** The SLA stage to advance to for each escalation level. */
const ESCALATION_STAGE_MAP: Record<number, SlaStage> = {
  1: 'platform_review',
  2: 'supervisor_review',
  3: 'supervisor_review', // Level 3 stays on supervisor_review (no timeout)
};

export interface EscalateResult {
  success: boolean;
  newLevel?: number;
  error?: string;
}

/**
 * Escalate a dispute to the next level.
 *
 * Side effects:
 *   1. Increment disputeSla.escalationLevel
 *   2. Advance SLA stage to the appropriate level
 *   3. Update dispute status to UNDER_REVIEW
 *   4. Create timeline event
 */
export async function escalateDispute(
  input: EscalateDisputeInput
): Promise<EscalateResult> {
  const { disputeId, actorType, actorId, reason } = input;

  // Check dispute exists and is not already resolved
  const [disp] = await db
    .select({ id: dispute.id, status: dispute.status })
    .from(dispute)
    .where(eq(dispute.id, disputeId))
    .limit(1);

  if (!disp) {
    return { success: false, error: 'DISPUTE_NOT_FOUND' };
  }

  const resolvedStatuses = new Set([
    'RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_PARTIAL', 'CLOSED',
  ]);
  if (resolvedStatuses.has(disp.status)) {
    return { success: false, error: 'CANNOT_ESCALATE' };
  }

  // Get current SLA
  const [sla] = await db
    .select({
      id: disputeSla.id,
      escalationLevel: disputeSla.escalationLevel,
      currentStage: disputeSla.currentStage,
    })
    .from(disputeSla)
    .where(eq(disputeSla.disputeId, disputeId))
    .limit(1);

  if (!sla) {
    return { success: false, error: 'SLA_NOT_FOUND' };
  }

  const currentLevel = sla.escalationLevel;

  if (currentLevel >= MAX_ESCALATION_LEVEL) {
    return { success: false, error: 'MAX_ESCALATION_REACHED' };
  }

  const newLevel = currentLevel + 1;

  // Update escalation level on SLA
  await db
    .update(disputeSla)
    .set({
      escalationLevel: newLevel,
      escalatedAt: new Date(),
    })
    .where(eq(disputeSla.id, sla.id));

  // Advance SLA stage if applicable
  const nextStage = ESCALATION_STAGE_MAP[newLevel];
  if (nextStage && nextStage !== sla.currentStage) {
    await advanceSlaStage(disputeId, nextStage);
  }

  // Set dispute status to UNDER_REVIEW if still OPEN
  if (disp.status === 'OPEN') {
    await db
      .update(dispute)
      .set({ status: 'UNDER_REVIEW', updatedAt: new Date() })
      .where(eq(dispute.id, disputeId));
  }

  // Timeline event
  await addTimelineEvent({
    disputeId,
    eventType:   'escalated',
    actorType,
    actorId,
    description: `Dispute escalated to level ${newLevel}: ${reason}`,
    metadata:    { fromLevel: currentLevel, toLevel: newLevel, reason },
  });

  return { success: true, newLevel };
}

/**
 * Get the current escalation level for a dispute.
 */
export async function getEscalationLevel(disputeId: string): Promise<number | null> {
  const [sla] = await db
    .select({ escalationLevel: disputeSla.escalationLevel })
    .from(disputeSla)
    .where(eq(disputeSla.disputeId, disputeId))
    .limit(1);

  return sla?.escalationLevel ?? null;
}

/**
 * Check if a dispute can be escalated further.
 */
export async function canEscalate(
  disputeId: string
): Promise<{ canEscalate: boolean; currentLevel: number | null; reason?: string }> {
  const [disp] = await db
    .select({ status: dispute.status })
    .from(dispute)
    .where(eq(dispute.id, disputeId))
    .limit(1);

  if (!disp) {
    return { canEscalate: false, currentLevel: null, reason: 'DISPUTE_NOT_FOUND' };
  }

  const resolvedStatuses = new Set([
    'RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_PARTIAL', 'CLOSED',
  ]);
  if (resolvedStatuses.has(disp.status)) {
    return { canEscalate: false, currentLevel: null, reason: 'ALREADY_RESOLVED' };
  }

  const level = await getEscalationLevel(disputeId);
  if (level === null) {
    return { canEscalate: false, currentLevel: null, reason: 'NO_SLA' };
  }

  if (level >= MAX_ESCALATION_LEVEL) {
    return { canEscalate: false, currentLevel: level, reason: 'MAX_LEVEL' };
  }

  return { canEscalate: true, currentLevel: level };
}
