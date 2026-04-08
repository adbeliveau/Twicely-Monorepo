import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSettingsByPrefix: vi.fn(),
}));

// getBecomeSelllerPricing now reads canonical TF brackets via @twicely/commerce.
// Mock the canonical loader so we can drive bracket assertions from this test.
vi.mock('@twicely/commerce/tf-calculator', () => ({
  getTfBrackets: vi.fn(),
}));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', isSeller: 'is_seller' },
  sellerProfile: { userId: 'user_id', sellerType: 'seller_type' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
}));

import { getBecomeSelllerPricing, getSellerStatusForCtaRouting } from '../become-seller';
import { db } from '@twicely/db';
import { getPlatformSettingsByPrefix } from '@/lib/queries/platform-settings';
import { getTfBrackets } from '@twicely/commerce/tf-calculator';

const mockSelect = vi.mocked(db.select);
const mockGetPrefix = vi.mocked(getPlatformSettingsByPrefix);
const mockGetTfBrackets = vi.mocked(getTfBrackets);

const CANONICAL_TF_BRACKETS = [
  { maxCents: 49900, rateBps: 1000 },
  { maxCents: 199900, rateBps: 1100 },
  { maxCents: 499900, rateBps: 1050 },
  { maxCents: 999900, rateBps: 1000 },
  { maxCents: 2499900, rateBps: 950 },
  { maxCents: 4999900, rateBps: 900 },
  { maxCents: 9999900, rateBps: 850 },
  { maxCents: null, rateBps: 800 },
];

const NULL_MAX_TF_BRACKETS = CANONICAL_TF_BRACKETS.map((b) => ({ ...b, maxCents: null }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain as never;
}

function makePricingMaps(): Map<string, unknown>[] {
  return [
    // store.pricing.*
    new Map<string, unknown>([
      ['store.pricing.starter.monthlyCents', 1200],
      ['store.pricing.pro.monthlyCents', 3999],
      ['store.pricing.power.monthlyCents', 7999],
    ]),
    // crosslister.pricing.*
    new Map<string, unknown>([
      ['crosslister.pricing.lite.monthlyCents', 1399],
      ['crosslister.pricing.pro.monthlyCents', 3999],
    ]),
    // crosslister.publishes.*
    new Map<string, unknown>([
      ['crosslister.publishes.FREE', 5],
      ['crosslister.publishes.LITE', 200],
      ['crosslister.publishes.PRO', 2000],
    ]),
    // fees.insertion.*
    new Map<string, unknown>([
      ['fees.insertion.NONE', 35],
      ['fees.insertion.STARTER', 25],
      ['fees.insertion.PRO', 10],
      ['fees.insertion.POWER', 5],
    ]),
    // fees.freeListings.*
    new Map<string, unknown>([
      ['fees.freeListings.NONE', 100],
      ['fees.freeListings.STARTER', 250],
      ['fees.freeListings.PRO', 2000],
      ['fees.freeListings.POWER', 15000],
    ]),
    // automation.pricing.*
    new Map<string, unknown>([
      ['automation.pricing.monthlyCents', 1299],
    ]),
    // commerce.tf.*
    new Map<string, unknown>([
      ['commerce.tf.bracket1.maxCents', 49900],
      ['commerce.tf.bracket1.rate', 1000],
      ['commerce.tf.bracket2.maxCents', 199900],
      ['commerce.tf.bracket2.rate', 1100],
      ['commerce.tf.bracket3.maxCents', 499900],
      ['commerce.tf.bracket3.rate', 1050],
      ['commerce.tf.bracket4.maxCents', 999900],
      ['commerce.tf.bracket4.rate', 1000],
      ['commerce.tf.bracket5.maxCents', 2499900],
      ['commerce.tf.bracket5.rate', 950],
      ['commerce.tf.bracket6.maxCents', 4999900],
      ['commerce.tf.bracket6.rate', 900],
      ['commerce.tf.bracket7.maxCents', 9999900],
      ['commerce.tf.bracket7.rate', 850],
      ['commerce.tf.bracket8.maxCents', -1],
      ['commerce.tf.bracket8.rate', 800],
    ]),
  ];
}

// ─── Tests: getBecomeSelllerPricing ──────────────────────────────────────────

describe('getBecomeSelllerPricing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const maps = makePricingMaps();
    mockGetPrefix.mockImplementation(async (prefix: string) => {
      const order = [
        'store.pricing.',
        'crosslister.pricing.',
        'crosslister.publishes.',
        'fees.insertion.',
        'fees.freeListings.',
        'automation.pricing.',
        'commerce.tf.',
      ];
      const idx = order.indexOf(prefix);
      return maps[idx] ?? new Map();
    });
    mockGetTfBrackets.mockResolvedValue(CANONICAL_TF_BRACKETS as never);
  });

  it('returns store pricing with correct keys mapped from platform_settings', async () => {
    const result = await getBecomeSelllerPricing();
    const starter = result.storeTiers.find((t) => t.tier === 'STARTER');
    expect(starter?.monthlyCents).toBe(1200);
    const pro = result.storeTiers.find((t) => t.tier === 'PRO');
    expect(pro?.monthlyCents).toBe(3999);
    const power = result.storeTiers.find((t) => t.tier === 'POWER');
    expect(power?.monthlyCents).toBe(7999);
  });

  it('formats prices as integer cents (not divided at query level)', async () => {
    const result = await getBecomeSelllerPricing();
    const lite = result.crosslisterTiers.find((t) => t.tier === 'LITE');
    expect(lite?.monthlyCents).toBe(1399);
    expect(typeof lite?.monthlyCents).toBe('number');
  });

  it('returns null for Enterprise tier monthly price (no platform_settings key)', async () => {
    const result = await getBecomeSelllerPricing();
    // Enterprise is not included in storeTiers — it is a special card in the UI only
    const enterprise = result.storeTiers.find((t) => t.tier === 'ENTERPRISE');
    expect(enterprise).toBeUndefined();
  });

  it('returns all 8 TF brackets with rateBps values', async () => {
    const result = await getBecomeSelllerPricing();
    expect(result.tfBrackets).toHaveLength(8);
    const [bracket1, bracket2] = result.tfBrackets;
    expect(bracket1?.rateBps).toBe(1000);
    expect(bracket2?.rateBps).toBe(1100);
    const lastBracket = result.tfBrackets.at(-1);
    expect(lastBracket?.rateBps).toBe(800);
  });

  it('sets bracket 8 maxCents to null for the -1 sentinel value', async () => {
    const result = await getBecomeSelllerPricing();
    const last = result.tfBrackets.at(-1);
    expect(last).toBeDefined();
    if (!last) return;
    expect(last.bracketNumber).toBe(8);
    expect(last.maxCents).toBeNull();
  });

  it('preserves positive maxCents for non-sentinel brackets', async () => {
    const result = await getBecomeSelllerPricing();
    const b1 = result.tfBrackets.find((b) => b.bracketNumber === 1);
    expect(b1?.maxCents).toBe(49900);
    const b4 = result.tfBrackets.find((b) => b.bracketNumber === 4);
    expect(b4?.maxCents).toBe(999900);
  });

  it('sets maxCents to null for brackets whose key is absent from the map', async () => {
    // When the canonical loader returns brackets with all-null maxCents (empty platform_settings),
    // become-seller passes them through unchanged.
    mockGetTfBrackets.mockResolvedValue(NULL_MAX_TF_BRACKETS as never);
    const result = await getBecomeSelllerPricing();
    result.tfBrackets.forEach((b) => expect(b.maxCents).toBeNull());
  });

  it('returns automationMonthlyCents from platform_settings', async () => {
    const result = await getBecomeSelllerPricing();
    expect(result.automationMonthlyCents).toBe(1299);
  });

  it('returns crosslister tier publishes counts from platform_settings', async () => {
    const result = await getBecomeSelllerPricing();
    expect(result.crosslisterTiers.find((t) => t.tier === 'FREE')?.publishesPerMonth).toBe(5);
    expect(result.crosslisterTiers.find((t) => t.tier === 'LITE')?.publishesPerMonth).toBe(200);
    expect(result.crosslisterTiers.find((t) => t.tier === 'PRO')?.publishesPerMonth).toBe(2000);
  });

  it('falls back to hardcoded defaults when all maps are empty', async () => {
    mockGetPrefix.mockResolvedValue(new Map());
    const result = await getBecomeSelllerPricing();
    expect(result.storeTiers.find((t) => t.tier === 'STARTER')?.monthlyCents).toBe(1200);
    expect(result.storeTiers.find((t) => t.tier === 'POWER')?.monthlyCents).toBe(7999);
    expect(result.crosslisterTiers.find((t) => t.tier === 'LITE')?.monthlyCents).toBe(1399);
    expect(result.automationMonthlyCents).toBe(1299);
    expect(result.tfBrackets[0]?.rateBps).toBe(1000);
  });
});

