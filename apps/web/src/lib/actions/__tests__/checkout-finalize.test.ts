import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/casl', () => ({ authorize: vi.fn() }));
vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn(), transaction: vi.fn() },
}));
vi.mock('@twicely/db/schema', () => ({
  order: { id: 'id', status: 'status', buyerId: 'buyer_id', sellerId: 'seller_id', totalCents: 'total_cents', discountCents: 'discount_cents', paymentIntentId: 'payment_intent_id', sourceCartId: 'source_cart_id' },
  orderItem: { id: 'id', orderId: 'order_id', listingId: 'listing_id', tfAmountCents: 'tf_amount_cents' },
  listing: { id: 'id', availableQuantity: 'available_quantity', soldQuantity: 'sold_quantity', status: 'status' },
  ledgerEntry: { id: 'id' },
  orderPayment: { id: 'id' },
  cart: { id: 'id', status: 'status' },
  sellerProfile: { userId: 'user_id', stripeAccountId: 'stripe_account_id', payoutsEnabled: 'payouts_enabled' },
  listingOffer: { id: 'id', listingId: 'listing_id', status: 'status', stripeHoldId: 'stripe_hold_id' },
  promotionUsage: { id: 'id' },
  promotion: { id: 'id', usageCount: 'usage_count' },
  platformSetting: { key: 'key', value: 'value' },
}));
vi.mock('@twicely/commerce/offer-transitions', () => ({
  declineAllPendingOffersForListing: vi.fn().mockResolvedValue({ declined: 0 }),
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  ne: vi.fn((a, b) => ({ type: 'ne', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  inArray: vi.fn((col, vals) => ({ type: 'inArray', col, vals })),
  sql: vi.fn(),
}));
vi.mock('@twicely/commerce/create-order', () => ({ createOrdersFromCart: vi.fn() }));
vi.mock('@twicely/stripe/server', () => ({
  createConnectPaymentIntent: vi.fn(),
  stripe: { paymentIntents: { retrieve: vi.fn() } },
}));
vi.mock('@/lib/actions/browsing-history-helpers', () => ({
  updateEngagement: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@twicely/commerce/auth-offer', () => ({
  getAuthOfferConfig: vi.fn().mockResolvedValue({ buyerFeeCents: 500 }),
}));
vi.mock('@/lib/validations/checkout-finalize', () => ({
  finalizeOrderSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: { paymentIntentId: 'pi_123' } }) },
  finalizeOrdersSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: { paymentIntentIds: [] } }) },
}));
vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { finalizeOrder } from '../checkout-finalize';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { stripe } from '@twicely/stripe/server';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);
const mockTransaction = vi.mocked(db.transaction);
const mockPaymentIntentsRetrieve = vi.mocked(stripe.paymentIntents.retrieve);

describe('finalizeOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error if not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } as never });
    const result = await finalizeOrder('pi_123');
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error if order not found', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as never);
    const result = await finalizeOrder('pi_123');
    expect(result).toEqual({ success: false, error: 'Order not found' });
  });

  it('returns success if order already PAID (idempotency)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'order1', status: 'PAID', buyerId: 'user1', sellerId: 'seller1', totalCents: 5000, sourceCartId: null },
        ]),
      }),
    } as never);
    const result = await finalizeOrder('pi_123');
    expect(result).toEqual({ success: true });
    expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled();
  });

  it('returns error if user does not own the order', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'order1', status: 'CREATED', buyerId: 'user2', sellerId: 'seller1', totalCents: 5000, sourceCartId: null },
        ]),
      }),
    } as never);
    const result = await finalizeOrder('pi_123');
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error if payment not succeeded', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'order1', status: 'CREATED', buyerId: 'user1', sellerId: 'seller1', totalCents: 5000, sourceCartId: null },
        ]),
      }),
    } as never);
    mockPaymentIntentsRetrieve.mockResolvedValue({ status: 'processing' } as never);
    const result = await finalizeOrder('pi_123');
    expect(result).toEqual({ success: false, error: 'Payment not completed' });
  });

  it('processes payment with destination charge and creates ledger entries', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    // Call 1: order lookup — chain ends at .where()
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'order1', status: 'CREATED', buyerId: 'user1', sellerId: 'seller1', totalCents: 5000, sourceCartId: 'cart1' },
        ]),
      }),
    } as never);
    // Call 2: platformSetting processingRateBps — chain ends at .limit()
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ value: '290' }]),
        }),
      }),
    } as never);
    // Call 3: platformSetting processingFixedCents — chain ends at .limit()
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ value: '30' }]),
        }),
      }),
    } as never);
    mockPaymentIntentsRetrieve.mockResolvedValue({
      status: 'succeeded',
      application_fee_amount: 500,
    } as never);

    const txMock = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ availableQuantity: 0 }]),
          }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'item1', listingId: 'listing1', quantity: 1, unitPriceCents: 5000, tfAmountCents: 500 },
          ]),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };
    mockTransaction.mockImplementation(async (cb) => {
      await cb(txMock as never);
      return ['listing1'];
    });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);

    const result = await finalizeOrder('pi_123');
    expect(result).toEqual({ success: true });
    expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith('pi_123');
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('records promotionUsage and increments usageCount when coupon applied', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    // Call 1: order lookup — chain ends at .where()
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: 'order1',
            status: 'CREATED',
            buyerId: 'user1',
            sellerId: 'seller1',
            totalCents: 8000,
            discountCents: 2000,
            sourceCartId: 'cart1',
            authenticationOffered: false,
            authenticationDeclined: false,
          },
        ]),
      }),
    } as never);
    // Call 2: platformSetting processingRateBps — chain ends at .limit()
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ value: '290' }]),
        }),
      }),
    } as never);
    // Call 3: platformSetting processingFixedCents — chain ends at .limit()
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ value: '30' }]),
        }),
      }),
    } as never);
    mockPaymentIntentsRetrieve.mockResolvedValue({
      status: 'succeeded',
      application_fee_amount: 800,
      metadata: {
        promotionId: 'promo-1',
        discountCents: '2000',
        couponCode: 'SAVE20',
      },
    } as never);

    const insertMock = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    const txUpdateMock = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ availableQuantity: 0 }]),
        }),
      }),
    });
    const txSelectMock = vi.fn()
      // First call: order items
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'item1', listingId: 'listing1', quantity: 1, unitPriceCents: 8000, tfAmountCents: 800 },
          ]),
        }),
      })
      // Second call: SEC-017 promotion validation
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'promo-1', discountPercent: 20, discountAmountCents: null, isActive: true },
          ]),
        }),
      });
    const txMock = {
      update: txUpdateMock,
      select: txSelectMock,
      insert: insertMock,
    };
    mockTransaction.mockImplementation(async (cb) => {
      await cb(txMock as never);
      return ['listing1'];
    });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);

    const result = await finalizeOrder('pi_promo');

    expect(result).toEqual({ success: true });
    expect(insertMock).toHaveBeenCalledTimes(4);
    expect(txUpdateMock).toHaveBeenCalled();
  });
});
