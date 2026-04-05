import { describe, it, expect } from 'vitest';
import { defineAbilitiesFor } from '../ability';
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

describe('impersonate ability — role coverage', () => {
  it('SUPPORT: cannot impersonate User (SEC-009)', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['SUPPORT']));
    expect(ability.can('impersonate', 'User')).toBe(false);
  });

  it('ADMIN: can impersonate User', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['ADMIN']));
    expect(ability.can('impersonate', 'User')).toBe(true);
  });

  it('SUPER_ADMIN: can impersonate User', () => {
    const ability = defineAbilitiesFor(
      createPlatformStaffSession(['SUPER_ADMIN'])
    );
    expect(ability.can('impersonate', 'User')).toBe(true);
  });

  it('HELPDESK_AGENT: cannot impersonate User', () => {
    const ability = defineAbilitiesFor(
      createPlatformStaffSession(['HELPDESK_AGENT'])
    );
    expect(ability.can('impersonate', 'User')).toBe(false);
  });

  it('HELPDESK_LEAD: cannot impersonate User', () => {
    const ability = defineAbilitiesFor(
      createPlatformStaffSession(['HELPDESK_LEAD'])
    );
    expect(ability.can('impersonate', 'User')).toBe(false);
  });

  it('HELPDESK_MANAGER: cannot impersonate User', () => {
    const ability = defineAbilitiesFor(
      createPlatformStaffSession(['HELPDESK_MANAGER'])
    );
    expect(ability.can('impersonate', 'User')).toBe(false);
  });

  it('MODERATION: cannot impersonate User', () => {
    const ability = defineAbilitiesFor(
      createPlatformStaffSession(['MODERATION'])
    );
    expect(ability.can('impersonate', 'User')).toBe(false);
  });

  it('FINANCE: cannot impersonate User', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['FINANCE']));
    expect(ability.can('impersonate', 'User')).toBe(false);
  });

  it('DEVELOPER: cannot impersonate User', () => {
    const ability = defineAbilitiesFor(
      createPlatformStaffSession(['DEVELOPER'])
    );
    expect(ability.can('impersonate', 'User')).toBe(false);
  });

  it('SRE: cannot impersonate User', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['SRE']));
    expect(ability.can('impersonate', 'User')).toBe(false);
  });
});
