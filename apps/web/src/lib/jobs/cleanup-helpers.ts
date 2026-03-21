/**
 * Cleanup Job Helpers — G8.2
 *
 * Shared utilities for cleanup cron jobs.
 * Handles platform_setting upsert for job last-run status tracking.
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

/**
 * Upsert a platform setting by key.
 * Used by cleanup jobs to record last-run timestamps and results.
 * Keys NOT seeded in advance — created on first run via upsert.
 */
export async function upsertPlatformSetting(
  key: string,
  value: string
): Promise<void> {
  const existing = await db
    .select({ id: platformSetting.id })
    .from(platformSetting)
    .where(eq(platformSetting.key, key))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(platformSetting)
      .set({ value, updatedAt: new Date() })
      .where(eq(platformSetting.key, key));
  } else {
    await db.insert(platformSetting).values({
      id: createId(),
      key,
      value,
      type: 'string',
      category: 'cleanup',
      description: `Auto-updated by cleanup job: ${key}`,
      isSecret: false,
    });
  }
}
