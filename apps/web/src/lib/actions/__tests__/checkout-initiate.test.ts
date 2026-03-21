import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
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
  promotion: { id: 'id', usageCount: 'usage_count', isActive: 'is_active', discountPercent: 'discount_percent', discountAmountCents: 'discount_amount_cents', minimumOrderCents: 'minimum_order_cents', maxUsesTotal: 'max_uses_total', maxUsesPerBuyer: 'max_uses_per_buyer', startsAt: 'starts_at', endsAt: 'ends_at', couponCode: 'coupon_code' },
}));
vi.mock('@twicely/commerce/offer-transitions', () => ({
  declineAllPendingOffersForListing: vi.fn().mockResolvedValue({ declined: 0 }),
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  inArray: vi.fn((col, vals) => ({ type: 'inArray', col, vals })),
  sql: vi.fn(),
}));
vi.mock('@twicely/commerce/create-order', () => ({ createOrdersFromCart: vi.fn() }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(100),
}));
vi.mock('@twicely/stripe/server', () => ({
  createConnectPaymentIntent: vi.fn(),
  stripe: { paymentIntents: { retrieve: vi.fn() } },
}));
vi.mock('@twicely/db/cache/valkey', () => ({
  getValkeyClient: vi.fn().mockReturnValue({ incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) }),
}));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { initiateCheckout } from '../checkout';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { createOrdersFromCart } from '@twicely/commerce/create-order';
import { createConnectPaymentIntent } from '@twicely/stripe/server';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);
const mockCreateOrdersFromCart = vi.mocked(createOrdersFromCart);
const mockCreateConnectPaymentIntent = vi.mocked(createConnectPaymentIntent);

const validShippingAddress = {
  name: 'Test User',
  address1: '123 Main St',
  address2: null,
  city: 'New York',
  state: 'NY',
  zip: '10001',
  country: 'US',
  phone: null,
};

