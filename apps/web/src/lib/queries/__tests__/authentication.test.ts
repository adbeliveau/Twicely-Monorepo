import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
}));

import { db } from '@twicely/db';
const mockDb = db as unknown as { select: Mock };

function makeChain(finalResult: unknown) {
  const chain: Record<string, Mock> = {};
  const methods = ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin', 'innerJoin'];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  // Make it thenable so await works
  (chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => resolve(finalResult);
  return chain;
}

function setupSelect(result: unknown) {
  mockDb.select.mockReturnValue(makeChain(result));
}

describe('verifyCertificate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns NOT_FOUND for unknown certificate', async () => {
    setupSelect([]); // empty result = not found
    const { verifyCertificate } = await import('../authentication-verify');
    const result = await verifyCertificate('TW-AUTH-XXXXX');
    expect(result.status).toBe('NOT_FOUND');
    expect(result.message).toContain('not found');
  });

  it('returns TRANSFERRED for expired certificate (relisted item)', async () => {
    setupSelect([{
      id: 'req-1',
      status: 'CERTIFICATE_EXPIRED',
      authenticationType: 'EXPERT',
      authenticationDate: new Date('2025-01-01'),
      photoUrls: null,
      authenticatorId: null,
      listingId: 'lst-1',
      certNum: 'TW-AUTH-ABCD1',
    }]);
    const { verifyCertificate } = await import('../authentication-verify');
    const result = await verifyCertificate('TW-AUTH-ABCD1');
    expect(result.status).toBe('TRANSFERRED');
    expect(result.message).toContain('previous listing');
  });

  it('returns REVOKED for revoked certificate', async () => {
    setupSelect([{
      id: 'req-2',
      status: 'CERTIFICATE_REVOKED',
      authenticationType: 'EXPERT',
      authenticationDate: new Date('2025-01-01'),
      photoUrls: null,
      authenticatorId: null,
      listingId: 'lst-2',
      certNum: 'TW-AUTH-ABCD2',
    }]);
    const { verifyCertificate } = await import('../authentication-verify');
    const result = await verifyCertificate('TW-AUTH-ABCD2');
    expect(result.status).toBe('REVOKED');
    expect(result.message).toContain('revoked');
  });

  it('returns VALID for authenticated request with listing details', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // authenticationRequest lookup
        return makeChain([{
          id: 'req-3',
          status: 'EXPERT_AUTHENTICATED',
          authenticationType: 'EXPERT',
          authenticationDate: new Date('2025-06-01'),
          photoUrls: ['https://r2.example.com/photo1.jpg'],
          authenticatorId: null,
          listingId: 'lst-3',
          certNum: 'TW-AUTH-VALID',
        }]);
      }
      if (callCount === 2) return makeChain([{ title: 'Nike Air Jordan' }]); // listing
      if (callCount === 3) return makeChain([{ url: 'https://r2.example.com/thumb.jpg' }]); // image
      return makeChain([]);
    });
    const { verifyCertificate } = await import('../authentication-verify');
    const result = await verifyCertificate('TW-AUTH-VALID');
    expect(result.status).toBe('VALID');
    expect(result.listingTitle).toBe('Nike Air Jordan');
  });
});

describe('getAuthenticationBadgeForListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns null for NONE status', async () => {
    setupSelect([{ authenticationStatus: 'NONE', authenticationRequestId: null }]);
    const { getAuthenticationBadgeForListing } = await import('../authentication');
    const result = await getAuthenticationBadgeForListing('lst-1');
    expect(result).toBeNull();
  });

  it('returns badge info for authenticated listing', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain([{ authenticationStatus: 'EXPERT_AUTHENTICATED', authenticationRequestId: 'req-1' }]);
      }
      return makeChain([{ certificateNumber: 'TW-AUTH-ABCD1' }]);
    });
    const { getAuthenticationBadgeForListing } = await import('../authentication');
    const result = await getAuthenticationBadgeForListing('lst-1');
    expect(result).not.toBeNull();
    expect(result?.badgeLabel).toBe('Expert Authenticated');
    expect(result?.certificateNumber).toBe('TW-AUTH-ABCD1');
  });

  it('returns null for unknown status (no badge label)', async () => {
    setupSelect([{ authenticationStatus: 'EXPERT_COUNTERFEIT', authenticationRequestId: null }]);
    const { getAuthenticationBadgeForListing } = await import('../authentication');
    const result = await getAuthenticationBadgeForListing('lst-1');
    expect(result).toBeNull();
  });
});

describe('getAuthenticationRequestsForSeller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('paginates correctly', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([{ total: 42 }]); // count
      return makeChain([
        { id: 'req-1', listingId: 'l1', orderId: null, sellerId: 'u1', buyerId: null, initiator: 'SELLER', tier: 'EXPERT', status: 'EXPERT_PENDING', totalFeeCents: 3999, buyerFeeCents: null, sellerFeeCents: null, refundedBuyerCents: 0, certificateNumber: 'TW-AUTH-A', certificateUrl: null, verifyUrl: null, photosHash: null, photoUrls: null, resultNotes: null, authenticatorId: null, submittedAt: null, completedAt: null, expiresAt: null, createdAt: new Date() },
      ]);
    });
    const { getAuthenticationRequestsForSeller } = await import('../authentication');
    const result = await getAuthenticationRequestsForSeller('user-seller', { limit: 10, offset: 0 });
    expect(result.total).toBe(42);
    expect(Array.isArray(result.requests)).toBe(true);
  });
});

describe('getSellerVerificationStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns isVerified=true when seller is authenticated', async () => {
    setupSelect([{ isAuthenticatedSeller: true }]);
    const { getSellerVerificationStatus } = await import('../authentication');
    const result = await getSellerVerificationStatus('user-1');
    expect(result.isVerified).toBe(true);
  });

  it('returns isVerified=false when seller is not authenticated', async () => {
    setupSelect([{ isAuthenticatedSeller: false }]);
    const { getSellerVerificationStatus } = await import('../authentication');
    const result = await getSellerVerificationStatus('user-1');
    expect(result.isVerified).toBe(false);
  });

  it('returns isVerified=false when no seller profile', async () => {
    setupSelect([]);
    const { getSellerVerificationStatus } = await import('../authentication');
    const result = await getSellerVerificationStatus('user-unknown');
    expect(result.isVerified).toBe(false);
  });
});
