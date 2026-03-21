'use server';

import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { staffUser } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

// =============================================================================
// INPUT SCHEMA
// =============================================================================

const updateAgentSignatureSchema = z.object({
  signatureHtml: z.string().max(2000),
}).strict();

// =============================================================================
// HTML SANITIZER — escapes all HTML entities (plain text only)
// =============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeSignatureHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br />');
}

// =============================================================================
// ACTION
// =============================================================================

export async function updateAgentSignature(
  input: unknown
): Promise<ActionResult> {
  let session;
  try {
    const result = await staffAuthorize();
    session = result.session;
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = updateAgentSignatureSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const rawSignature = parsed.data.signatureHtml;
  const signatureHtml = rawSignature.trim() === ''
    ? null
    : sanitizeSignatureHtml(rawSignature);

  await db
    .update(staffUser)
    .set({ signatureHtml, updatedAt: new Date() })
    .where(eq(staffUser.id, session.staffUserId));

  return { success: true };
}
