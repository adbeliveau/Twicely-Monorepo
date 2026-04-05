/**
 * Sync engine — orchestrates pushing Twicely data to QB/Xero — G10.3
 * All sync operations are idempotent: checks entityMap before creating.
 * Uses encrypt/decrypt from @twicely/db/encryption for token access.
 */

import { db } from '@twicely/db';
import {
  accountingIntegration,
  accountingSyncLog,
  accountingEntityMap,
  order,
  expense,
  payout,
} from '@twicely/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { decrypt, encrypt } from '@twicely/db/encryption';
import { logger } from '@twicely/logger';
import { getAccountingAdapter } from './adapter-factory';
import { orderToInvoice, expenseToExpenseData, payoutToJournalEntry } from './entity-mappers';
import { notifyAccountingSync } from './accounting-notifier';

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
 * Sync completed payouts to the accounting provider as journal entries.
 * Idempotent: skips payouts already present in accountingEntityMap.
 */
export async function syncPayouts(integrationId: string): Promise<{
  recordsSynced: number;
  recordsFailed: number;
  errorMessage: string | null;
}> {
  const [integration] = await db
    .select()
    .from(accountingIntegration)
    .where(eq(accountingIntegration.id, integrationId))
    .limit(1);

  if (!integration) throw new Error(`Integration not found: ${integrationId}`);
  if (!integration.accessToken || !integration.externalAccountId) {
    throw new Error('Integration missing tokens or account ID');
  }

  const accessToken = decrypt(integration.accessToken);
  const realmId = integration.externalAccountId;
  const adapter = getAccountingAdapter(integration.provider as 'QUICKBOOKS' | 'XERO');

  const sinceDate = integration.lastSyncAt ?? new Date(0);
  const completedPayouts = await db
    .select({
      id: payout.id,
      amountCents: payout.amountCents,
      createdAt: payout.createdAt,
    })
    .from(payout)
    .where(
      and(
        eq(payout.userId, integration.userId),
        eq(payout.status, 'COMPLETED'),
        gt(payout.createdAt, sinceDate),
      ),
    );

  let recordsSynced = 0;
  let recordsFailed = 0;
  const errors: string[] = [];

  for (const completedPayout of completedPayouts) {
    const [existing] = await db
      .select({ id: accountingEntityMap.id })
      .from(accountingEntityMap)
      .where(
        and(
          eq(accountingEntityMap.integrationId, integrationId),
          eq(accountingEntityMap.twicelyEntityType, 'PAYOUT'),
          eq(accountingEntityMap.twicelyEntityId, completedPayout.id),
        ),
      )
      .limit(1);

    if (existing) continue;

    try {
      const journalData = payoutToJournalEntry({
        id: completedPayout.id,
        amountCents: completedPayout.amountCents,
        createdAt: completedPayout.createdAt,
        memo: null,
      });

      const externalEntity = await adapter.createJournalEntry(accessToken, realmId, journalData);

      await db.insert(accountingEntityMap).values({
        integrationId,
        twicelyEntityType: 'PAYOUT',
        twicelyEntityId: completedPayout.id,
        externalEntityType: externalEntity.externalType,
        externalEntityId: externalEntity.externalId,
      });

      recordsSynced++;
    } catch (err) {
      recordsFailed++;
      errors.push(`Payout ${completedPayout.id}: ${String(err)}`);
      logger.error('[syncPayouts] Failed to sync payout', {
        integrationId,
        payoutId: completedPayout.id,
        error: String(err),
      });
    }
  }

  return {
    recordsSynced,
    recordsFailed,
    errorMessage: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
  };
}

/**
 * Sync completed sales (orders) to the accounting provider as invoices.
 * Idempotent: skips orders already present in accountingEntityMap.
 */
