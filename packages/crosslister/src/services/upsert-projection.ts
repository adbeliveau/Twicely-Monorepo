import { db } from '@twicely/db';
import { channelProjection } from '@twicely/db/schema';
import { sql } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';

type NewChannelProjection = InferInsertModel<typeof channelProjection>;

/**
 * Upsert a channel projection using the unique constraint on (sellerId, channel, externalId).
 * On conflict, updates sync tracking fields but never overwrites user-edited content.
 */
export async function upsertProjection(
  data: NewChannelProjection,
): Promise<typeof channelProjection.$inferSelect> {
  const rows = await db
    .insert(channelProjection)
    .values(data)
    .onConflictDoUpdate({
      target: [
        channelProjection.sellerId,
        channelProjection.channel,
        channelProjection.externalId,
      ],
      set: {
        pollTier: data.pollTier,
        nextPollAt: data.nextPollAt,
        updatedAt: sql`now()`,
        // Never overwrite: overridesJson, platformDataJson (user edits)
      },
    })
    .returning();

  if (!rows[0]) {
    throw new Error('upsertProjection: no row returned');
  }
  return rows[0];
}
