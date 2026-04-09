import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  financeSubscription: {
    id: 'id',
    sellerProfileId: 'seller_profile_id',
    tier: 'tier',
    status: 'status',
    stripeSubscriptionId: 'stripe_subscription_id',
    storeTierTrialUsed: 'store_tier_trial_used',
    storeTierTrialStartedAt: 'store_tier_trial_started_at',
    storeTierTrialEndsAt: 'store_tier_trial_ends_at',
    cancelAtPeriodEnd: 'cancel_at_period_end',
    updatedAt: 'updated_at',
  },
  sellerProfile: {
    id: 'id',
    financeTier: 'finance_tier',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) =>
    Promise.resolve(fallback),
  ),
}));

vi.mock('@twicely/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

import { db } from '@twicely/db';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { activateFinanceProTrialIfEligible } from '../finance-trial';

// ─── Chain helpers ────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue([]) };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('activateFinanceProTrialIfEligible', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Restore default implementation after reset
    vi.mocked(getPlatformSetting).mockImplementation((_key: string, fallback: unknown) =>
      Promise.resolve(fallback),
    );
  });

  it('activates trial for a seller with no existing financeSubscription', async () => {
    // No existing row → insert → re-read returns fresh row (no trial used)
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([]) as never)           // initial read: no row
      .mockReturnValueOnce(makeSelectChain([{                       // re-read after insert
        id: 'fs-1',
        storeTierTrialUsed: false,
        stripeSubscriptionId: null,
      }]) as never);

    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);

    const updateChain = makeUpdateChain();
    const tx = { update: vi.fn().mockReturnValue(updateChain) };
    vi.mocked(db.transaction).mockImplementation(async (cb) => { await cb(tx as never); });

    const result = await activateFinanceProTrialIfEligible('sp-1');

    expect(result).toEqual({ activated: true, reason: 'TRIAL_ACTIVATED' });
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('returns TRIAL_ALREADY_USED when storeTierTrialUsed is true and not repeatable', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([{
      id: 'fs-2',
      storeTierTrialUsed: true,
      stripeSubscriptionId: null,
    }]) as never);

    // Override default: storeTierTrialRepeatable = false (not repeatable)
    vi.mocked(getPlatformSetting).mockResolvedValue(false);

    const result = await activateFinanceProTrialIfEligible('sp-2');

    expect(result).toEqual({ activated: false, reason: 'TRIAL_ALREADY_USED' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('activates trial again when storeTierTrialUsed is true but repeatable is true', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([{
      id: 'fs-3',
      storeTierTrialUsed: true,
      stripeSubscriptionId: null,
    }]) as never);

    // First call (storeTierTrialRepeatable) → true, second call (storeTierTrialMonths) → 6
    vi.mocked(getPlatformSetting)
      .mockResolvedValueOnce(true)   // finance.storeTierTrialRepeatable
      .mockResolvedValueOnce(6);     // finance.storeTierTrialMonths

    const updateChain = makeUpdateChain();
    const tx = { update: vi.fn().mockReturnValue(updateChain) };
    vi.mocked(db.transaction).mockImplementation(async (cb) => { await cb(tx as never); });

    const result = await activateFinanceProTrialIfEligible('sp-3');

    expect(result).toEqual({ activated: true, reason: 'TRIAL_ACTIVATED' });
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it('does NOT change tier when stripeSubscriptionId is set (bundle case)', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([{
      id: 'fs-4',
      storeTierTrialUsed: false,
      stripeSubscriptionId: 'sub_bundle_123',
    }]) as never);

    let capturedTierUpdate: Record<string, unknown> | null = null;
    const updateChain = {
      set: vi.fn().mockImplementation((args: Record<string, unknown>) => {
        capturedTierUpdate = args;
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    };
    const tx = {
      update: vi.fn().mockReturnValue(updateChain),
    };
    vi.mocked(db.transaction).mockImplementation(async (cb) => { await cb(tx as never); });

    const result = await activateFinanceProTrialIfEligible('sp-4');

    expect(result).toEqual({ activated: true, reason: 'TRIAL_ACTIVATED' });
    // Tier should NOT be set in the update — bundle case
    expect(capturedTierUpdate).not.toHaveProperty('tier');
    // sellerProfile update should NOT be called (only financeSubscription)
    expect(tx.update).toHaveBeenCalledTimes(1);
  });

  it('updates sellerProfile.financeTier = PRO when no stripeSubscriptionId (non-bundle)', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([{
      id: 'fs-5',
      storeTierTrialUsed: false,
      stripeSubscriptionId: null,
    }]) as never);

    const updateChain = makeUpdateChain();
    const tx = { update: vi.fn().mockReturnValue(updateChain) };
    vi.mocked(db.transaction).mockImplementation(async (cb) => { await cb(tx as never); });

    const result = await activateFinanceProTrialIfEligible('sp-5');

    expect(result).toEqual({ activated: true, reason: 'TRIAL_ACTIVATED' });
    // Both financeSubscription and sellerProfile updated
    expect(tx.update).toHaveBeenCalledTimes(2);
  });

  it('uses finance.storeTierTrialMonths platform setting for trial duration', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([{
      id: 'fs-6',
      storeTierTrialUsed: false,
      stripeSubscriptionId: null,
    }]) as never);

    // Return 3-month trial instead of default 6
    vi.mocked(getPlatformSetting).mockResolvedValue(3);

    const updateChain = makeUpdateChain();
    const tx = { update: vi.fn().mockReturnValue(updateChain) };
    vi.mocked(db.transaction).mockImplementation(async (cb) => { await cb(tx as never); });

    const result = await activateFinanceProTrialIfEligible('sp-6');

    expect(result).toEqual({ activated: true, reason: 'TRIAL_ACTIVATED' });
    expect(getPlatformSetting).toHaveBeenCalledWith('finance.storeTierTrialMonths', 6);
  });
});
