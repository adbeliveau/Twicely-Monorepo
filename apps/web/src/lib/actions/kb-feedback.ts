'use server';

import { db } from '@twicely/db';
import { kbCaseArticleLink, kbArticleFeedback } from '@twicely/db/schema';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { authorize } from '@twicely/casl';
import { submitArticleFeedbackSchema } from '@/lib/validations/helpdesk';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

// ─── Article <-> Case link ─────────────────────────────────────────────────────

export async function linkArticleToCase(
  caseId: string,
  articleId: string,
  sentToCustomer: boolean
): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('update', 'HelpdeskCase')) {
    return { success: false, error: 'Forbidden' };
  }

  await db.insert(kbCaseArticleLink).values({
    caseId,
    articleId,
    linkedByStaffId: session.staffUserId,
    sentToCustomer,
  });

  return { success: true };
}

// ─── Article feedback ─────────────────────────────────────────────────────────

export async function submitArticleFeedback(
  formData: unknown
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!ability.can('read', 'KbArticle')) return { success: false, error: 'Not authorized' };

  const parsed = submitArticleFeedbackSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { articleId, helpful, comment } = parsed.data;

  await db.insert(kbArticleFeedback).values({
    articleId,
    userId: session.userId,
    helpful,
    comment: comment ?? null,
  });

  return { success: true };
}
