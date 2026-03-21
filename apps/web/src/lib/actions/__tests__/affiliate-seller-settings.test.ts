/**
 * Tests for updateAffiliateOptIn and updateAffiliateCommissionRate actions (G3.6)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mocks ───────────────────────────────────────────────────────

const mockAuthorize = vi.fn();
vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (subject: string, conditions: unknown) => ({ subject, conditions }),
}));

const mockGetPlatformSetting = vi.fn();
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

const mockDbUpdate = vi.fn();
vi.mock('@twicely/db', () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { userId: 'userId', affiliateOptIn: 'affiliateOptIn', affiliateCommissionBps: 'affiliateCommissionBps' },
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import {
  updateAffiliateOptIn,
  updateAffiliateCommissionRate,
} from '../affiliate-seller-settings';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSellerSession(userId = 'seller-001') {
  return { userId, isSeller: true };
}

function makeAbility(canUpdate = true) {
  return {
    can: vi.fn(() => canUpdate),
  };
}

function setupUpdateChain() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  mockDbUpdate.mockReturnValue(chain);
  return chain;
}

// ─── Tests: updateAffiliateOptIn ─────────────────────────────────────────────

describe('updateAffiliateOptIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupUpdateChain();
  });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() });
    const result = await updateAffiliateOptIn({ optIn: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns error when not a seller', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'u1', isSeller: false }, ability: makeAbility() });
    const result = await updateAffiliateOptIn({ optIn: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Sellers only');
  });

  it('returns error when CASL forbids update', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSellerSession(), ability: makeAbility(false) });
    const result = await updateAffiliateOptIn({ optIn: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('returns error when input is invalid', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSellerSession(), ability: makeAbility() });
    const result = await updateAffiliateOptIn({ optIn: 'not-a-boolean' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('updates affiliateOptIn and revalidates path on success', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSellerSession(), ability: makeAbility() });
    const result = await updateAffiliateOptIn({ optIn: false });
    expect(result.success).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/affiliate');
  });

  it('sets optIn=true successfully', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSellerSession(), ability: makeAbility() });
    const result = await updateAffiliateOptIn({ optIn: true });
    expect(result.success).toBe(true);
  });
});

// ─── Tests: updateAffiliateCommissionRate ────────────────────────────────────

describe('updateAffiliateCommissionRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupUpdateChain();
    mockGetPlatformSetting.mockImplementation((key: string) => {
      if (key === 'affiliate.listingCommissionMinBps') return Promise.resolve(200);
      if (key === 'affiliate.listingCommissionMaxBps') return Promise.resolve(1000);
      return Promise.resolve(300);
    });
  });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() });
    const result = await updateAffiliateCommissionRate({ commissionBps: 500 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns error when not a seller', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'u1', isSeller: false }, ability: makeAbility() });
    const result = await updateAffiliateCommissionRate({ commissionBps: 500 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Sellers only');
  });

  it('returns error when CASL forbids update', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSellerSession(), ability: makeAbility(false) });
    const result = await updateAffiliateCommissionRate({ commissionBps: 500 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('accepts null to clear custom rate (revert to platform default)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSellerSession(), ability: makeAbility() });
    const result = await updateAffiliateCommissionRate({ commissionBps: null });
    expect(result.success).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/affiliate');
  });

  it('accepts valid rate within bounds (e.g., 500 bps = 5%)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSellerSession(), ability: makeAbility() });
    const result = await updateAffiliateCommissionRate({ commissionBps: 500 });
    expect(result.success).toBe(true);
  });

  it('rejects rate below platform minimum (199 bps < 200 bps)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSellerSession(), ability: makeAbility() });
    // Schema-level min is 200, so 199 fails at schema validation
    const result = await updateAffiliateCommissionRate({ commissionBps: 199 });
    expect(result.success).toBe(false);
  });

  it('rejects rate above platform maximum (1001 bps > 1000 bps)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSellerSession(), ability: makeAbility() });
    const result = await updateAffiliateCommissionRate({ commissionBps: 1001 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer commission bps', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSellerSession(), ability: makeAbility() });
    const result = await updateAffiliateCommissionRate({ commissionBps: 5.5 });
    expect(result.success).toBe(false);
  });

  it('rejects extra unknown keys (strict mode)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSellerSession(), ability: makeAbility() });
    const result = await updateAffiliateCommissionRate({ commissionBps: 500, extra: true });
    expect(result.success).toBe(false);
  });
});
