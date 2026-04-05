/**
 * Entity mappers — Twicely entities to accounting format — G10.3
 * All money internally in cents; convert to dollars only when sending to external API.
 */

import type { InvoiceData, ExpenseData, JournalEntryData } from './types';

export interface OrderForMapping {
  id: string;
  buyerName: string;
  priceCents: number;
  shippingCostCents: number;
  completedAt: Date;
}

export interface ExpenseForMapping {
  id: string;
  vendor: string | null;
  category: string;
  amountCents: number;
  expenseDate: Date;
  description: string | null;
}

export interface PayoutForMapping {
  id: string;
  amountCents: number;
  createdAt: Date;
  memo: string | null;
}

/**
 * Map a completed Twicely order to InvoiceData for the accounting provider.
 * amountCents are kept internal; providers receive dollars.
 */
export function orderToInvoice(order: OrderForMapping): InvoiceData {
  const lineItems: InvoiceData['lineItems'] = [
    {
      description: `Twicely sale — order ${order.id}`,
      amountCents: order.priceCents,
      quantity: 1,
    },
  ];

  if (order.shippingCostCents > 0) {
    lineItems.push({
      description: 'Shipping',
      amountCents: order.shippingCostCents,
      quantity: 1,
    });
  }

  return {
    customerName: order.buyerName,
    lineItems,
    datePaid: order.completedAt,
    reference: order.id,
  };
}

/**
 * Map a Twicely expense to ExpenseData for the accounting provider.
 */
export function expenseToExpenseData(expense: ExpenseForMapping): ExpenseData {
  return {
    vendor: expense.vendor ?? 'Unknown Vendor',
    category: expense.category,
    amountCents: expense.amountCents,
    date: expense.expenseDate,
    description: expense.description ?? expense.category,
    reference: expense.id,
  };
}

/**
 * Map a Twicely payout to JournalEntryData for the accounting provider.
 */
export function payoutToJournalEntry(payout: PayoutForMapping): JournalEntryData {
  return {
    memo: payout.memo ?? `Twicely payout ${payout.id}`,
    lines: [
      {
        accountName: 'Accounts Receivable',
        debitCents: 0,
        creditCents: payout.amountCents,
      },
      {
        accountName: 'Bank',
        debitCents: payout.amountCents,
        creditCents: 0,
      },
    ],
    date: payout.createdAt,
    reference: payout.id,
  };
}
