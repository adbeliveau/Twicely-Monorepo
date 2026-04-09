/**
 * Shared filter helpers for the projection engine.
 * Extracted so both projection-engine.ts and projection-health.ts
 * can import without circular dependencies.
 */

import type { OrderSummary, ExpenseSummary } from './projection-types';

export function daysAgoFilter(orders: OrderSummary[], days: number): OrderSummary[] {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return orders.filter((o) => o.completedAt >= cutoff);
}

export function expensesInDays(expenses: ExpenseSummary[], days: number): ExpenseSummary[] {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return expenses.filter((e) => e.expenseDate >= cutoff);
}
