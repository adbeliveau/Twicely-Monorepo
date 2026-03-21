import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../server', () => ({
  stripe: {
    subscriptions: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
  },
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema/subscriptions', () => ({
  trialUsage: {
    id: 'id', userId: 'user_id', productType: 'product_type',
    trialStartedAt: 'trial_started_at', trialEndedAt: 'trial_ended_at',
    stripeSubscriptionId: 'stripe_subscription_id',
    convertedToSubscription: 'converted_to_subscription',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, defaultVal: unknown) => Promise.resolve(defaultVal)),
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import {
  TRIAL_PERIOD_DAYS,
  checkTrialEligibility,
  getTrialDaysRemaining,
} from '../trials';
import { db } from '@twicely/db';

describe('TRIAL_PERIOD_DAYS', () => {
  it('equals 14', () => {
    expect(TRIAL_PERIOD_DAYS).toBe(14);
  });
});

describe('checkTrialEligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns eligible for first-time user', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never);

    const result = await checkTrialEligibility('user1', 'STORE');

    expect(result.eligible).toBe(true);
  });

  it('returns ineligible for repeat trial', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ trialStartedAt: new Date() }]),
        }),
      }),
    } as never);

    const result = await checkTrialEligibility('user1', 'STORE');

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('already used');
  });
});

describe('getTrialDaysRemaining', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns correct days for active trial', () => {
    const trialEnd = new Date('2026-01-22T12:00:00Z'); // exactly 7 days

    const result = getTrialDaysRemaining(trialEnd);

    expect(result).toBe(7);
  });

  it('returns 0 for trial ending today', () => {
    const trialEnd = new Date('2026-01-16T00:00:00Z'); // 12 hours away

    const result = getTrialDaysRemaining(trialEnd);

    expect(result).toBe(0);
  });

  it('returns negative for past-expiry trial', () => {
    const trialEnd = new Date('2026-01-12T12:00:00Z'); // 3 days ago

    const result = getTrialDaysRemaining(trialEnd);

    expect(result).toBe(-3);
  });

  it('returns full 14 days for brand new trial', () => {
    const trialEnd = new Date('2026-01-29T12:00:00Z'); // exactly 14 days

    const result = getTrialDaysRemaining(trialEnd);

    expect(result).toBe(14);
  });
});
