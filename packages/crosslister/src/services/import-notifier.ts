/**
 * Import notifier — sends in-app + email notification when an import completes.
 * Source: F1.2 install prompt §2.11
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Fire-and-forget: errors are logged but never thrown.
 */

import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';

export interface ImportCounts {
  createdItems: number;
  deduplicatedItems: number;
  failedItems: number;
  skippedItems: number;
}

/**
 * Send an import_completed notification to the seller.
 * Uses the import_completed template (added in Stream 0).
 */
export async function notifyImportCompleted(
  sellerId: string,
  _batchId: string,
  counts: ImportCounts,
): Promise<void> {
  try {
    await notify(sellerId, 'import_completed', {
      createdItems: String(counts.createdItems),
      failedItems: String(counts.failedItems),
      deduplicatedItems: String(counts.deduplicatedItems),
      skippedItems: String(counts.skippedItems),
    });
  } catch (err) {
    logger.error('[notifyImportCompleted] Failed to send notification', {
      sellerId,
      error: String(err),
    });
  }
}
