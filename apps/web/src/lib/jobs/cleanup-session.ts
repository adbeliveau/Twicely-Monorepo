/**
 * Session Cleanup Job — G8.2
 *
 * Purges expired sessions from the session table every 6 hours.
 * Per Feature Lock-in section 40.
 */

import { db } from '@twicely/db';
import { session } from '@twicely/db/schema';
import { lt } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { upsertPlatformSetting } from '@twicely/jobs/cleanup-helpers';

/**
 * Delete all sessions where expiresAt < now().
 * Returns count of purged sessions.
 */
export async function runSessionCleanup(): Promise<number> {
  const now = new Date();

  const result = await db
    .delete(session)
    .where(lt(session.expiresAt, now));

  const count = result.count ?? 0;
  logger.info('[sessionCleanup] Purged expired sessions', { count });

  // Write last-run status to platform_settings
  await upsertPlatformSetting(
    'cleanup.sessionCleanup.lastRunAt',
    now.toISOString()
  );
  await upsertPlatformSetting(
    'cleanup.sessionCleanup.lastResult',
    `Purged ${count} expired sessions`
  );

  return count;
}
