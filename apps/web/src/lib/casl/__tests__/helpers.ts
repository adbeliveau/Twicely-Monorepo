import type { CaslSession } from '../types';

export const guestSession = null;

export function createBuyerSession(overrides: Partial<CaslSession> = {}): CaslSession {
  return {
    userId: 'buyer-123',
    email: 'buyer@example.com',
    isSeller: false,
    sellerId: null,
    sellerStatus: null,
    delegationId: null,
    onBehalfOfSellerId: null,
    onBehalfOfSellerProfileId: null,
    delegatedScopes: [],
    isPlatformStaff: false,
    platformRoles: [],
    ...overrides,
  };
}

export function createSellerSession(overrides: Partial<CaslSession> = {}): CaslSession {
  return {
    userId: 'seller-123',
    email: 'seller@example.com',
    isSeller: true,
    sellerId: 'seller-profile-123',
    sellerStatus: 'ACTIVE',
    delegationId: null,
    onBehalfOfSellerId: null,
    onBehalfOfSellerProfileId: null,
    delegatedScopes: [],
    isPlatformStaff: false,
    platformRoles: [],
    ...overrides,
  };
}

export function createStaffSession(
  scopes: string[],
  overrides: Partial<CaslSession> = {}
): CaslSession {
  return {
    userId: 'staff-123',
    email: 'staff@example.com',
    isSeller: false,
    sellerId: null,
    sellerStatus: null,
    delegationId: 'delegation-123',
    onBehalfOfSellerId: 'seller-user-456',
    onBehalfOfSellerProfileId: 'seller-profile-456',
    delegatedScopes: scopes,
    isPlatformStaff: false,
    platformRoles: [],
    ...overrides,
  };
}
