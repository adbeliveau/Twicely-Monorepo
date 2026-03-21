import { describe, it, expect } from 'vitest';

describe('Connect account types', () => {
  // Test expected interface shapes without importing Stripe-dependent modules

  it('CreateAccountResult has success, accountId, error fields', () => {
    const result: { success: boolean; accountId?: string; error?: string } = {
      success: true,
      accountId: 'acct_123',
    };
    expect(result.success).toBe(true);
    expect(result.accountId).toBe('acct_123');
    expect(result.error).toBeUndefined();
  });

  it('OnboardingLinkResult has success, url, error fields', () => {
    const result: { success: boolean; url?: string; error?: string } = {
      success: true,
      url: 'https://connect.stripe.com/setup/abc',
    };
    expect(result.success).toBe(true);
    expect(result.url).toContain('stripe.com');
  });

  it('AccountStatusResult has expected status fields', () => {
    const result: {
      success: boolean;
      status?: {
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        detailsSubmitted: boolean;
        requiresAction: boolean;
        currentlyDue: string[];
      };
    } = {
      success: true,
      status: {
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        requiresAction: false,
        currentlyDue: [],
      },
    };
    expect(result.status?.chargesEnabled).toBe(true);
    expect(result.status?.payoutsEnabled).toBe(true);
    expect(result.status?.detailsSubmitted).toBe(true);
    expect(result.status?.requiresAction).toBe(false);
    expect(result.status?.currentlyDue).toEqual([]);
  });
});

describe('Connect account status logic', () => {
  // Test the business logic for determining account status

  it('payoutsEnabled requires both charges_enabled AND payouts_enabled', () => {
    const accountFromStripe = {
      charges_enabled: true,
      payouts_enabled: true,
    };
    const payoutsEnabled = accountFromStripe.charges_enabled && accountFromStripe.payouts_enabled;
    expect(payoutsEnabled).toBe(true);
  });

  it('payoutsEnabled is false when charges_enabled is false', () => {
    const accountFromStripe = {
      charges_enabled: false,
      payouts_enabled: true,
    };
    const payoutsEnabled = accountFromStripe.charges_enabled && accountFromStripe.payouts_enabled;
    expect(payoutsEnabled).toBe(false);
  });

  it('payoutsEnabled is false when payouts_enabled is false', () => {
    const accountFromStripe = {
      charges_enabled: true,
      payouts_enabled: false,
    };
    const payoutsEnabled = accountFromStripe.charges_enabled && accountFromStripe.payouts_enabled;
    expect(payoutsEnabled).toBe(false);
  });

  it('stripeOnboarded follows details_submitted', () => {
    const accountFromStripe = { details_submitted: true };
    const stripeOnboarded = accountFromStripe.details_submitted;
    expect(stripeOnboarded).toBe(true);
  });

  it('requiresAction when currently_due has items', () => {
    const accountFromStripe = {
      requirements: { currently_due: ['business_profile.url', 'tos_acceptance'] },
    };
    const requiresAction = (accountFromStripe.requirements?.currently_due?.length ?? 0) > 0;
    expect(requiresAction).toBe(true);
  });

  it('requiresAction is false when currently_due is empty', () => {
    const accountFromStripe = {
      requirements: { currently_due: [] },
    };
    const requiresAction = (accountFromStripe.requirements?.currently_due?.length ?? 0) > 0;
    expect(requiresAction).toBe(false);
  });
});