describe('initiateCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error if not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } as never });
    const result = await initiateCheckout({ cartId: 'cart1', shippingAddress: validShippingAddress });
    expect(result).toEqual({ success: false, error: 'Please sign in to checkout' });
  });

  it('returns error if user cannot create orders', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(false) } as never,
    });
    const result = await initiateCheckout({ cartId: 'cart1', shippingAddress: validShippingAddress });
    expect(result).toEqual({ success: false, error: 'Your account cannot place orders' });
  });

  it('returns error if order creation fails', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockCreateOrdersFromCart.mockResolvedValue([{ success: false, error: 'Item unavailable' }]);
    const result = await initiateCheckout({ cartId: 'cart1', shippingAddress: validShippingAddress });
    expect(result).toEqual({ success: false, error: 'Item unavailable' });
  });

  it('returns error if total is below minimum ($1)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockCreateOrdersFromCart.mockResolvedValue([{ success: true, orderId: 'order1', totalCents: 50 }]);

    const selectMock = vi.fn();
    mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: selectMock }) } as never);
    selectMock.mockResolvedValueOnce([{ id: 'order1', sellerId: 'seller1', totalCents: 50 }]);
    selectMock.mockResolvedValueOnce([{ userId: 'seller1', stripeAccountId: 'acct_seller1', payoutsEnabled: true }]);
    selectMock.mockResolvedValueOnce([{ tfAmountCents: 5 }]);

    const result = await initiateCheckout({ cartId: 'cart1', shippingAddress: validShippingAddress });
    expect(result).toEqual({ success: false, error: 'Order total must be at least $1.00' });
  });

  it('creates orders and payment intents with destination charges for single seller', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockCreateOrdersFromCart.mockResolvedValue([{ success: true, orderId: 'order1', totalCents: 5000 }]);

    const selectMock = vi.fn();
    mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: selectMock }) } as never);
    selectMock.mockResolvedValueOnce([{ id: 'order1', sellerId: 'seller1', totalCents: 5000 }]);
    selectMock.mockResolvedValueOnce([{ userId: 'seller1', stripeAccountId: 'acct_seller1', payoutsEnabled: true }]);
    selectMock.mockResolvedValueOnce([{ tfAmountCents: 500 }]);

    mockCreateConnectPaymentIntent.mockResolvedValue({ clientSecret: 'secret_123', paymentIntentId: 'pi_123' });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);

    const result = await initiateCheckout({ cartId: 'cart1', shippingAddress: validShippingAddress });

    expect(result.success).toBe(true);
    expect(result.clientSecret).toBe('secret_123');
    expect(result.orderIds).toEqual(['order1']);
    expect(mockCreateConnectPaymentIntent).toHaveBeenCalledWith({
      amountCents: 5000,
      applicationFeeCents: 500,
      destinationAccountId: 'acct_seller1',
      metadata: { orderId: 'order1', buyerId: 'user1', sellerId: 'seller1' },
    });
  });

  it('applies coupon discount and adjusts TF for matching seller', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockCreateOrdersFromCart.mockResolvedValue([{ success: true, orderId: 'order1', totalCents: 10000 }]);

    const whereMock = vi.fn();
    const limitMock = vi.fn();
    mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereMock }) } as never);
    // Call 1: orders query
    whereMock.mockResolvedValueOnce([{ id: 'order1', sellerId: 'seller1', totalCents: 10000 }]);
    // Call 2: seller profiles
    whereMock.mockResolvedValueOnce([{ userId: 'seller1', stripeAccountId: 'acct_s1', payoutsEnabled: true }]);
    // Call 3: TF items (runs before coupon validation)
    whereMock.mockResolvedValueOnce([{ tfAmountCents: 1000 }]);
    // Call 4: promotion lookup (has .limit())
    whereMock.mockReturnValueOnce({ limit: limitMock });
    limitMock.mockResolvedValueOnce([{
      id: 'clpromo00000001test0001', isActive: true, discountAmountCents: 2000,
      discountPercent: null, minimumOrderCents: null, maxUsesTotal: null,
      maxUsesPerBuyer: 1, usageCount: 0, startsAt: new Date('2020-01-01'),
      endsAt: null, couponCode: 'SAVE20',
    }]);

    mockCreateConnectPaymentIntent.mockResolvedValue({
      clientSecret: 'sec_coupon',
      paymentIntentId: 'pi_coupon',
    });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);

    const result = await initiateCheckout({
      cartId: 'cart1',
      shippingAddress: validShippingAddress,
      coupon: {
        promotionId: 'clpromo00000001test0001',
        couponCode: 'SAVE20',
        discountCents: 2000,
        freeShipping: false,
        appliedToSellerId: 'seller1',
      },
    });

    expect(result.success).toBe(true);
    expect(result.totalCents).toBe(8000);
    expect(mockCreateConnectPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 8000,
        applicationFeeCents: 800,
        metadata: expect.objectContaining({ promotionId: 'clpromo00000001test0001', discountCents: '2000' }),
      })
    );
  });

  it('ignores coupon when appliedToSellerId does not match order seller', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockCreateOrdersFromCart.mockResolvedValue([{ success: true, orderId: 'order1', totalCents: 5000 }]);

    const whereMock = vi.fn();
    const limitMock = vi.fn();
    mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereMock }) } as never);
    whereMock.mockResolvedValueOnce([{ id: 'order1', sellerId: 'seller1', totalCents: 5000 }]);
    whereMock.mockResolvedValueOnce([{ userId: 'seller1', stripeAccountId: 'acct_s1', payoutsEnabled: true }]);
    // TF items (runs before coupon validation)
    whereMock.mockResolvedValueOnce([{ tfAmountCents: 500 }]);
    // Promotion lookup (has .limit()) — valid promo but for different seller
    whereMock.mockReturnValueOnce({ limit: limitMock });
    limitMock.mockResolvedValueOnce([{
      id: 'clpromox0000001test0002', isActive: true, discountAmountCents: 1000,
      discountPercent: null, minimumOrderCents: null, maxUsesTotal: null,
      maxUsesPerBuyer: 1, usageCount: 0, startsAt: new Date('2020-01-01'),
      endsAt: null, couponCode: 'NOPE',
    }]);

    mockCreateConnectPaymentIntent.mockResolvedValue({
      clientSecret: 'sec_no',
      paymentIntentId: 'pi_no',
    });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);

    const result = await initiateCheckout({
      cartId: 'cart1',
      shippingAddress: validShippingAddress,
      coupon: {
        promotionId: 'clpromox0000001test0002',
        couponCode: 'NOPE',
        discountCents: 1000,
        freeShipping: false,
        appliedToSellerId: 'clsellerother001test03',
      },
    });

    expect(result.success).toBe(true);
    expect(result.totalCents).toBe(5000);
    expect(mockCreateConnectPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 5000, applicationFeeCents: 500 })
    );
  });

  it('returns error if seller not onboarded', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockCreateOrdersFromCart.mockResolvedValue([{ success: true, orderId: 'order1', totalCents: 5000 }]);

    const selectMock = vi.fn();
    mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: selectMock }) } as never);
    selectMock.mockResolvedValueOnce([{ id: 'order1', sellerId: 'seller1', totalCents: 5000 }]);
    selectMock.mockResolvedValueOnce([{ userId: 'seller1', stripeAccountId: null, payoutsEnabled: false }]);

    const result = await initiateCheckout({ cartId: 'cart1', shippingAddress: validShippingAddress });
    expect(result).toEqual({
      success: false,
      error: 'One or more sellers have not completed payment setup',
    });
  });
});
