import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockCookieSet = vi.fn();
const mockDb = { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert };

const mockAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  crosslisterAccount: { id: 'id', sellerId: 'seller_id', channel: 'channel', status: 'status' },
  platformSetting: { key: 'key', value: 'value' },
}));
vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize, sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond) }));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@twicely/crosslister/connectors', () => ({}));
vi.mock('@twicely/crosslister/connectors/ebay-connector', () => ({
  EbayConnector: vi.fn().mockImplementation(function () {
    return {
      buildAuthUrl: vi.fn().mockResolvedValue('https://auth.ebay.com/oauth2/authorize?state=xyz'),
      revokeAuth: vi.fn().mockResolvedValue(undefined),
      refreshAuth: vi.fn().mockResolvedValue({
        success: true,
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        tokenExpiresAt: new Date(),
        capabilities: {},
      }),
    };
  }),
}));
vi.mock('@twicely/crosslister/connector-registry', () => ({
  getConnector: vi.fn().mockImplementation((channel: string) => {
    if (channel === 'EBAY') {
      return {
        buildAuthUrl: vi.fn().mockResolvedValue('https://auth.ebay.com/oauth2/authorize?state=xyz'),
        revokeAuth: vi.fn().mockResolvedValue(undefined),
        refreshAuth: vi.fn().mockResolvedValue({
          success: true,
          accessToken: 'new-token',
          refreshToken: 'new-refresh',
          tokenExpiresAt: new Date(),
          capabilities: {},
        }),
      };
    }
    if (channel === 'MERCARI') {
      return {
        buildAuthUrl: vi.fn().mockResolvedValue('https://www.mercari.com/oauth/authorize?state=xyz'),
        revokeAuth: vi.fn().mockResolvedValue(undefined),
        refreshAuth: vi.fn().mockResolvedValue({ success: true, accessToken: 'tok', refreshToken: null, tokenExpiresAt: new Date(), capabilities: {} }),
      };
    }
    if (channel === 'SHOPIFY') {
      return {
        buildAuthUrl: vi.fn().mockResolvedValue('https://my-store.myshopify.com/admin/oauth/authorize?state=xyz'),
        revokeAuth: vi.fn().mockResolvedValue(undefined),
        refreshAuth: vi.fn().mockResolvedValue({ success: true, accessToken: 'tok', refreshToken: null, tokenExpiresAt: null, capabilities: {} }),
      };
    }
    if (channel === 'POSHMARK') {
      return {
        authenticate: vi.fn().mockResolvedValue({
          success: true,
          externalAccountId: 'pm-user-1',
          externalUsername: 'poshuser',
          accessToken: null,
          refreshToken: null,
          sessionData: { jwt: 'jwt-tok', username: 'poshuser' },
          tokenExpiresAt: null,
          capabilities: {},
        }),
        revokeAuth: vi.fn().mockResolvedValue(undefined),
        refreshAuth: vi.fn().mockResolvedValue({ success: false, error: 'Session expired. Please reconnect.' }),
      };
    }
    return {
      revokeAuth: vi.fn().mockResolvedValue(undefined),
      refreshAuth: vi.fn().mockResolvedValue({ success: false, error: 'Unknown' }),
    };
  }),
}));
vi.mock('@twicely/crosslister/token-crypto', () => ({
  encryptToken: vi.fn((v: string) => v),
  decryptToken: vi.fn((v: string) => v),
  encryptSessionData: vi.fn((data: unknown) => (data ? JSON.stringify(data) : null)),
  decryptSessionData: vi.fn((data: unknown) => data),
  withDecryptedTokens: vi.fn((a: unknown) => a),
}));
vi.mock('@paralleldrive/cuid2', () => ({ createId: vi.fn().mockReturnValue('state-xyz') }));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: mockCookieSet,
    get: vi.fn(),
    delete: vi.fn(),
  }),
}));

function makeChain(result: unknown) {
  const chain = {
    from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(result),
    set: vi.fn(), values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue(result),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  return chain;
}

function sellerSession(overrides: Record<string, unknown> = {}) {
  return {
    session: { userId: 'user-1', delegationId: null, onBehalfOfSellerId: null, isSeller: true, ...overrides },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

describe('connectEbayAccount', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns OAuth URL for authenticated seller', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());

    // Flag enabled
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ value: true }]))       // feature flag
      .mockReturnValueOnce(makeChain([]));                      // no existing account

    const { connectEbayAccount } = await import('../crosslister-accounts');
    const result = await connectEbayAccount();

    expect(result.success).toBe(true);
    expect(result.data?.url).toContain('auth.ebay.com');
  });

  it('rejects if channel disabled via feature flag', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect.mockReturnValueOnce(makeChain([{ value: false }]));

    const { connectEbayAccount } = await import('../crosslister-accounts');
    const result = await connectEbayAccount();

    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
  });

  it('rejects if seller already has active eBay account', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ value: true }]))
      .mockReturnValueOnce(makeChain([{ id: 'existing-acc' }]));

    const { connectEbayAccount } = await import('../crosslister-accounts');
    const result = await connectEbayAccount();

    expect(result.success).toBe(false);
    expect(result.error).toContain('already connected');
  });

  it('rejects for non-seller (unauthorized)', async () => {
    mockAuthorize.mockResolvedValue({
      session: null,
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { connectEbayAccount } = await import('../crosslister-accounts');
    const result = await connectEbayAccount();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });
});

