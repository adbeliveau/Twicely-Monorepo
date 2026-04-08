import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: vi.fn().mockReturnValue({ set: vi.fn().mockResolvedValue('OK'), get: vi.fn().mockResolvedValue(null) }),
}));
import {
  createMockSubscription,
  createMockSubscriptionEvent,
} from '@/lib/__tests__/helpers/stripe-mocks';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/mutations/subscriptions', () => ({
  upsertStoreSubscription: vi.fn(),
  upsertListerSubscription: vi.fn(),
  upsertAutomationSubscription: vi.fn(),
  upsertFinanceSubscription: vi.fn(),
  upsertBundleSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
}));

vi.mock('@/lib/queries/subscription-lookups', () => ({
  findSellerByStripeCustomerId: vi.fn(),
  findSubscriptionByStripeId: vi.fn(),
}));

vi.mock('@twicely/subscriptions/price-map', () => ({
  resolveStripePriceId: vi.fn(),
}));

vi.mock('@/lib/mutations/apply-pending-downgrade', () => ({
  applyPendingDowngradeIfNeeded: vi.fn(),
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('D3-S5: Bundle Webhook Integration', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('handleSubscriptionUpsert — bundle routing', () => {
    it('routes bundle subscription to upsertBundleSubscription', async () => {
      const { handleSubscriptionUpsert } = await import('../subscription-webhooks');
      const { upsertBundleSubscription } = await import('@/lib/mutations/subscriptions');
      const { resolveStripePriceId } = await import('@twicely/subscriptions/price-map');

      vi.mocked(resolveStripePriceId).mockReturnValue({
        product: 'bundle', tier: 'PRO', interval: 'monthly',
      });

      const mockSub = createMockSubscription({ product: 'bundle', tier: 'PRO' });
      await handleSubscriptionUpsert(mockSub);

      expect(upsertBundleSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ tier: 'PRO', stripeSubscriptionId: 'sub_test123' })
      );
    });

    it('passes correct params from Stripe subscription to bundle upsert', async () => {
      const { handleSubscriptionUpsert } = await import('../subscription-webhooks');
      const { upsertBundleSubscription } = await import('@/lib/mutations/subscriptions');
      const { resolveStripePriceId } = await import('@twicely/subscriptions/price-map');

      vi.mocked(resolveStripePriceId).mockReturnValue({
        product: 'bundle', tier: 'POWER', interval: 'annual',
      });

      const mockSub = createMockSubscription({
        product: 'bundle', tier: 'POWER', sellerProfileId: 'sp_456',
      });
      await handleSubscriptionUpsert(mockSub);

      expect(upsertBundleSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerProfileId: 'sp_456',
          tier: 'POWER',
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
        })
      );
    });

    it('resolves bundle from price ID when metadata is missing', async () => {
      const { handleSubscriptionUpsert } = await import('../subscription-webhooks');
      const { upsertBundleSubscription } = await import('@/lib/mutations/subscriptions');
      const { resolveStripePriceId } = await import('@twicely/subscriptions/price-map');
      const { findSellerByStripeCustomerId } = await import('@/lib/queries/subscription-lookups');

      vi.mocked(resolveStripePriceId).mockReturnValue({
        product: 'bundle', tier: 'STARTER', interval: 'monthly',
      });

      vi.mocked(findSellerByStripeCustomerId).mockResolvedValue({
        sellerProfileId: 'sp_789', userId: 'user_789',
        storeTier: 'NONE', listerTier: 'FREE', hasAutomation: false, financeTier: 'FREE',
      });

      const mockSub = createMockSubscription({});
      mockSub.metadata = {};

      await handleSubscriptionUpsert(mockSub);

      expect(upsertBundleSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ tier: 'STARTER' })
      );
    });
  });

  describe('handleSubscriptionDeleted — bundle cancel', () => {
    it('cancels bundle subscription when deleted event received', async () => {
      const { handleSubscriptionDeleted } = await import('../subscription-webhooks');
      const { cancelSubscription } = await import('@/lib/mutations/subscriptions');
      const { findSubscriptionByStripeId } = await import('@/lib/queries/subscription-lookups');

      vi.mocked(findSubscriptionByStripeId).mockResolvedValue({
        product: 'bundle', subscriptionId: 'bsub_internal_1', sellerProfileId: 'sp_123',
      });

      const mockSub = createMockSubscription({ subscriptionId: 'sub_bundle_del' });
      await handleSubscriptionDeleted(mockSub);

      expect(cancelSubscription).toHaveBeenCalledWith({
        product: 'bundle', sellerProfileId: 'sp_123', stripeSubscriptionId: 'sub_bundle_del',
      });
    });
  });

  describe('handleSubscriptionWebhook — bundle dispatch', () => {
    it('dispatches customer.subscription.created for bundle', async () => {
      const { handleSubscriptionWebhook } = await import('../subscription-webhooks');
      const { upsertBundleSubscription } = await import('@/lib/mutations/subscriptions');
      const { resolveStripePriceId } = await import('@twicely/subscriptions/price-map');

      vi.mocked(resolveStripePriceId).mockReturnValue({
        product: 'bundle', tier: 'STARTER', interval: 'annual',
      });

      const mockEvent = createMockSubscriptionEvent(
        'customer.subscription.created',
        createMockSubscription({ product: 'bundle', tier: 'STARTER' })
      );
      await handleSubscriptionWebhook(mockEvent);

      expect(upsertBundleSubscription).toHaveBeenCalled();
    });

    it('dispatches customer.subscription.updated for bundle and checks pending', async () => {
      const { handleSubscriptionWebhook } = await import('../subscription-webhooks');
      const { upsertBundleSubscription } = await import('@/lib/mutations/subscriptions');
      const { applyPendingDowngradeIfNeeded } = await import('@/lib/mutations/apply-pending-downgrade');
      const { resolveStripePriceId } = await import('@twicely/subscriptions/price-map');

      vi.mocked(resolveStripePriceId).mockReturnValue({
        product: 'bundle', tier: 'PRO', interval: 'monthly',
      });

      const mockEvent = createMockSubscriptionEvent(
        'customer.subscription.updated',
        createMockSubscription({ product: 'bundle', tier: 'PRO' })
      );
      await handleSubscriptionWebhook(mockEvent);

      expect(upsertBundleSubscription).toHaveBeenCalled();
      expect(applyPendingDowngradeIfNeeded).toHaveBeenCalled();
    });

    it('dispatches customer.subscription.deleted for bundle', async () => {
      const { handleSubscriptionWebhook } = await import('../subscription-webhooks');
      const { cancelSubscription } = await import('@/lib/mutations/subscriptions');
      const { findSubscriptionByStripeId } = await import('@/lib/queries/subscription-lookups');

      vi.mocked(findSubscriptionByStripeId).mockResolvedValue({
        product: 'bundle', subscriptionId: 'bsub_1', sellerProfileId: 'sp_123',
      });

      const mockEvent = createMockSubscriptionEvent(
        'customer.subscription.deleted',
        createMockSubscription({ product: 'bundle' })
      );
      await handleSubscriptionWebhook(mockEvent);

      expect(cancelSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ product: 'bundle' })
      );
    });

    it('routes bundle upgrade to upsert with new tier', async () => {
      const { handleSubscriptionUpsert } = await import('../subscription-webhooks');
      const { upsertBundleSubscription } = await import('@/lib/mutations/subscriptions');
      const { resolveStripePriceId } = await import('@twicely/subscriptions/price-map');

      vi.mocked(resolveStripePriceId).mockReturnValue({
        product: 'bundle', tier: 'POWER', interval: 'annual',
      });

      const mockSub = createMockSubscription({ product: 'bundle', tier: 'POWER' });
      await handleSubscriptionUpsert(mockSub);

      expect(upsertBundleSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ tier: 'POWER' })
      );
    });
  });
});
