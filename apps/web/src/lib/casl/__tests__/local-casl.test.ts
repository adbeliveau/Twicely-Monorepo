import { describe, it, expect } from 'vitest';
import { defineAbilitiesFor } from '../ability';
import { sub } from '../check';
import {
  createBuyerSession,
  createSellerSession,
  createStaffSession,
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

describe('Local Transaction CASL', () => {
  describe('buyer abilities', () => {
    it('buyer can read own local transaction (buyerId match)', () => {
      const session = createBuyerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('read', sub('LocalTransaction', { buyerId: session.userId }))).toBe(true);
    });

    it('buyer cannot read other buyer local transaction', () => {
      const session = createBuyerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('read', sub('LocalTransaction', { buyerId: 'other-buyer' }))).toBe(false);
    });

    it('buyer can update own local transaction (check-in/confirm)', () => {
      const session = createBuyerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('update', sub('LocalTransaction', { buyerId: session.userId }))).toBe(true);
    });

    it('buyer cannot update other buyer local transaction', () => {
      const session = createBuyerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('update', sub('LocalTransaction', { buyerId: 'other-buyer' }))).toBe(false);
    });

    it('buyer can read safe meetup locations', () => {
      const session = createBuyerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('read', 'SafeMeetupLocation')).toBe(true);
    });
  });

  describe('seller abilities', () => {
    it('seller can read own local transaction (sellerId match)', () => {
      const session = createSellerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('read', sub('LocalTransaction', { sellerId: session.userId }))).toBe(true);
    });

    it('seller cannot read other seller local transaction', () => {
      const session = createSellerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('read', sub('LocalTransaction', { sellerId: 'other-seller' }))).toBe(false);
    });

    it('seller can update own local transaction (check-in)', () => {
      const session = createSellerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('update', sub('LocalTransaction', { sellerId: session.userId }))).toBe(true);
    });

    it('seller cannot update other seller local transaction', () => {
      const session = createSellerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('update', sub('LocalTransaction', { sellerId: 'other-seller' }))).toBe(false);
    });

    it('seller can read safe meetup locations', () => {
      const session = createSellerSession();
      const ability = defineAbilitiesFor(session);
      expect(ability.can('read', 'SafeMeetupLocation')).toBe(true);
    });
  });

  describe('platform staff abilities', () => {
    it('admin can manage any local transaction', () => {
      const session = createPlatformStaffSession(['ADMIN']);
      const ability = defineAbilitiesFor(session);
      expect(ability.can('manage', 'LocalTransaction')).toBe(true);
    });

    it('support can manage any local transaction', () => {
      const session = createPlatformStaffSession(['SUPPORT']);
      const ability = defineAbilitiesFor(session);
      expect(ability.can('manage', 'LocalTransaction')).toBe(true);
    });

    it('admin can manage safe meetup locations', () => {
      const session = createPlatformStaffSession(['ADMIN']);
      const ability = defineAbilitiesFor(session);
      expect(ability.can('manage', 'SafeMeetupLocation')).toBe(true);
    });
  });

  describe('delegated staff abilities', () => {
    it('orders.view delegate can read seller local transactions', () => {
      const session = createStaffSession(['orders.view']);
      const ability = defineAbilitiesFor(session);
      expect(
        ability.can('read', sub('LocalTransaction', { sellerId: session.onBehalfOfSellerId }))
      ).toBe(true);
    });

    it('orders.manage delegate can update seller local transactions', () => {
      const session = createStaffSession(['orders.manage']);
      const ability = defineAbilitiesFor(session);
      expect(
        ability.can('update', sub('LocalTransaction', { sellerId: session.onBehalfOfSellerId }))
      ).toBe(true);
    });

    it('orders.view delegate cannot read other seller local transactions', () => {
      const session = createStaffSession(['orders.view']);
      const ability = defineAbilitiesFor(session);
      expect(
        ability.can('read', sub('LocalTransaction', { sellerId: 'other-seller-999' }))
      ).toBe(false);
    });
  });
});
