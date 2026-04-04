'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { combinedShippingQuote, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { notify } from '@twicely/notifications/service';
import { formatPrice } from '@twicely/utils/format';
import {
  submitShippingQuoteSchema,
  respondToShippingQuoteSchema,
} from '@/lib/validations/shipping-quote';
import { resolveQuoteFinalPrice } from '@/lib/services/shipping-quote-resolver';

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Submit a combined shipping quote (seller action).
 * The quoted amount cannot exceed maxShippingCents.
 * If called after penalty is applied, resolves final price per canonical rules.
 */
export async function submitShippingQuote(input: unknown): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // Resolve effective seller ID (own or delegated)
  const effectiveSellerId = session.delegationId
    ? session.onBehalfOfSellerId!
    : session.userId;

  if (!ability.can('update', sub('CombinedShippingQuote', { sellerId: effectiveSellerId }))) {
    return { success: false, error: 'You do not have permission to submit shipping quotes' };
  }

  const parsed = submitShippingQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { quoteId, quotedShippingCents } = parsed.data;

  const [quote] = await db
    .select()
    .from(combinedShippingQuote)
    .where(eq(combinedShippingQuote.id, quoteId))
    .limit(1);

  // S1: Return same message for not-found and ownership mismatch (never expose ownership)
  if (!quote || quote.sellerId !== effectiveSellerId) {
    return { success: false, error: 'Quote not found' };
  }

  if (quote.status !== 'PENDING_SELLER' && quote.status !== 'PENALTY_APPLIED') {
    return { success: false, error: 'This quote cannot be updated in its current state' };
  }

  if (quotedShippingCents > quote.maxShippingCents) {
    return {
      success: false,
      error: `Quote cannot exceed the maximum shipping of ${formatPrice(quote.maxShippingCents)}`,
    };
  }

  const now = new Date();

  // Fetch order number for notification (V3)
  const [orderRow] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(eq(order.id, quote.orderId))
    .limit(1);
  const orderNumber = orderRow?.orderNumber ?? quote.orderId;

  if (quote.status === 'PENDING_SELLER') {
    // Before deadline: transition to PENDING_BUYER
    await db
      .update(combinedShippingQuote)
      .set({
        quotedShippingCents,
        sellerQuotedAt: now,
        status: 'PENDING_BUYER',
        updatedAt: now,
      })
      .where(eq(combinedShippingQuote.id, quoteId));
  } else {
    // PENALTY_APPLIED: seller quotes after deadline
    // Resolve final price (buyer pays the lower of quote or penalty price)
    const resolution = resolveQuoteFinalPrice({
      maxShippingCents: quote.maxShippingCents,
      quotedShippingCents,
      penaltyDiscountPercent: quote.penaltyDiscountPercent ?? 25,
    });

    await db
      .update(combinedShippingQuote)
      .set({
        quotedShippingCents,
        sellerQuotedAt: now,
        finalShippingCents: resolution.finalShippingCents,
        savingsCents: resolution.savingsCents,
        updatedAt: now,
      })
      .where(eq(combinedShippingQuote.id, quoteId));

    // Update order totals with the resolved final shipping
    const [ord] = await db
      .select({
        itemSubtotalCents: order.itemSubtotalCents,
        taxCents: order.taxCents,
        discountCents: order.discountCents,
      })
      .from(order)
      .where(eq(order.id, quote.orderId))
      .limit(1);

    if (ord) {
      const totalCents =
        ord.itemSubtotalCents +
        resolution.finalShippingCents +
        ord.taxCents -
        ord.discountCents;
      await db
        .update(order)
        .set({ shippingCents: resolution.finalShippingCents, totalCents, updatedAt: now })
        .where(eq(order.id, quote.orderId));
    }
  }

  // Notify buyer (V2: use 'Seller' display name, V3: use real orderNumber)
  const savingsCents = quote.maxShippingCents - quotedShippingCents;
  void notify(quote.buyerId, 'shipping_quote.received', {
    sellerName: 'Seller',
    quotedAmountFormatted: formatPrice(quotedShippingCents),
    savingsFormatted: formatPrice(Math.max(0, savingsCents)),
    orderNumber,
  });

  revalidatePath('/my/selling/orders/[id]', 'page');
  revalidatePath('/my/buying/orders/[id]', 'page');

  return { success: true };
}

/**
 * Respond to a combined shipping quote (buyer action).
 * Buyer can accept (updates order totals) or dispute (flags for support).
 */
export async function respondToShippingQuote(input: unknown): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', sub('CombinedShippingQuote', { buyerId: session.userId }))) {
    return { success: false, error: 'You do not have permission to respond to shipping quotes' };
  }

  const parsed = respondToShippingQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { quoteId, action } = parsed.data;

  const [quote] = await db
    .select()
    .from(combinedShippingQuote)
    .where(eq(combinedShippingQuote.id, quoteId))
    .limit(1);

  // S2: Return same message for not-found and ownership mismatch (never expose ownership)
  if (!quote || quote.buyerId !== session.userId) {
    return { success: false, error: 'Quote not found' };
  }

  if (quote.status !== 'PENDING_BUYER') {
    return { success: false, error: 'This quote is not awaiting a buyer response' };
  }

  const now = new Date();

  if (action === 'ACCEPT') {
    const finalShippingCents = quote.quotedShippingCents ?? quote.maxShippingCents;
    const savingsCents = quote.maxShippingCents - finalShippingCents;

    await db
      .update(combinedShippingQuote)
      .set({
        status: 'ACCEPTED',
        finalShippingCents,
        savingsCents,
        buyerRespondedAt: now,
        updatedAt: now,
      })
      .where(eq(combinedShippingQuote.id, quoteId));

    // Update order totals (V3: also select orderNumber for notification)
    const [ord] = await db
      .select({
        orderNumber: order.orderNumber,
        itemSubtotalCents: order.itemSubtotalCents,
        taxCents: order.taxCents,
        discountCents: order.discountCents,
      })
      .from(order)
      .where(eq(order.id, quote.orderId))
      .limit(1);

    if (ord) {
      const totalCents =
        ord.itemSubtotalCents + finalShippingCents + ord.taxCents - ord.discountCents;
      await db
        .update(order)
        .set({ shippingCents: finalShippingCents, totalCents, updatedAt: now })
        .where(eq(order.id, quote.orderId));

      // V2: use 'Buyer' display name, V3: use real orderNumber
      void notify(quote.sellerId, 'shipping_quote.accepted', {
        buyerName: 'Buyer',
        orderNumber: ord.orderNumber,
      });
    } else {
      void notify(quote.sellerId, 'shipping_quote.accepted', {
        buyerName: 'Buyer',
        orderNumber: quote.orderId,
      });
    }
  } else {
    // DISPUTE
    await db
      .update(combinedShippingQuote)
      .set({
        status: 'DISPUTED',
        buyerRespondedAt: now,
        updatedAt: now,
      })
      .where(eq(combinedShippingQuote.id, quoteId));

    // V3: fetch orderNumber for notification
    const [orderRow] = await db
      .select({ orderNumber: order.orderNumber })
      .from(order)
      .where(eq(order.id, quote.orderId))
      .limit(1);

    // V2: use 'Buyer' display name, V3: use real orderNumber
    void notify(quote.sellerId, 'shipping_quote.disputed', {
      buyerName: 'Buyer',
      orderNumber: orderRow?.orderNumber ?? quote.orderId,
    });
  }

  revalidatePath('/my/selling/orders/[id]', 'page');
  revalidatePath('/my/buying/orders/[id]', 'page');

  return { success: true };
}