describe('disconnectAccount', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('revokes and sets status to REVOKED', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());

    const account = {
      id: 'acc-1', sellerId: 'user-1', channel: 'EBAY',
      accessToken: 'tok', refreshToken: 'rtok', status: 'ACTIVE',
    };

    mockDbSelect.mockReturnValue(makeChain([account]));
    const updateChain = makeChain(undefined);
    mockDbUpdate.mockReturnValue(updateChain);

    const { disconnectAccount } = await import('../crosslister-accounts');
    const result = await disconnectAccount({ accountId: 'acc-1' });

    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('rejects for wrong seller (CASL)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'other-user', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { disconnectAccount } = await import('../crosslister-accounts');
    const result = await disconnectAccount({ accountId: 'acc-1' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('works for Poshmark accounts (generic disconnect)', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());

    const account = {
      id: 'acc-pm', sellerId: 'user-1', channel: 'POSHMARK',
      accessToken: null, refreshToken: null, status: 'ACTIVE',
      sessionData: { jwt: 'jwt-token', username: 'poshuser' },
    };

    mockDbSelect.mockReturnValue(makeChain([account]));
    const updateChain = makeChain(undefined);
    mockDbUpdate.mockReturnValue(updateChain);

    const { disconnectAccount } = await import('../crosslister-accounts');
    const result = await disconnectAccount({ accountId: 'acc-pm' });

    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });
});

describe('connectPlatformAccount', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns OAuth URL for eBay', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect.mockReturnValue(makeChain([])); // no existing account

    const { connectPlatformAccount } = await import('../crosslister-accounts');
    const result = await connectPlatformAccount({ channel: 'EBAY' });

    expect(result.success).toBe(true);
    expect(result.data?.method).toBe('OAUTH');
    expect(result.data?.url).toContain('auth.ebay.com');
  });

  it('returns OAuth URL for Mercari', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect.mockReturnValue(makeChain([]));

    const { connectPlatformAccount } = await import('../crosslister-accounts');
    const result = await connectPlatformAccount({ channel: 'MERCARI' });

    expect(result.success).toBe(true);
    expect(result.data?.method).toBe('OAUTH');
    expect(result.data?.url).toContain('mercari.com');
  });

  it('returns SESSION method for Poshmark', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect.mockReturnValue(makeChain([]));

    const { connectPlatformAccount } = await import('../crosslister-accounts');
    const result = await connectPlatformAccount({ channel: 'POSHMARK' });

    expect(result.success).toBe(true);
    expect(result.data?.method).toBe('SESSION');
    expect(result.data?.url).toBeUndefined();
  });

  it('returns Shopify OAuth URL when a valid shopDomain is provided', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect.mockReturnValue(makeChain([]));

    const { connectPlatformAccount } = await import('../crosslister-accounts');
    const result = await connectPlatformAccount({
      channel: 'SHOPIFY',
      shopDomain: 'My-Store.myshopify.com',
    });

    expect(result.success).toBe(true);
    expect(result.data?.method).toBe('OAUTH');
    expect(result.data?.url).toContain('my-store.myshopify.com/admin/oauth/authorize');
    expect(mockCookieSet).toHaveBeenCalledWith(
      'crosslister_oauth_state',
      expect.stringContaining('"shopDomain":"my-store.myshopify.com"'),
      expect.any(Object),
    );
  });

  it('rejects unauthenticated users', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn().mockReturnValue(false) } });

    const { connectPlatformAccount } = await import('../crosslister-accounts');
    const result = await connectPlatformAccount({ channel: 'EBAY' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });
});

describe('authenticateSessionAccount', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('succeeds with valid Poshmark credentials', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect.mockReturnValue(makeChain([])); // no existing account
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const { authenticateSessionAccount } = await import('../crosslister-accounts');
    const result = await authenticateSessionAccount({ channel: 'POSHMARK', username: 'user', password: 'pass' });

    expect(result.success).toBe(true);
  });

  it('fails with invalid credentials', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());

    // Override connector mock to return failure
    const { getConnector } = await import('@/lib/crosslister/connector-registry');
    (getConnector as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      authenticate: vi.fn().mockResolvedValue({ success: false, error: 'Invalid credentials' }),
    });

    const { authenticateSessionAccount } = await import('../crosslister-accounts');
    const result = await authenticateSessionAccount({ channel: 'POSHMARK', username: 'bad', password: 'bad' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid credentials');
  });
});

describe('refreshAccountAuth', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns session-expired error for Poshmark (session-based)', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());

    const account = {
      id: 'acc-pm', sellerId: 'user-1', channel: 'POSHMARK',
      accessToken: null, refreshToken: null, status: 'ACTIVE',
      sessionData: { jwt: 'expired-jwt', username: 'poshuser' },
    };
    mockDbSelect.mockReturnValue(makeChain([account]));
    const updateChain = makeChain(undefined);
    mockDbUpdate.mockReturnValue(updateChain);

    const { refreshAccountAuth } = await import('../crosslister-accounts');
    const result = await refreshAccountAuth({ accountId: 'acc-pm' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('re-authentication');
  });
});
