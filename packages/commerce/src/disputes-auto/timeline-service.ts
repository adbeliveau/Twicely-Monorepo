/**
 * Dispute Timeline Service
 *
 * Immutable event log for dispute lifecycle. Events are only appended, never
 * updated or deleted. Every state change, evidence submission, escalation,
 * and resolution creates a timeline entry.
 */

import { db } from '@twicely/db';
import { disputeTimeline } from '@twicely/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { AddTimelineEventInput } from './types';

/**
 * Append an immutable event to the dispute timeline.
 */
export async function addTimelineEvent(input: AddTimelineEventInput): Promise<{ id: string }> {
  const [row] = await db
    .insert(disputeTimeline)
    .values({
      disputeId:   input.disputeId,
      eventType:   input.eventType,
      actorType:   input.actorType,
      actorId:     input.actorId ?? null,
      description: input.description,
      metadata:    input.metadata ?? {},
    })
    .returning({ id: disputeTimeline.id });

  return { id: row.id };
}

/**
 * Get full timeline for a dispute, ordered chronologically.
 */
export async function getTimeline(disputeId: string) {
  return db
    .select()
    .from(disputeTimeline)
    .where(eq(disputeTimeline.disputeId, disputeId))
    .orderBy(disputeTimeline.createdAt);
}

/**
 * Get event counts by type for a dispute (summary view).
 */
export async function getTimelineSummary(disputeId: string) {
  const rows = await db
    .select({
      eventType: disputeTimeline.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(disputeTimeline)
    .where(eq(disputeTimeline.disputeId, disputeId))
    .groupBy(disputeTimeline.eventType);

  const summary: Record<string, number> = {};
  for (const row of rows) {
    summary[row.eventType] = row.count;
  }
  return summary;
}
