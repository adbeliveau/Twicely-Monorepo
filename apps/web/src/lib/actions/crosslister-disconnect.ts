'use server';

import { db } from '@twicely/db';
import { crosslisterAccount } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { disconnectPlatformProjections } from '@twicely/crosslister/services/projection-cascade';
import { logger } from '@twicely/logger';
import { z } from 'zod';

const VALID_CHANNELS = [
  'EBAY', 'POSHMARK', 'MERCARI', 'DEPOP', 'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL',
] as const;

const disconnectPlatformSchema = z.object({
  channel: z.enum(VALID_CHANNELS),
}).strict();

type ValidChannel = (typeof VALID_CHANNELS)[number];

/**
 * Disconnect a crosslister platform account.
 * Revokes tokens, transitions ACTIVE projections → UNMANAGED.
 * Does NOT cancel EMERGENCY_DELIST jobs (those run in a separate queue).
 */
export async function disconnectPlatform(
  input: unknown,
): Promise<{ success: boolean; unmanagedCount: number; error?: string }> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, unmanagedCount: 0, error: 'Unauthorized' };
  }

  const parsed = disconnectPlatformSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, unmanagedCount: 0, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = session.userId;

  if (!ability.can('update', sub('CrosslisterAccount', { sellerId: userId }))) {
    return { success: false, unmanagedCount: 0, error: 'Forbidden' };
  }
  const channel: ValidChannel = parsed.data.channel;

  // Revoke tokens for this channel
  await db
    .update(crosslisterAccount)
    .set({
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      status: 'REVOKED',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(crosslisterAccount.sellerId, userId),
        eq(crosslisterAccount.channel, channel),
      ),
    );

  // ACTIVE → UNMANAGED for this channel
  const unmanagedCount = await disconnectPlatformProjections(userId, channel);

  logger.info('Platform disconnected', {
    userId,
    channel,
    unmanagedProjections: unmanagedCount,
  });

  return { success: true, unmanagedCount };
}
