import { describe, it, expect } from 'vitest';
import { defineAbilitiesFor } from '../ability';
import type { CaslSession, PlatformRole } from '../types';

function createPlatformStaffSession(roles: PlatformRole[]): CaslSession {
  return {
    userId: 'staff-test-001',
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

describe('Category CASL permissions', () => {
  it('ADMIN can manage Category', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['ADMIN']));
    expect(ability.can('manage', 'Category')).toBe(true);
    expect(ability.can('create', 'Category')).toBe(true);
    expect(ability.can('update', 'Category')).toBe(true);
    expect(ability.can('delete', 'Category')).toBe(true);
    expect(ability.can('read', 'Category')).toBe(true);
  });

  it('MODERATION can read Category', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['MODERATION']));
    expect(ability.can('read', 'Category')).toBe(true);
  });

  it('MODERATION cannot create Category', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['MODERATION']));
    expect(ability.can('create', 'Category')).toBe(false);
  });

  it('MODERATION cannot update Category', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['MODERATION']));
    expect(ability.can('update', 'Category')).toBe(false);
  });

  it('MODERATION cannot delete Category', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['MODERATION']));
    expect(ability.can('delete', 'Category')).toBe(false);
  });

  it('SUPPORT cannot read Category', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['SUPPORT']));
    expect(ability.can('read', 'Category')).toBe(false);
  });

  it('DEVELOPER cannot read Category', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['DEVELOPER']));
    expect(ability.can('read', 'Category')).toBe(false);
  });

  it('FINANCE cannot read Category', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['FINANCE']));
    expect(ability.can('read', 'Category')).toBe(false);
  });

  it('HELPDESK_AGENT cannot read Category', () => {
    const ability = defineAbilitiesFor(createPlatformStaffSession(['HELPDESK_AGENT']));
    expect(ability.can('read', 'Category')).toBe(false);
  });
});
