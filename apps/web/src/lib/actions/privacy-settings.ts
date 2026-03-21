'use server';

/**
 * Privacy Settings Server Actions — G6
 */

import { z } from 'zod';
import { db } from '@twicely/db';
import { user as userTable } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';

const UpdateMarketingOptInSchema = z.object({
  optIn: z.boolean(),
});

/**
 * Toggle user.marketingOptIn for the authenticated user.
 */
export async function updateMarketingOptIn(
  input: z.infer<typeof UpdateMarketingOptInSchema>
): Promise<{ success: boolean; error?: string }> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!ability.can('update', sub('User', { id: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = UpdateMarketingOptInSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  await db
    .update(userTable)
    .set({ marketingOptIn: parsed.data.optIn, updatedAt: new Date() })
    .where(eq(userTable.id, session.userId));

  return { success: true };
}
