import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  platformSetting: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

vi.mock('@twicely/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe('calculatePlatformFee', () => {
  it('calculates eBay fee at 1290 bps (12.9%) on $100 sale', async () => {
    const { calculatePlatformFee } = await import('../platform-fees');
    // $100.00 → $12.90
    expect(calculatePlatformFee(10000, 1290)).toBe(1290);
  });

  it('calculates Poshmark fee at 2000 bps (20%) on $50 sale', async () => {
    const { calculatePlatformFee } = await import('../platform-fees');
    // $50.00 → $10.00
    expect(calculatePlatformFee(5000, 2000)).toBe(1000);
  });

  it('calculates $15.50 sale at 20% = $3.10 = 310 cents', async () => {
    const { calculatePlatformFee } = await import('../platform-fees');
    expect(calculatePlatformFee(1550, 2000)).toBe(310);
  });

  it('returns integer result for any input combination', async () => {
    const { calculatePlatformFee } = await import('../platform-fees');
    const result = calculatePlatformFee(9999, 1290);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('getPlatformFeeRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 1290 bps for EBAY from platform_settings', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { select: Mock };
    dbAny.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ value: 1290 }]),
        }),
      }),
    }));

    const { getPlatformFeeRate } = await import('../platform-fees');
    const rate = await getPlatformFeeRate('EBAY');
    expect(rate).toBe(1290);
  });

  it('returns 2000 bps for POSHMARK from platform_settings', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { select: Mock };
    dbAny.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ value: 2000 }]),
        }),
      }),
    }));

    const { getPlatformFeeRate } = await import('../platform-fees');
    const rate = await getPlatformFeeRate('POSHMARK');
    expect(rate).toBe(2000);
  });

  it('returns default rate when setting not found in DB', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { select: Mock };
    dbAny.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }));

    const { getPlatformFeeRate } = await import('../platform-fees');
    const rate = await getPlatformFeeRate('MERCARI');
    expect(rate).toBe(1000);
  });

  it('returns default rate when DB throws', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { select: Mock };
    dbAny.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('DB connection failed')),
        }),
      }),
    }));

    const { getPlatformFeeRate } = await import('../platform-fees');
    const rate = await getPlatformFeeRate('EBAY');
    expect(rate).toBe(1290);
  });

  it('returns default rate for DEPOP when not in settings', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { select: Mock };
    dbAny.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }));

    const { getPlatformFeeRate } = await import('../platform-fees');
    const rate = await getPlatformFeeRate('DEPOP');
    expect(rate).toBe(1000);
  });
});
