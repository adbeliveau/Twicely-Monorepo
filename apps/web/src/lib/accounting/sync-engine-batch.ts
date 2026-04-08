/**
 * Batch sync functions — G10.3
 * Idempotent entity-level sync: sales, expenses, payouts.
 * Called by runFullSync in sync-engine.ts.
 */

import { db } from '@twicely/db';
import {
  accountingIntegration,
  accountingEntityMap,
  order,
  expense,
  payout,
} from '@twicely/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { decrypt } from '@twicely/db/encryption';
import { logger } from '@twicely/logger';
import { getAccountingAdapter } from './adapter-factory';
import { orderToInvoice, expenseToExpenseData, payoutToJournalEntry } from './entity-mappers';

/** Sync completed sales (orders) as invoices. Idempotent — skips already-mapped orders. */
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

/** Sync expenses to the accounting provider. Idempotent — skips already-mapped expenses. */
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

/** Sync completed payouts as journal entries. Idempotent — skips already-mapped payouts. */
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
