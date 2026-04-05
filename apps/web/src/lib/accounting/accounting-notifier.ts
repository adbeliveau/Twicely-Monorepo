/**
 * Fire-and-forget notifications for accounting sync events — G10.3
 */

import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';

/**
 * Notify user about accounting sync result.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function notifyAccountingSync(
  userId: string,
  provider: string,
  recordsSynced: number,
  recordsFailed: number,
  errorMessage?: string,
): Promise<void> {
  try {
    if (recordsFailed === 0) {
      await notify(userId, 'accounting.sync.completed', {
        provider,
        recordsSynced: String(recordsSynced),
        syncDate: new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }),
      });
    } else {
      await notify(userId, 'accounting.sync.failed', {
        provider,
        errorMessage: errorMessage ?? `${recordsFailed} record(s) failed to sync`,
      });
    }
  } catch (err) {
    logger.error('[notifyAccountingSync] Failed to send notification', {
      userId,
      provider,
      error: String(err),
    });
  }
}
