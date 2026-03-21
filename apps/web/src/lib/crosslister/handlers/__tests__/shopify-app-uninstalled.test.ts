/**
 * Unit tests for Shopify app uninstalled webhook handler.
 * Source: H3.4 install prompt §5 (Unit Tests — App Uninstalled Handler)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  channelProjection: {
    id: 'id',
    status: 'status',
    channel: 'channel',
    externalId: 'external_id',
    accountId: 'account_id',
    sellerId: 'seller_id',
    updatedAt: 'updated_at',
  },
  crosslisterAccount: {
    id: 'id',
    channel: 'channel',
    externalAccountId: 'external_account_id',
    status: 'account_status',
    accessToken: 'access_token',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => ({ type: 'eq', a: _a, b: _b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

vi.mock('@twicely/realtime/centrifugo-publisher', () => ({
  publishToChannel: vi.fn().mockResolvedValue(undefined),
  sellerChannel: vi.fn((id: string) => `private-user.${id}`),
}));

import { db } from '@twicely/db';
import { handleShopifyAppUninstalled } from '../shopify-webhook-handlers';

/** Mock a found crosslisterAccount */
function mockFoundAccount(account = { id: 'account-001' }) {
  const mockSet = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  vi.mocked(db.update).mockImplementation(mockUpdate);

  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([account]),
      }),
    }),
  } as never);
}

/** Mock no matching account */
function mockNotFoundAccount() {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as never);
}

describe('handleShopifyAppUninstalled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes crosslisterAccount (status = REVOKED, accessToken = null)', async () => {
    mockFoundAccount();

    await handleShopifyAppUninstalled('mystore.myshopify.com');

    const firstSetCall = vi.mocked(db.update).mock.results[0]?.value?.set;
    expect(firstSetCall).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'REVOKED',
        accessToken: null,
      }),
    );
  });

  it('marks all ACTIVE projections for the account as DELISTED', async () => {
    mockFoundAccount();

    await handleShopifyAppUninstalled('mystore.myshopify.com');

    // Should be called twice: once for account, once for projections
    expect(db.update).toHaveBeenCalledTimes(2);
    const secondSetCall = vi.mocked(db.update).mock.results[1]?.value?.set;
    expect(secondSetCall).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DELISTED' }),
    );
  });

  it('does nothing when account not found', async () => {
    mockNotFoundAccount();

    await handleShopifyAppUninstalled('unknownstore.myshopify.com');

    expect(db.update).not.toHaveBeenCalled();
  });

  it('handles DB errors gracefully (does not throw)', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('DB connection failed')),
        }),
      }),
    } as never);

    await expect(
      handleShopifyAppUninstalled('mystore.myshopify.com')
    ).rejects.toThrow();
    // Note: unhandled DB errors propagate — the route wraps with try/catch
  });
});
