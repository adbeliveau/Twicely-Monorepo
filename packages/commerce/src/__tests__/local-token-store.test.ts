/**
 * Tests for IndexedDB token storage (G2.7).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock idb-keyval — no real IndexedDB in test environment
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

import { get, set, del } from 'idb-keyval';
import { storeTokens, getStoredTokens, clearStoredTokens } from '../local-token-store';
import type { PreloadedTokenData } from '@/lib/types/local-token';

const TX_ID = 'tx-store-001';

function makeTokenData(): PreloadedTokenData {
  return {
    sellerToken: 'seller.token',
    buyerToken: 'buyer.token',
    sellerOfflineCode: '123456',
    buyerOfflineCode: '654321',
    transactionId: TX_ID,
    amountCents: 5000,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    storedAt: new Date().toISOString(),
  };
}

describe('storeTokens', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls idb-keyval set with the correct key', async () => {
    vi.mocked(set).mockResolvedValue(undefined);
    const data = makeTokenData();
    await storeTokens(TX_ID, data);
    expect(set).toHaveBeenCalledWith(`local-tx-tokens-${TX_ID}`, data);
  });
});

describe('getStoredTokens', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns the stored data when found', async () => {
    const data = makeTokenData();
    vi.mocked(get).mockResolvedValue(data);
    const result = await getStoredTokens(TX_ID);
    expect(result).toEqual(data);
    expect(get).toHaveBeenCalledWith(`local-tx-tokens-${TX_ID}`);
  });

  it('returns undefined when not found', async () => {
    vi.mocked(get).mockResolvedValue(undefined);
    const result = await getStoredTokens(TX_ID);
    expect(result).toBeUndefined();
  });
});

describe('clearStoredTokens', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls idb-keyval del with the correct key', async () => {
    vi.mocked(del).mockResolvedValue(undefined);
    await clearStoredTokens(TX_ID);
    expect(del).toHaveBeenCalledWith(`local-tx-tokens-${TX_ID}`);
  });
});
