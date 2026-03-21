'use server';

import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { helpdeskCase, caseMessage } from '@twicely/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { generateSuggestion, assistReply } from '@/lib/helpdesk/ai-service';
import type { AssistAction } from '@/lib/helpdesk/ai-service';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

const getAiSuggestionSchema = z.object({
  caseId: z.string().min(1),
}).strict();

const getAiAssistSchema = z.object({
  body: z.string().max(5000),
  action: z.enum(['REWRITE', 'SUMMARIZE', 'TRANSLATE_ES', 'TRANSLATE_FR']),
}).strict();

// =============================================================================
// ACTIONS
// =============================================================================

export async function getAiSuggestion(
  input: unknown
): Promise<ActionResult<{ suggestion: string }>> {
  let ability;
  try {
    const result = await staffAuthorize();
    ability = result.ability;
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('read', 'HelpdeskCase')) {
    return { success: false, error: 'Access denied' };
  }

  const parsed = getAiSuggestionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { caseId } = parsed.data;

  const cases = await db
    .select({
      id: helpdeskCase.id,
      type: helpdeskCase.type,
      priority: helpdeskCase.priority,
      subject: helpdeskCase.subject,
      description: helpdeskCase.description,
      orderId: helpdeskCase.orderId,
    })
    .from(helpdeskCase)
    .where(eq(helpdeskCase.id, caseId))
    .limit(1);

  const caseRecord = cases[0];
  if (!caseRecord) {
    return { success: false, error: 'Not found' };
  }

  const messages = await db
    .select({ direction: caseMessage.direction, body: caseMessage.body })
    .from(caseMessage)
    .where(eq(caseMessage.caseId, caseId))
    .orderBy(desc(caseMessage.createdAt))
    .limit(5);

  const linkedEntitySummary = caseRecord.orderId
    ? `Order ID: ${caseRecord.orderId}`
    : undefined;

  const suggestion = await generateSuggestion({
    type: caseRecord.type,
    priority: caseRecord.priority,
    subject: caseRecord.subject,
    description: caseRecord.description,
    recentMessages: messages.map((m) => ({ direction: m.direction, body: m.body })),
    linkedEntitySummary,
  });

  if (!suggestion) {
    return { success: false, error: 'AI suggestion unavailable' };
  }

  return { success: true, data: { suggestion } };
}

export async function getAiAssist(
  input: unknown
): Promise<ActionResult<{ result: string }>> {
  let ability;
  try {
    const result = await staffAuthorize();
    ability = result.ability;
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('read', 'HelpdeskCase')) {
    return { success: false, error: 'Access denied' };
  }

  const parsed = getAiAssistSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { body, action } = parsed.data;

  const transformed = await assistReply(body, action as AssistAction);

  if (!transformed) {
    return { success: false, error: 'AI assist unavailable' };
  }

  return { success: true, data: { result: transformed } };
}
