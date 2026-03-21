import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError } from '../authorize';
import { sub } from '../check';

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock auth module
vi.mock('@twicely/auth/server', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock db module
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

// Mock db schema
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { id: 'id', userId: 'user_id' },
}));

// Mock db schema/subscriptions (delegatedAccess)
vi.mock('@twicely/db/schema/subscriptions', () => ({
  delegatedAccess: { id: 'id', sellerId: 'seller_id', userId: 'user_id', status: 'status', expiresAt: 'expires_at', scopes: 'scopes' },
}));

// Mock db schema/identity (sellerProfile)
vi.mock('@twicely/db/schema/identity', () => ({
  sellerProfile: { id: 'id', userId: 'user_id' },
}));

// Helper to create mock session data with full Better Auth user fields
function createMockSession(overrides: { id: string; email: string; isSeller?: boolean }) {
  return {
    user: {
      id: overrides.id,
      email: overrides.email,
      name: 'Test User',
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isSeller: overrides.isSeller ?? false,
      displayName: null,
      username: null,
      bio: null,
      phone: null,
      phoneVerified: false,
      avatarUrl: null,
      defaultAddressId: null,
      buyerQualityTier: 'GREEN',
      marketingOptIn: false,
      isBanned: false,
      dashboardLayoutJson: null,
      deletionRequestedAt: null,
      referredByAffiliateId: null,
      creditBalanceCents: 0,
      bannedAt: null,
      bannedReason: null,
    },
    session: {
      id: `session-${overrides.id}`,
      userId: overrides.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      token: `token-${overrides.id}`,
      ipAddress: null,
      userAgent: null,
    },
  };
}

describe('ForbiddenError', () => {
  test('has correct name', () => {
    const error = new ForbiddenError();
    expect(error.name).toBe('ForbiddenError');
  });

  test('has default message', () => {
    const error = new ForbiddenError();
    expect(error.message).toBe('Forbidden');
  });

  test('accepts custom message', () => {
    const error = new ForbiddenError('Custom forbidden message');
    expect(error.message).toBe('Custom forbidden message');
  });

  test('is instance of Error', () => {
    const error = new ForbiddenError();
    expect(error).toBeInstanceOf(Error);
  });

  test('can be thrown and caught', () => {
    expect(() => {
      throw new ForbiddenError('Access denied');
    }).toThrow(ForbiddenError);
  });
});

describe('authorize', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('returns guest ability when no session', async () => {
    const { auth } = await import('@/lib/auth/server');
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    const { authorize } = await import('../authorize');
    const { ability, session } = await authorize();

    expect(session).toBeNull();
    // Guest can read listings
    expect(ability.can('read', 'Listing')).toBe(true);
    // Guest cannot create listings
    expect(ability.can('create', 'Listing')).toBe(false);
    // Guest cannot read orders
    expect(ability.can('read', 'Order')).toBe(false);
  });

  test('returns buyer ability for authenticated non-seller', async () => {
    const { auth } = await import('@/lib/auth/server');
    vi.mocked(auth.api.getSession).mockResolvedValue(
      createMockSession({
        id: 'user-123',
        email: 'buyer@example.com',
        isSeller: false,
      })
    );

    const { authorize } = await import('../authorize');
    const { ability, session } = await authorize();

    expect(session).not.toBeNull();
    expect(session?.userId).toBe('user-123');
    expect(session?.email).toBe('buyer@example.com');
    expect(session?.isSeller).toBe(false);

    // Buyer can read listings
    expect(ability.can('read', 'Listing')).toBe(true);
    // Buyer can create orders
    expect(ability.can('create', 'Order')).toBe(true);
    // Buyer can read own orders
    expect(ability.can('read', sub('Order', { buyerId: 'user-123' }))).toBe(true);
    // Buyer cannot read other's orders
    expect(ability.can('read', sub('Order', { buyerId: 'other-user' }))).toBe(false);
    // Buyer cannot create listings
    expect(ability.can('create', 'Listing')).toBe(false);
  });

  test('returns buyer ability for isSeller=true but no sellerId yet', async () => {
    // In A4, isSeller might be true but sellerId is looked up separately
    // Until B2 wires up sellerId lookup, sellers get buyer abilities
    const { auth } = await import('@/lib/auth/server');
    vi.mocked(auth.api.getSession).mockResolvedValue(
      createMockSession({
        id: 'seller-123',
        email: 'seller@example.com',
        isSeller: true,
      })
    );

    const { authorize } = await import('../authorize');
    const { ability, session } = await authorize();

    expect(session).not.toBeNull();
    expect(session?.isSeller).toBe(true);
    // sellerId = user.id when isSeller is true
    expect(session?.sellerId).toBe('seller-123');

    // Without sellerId, seller abilities that require sellerId won't work
    // But the ability is still built correctly
    expect(ability.can('read', 'Listing')).toBe(true);
    expect(ability.can('create', 'Order')).toBe(true);
  });

  test('session has correct shape for delegation fields', async () => {
    const { auth } = await import('@/lib/auth/server');
    vi.mocked(auth.api.getSession).mockResolvedValue(
      createMockSession({
        id: 'user-789',
        email: 'test@example.com',
      })
    );

    const { authorize } = await import('../authorize');
    const { session } = await authorize();

    // A4 stubs - delegation fields are null
    expect(session?.delegationId).toBeNull();
    expect(session?.onBehalfOfSellerId).toBeNull();
    expect(session?.delegatedScopes).toEqual([]);

    // A4 stubs - platform fields are false/empty
    expect(session?.isPlatformStaff).toBe(false);
    expect(session?.platformRoles).toEqual([]);
  });
});
