import { describe, it, expect } from 'vitest';
import { defineAbilitiesFor } from '../ability';
import { sub } from '../check';
import {
  createBuyerSession,
  createSellerSession,
} from './helpers';
import type { CaslSession, PlatformRole } from '../types';

function createPlatformStaffSession(roles: PlatformRole[]): CaslSession {
  return {
    userId: 'staff-user-123',
    email: 'staff@hub.twicely.co',
    isSeller: false,
    sellerId: null,
    sellerStatus: null,
    delegationId: null,
    onBehalfOfSellerId: null,
    onBehalfOfSellerProfileId: null,
    delegatedScopes: [],
    isPlatformStaff: true,
    platformRoles: roles,
  };
}

describe('LocalReliabilityEvent CASL', () => {
  describe('buyer abilities', () => {
    it('buyer can read own LocalReliabilityEvent (userId match)', () => {
      const session = createBuyerSession();
      const ability = defineAbilitiesFor(session);
      expect(
        ability.can('read', sub('LocalReliabilityEvent', { userId: session.userId })),
      ).toBe(true);
    });

    it('buyer cannot read another user\'s LocalReliabilityEvent', () => {
      const session = createBuyerSession();
      const ability = defineAbilitiesFor(session);
      expect(
        ability.can('read', sub('LocalReliabilityEvent', { userId: 'other-user-999' })),
      ).toBe(false);
    });

    it('buyer cannot create LocalReliabilityEvent', () => {
      const session = createBuyerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('create', 'LocalReliabilityEvent')).toBe(false);
    });

    it('buyer cannot update LocalReliabilityEvent', () => {
      const session = createBuyerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('update', 'LocalReliabilityEvent')).toBe(false);
    });

    it('buyer cannot delete LocalReliabilityEvent', () => {
      const session = createBuyerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('delete', 'LocalReliabilityEvent')).toBe(false);
    });
  });

  describe('seller abilities', () => {
    it('seller can read own LocalReliabilityEvent (userId match)', () => {
      const session = createSellerSession();
      const ability = defineAbilitiesFor(session);
      expect(
        ability.can('read', sub('LocalReliabilityEvent', { userId: session.userId })),
      ).toBe(true);
    });

    it('seller cannot read another user\'s LocalReliabilityEvent', () => {
      const session = createSellerSession();
      const ability = defineAbilitiesFor(session);
      expect(
        ability.can('read', sub('LocalReliabilityEvent', { userId: 'other-user-999' })),
      ).toBe(false);
    });

    it('seller cannot create LocalReliabilityEvent', () => {
      const session = createSellerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('create', 'LocalReliabilityEvent')).toBe(false);
    });

    it('seller cannot update LocalReliabilityEvent', () => {
      const session = createSellerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('update', 'LocalReliabilityEvent')).toBe(false);
    });

    it('seller cannot delete LocalReliabilityEvent', () => {
      const session = createSellerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('delete', 'LocalReliabilityEvent')).toBe(false);
    });
  });

  describe('platform staff abilities', () => {
    it('admin can manage LocalReliabilityEvent', () => {
      const session = createPlatformStaffSession(['ADMIN']);
      const ability = defineAbilitiesFor(session);
      expect(ability.can('manage', 'LocalReliabilityEvent')).toBe(true);
    });

    it('support can manage LocalReliabilityEvent', () => {
      const session = createPlatformStaffSession(['SUPPORT']);
      const ability = defineAbilitiesFor(session);
      expect(ability.can('manage', 'LocalReliabilityEvent')).toBe(true);
    });

    it('admin can read any user\'s LocalReliabilityEvent', () => {
      const session = createPlatformStaffSession(['ADMIN']);
      const ability = defineAbilitiesFor(session);
      expect(
        ability.can('read', sub('LocalReliabilityEvent', { userId: 'any-user' })),
      ).toBe(true);
    });

    it('support can read any user\'s LocalReliabilityEvent', () => {
      const session = createPlatformStaffSession(['SUPPORT']);
      const ability = defineAbilitiesFor(session);
      expect(
        ability.can('read', sub('LocalReliabilityEvent', { userId: 'any-user' })),
      ).toBe(true);
    });
  });
});
