/**
 * Sync engine — orchestrates pushing Twicely data to QB/Xero — G10.3
 * All sync operations are idempotent: checks entityMap before creating.
 * Uses encrypt/decrypt from @twicely/db/encryption for token access.
 */

import { db } from '@twicely/db';
import { accountingIntegration, accountingSyncLog } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt, encrypt } from '@twicely/db/encryption';
import { logger } from '@twicely/logger';
import { getAccountingAdapter } from './adapter-factory';
import { notifyAccountingSync } from './accounting-notifier';
import { syncPayouts, syncSales, syncExpenses } from './sync-engine-batch';

// Re-export batch functions so existing callers can continue importing
// them from './sync-engine' without knowing about the split.
export { syncPayouts, syncSales, syncExpenses } from './sync-engine-batch';

/**
 * Refresh OAuth tokens for an integration.
 * Decrypts the stored refresh token, calls the adapter, encrypts + saves the new tokens.
 */
export async function refreshIntegrationTokens(integrationId: string): Promise<void> {
  const [integration] = await db
    .select()
    .from(accountingIntegration)
    .where(eq(accountingIntegration.id, integrationId))
    .limit(1);

  if (!integration) throw new Error(`Integration not found: ${integrationId}`);
  if (!integration.refreshToken) throw new Error('Integration missing refresh token');

  const adapter = getAccountingAdapter(integration.provider as 'QUICKBOOKS' | 'XERO');
  const refreshToken = decrypt(integration.refreshToken);
  const result = await adapter.refreshTokens(refreshToken);

  await db
    .update(accountingIntegration)
    .set({
      accessToken: encrypt(result.accessToken),
      refreshToken: encrypt(result.refreshToken),
      updatedAt: new Date(),
    })
    .where(eq(accountingIntegration.id, integrationId));

  logger.info('[refreshIntegrationTokens] Tokens refreshed', { integrationId });
}

/**
 * Run a full sync: sales + expenses.
 * Creates a sync log entry and updates the integration's lastSyncAt + status.
 */
export async function runFullSync(integrationId: string): Promise<{
  success: boolean;
  logId: string;
  recordsSynced: number;
  recordsFailed: number;
}> {
  // Create sync log entry in PENDING state
  const [logEntry] = await db
    .insert(accountingSyncLog)
    .values({
      integrationId,
      syncType: 'FULL',
      status: 'IN_PROGRESS',
    })
    .returning({ id: accountingSyncLog.id });

  if (!logEntry) throw new Error('Failed to create sync log entry');
  const logId = logEntry.id;

  // Look up integration for userId and provider (needed for notifications)
  const [integration] = await db
    .select({ userId: accountingIntegration.userId, provider: accountingIntegration.provider })
    .from(accountingIntegration)
    .where(eq(accountingIntegration.id, integrationId))
    .limit(1);

  let totalSynced = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  try {
    // Step 1: Refresh tokens before syncing
    await refreshIntegrationTokens(integrationId);

    // Step 2: Sync all entity types
    const salesResult = await syncSales(integrationId);
    const expensesResult = await syncExpenses(integrationId);
    const payoutsResult = await syncPayouts(integrationId);

    totalSynced = salesResult.recordsSynced + expensesResult.recordsSynced + payoutsResult.recordsSynced;
    totalFailed = salesResult.recordsFailed + expensesResult.recordsFailed + payoutsResult.recordsFailed;

    if (salesResult.errorMessage) allErrors.push(salesResult.errorMessage);
    if (expensesResult.errorMessage) allErrors.push(expensesResult.errorMessage);
    if (payoutsResult.errorMessage) allErrors.push(payoutsResult.errorMessage);

    const finalStatus = totalFailed === 0 ? 'COMPLETED' : 'FAILED';

    await db
      .update(accountingSyncLog)
      .set({
        status: finalStatus,
        recordsSynced: totalSynced,
        recordsFailed: totalFailed,
        errorMessage: allErrors.length > 0 ? allErrors.join(' | ') : null,
        completedAt: new Date(),
      })
      .where(eq(accountingSyncLog.id, logId));

    await db
      .update(accountingIntegration)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: finalStatus,
        syncErrorCount: totalFailed,
        updatedAt: new Date(),
      })
      .where(eq(accountingIntegration.id, integrationId));

    // Notify user of sync result
    if (integration) {
      void notifyAccountingSync(
        integration.userId,
        integration.provider,
        totalSynced,
        totalFailed,
      );
    }

    return { success: totalFailed === 0, logId, recordsSynced: totalSynced, recordsFailed: totalFailed };
  } catch (err) {
    const errorMsg = String(err);
    await db
      .update(accountingSyncLog)
      .set({
        status: 'FAILED',
        recordsSynced: totalSynced,
        recordsFailed: totalFailed + 1,
        errorMessage: errorMsg,
        completedAt: new Date(),
      })
      .where(eq(accountingSyncLog.id, logId));

    await db
      .update(accountingIntegration)
      .set({
        lastSyncStatus: 'FAILED',
        updatedAt: new Date(),
      })
      .where(eq(accountingIntegration.id, integrationId));

    // Notify user of failure
    if (integration) {
      void notifyAccountingSync(
        integration.userId,
        integration.provider,
        totalSynced,
        totalFailed + 1,
        errorMsg,
      );
    }

    logger.error('[runFullSync] Sync failed', { integrationId, error: errorMsg });
    return { success: false, logId, recordsSynced: totalSynced, recordsFailed: totalFailed + 1 };
  }
}