export async function syncSales(integrationId: string): Promise<{
  recordsSynced: number;
  recordsFailed: number;
  errorMessage: string | null;
}> {
  const [integration] = await db
    .select()
    .from(accountingIntegration)
    .where(eq(accountingIntegration.id, integrationId))
    .limit(1);

  if (!integration) throw new Error(`Integration not found: ${integrationId}`);
  if (!integration.accessToken || !integration.externalAccountId) {
    throw new Error('Integration missing tokens or account ID');
  }

  const accessToken = decrypt(integration.accessToken);
  const realmId = integration.externalAccountId;
  const adapter = getAccountingAdapter(integration.provider as 'QUICKBOOKS' | 'XERO');

  // Query completed orders since lastSyncAt
  const sinceDate = integration.lastSyncAt ?? new Date(0);
  const completedOrders = await db
    .select({
      id: order.id,
      buyerId: order.buyerId,
      totalCents: order.totalCents,
      shippingCents: order.shippingCents,
      completedAt: order.completedAt,
    })
    .from(order)
    .where(
      and(
        eq(order.sellerId, integration.userId),
        eq(order.status, 'COMPLETED'),
        gt(order.completedAt, sinceDate),
      ),
    );

  let recordsSynced = 0;
  let recordsFailed = 0;
  const errors: string[] = [];

  for (const completedOrder of completedOrders) {
    // Idempotency: check if already synced
    const [existing] = await db
      .select({ id: accountingEntityMap.id })
      .from(accountingEntityMap)
      .where(
        and(
          eq(accountingEntityMap.integrationId, integrationId),
          eq(accountingEntityMap.twicelyEntityType, 'ORDER'),
          eq(accountingEntityMap.twicelyEntityId, completedOrder.id),
        ),
      )
      .limit(1);

    if (existing) continue;

    try {
      const invoiceData = orderToInvoice({
        id: completedOrder.id,
        buyerName: completedOrder.buyerId,
        priceCents: completedOrder.totalCents - completedOrder.shippingCents,
        shippingCostCents: completedOrder.shippingCents,
        completedAt: completedOrder.completedAt ?? new Date(),
      });

      const externalEntity = await adapter.createInvoice(accessToken, realmId, invoiceData);

      await db.insert(accountingEntityMap).values({
        integrationId,
        twicelyEntityType: 'ORDER',
        twicelyEntityId: completedOrder.id,
        externalEntityType: externalEntity.externalType,
        externalEntityId: externalEntity.externalId,
      });

      recordsSynced++;
    } catch (err) {
      recordsFailed++;
      errors.push(`Order ${completedOrder.id}: ${String(err)}`);
      logger.error('[syncSales] Failed to sync order', {
        integrationId,
        orderId: completedOrder.id,
        error: String(err),
      });
    }
  }

  return {
    recordsSynced,
    recordsFailed,
    errorMessage: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
  };
}

/**
 * Sync expenses to the accounting provider.
 * Idempotent: skips expenses already present in accountingEntityMap.
 */
export async function syncExpenses(integrationId: string): Promise<{
  recordsSynced: number;
  recordsFailed: number;
  errorMessage: string | null;
}> {
  const [integration] = await db
    .select()
    .from(accountingIntegration)
    .where(eq(accountingIntegration.id, integrationId))
    .limit(1);

  if (!integration) throw new Error(`Integration not found: ${integrationId}`);
  if (!integration.accessToken || !integration.externalAccountId) {
    throw new Error('Integration missing tokens or account ID');
  }

  const accessToken = decrypt(integration.accessToken);
  const realmId = integration.externalAccountId;
  const adapter = getAccountingAdapter(integration.provider as 'QUICKBOOKS' | 'XERO');

  const sinceDate = integration.lastSyncAt ?? new Date(0);
  const expenseRows = await db
    .select({
      id: expense.id,
      vendor: expense.vendor,
      category: expense.category,
      amountCents: expense.amountCents,
      expenseDate: expense.expenseDate,
      description: expense.description,
    })
    .from(expense)
    .where(
      and(
        eq(expense.userId, integration.userId),
        gt(expense.expenseDate, sinceDate),
      ),
    );

  let recordsSynced = 0;
  let recordsFailed = 0;
  const errors: string[] = [];

  for (const expenseRow of expenseRows) {
    const [existing] = await db
      .select({ id: accountingEntityMap.id })
      .from(accountingEntityMap)
      .where(
        and(
          eq(accountingEntityMap.integrationId, integrationId),
          eq(accountingEntityMap.twicelyEntityType, 'EXPENSE'),
          eq(accountingEntityMap.twicelyEntityId, expenseRow.id),
        ),
      )
      .limit(1);

    if (existing) continue;

    try {
      const expenseData = expenseToExpenseData(expenseRow);
      const externalEntity = await adapter.createExpense(accessToken, realmId, expenseData);

      await db.insert(accountingEntityMap).values({
        integrationId,
        twicelyEntityType: 'EXPENSE',
        twicelyEntityId: expenseRow.id,
        externalEntityType: externalEntity.externalType,
        externalEntityId: externalEntity.externalId,
      });

      recordsSynced++;
    } catch (err) {
      recordsFailed++;
      errors.push(`Expense ${expenseRow.id}: ${String(err)}`);
      logger.error('[syncExpenses] Failed to sync expense', {
        integrationId,
        expenseId: expenseRow.id,
        error: String(err),
      });
    }
  }

  return {
    recordsSynced,
    recordsFailed,
    errorMessage: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
  };
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
