import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  user: {},
  order: { buyerId: 'buyer_id', sellerId: 'seller_id' },
  listing: { ownerUserId: 'owner_user_id' },
  ledgerEntry: { userId: 'user_id' },
  review: { reviewerUserId: 'reviewer_user_id', sellerId: 'seller_id' },
  payout: { userId: 'user_id' },
  savedSearch: { userId: 'user_id' },
  watchlistItem: { userId: 'user_id' },
  follow: { followerId: 'follower_id', followedId: 'followed_id' },
  notificationPreference: { userId: 'user_id' },
  address: { userId: 'user_id' },
  taxInfo: { userId: 'user_id' },
  affiliate: { userId: 'user_id', id: 'id' },
  affiliateCommission: { affiliateId: 'affiliate_id' },
  affiliatePayout: { affiliateId: 'affiliate_id' },
  identityVerification: { id: 'id', level: 'level', status: 'status', verifiedAt: 'verified_at', userId: 'user_id' },
  conversation: { buyerId: 'buyer_id', sellerId: 'seller_id', id: 'id' },
  message: { conversationId: 'conversation_id' },
  localTransaction: { buyerId: 'buyer_id', sellerId: 'seller_id' },
  promoCodeRedemption: { userId: 'user_id' },
  userInterest: { userId: 'user_id' },
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  or: vi.fn((...args) => ({ op: 'or', args })),
}));

// Chainable select builder
function makeSelectChain(resolvedValue: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolvedValue),
  };
  // Some calls don't use .limit() (notificationPreference, address)
  chain.where.mockImplementation(() => {
    return {
      ...chain,
      then: (resolve: (v: unknown[]) => void) => resolve(resolvedValue),
      [Symbol.toStringTag]: 'Promise',
    } as unknown as typeof chain;
  });
  chain.limit.mockResolvedValue(resolvedValue);
  return chain;
}

describe('collectUserDataFull', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns _metadata with version 2.0 and exportedAt', async () => {
    const { db } = await import('@twicely/db');

    // All queries return empty arrays
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    const { collectUserDataFull } = await import('../data-export-full');
    const result = await collectUserDataFull('user-test-1');

    expect(result._metadata).toBeDefined();
    const meta = result._metadata as Record<string, unknown>;
    expect(meta.version).toBe('2.0');
    expect(meta.format).toBe('json');
    expect(typeof meta.exportedAt).toBe('string');
    expect(meta.userId).toBe('user-test-1');
  });

  it('includes required sections list in metadata', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    const { collectUserDataFull } = await import('../data-export-full');
    const result = await collectUserDataFull('user-test-2');

    const meta = result._metadata as Record<string, unknown>;
    const sections = meta.sections as string[];
    expect(sections).toContain('profile');
    expect(sections).toContain('ordersAsBuyer');
    expect(sections).toContain('ordersAsSeller');
    expect(sections).toContain('ledgerEntries');
    expect(sections).toContain('cookieConsentPreferences');
  });

  it('omits taxIdEncrypted from tax info (returns safe fields only)', async () => {
    const { db } = await import('@twicely/db');

    const taxRecord = {
      taxIdType: 'SSN',
      taxIdLastFour: '1234',
      taxIdEncrypted: 'SUPER_SECRET_ENCRYPTED_VALUE',
      legalName: 'Test User',
      businessName: null,
      country: 'US',
      form1099Threshold: 60000,
      w9ReceivedAt: null,
    };

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      // 14th call is taxInfo (index 13)
      if (callCount === 14) {
        return makeSelectChain([taxRecord]) as unknown as ReturnType<typeof db.select>;
      }
      return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
    });

    const { collectUserDataFull } = await import('../data-export-full');
    const result = await collectUserDataFull('user-test-3');

    const taxInfo = result.taxInfo as Record<string, unknown> | null;
    expect(taxInfo).not.toBeNull();
    expect(taxInfo?.taxIdEncrypted).toBeUndefined();
    expect(taxInfo?.taxIdLastFour).toBe('1234');
  });

  it('includes cookieConsentPreferences from user record', async () => {
    const { db } = await import('@twicely/db');

    const userRecord = {
      id: 'user-test-4',
      email: 'test@example.com',
      cookieConsentJson: { functional: true, analytics: false, version: 1 },
    };

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeSelectChain([userRecord]) as unknown as ReturnType<typeof db.select>;
      }
      return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
    });

    const { collectUserDataFull } = await import('../data-export-full');
    const result = await collectUserDataFull('user-test-4');

    expect(result.cookieConsentPreferences).toEqual({
      functional: true,
      analytics: false,
      version: 1,
    });
  });

  it('returns null for cookieConsentPreferences when user has none', async () => {
    const { db } = await import('@twicely/db');

    const userRecord = { id: 'user-test-5', email: 'u@example.com', cookieConsentJson: null };

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeSelectChain([userRecord]) as unknown as ReturnType<typeof db.select>;
      }
      return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
    });

    const { collectUserDataFull } = await import('../data-export-full');
    const result = await collectUserDataFull('user-test-5');

    expect(result.cookieConsentPreferences).toBeNull();
  });

  it('includes identityVerifications in output', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    const { collectUserDataFull } = await import('../data-export-full');
    const result = await collectUserDataFull('user-test-6');

    expect(result).toHaveProperty('identityVerifications');
    expect(Array.isArray(result.identityVerifications)).toBe(true);
  });
});
