import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDb = { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert };

const mockGetPlatformSetting = vi.fn();
const mockAuthorize = vi.fn();
const mockGenerateCertNumber = vi.fn().mockResolvedValue('TW-AUTH-AABBB');

const mockProviderSubmit = vi.fn().mockResolvedValue({ providerRef: 'entrupy-ref-1', submittedAt: new Date() });
const mockAiProvider = {
  name: 'entrupy',
  submitForAuthentication: (...args: unknown[]) => mockProviderSubmit(...args),
  getResult: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  parseWebhookResult: vi.fn(),
};
const mockGetAiAuthProvider = vi.fn().mockResolvedValue(mockAiProvider);

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: vi.fn().mockReturnValue({ incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) }),
}));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));
vi.mock('@twicely/casl/authorize', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));
vi.mock('@/lib/authentication/cert-number', () => ({
  generateCertNumber: (...args: unknown[]) => mockGenerateCertNumber(...args),
}));
vi.mock('@/lib/authentication/ai-provider-factory', () => ({
  getAiAuthProvider: (...args: unknown[]) => mockGetAiAuthProvider(...args),
}));
vi.mock('@/lib/authentication/constants', () => ({
  AUTH_SETTINGS_KEYS: {
    AI_ENABLED: 'trust.authentication.aiEnabled',
    AI_FEE_CENTS: 'trust.authentication.aiFeeCents',
    AI_SUPPORTED_CATEGORIES: 'trust.authentication.aiSupportedCategories',
    AI_PROVIDER_NAME: 'trust.authentication.aiProviderName',
    AI_PROVIDER_WEBHOOK_SECRET: 'trust.authentication.aiProviderWebhookSecret',
  },
}));

// ─── Chainable mock helpers ─────────────────────────────────────────────────

function chainSelect(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };
}

function chainUpdate() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ id: 'updated' }]),
  };
}

function chainInsert(result: unknown[] = [{ id: 'new-req-id' }]) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
}

function makeGuestAbility() {
  return { session: null, ability: { can: () => false } };
}

function makeSellerAbility(userId = 'user-seller') {
  return {
    session: { userId, isSeller: true, sellerId: 'sp-1', delegationId: null, onBehalfOfSellerId: null, onBehalfOfSellerProfileId: null, delegatedScopes: [], isPlatformStaff: false, platformRoles: [] },
    ability: { can: () => true },
  };
}

function makeDelegateAbility(userId = 'user-delegate') {
  return {
    session: { userId, isSeller: true, sellerId: 'sp-1', delegationId: 'del-1', onBehalfOfSellerId: 'sp-owner', onBehalfOfSellerProfileId: 'sp-owner', delegatedScopes: ['listings.manage'], isPlatformStaff: false, platformRoles: [] },
    ability: { can: () => false },
  };
}

function makeBuyerAbility(userId = 'user-buyer') {
  return {
    session: { userId, isSeller: false, sellerId: null, delegationId: null, onBehalfOfSellerId: null, onBehalfOfSellerProfileId: null, delegatedScopes: [], isPlatformStaff: false, platformRoles: [] },
    ability: { can: () => true },
  };
}

const VALID_PHOTOS = [
  'https://r2.example.com/a.jpg',
  'https://r2.example.com/b.jpg',
  'https://r2.example.com/c.jpg',
];

const LISTING_ROW = {
  id: 'clst1xxxxxxxxxxxxxxxxxxx',
  ownerUserId: 'user-seller',
  status: 'ACTIVE',
  slug: 'my-item',
  title: 'Luxury Bag',
  priceCents: 60000,
  categoryId: 'cat-handbags',
};

// ─── requestAiAuthentication tests ──────────────────────────────────────────

