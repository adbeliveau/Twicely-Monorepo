'use server';

import { db } from '@twicely/db';
import { helpdeskCase, caseCsat, caseEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { submitCsatSchema } from '@/lib/validations/helpdesk';

interface ActionResult {
  success: boolean;
  error?: string;
}

/** User submits CSAT rating for a resolved case. One submission per case. */
export async function submitCsat(formData: unknown): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!ability.can('create', sub('CaseCsat', { userId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = submitCsatSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { caseId, rating, comment } = parsed.data;

  const existingCase = await db
    .select({ requesterId: helpdeskCase.requesterId, status: helpdeskCase.status })
    .from(helpdeskCase)
    .where(eq(helpdeskCase.id, caseId))
    .limit(1);

  const caseRecord = existingCase[0];
  if (!caseRecord) return { success: false, error: 'Not found' };

  if (caseRecord.requesterId !== session.userId) return { success: false, error: 'Not found' };
  if (caseRecord.status !== 'RESOLVED') {
    return { success: false, error: 'CSAT can only be submitted for resolved cases' };
  }

  // Check for existing CSAT submission
  const existingCsat = await db
    .select({ id: caseCsat.id })
    .from(caseCsat)
    .where(eq(caseCsat.caseId, caseId))
    .limit(1);

  if (existingCsat.length > 0 && existingCsat[0]?.id) {
    // Check if it was already rated (respondedAt set)
    const csatRecord = await db
      .select({ respondedAt: caseCsat.respondedAt })
      .from(caseCsat)
      .where(eq(caseCsat.caseId, caseId))
      .limit(1);

    if (csatRecord[0]?.respondedAt) {
      return { success: false, error: 'CSAT already submitted for this case' };
    }

    // Update existing survey record
    await db.update(caseCsat)
      .set({ rating, comment: comment ?? null, respondedAt: new Date() })
      .where(eq(caseCsat.caseId, caseId));
  } else {
    // Create new CSAT record
    await db.insert(caseCsat).values({
      caseId,
      userId: session.userId,
      rating,
      comment: comment ?? null,
      surveyRequestedAt: new Date(),
      respondedAt: new Date(),
    });
  }

  await db.insert(caseEvent).values({
    caseId,
    eventType: 'csat_submitted',
    actorType: 'user',
    actorId: session.userId,
    dataJson: { rating },
  });

  return { success: true };
}
