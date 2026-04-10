/**
 * Ledger vs. Orders Reconciliation Check
 *
 * Compares ledger entry totals against order totals for a date range.
 * Catches orphaned ledger entries or missing entries for completed orders.
 * Canonical 31 Section 6.1 — balance comparison: sum of Stripe charges =
 * sum of ORDER_PAYMENT_CAPTURED ledger entries.
 */

import type { Variance, ReconCheckResult } from '../types';

export interface OrderRecord {
  id: string;
  totalCents: number;
  paidAt: Date | null;
  stripePaymentIntentId: string | null;
}

export interface LedgerOrderEntry {
  id: string;
  orderId: string | null;
  amountCents: number;
  type: string;
}

export function checkLedgerVsOrders(input: {
  orders: OrderRecord[];
  ledgerEntries: LedgerOrderEntry[];
}): ReconCheckResult {
  const variances: Variance[] = [];
  let matchedCount = 0;

  // Build lookup: orderId -> ledger entries
  const ledgerByOrderId = new Map<string, LedgerOrderEntry[]>();
  for (const entry of input.ledgerEntries) {
    if (!entry.orderId) continue;
    const existing = ledgerByOrderId.get(entry.orderId) ?? [];
    existing.push(entry);
    ledgerByOrderId.set(entry.orderId, existing);
  }

  const ordersMatched = new Set<string>();

  // Check each paid order has corresponding ledger entries
  for (const order of input.orders) {
    if (!order.paidAt) continue;

    const entries = ledgerByOrderId.get(order.id);
    if (!entries || entries.length === 0) {
      // Order was paid but no ledger entry exists
      variances.push({
        type: 'ORPHANED_LEDGER_ENTRY',
        orderId: order.id,
        stripeAmountCents: order.totalCents,
        varianceAmountCents: Math.abs(order.totalCents),
      });
    } else {
      // Sum ORDER_PAYMENT_CAPTURED entries for this order
      const capturedTotal = entries
        .filter((e) => e.type === 'ORDER_PAYMENT_CAPTURED')
        .reduce((sum, e) => sum + e.amountCents, 0);

      const diff = Math.abs(order.totalCents) - Math.abs(capturedTotal);
      if (Math.abs(diff) > 0) {
        variances.push({
          type: 'AMOUNT_MISMATCH',
          orderId: order.id,
          ledgerEntryId: entries[0].id,
          stripeAmountCents: order.totalCents,
          ledgerAmountCents: capturedTotal,
          varianceAmountCents: Math.abs(diff),
        });
      } else {
        matchedCount++;
      }
      ordersMatched.add(order.id);
    }
  }

  // Check for ledger entries referencing orders not in our set
  for (const entry of input.ledgerEntries) {
    if (!entry.orderId) continue;
    if (entry.type !== 'ORDER_PAYMENT_CAPTURED') continue;
    const orderExists = input.orders.some((o) => o.id === entry.orderId);
    if (!orderExists) {
      variances.push({
        type: 'ORPHANED_LEDGER_ENTRY',
        ledgerEntryId: entry.id,
        orderId: entry.orderId,
        ledgerAmountCents: entry.amountCents,
        varianceAmountCents: Math.abs(entry.amountCents),
      });
    }
  }

  const stripeTotalCents = input.orders
    .filter((o) => o.paidAt)
    .reduce((s, o) => s + Math.abs(o.totalCents), 0);
  const ledgerTotalCents = input.ledgerEntries.reduce((s, e) => s + Math.abs(e.amountCents), 0);

  return {
    checkName: 'ledger-vs-orders',
    passed: variances.length === 0,
    variancesFound: variances,
    stripeTotalCents,
    ledgerTotalCents,
    matchedCount,
    checkedCount: input.orders.length + input.ledgerEntries.length,
  };
}
