import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: vi.fn().mockReturnValue({ set: vi.fn().mockResolvedValue('OK'), get: vi.fn().mockResolvedValue(null) }),
}));

import { mapStripeStatus } from '../subscription-webhooks';
import {
  createMockSubscription,
  createMockSubscriptionEvent,
} from '@/lib/__tests__/helpers/stripe-mocks';

// Mock the mutation functions
vi.mock('@/lib/mutations/subscriptions', () => ({
  upsertStoreSubscription: vi.fn(),
  upsertListerSubscription: vi.fn(),
  upsertAutomationSubscription: vi.fn(),
  upsertFinanceSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
}));

// Mock the lookup functions
vi.mock('@/lib/queries/subscription-lookups', () => ({
  findSellerByStripeCustomerId: vi.fn(),
  findSubscriptionByStripeId: vi.fn(),
}));

// Mock price map
vi.mock('@twicely/subscriptions/price-map', () => ({
  resolveStripePriceId: vi.fn(),
}));

// Mock pending downgrade handler (D3-S4)
vi.mock('@/lib/mutations/apply-pending-downgrade', () => ({
  applyPendingDowngradeIfNeeded: vi.fn(),
}));

// Mock notifications service
vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

describe('D3-S2: Subscription Webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mapStripeStatus', () => {
    it('maps "active" to "ACTIVE"', () => {
      expect(mapStripeStatus('active')).toBe('ACTIVE');
    });

    it('maps "past_due" to "PAST_DUE"', () => {
      expect(mapStripeStatus('past_due')).toBe('PAST_DUE');
    });

    it('maps "trialing" to "TRIALING"', () => {
      expect(mapStripeStatus('trialing')).toBe('TRIALING');
    });

    it('maps "canceled" to "CANCELED"', () => {
      expect(mapStripeStatus('canceled')).toBe('CANCELED');
    });

    it('maps "incomplete" to "PENDING"', () => {
      expect(mapStripeStatus('incomplete')).toBe('PENDING');
    });

    it('maps "incomplete_expired" to "CANCELED"', () => {
      expect(mapStripeStatus('incomplete_expired')).toBe('CANCELED');
    });

    it('maps "unpaid" to "PAST_DUE"', () => {
      expect(mapStripeStatus('unpaid')).toBe('PAST_DUE');
    });

    it('maps "paused" to "PAUSED"', () => {
      expect(mapStripeStatus('paused')).toBe('PAUSED');
    });

    it('maps unknown status to "PENDING"', () => {
      expect(mapStripeStatus('unknown_status')).toBe('PENDING');
    });
  });

  describe('handleSubscriptionUpsert routing', () => {
    it('routes store subscription to upsertStoreSubscription', async () => {
      const { handleSubscriptionUpsert } = await import('../subscription-webhooks');
      const { upsertStoreSubscription } = await import('@/lib/mutations/subscriptions');
      const { resolveStripePriceId } = await import('@/lib/subscriptions/price-map');

      vi.mocked(resolveStripePriceId).mockReturnValue({
        product: 'store',
        tier: 'PRO',
        interval: 'monthly',
      });

      const mockSubscription = createMockSubscription({
        product: 'store',
        tier: 'PRO',
      });

      await handleSubscriptionUpsert(mockSubscription);

      expect(upsertStoreSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'PRO',
          stripeSubscriptionId: 'sub_test123',
        })
      );
    });

    it('routes lister subscription to upsertListerSubscription', async () => {
      const { handleSubscriptionUpsert } = await import('../subscription-webhooks');
      const { upsertListerSubscription } = await import('@/lib/mutations/subscriptions');
      const { resolveStripePriceId } = await import('@/lib/subscriptions/price-map');

      vi.mocked(resolveStripePriceId).mockReturnValue({
        product: 'lister',
        tier: 'LITE',
        interval: 'annual',
      });

      const mockSubscription = createMockSubscription({
        product: 'lister',
        tier: 'LITE',
      });

      await handleSubscriptionUpsert(mockSubscription);

      expect(upsertListerSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'LITE',
        })
      );
    });

    it('routes automation subscription to upsertAutomationSubscription', async () => {
      const { handleSubscriptionUpsert } = await import('../subscription-webhooks');
      const { upsertAutomationSubscription } = await import('@/lib/mutations/subscriptions');
      const { resolveStripePriceId } = await import('@/lib/subscriptions/price-map');

      vi.mocked(resolveStripePriceId).mockReturnValue({
        product: 'automation',
        tier: 'DEFAULT',
        interval: 'monthly',
      });

      const mockSubscription = createMockSubscription({
        product: 'automation',
        tier: 'DEFAULT',
      });

      await handleSubscriptionUpsert(mockSubscription);

      expect(upsertAutomationSubscription).toHaveBeenCalled();
    });

    it('routes finance subscription to upsertFinanceSubscription', async () => {
      const { handleSubscriptionUpsert } = await import('../subscription-webhooks');
      const { upsertFinanceSubscription } = await import('@/lib/mutations/subscriptions');
      const { resolveStripePriceId } = await import('@/lib/subscriptions/price-map');

      vi.mocked(resolveStripePriceId).mockReturnValue({
        product: 'finance',
        tier: 'PRO',
        interval: 'monthly',
      });

      const mockSubscription = createMockSubscription({
        product: 'finance',
        tier: 'PRO',
      });

      await handleSubscriptionUpsert(mockSubscription);

      expect(upsertFinanceSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'PRO',
        })
      );
    });

    it('uses resolveStripePriceId when metadata is missing', async () => {
      const { handleSubscriptionUpsert } = await import('../subscription-webhooks');
      const { upsertAutomationSubscription } = await import('@/lib/mutations/subscriptions');
      const { resolveStripePriceId } = await import('@/lib/subscriptions/price-map');
      const { findSellerByStripeCustomerId } = await import('@/lib/queries/subscription-lookups');

      vi.mocked(resolveStripePriceId).mockReturnValue({
        product: 'automation',
        tier: 'DEFAULT',
        interval: 'monthly',
      });

      vi.mocked(findSellerByStripeCustomerId).mockResolvedValue({
        sellerProfileId: 'sp_123',
        userId: 'user_123',
        storeTier: 'NONE',
        listerTier: 'FREE',
        hasAutomation: false,
        financeTier: 'FREE',
      });

      // Create subscription without metadata
      const mockSubscription = createMockSubscription({});
      mockSubscription.metadata = {};

      await handleSubscriptionUpsert(mockSubscription);

      expect(upsertAutomationSubscription).toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('calls cancelSubscription when subscription is found', async () => {
      const { handleSubscriptionDeleted } = await import('../subscription-webhooks');
      const { cancelSubscription } = await import('@/lib/mutations/subscriptions');
      const { findSubscriptionByStripeId } = await import('@/lib/queries/subscription-lookups');

      vi.mocked(findSubscriptionByStripeId).mockResolvedValue({
        product: 'store',
        subscriptionId: 'sub_internal_123',
        sellerProfileId: 'sp_123',
      });

      const mockSubscription = createMockSubscription({});

      await handleSubscriptionDeleted(mockSubscription);

      expect(cancelSubscription).toHaveBeenCalledWith({
        product: 'store',
        sellerProfileId: 'sp_123',
        stripeSubscriptionId: 'sub_test123',
      });
    });

    it('does not throw when subscription is not found', async () => {
      const { handleSubscriptionDeleted } = await import('../subscription-webhooks');
      const { findSubscriptionByStripeId } = await import('@/lib/queries/subscription-lookups');

      vi.mocked(findSubscriptionByStripeId).mockResolvedValue(null);

      const mockSubscription = createMockSubscription({});

      // Should not throw
      await expect(handleSubscriptionDeleted(mockSubscription)).resolves.not.toThrow();
    });
  });

  describe('handleSubscriptionWebhook dispatch', () => {
    it('dispatches customer.subscription.created to handleSubscriptionUpsert', async () => {
      const { handleSubscriptionWebhook } = await import('../subscription-webhooks');
      const { resolveStripePriceId } = await import('@/lib/subscriptions/price-map');

      vi.mocked(resolveStripePriceId).mockReturnValue({
        product: 'store',
        tier: 'PRO',
        interval: 'monthly',
      });

      const mockEvent = createMockSubscriptionEvent(
        'customer.subscription.created',
        createMockSubscription({ product: 'store', tier: 'PRO' })
      );

      await handleSubscriptionWebhook(mockEvent);

      // Verify upsert was called (via mock)
      const { upsertStoreSubscription } = await import('@/lib/mutations/subscriptions');
      expect(upsertStoreSubscription).toHaveBeenCalled();
    });

    it('dispatches customer.subscription.deleted to handleSubscriptionDeleted', async () => {
      const { handleSubscriptionWebhook } = await import('../subscription-webhooks');
      const { findSubscriptionByStripeId } = await import('@/lib/queries/subscription-lookups');
      const { cancelSubscription } = await import('@/lib/mutations/subscriptions');

      vi.mocked(findSubscriptionByStripeId).mockResolvedValue({
        product: 'lister',
        subscriptionId: 'sub_internal_123',
        sellerProfileId: 'sp_123',
      });

      const mockEvent = createMockSubscriptionEvent(
        'customer.subscription.deleted',
        createMockSubscription({})
      );

      await handleSubscriptionWebhook(mockEvent);

      expect(cancelSubscription).toHaveBeenCalled();
    });

    it('handles customer.subscription.trial_will_end without error', async () => {
      const { handleSubscriptionWebhook } = await import('../subscription-webhooks');

      const mockEvent = createMockSubscriptionEvent(
        'customer.subscription.trial_will_end',
        createMockSubscription({})
      );

      // Should not throw
      await expect(handleSubscriptionWebhook(mockEvent)).resolves.not.toThrow();
    });
  });
});
