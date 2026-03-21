import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock channel-registry to provide known rate limits
vi.mock('@twicely/crosslister/channel-registry', () => ({
  getChannelMetadata: vi.fn().mockImplementation((channel: string) => {
    const limits: Record<string, number> = {
      EBAY: 200,
      POSHMARK: 60,
      MERCARI: 150,
    };
    return {
      channel,
      rateLimit: { callsPerHourPerSeller: limits[channel] ?? 60, burstAllowance: 10 },
    };
  }),
}));

describe('rate-limiter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('checkRateLimit returns true when under limit', async () => {
    const { checkRateLimit } = await import('../rate-limiter');
    expect(checkRateLimit('POSHMARK', 'user-1')).toBe(true);
  });

  it('checkRateLimit returns false when limit exceeded', async () => {
    const { checkRateLimit, recordRequest } = await import('../rate-limiter');
    // POSHMARK limit is 60/hour
    for (let i = 0; i < 60; i++) {
      recordRequest('POSHMARK', 'user-rate-test');
    }
    expect(checkRateLimit('POSHMARK', 'user-rate-test')).toBe(false);
  });

  it('recordRequest increments the count', async () => {
    const { checkRateLimit, recordRequest } = await import('../rate-limiter');
    // Start fresh with a unique seller
    expect(checkRateLimit('MERCARI', 'user-incr')).toBe(true);
    recordRequest('MERCARI', 'user-incr');
    // Still under limit
    expect(checkRateLimit('MERCARI', 'user-incr')).toBe(true);
  });

  it('sliding window expires old entries after 1 hour', async () => {
    const { checkRateLimit, recordRequest } = await import('../rate-limiter');
    // Fill up limit
    for (let i = 0; i < 60; i++) {
      recordRequest('POSHMARK', 'user-expire');
    }
    expect(checkRateLimit('POSHMARK', 'user-expire')).toBe(false);

    // Advance time by 1 hour + 1ms
    vi.advanceTimersByTime(3_600_001);

    // Slots should be available again
    expect(checkRateLimit('POSHMARK', 'user-expire')).toBe(true);
  });

  it('getDelayMs returns 0 when under limit', async () => {
    const { getDelayMs } = await import('../rate-limiter');
    expect(getDelayMs('EBAY', 'user-delay-free')).toBe(0);
  });

  it('getDelayMs returns positive ms when limit exceeded', async () => {
    const { getDelayMs, recordRequest } = await import('../rate-limiter');
    // Fill up POSHMARK limit for a unique user
    for (let i = 0; i < 60; i++) {
      recordRequest('POSHMARK', 'user-delay-test');
    }
    const delay = getDelayMs('POSHMARK', 'user-delay-test');
    expect(delay).toBeGreaterThan(0);
  });

  it('different channel+seller combos have independent buckets', async () => {
    const { checkRateLimit, recordRequest } = await import('../rate-limiter');
    // Fill user-A on EBAY (limit 200) — need 200 calls
    for (let i = 0; i < 200; i++) {
      recordRequest('EBAY', 'user-a-indep');
    }
    // user-A on EBAY is now rate-limited
    expect(checkRateLimit('EBAY', 'user-a-indep')).toBe(false);

    // user-B on EBAY should be unaffected
    expect(checkRateLimit('EBAY', 'user-b-indep')).toBe(true);

    // user-A on POSHMARK should be unaffected
    expect(checkRateLimit('POSHMARK', 'user-a-indep')).toBe(true);
  });
});