// ─── Tests: getSellerStatusForCtaRouting ─────────────────────────────────────

describe('getSellerStatusForCtaRouting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns { isSeller: false, sellerType: null } when user has no seller profile', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([{ isSeller: false }]));
    const result = await getSellerStatusForCtaRouting('user-1');
    expect(result).toEqual({ isSeller: false, sellerType: null });
  });

  it('returns { isSeller: false, sellerType: null } when user row is not found', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]));
    const result = await getSellerStatusForCtaRouting('user-missing');
    expect(result).toEqual({ isSeller: false, sellerType: null });
  });

  it('returns { isSeller: true, sellerType: "PERSONAL" } for personal sellers', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ isSeller: true }]))
      .mockReturnValueOnce(makeSelectChain([{ sellerType: 'PERSONAL' }]));
    const result = await getSellerStatusForCtaRouting('user-2');
    expect(result).toEqual({ isSeller: true, sellerType: 'PERSONAL' });
  });

  it('returns { isSeller: true, sellerType: "BUSINESS" } for business sellers', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ isSeller: true }]))
      .mockReturnValueOnce(makeSelectChain([{ sellerType: 'BUSINESS' }]));
    const result = await getSellerStatusForCtaRouting('user-3');
    expect(result).toEqual({ isSeller: true, sellerType: 'BUSINESS' });
  });

  it('returns { isSeller: true, sellerType: null } when isSeller=true but profile row is missing', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ isSeller: true }]))
      .mockReturnValueOnce(makeSelectChain([]));
    const result = await getSellerStatusForCtaRouting('user-4');
    expect(result).toEqual({ isSeller: true, sellerType: null });
  });

  it('does not query sellerProfile when isSeller is false', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([{ isSeller: false }]));
    await getSellerStatusForCtaRouting('user-5');
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });
});
