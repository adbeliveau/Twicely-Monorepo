/**
 * Stripe vs. Ledger Reconciliation Check
 *
 * Compares Stripe payment events against ledger entries for a date range.
 * Detects: UNMATCHED_STRIPE_EVENT, ORPHANED_LEDGER_ENTRY, AMOUNT_MISMATCH.
 * Canonical 31 Section 6.2.
 */

import type {
  StripeEventRecord,
  LedgerEntryRecord,
  StripeEventLogRecord,
  Variance,
  ReconCheckResult,
} from '../types';

export function checkStripeVsLedger(input: {
  stripeEvents: StripeEventRecord[];
  ledgerEntries: LedgerEntryRecord[];
  stripeEventLogs: StripeEventLogRecord[];
}): ReconCheckResult {
  const variances: Variance[] = [];
  let matchedCount = 0;

  // Build lookup: stripeEventId -> ledger entries
  const ledgerByStripeEventId = new Map<string, LedgerEntryRecord[]>();
  for (const entry of input.ledgerEntries) {
    if (!entry.stripeEventId) continue;
    const existing = ledgerByStripeEventId.get(entry.stripeEventId) ?? [];
    existing.push(entry);
    ledgerByStripeEventId.set(entry.stripeEventId, existing);
  }

  const stripeEventUsed = new Set<string>();

  // --- Pass 1: Every Stripe event should have a ledger match ----------------
  for (const stripeEvent of input.stripeEvents) {
    const ledgerMatches = ledgerByStripeEventId.get(stripeEvent.id);

    if (!ledgerMatches || ledgerMatches.length === 0) {
      variances.push({
        type: 'UNMATCHED_STRIPE_EVENT',
        stripeEventId: stripeEvent.id,
        stripeObjectType: stripeEvent.type,
        stripeAmountCents: stripeEvent.amountCents,
        varianceAmountCents: Math.abs(stripeEvent.amountCents),
      });
    } else {
      stripeEventUsed.add(stripeEvent.id);

      // Verify amounts match (sum all ledger entries for this event)
      const ledgerTotal = ledgerMatches.reduce((sum, e) => sum + e.amountCents, 0);
      const diff = Math.abs(stripeEvent.amountCents) - Math.abs(ledgerTotal);

      if (Math.abs(diff) > 0) {
        variances.push({
          type: 'AMOUNT_MISMATCH',
          stripeEventId: stripeEvent.id,
          stripeObjectType: stripeEvent.type,
          ledgerEntryId: ledgerMatches[0].id,
          stripeAmountCents: stripeEvent.amountCents,
          ledgerAmountCents: ledgerTotal,
          varianceAmountCents: Math.abs(diff),
          orderId: ledgerMatches[0].orderId ?? undefined,
          userId: ledgerMatches[0].userId ?? undefined,
        });
      } else {
        matchedCount++;
      }
    }
  }

  // --- Pass 2: Orphaned ledger entries (reference non-existent Stripe event) --
  for (const entry of input.ledgerEntries) {
    if (!entry.stripeEventId) continue;
    if (!stripeEventUsed.has(entry.stripeEventId)) {
      // Check it wasn't already flagged as unmatched stripe (the stripe side exists
      // but a different scenario). Only flag if the stripe event is truly missing.
      const stripeEventExists = input.stripeEvents.some((se) => se.id === entry.stripeEventId);
      if (!stripeEventExists) {
        variances.push({
          type: 'ORPHANED_LEDGER_ENTRY',
          ledgerEntryId: entry.id,
          stripeEventId: entry.stripeEventId,
          ledgerAmountCents: entry.amountCents,
          varianceAmountCents: Math.abs(entry.amountCents),
          orderId: entry.orderId ?? undefined,
          userId: entry.userId ?? undefined,
        });
      }
    }
  }

  // --- Pass 3: Duplicate Stripe event IDs ------------------------------------
  const eventIdCounts = new Map<string, number>();
  for (const log of input.stripeEventLogs) {
    eventIdCounts.set(log.stripeEventId, (eventIdCounts.get(log.stripeEventId) ?? 0) + 1);
  }
  for (const [eventId, count] of eventIdCounts) {
    if (count > 1) {
      variances.push({
        type: 'DUPLICATE_STRIPE_EVENT',
        stripeEventId: eventId,
        varianceAmountCents: 0,
      });
    }
  }

  // Totals
  const stripeTotalCents = input.stripeEvents.reduce((s, e) => s + Math.abs(e.amountCents), 0);
  const ledgerTotalCents = input.ledgerEntries.reduce((s, e) => s + Math.abs(e.amountCents), 0);

  return {
    checkName: 'stripe-vs-ledger',
    passed: variances.length === 0,
    variancesFound: variances,
    stripeTotalCents,
    ledgerTotalCents,
    matchedCount,
    checkedCount: input.stripeEvents.length + input.ledgerEntries.length,
  };
}