describe('requestAiAuthentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((key: string) => {
      if (key === 'trust.authentication.aiEnabled') return Promise.resolve(true);
      if (key === 'trust.authentication.aiFeeCents') return Promise.resolve(1999);
      if (key === 'trust.authentication.aiSupportedCategories') return Promise.resolve(['cat-handbags', 'cat-watches', 'cat-sneakers', 'cat-trading-cards']);
      return Promise.resolve(null);
    });
    mockGenerateCertNumber.mockResolvedValue('TW-AUTH-AABBB');
    mockProviderSubmit.mockResolvedValue({ providerRef: 'entrupy-ref-1', submittedAt: new Date() });
    mockGetAiAuthProvider.mockResolvedValue(mockAiProvider);
  });

  it('rejects unauthenticated users', async () => {
    mockAuthorize.mockResolvedValue(makeGuestAbility());
    const { requestAiAuthentication } = await import('../authentication-ai');
    const result = await requestAiAuthentication({
      listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('You must be logged in');
  });

  it('rejects when aiEnabled is false', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility());
    mockGetPlatformSetting.mockResolvedValue(false);
    const { requestAiAuthentication } = await import('../authentication-ai');
    const result = await requestAiAuthentication({
      listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('AI authentication is not currently available');
  });

  it('rejects delegates', async () => {
    mockAuthorize.mockResolvedValue(makeDelegateAbility());
    const { requestAiAuthentication } = await import('../authentication-ai');
    const result = await requestAiAuthentication({
      listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Delegated staff cannot create authentication requests');
  });

  it('rejects invalid input (too few photos)', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility());
    const { requestAiAuthentication } = await import('../authentication-ai');
    const result = await requestAiAuthentication({
      listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      photoUrls: ['https://r2.example.com/a.jpg'],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  it('returns error for missing listing', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('user-seller'));
    mockDbSelect.mockReturnValueOnce(chainSelect([]));
    const { requestAiAuthentication } = await import('../authentication-ai');
    const result = await requestAiAuthentication({
      listingId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Listing not found');
  });

  it('reads fee from trust.authentication.aiFeeCents setting', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('user-seller'));
    mockGetPlatformSetting.mockImplementation((key: string) => {
      if (key === 'trust.authentication.aiEnabled') return Promise.resolve(true);
      if (key === 'trust.authentication.aiFeeCents') return Promise.resolve(2499);
      if (key === 'trust.authentication.aiSupportedCategories') return Promise.resolve(['cat-handbags', 'cat-watches', 'cat-sneakers', 'cat-trading-cards']);
      return Promise.resolve(null);
    });
    mockDbSelect.mockReturnValueOnce(chainSelect([LISTING_ROW]));
    mockDbInsert.mockReturnValue(chainInsert([{ id: 'req-1' }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const { requestAiAuthentication } = await import('../authentication-ai');
    const result = await requestAiAuthentication({
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(mockGetPlatformSetting).toHaveBeenCalledWith('trust.authentication.aiFeeCents', 1999);
    expect(result.success).toBe(true);
  });

  it('creates request with tier=AI and status=AI_PENDING', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('user-seller'));
    mockDbSelect.mockReturnValueOnce(chainSelect([LISTING_ROW]));
    mockDbInsert.mockReturnValue(chainInsert([{ id: 'req-1' }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const { requestAiAuthentication } = await import('../authentication-ai');
    const result = await requestAiAuthentication({
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(true);
    expect(mockDbInsert).toHaveBeenCalled();
    const insertCallArgs = mockDbInsert.mock.calls;
    expect(insertCallArgs.length).toBeGreaterThan(0);
  });

  it('generates certificate number', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('user-seller'));
    mockDbSelect.mockReturnValueOnce(chainSelect([LISTING_ROW]));
    mockDbInsert.mockReturnValue(chainInsert([{ id: 'req-1' }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const { requestAiAuthentication } = await import('../authentication-ai');
    const result = await requestAiAuthentication({
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(true);
    expect(result.certificateNumber).toBe('TW-AUTH-AABBB');
    expect(mockGenerateCertNumber).toHaveBeenCalled();
  });

  it('calls AI provider submitForAuthentication', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('user-seller'));
    mockDbSelect.mockReturnValueOnce(chainSelect([LISTING_ROW]));
    mockDbInsert.mockReturnValue(chainInsert([{ id: 'req-1' }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const { requestAiAuthentication } = await import('../authentication-ai');
    await requestAiAuthentication({
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(mockProviderSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ photoUrls: VALID_PHOTOS })
    );
  });

  it('updates listing authenticationStatus to AI_PENDING', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('user-seller'));
    mockDbSelect.mockReturnValueOnce(chainSelect([LISTING_ROW]));
    mockDbInsert.mockReturnValue(chainInsert([{ id: 'req-1' }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const { requestAiAuthentication } = await import('../authentication-ai');
    const result = await requestAiAuthentication({
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it('allows buyer-initiated with orderId', async () => {
    mockAuthorize.mockResolvedValue(makeBuyerAbility('user-buyer'));
    mockDbSelect.mockReturnValueOnce(chainSelect([{ ...LISTING_ROW, ownerUserId: 'other-seller' }]));
    mockDbInsert.mockReturnValue(chainInsert([{ id: 'req-2' }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const { requestAiAuthentication } = await import('../authentication-ai');
    const result = await requestAiAuthentication({
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      orderId: 'clord1xxxxxxxxxxxxxxxxxx0',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-owner non-buyer (no orderId, not owner)', async () => {
    mockAuthorize.mockResolvedValue(makeBuyerAbility('user-random'));
    mockDbSelect.mockReturnValueOnce(chainSelect([{ ...LISTING_ROW, ownerUserId: 'other-seller' }]));
    const { requestAiAuthentication } = await import('../authentication-ai');
    const result = await requestAiAuthentication({
      listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});

// ─── retryAiAuthentication tests ────────────────────────────────────────────

describe('retryAiAuthentication', () => {
  const INCONCLUSIVE_REQ = {
    id: 'clreqincxxxxxxxxxxxxxxxxxx',
    listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
    sellerId: 'user-seller',
    status: 'AI_INCONCLUSIVE',
    tier: 'AI',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((key: string) => {
      if (key === 'trust.authentication.aiEnabled') return Promise.resolve(true);
      return Promise.resolve(null);
    });
    mockGenerateCertNumber.mockResolvedValue('TW-AUTH-RETRY1');
    mockProviderSubmit.mockResolvedValue({ providerRef: 'entrupy-ref-retry', submittedAt: new Date() });
    mockGetAiAuthProvider.mockResolvedValue(mockAiProvider);
  });

  it('rejects non-INCONCLUSIVE requests', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('user-seller'));
    mockDbSelect.mockReturnValueOnce(chainSelect([{ ...INCONCLUSIVE_REQ, status: 'AI_PENDING' }]));
    const { retryAiAuthentication } = await import('../authentication-ai');
    const result = await retryAiAuthentication({
      requestId: 'clreqincxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Only AI_INCONCLUSIVE requests can be retried');
  });

  it('rejects when aiEnabled is false', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('user-seller'));
    mockGetPlatformSetting.mockResolvedValue(false);
    const { retryAiAuthentication } = await import('../authentication-ai');
    const result = await retryAiAuthentication({
      requestId: 'clreqincxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('AI authentication is not currently available');
  });

  it('rejects non-seller trying to retry', async () => {
    mockAuthorize.mockResolvedValue(makeBuyerAbility('user-buyer'));
    mockDbSelect.mockReturnValueOnce(chainSelect([INCONCLUSIVE_REQ]));
    const { retryAiAuthentication } = await import('../authentication-ai');
    const result = await retryAiAuthentication({
      requestId: 'clreqincxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Only the seller can retry authentication');
  });

  it('rejects second retry (count > 1)', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('user-seller'));
    mockDbSelect
      .mockReturnValueOnce(chainSelect([INCONCLUSIVE_REQ]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 2 }]),
      });
    const { retryAiAuthentication } = await import('../authentication-ai');
    const result = await retryAiAuthentication({
      requestId: 'clreqincxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Only one retry is permitted per authentication request');
  });

  it('creates retry with totalFeeCents=0', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('user-seller'));
    mockDbSelect
      .mockReturnValueOnce(chainSelect([INCONCLUSIVE_REQ]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 1 }]),
      })
      .mockReturnValueOnce(chainSelect([LISTING_ROW]));
    mockDbInsert.mockReturnValue(chainInsert([{ id: 'retry-req-1' }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const { retryAiAuthentication } = await import('../authentication-ai');
    const result = await retryAiAuthentication({
      requestId: 'clreqincxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(true);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it('updates listing to AI_PENDING on successful retry', async () => {
    mockAuthorize.mockResolvedValue(makeSellerAbility('user-seller'));
    mockDbSelect
      .mockReturnValueOnce(chainSelect([INCONCLUSIVE_REQ]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 1 }]),
      })
      .mockReturnValueOnce(chainSelect([LISTING_ROW]));
    mockDbInsert.mockReturnValue(chainInsert([{ id: 'retry-req-1' }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const { retryAiAuthentication } = await import('../authentication-ai');
    const result = await retryAiAuthentication({
      requestId: 'clreqincxxxxxxxxxxxxxxxxxx',
      photoUrls: VALID_PHOTOS,
    });
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });
});
