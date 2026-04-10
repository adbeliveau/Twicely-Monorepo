/**
 * Dispute Evidence Service
 *
 * Handles structured evidence submission for disputes, with server-side
 * validation of evidence limits and file sizes. All config from platform_settings.
 */

import { db } from '@twicely/db';
import { disputeEvidence, dispute } from '@twicely/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { addTimelineEvent } from './timeline-service';
import type { SubmitEvidenceInput } from './types';
import { VALID_EVIDENCE_TYPES } from './types';

export interface SubmitEvidenceResult {
  success: boolean;
  evidenceId?: string;
  error?: string;
}

/**
 * Submit evidence for a dispute.
 *
 * Validates:
 *   - Evidence count < disputes.evidence.maxPerDispute (default 10)
 *   - File size < disputes.evidence.maxFileSizeBytes (default 10 MB)
 *   - evidenceType is valid
 *
 * Side effects:
 *   - Creates disputeEvidence record
 *   - Creates disputeTimeline event
 *   - Updates dispute.lastActionAt (via updatedAt — no V4 additive column yet)
 */
export async function submitEvidence(
  input: SubmitEvidenceInput
): Promise<SubmitEvidenceResult> {
  // Validate evidence type
  if (!VALID_EVIDENCE_TYPES.has(input.evidenceType)) {
    return { success: false, error: 'INVALID_EVIDENCE_TYPE' };
  }

  // Check evidence count limit
  const maxPerDispute = await getPlatformSetting<number>(
    'disputes.evidence.maxPerDispute', 10
  );
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(disputeEvidence)
    .where(eq(disputeEvidence.disputeId, input.disputeId));

  if (countRow.count >= maxPerDispute) {
    return { success: false, error: 'EVIDENCE_LIMIT_REACHED' };
  }

  // Check file size limit if metadata includes fileSizeBytes
  const meta = input.metadata ?? {};
  if (typeof meta.fileSizeBytes === 'number') {
    const maxFileSizeBytes = await getPlatformSetting<number>(
      'disputes.evidence.maxFileSizeBytes', 10_485_760
    );
    if (meta.fileSizeBytes > maxFileSizeBytes) {
      return { success: false, error: 'FILE_TOO_LARGE' };
    }
  }

  // Insert evidence record
  const [row] = await db
    .insert(disputeEvidence)
    .values({
      disputeId:    input.disputeId,
      submittedBy:  input.submittedBy,
      submitterId:  input.submitterId,
      evidenceType: input.evidenceType,
      description:  input.description ?? null,
      storageKey:   input.storageKey ?? null,
      metadata:     meta,
    })
    .returning({ id: disputeEvidence.id });

  // Update dispute.updatedAt to track last action
  await db
    .update(dispute)
    .set({ updatedAt: new Date() })
    .where(eq(dispute.id, input.disputeId));

  // Add timeline event
  await addTimelineEvent({
    disputeId:   input.disputeId,
    eventType:   'evidence',
    actorType:   input.submittedBy,
    actorId:     input.submitterId,
    description: `${input.submittedBy} submitted ${input.evidenceType} evidence`,
    metadata:    { evidenceId: row.id, evidenceType: input.evidenceType },
  });

  return { success: true, evidenceId: row.id };
}

/**
 * Get all evidence for a dispute, ordered by submission time.
 */
export async function getEvidenceForDispute(disputeId: string) {
  return db
    .select()
    .from(disputeEvidence)
    .where(eq(disputeEvidence.disputeId, disputeId))
    .orderBy(disputeEvidence.createdAt);
}

/**
 * Heuristic evidence strength scoring.
 *
 * Scoring rules:
 *   - tracking evidence: +30 (delivery proof is strongest)
 *   - photo evidence: +20
 *   - receipt evidence: +20
 *   - communication evidence: +15
 *   - other evidence: +10
 *   - Each piece of evidence beyond the first: diminishing returns (50%)
 *
 * Returns a score from 0-100.
 */
export function evaluateEvidenceStrength(
  evidence: Array<{ evidenceType: string }>
): number {
  const typeScores: Record<string, number> = {
    tracking:       30,
    photo:          20,
    receipt:        20,
    communication:  15,
    other:          10,
  };

  let total = 0;
  const seenTypes = new Set<string>();

  for (const item of evidence) {
    const baseScore = typeScores[item.evidenceType] ?? 10;
    // Diminishing returns for duplicate evidence types
    const multiplier = seenTypes.has(item.evidenceType) ? 0.5 : 1;
    total += baseScore * multiplier;
    seenTypes.add(item.evidenceType);
  }

  return Math.min(100, Math.round(total));
}
