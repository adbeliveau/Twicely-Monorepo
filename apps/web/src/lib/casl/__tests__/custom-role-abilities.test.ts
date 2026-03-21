/**
 * Tests for CASL ability factory integration with custom role permissions (A4.1)
 */

import { describe, test, expect } from 'vitest';
import { defineAbilitiesFor } from '../ability';
import type { CaslSession, PlatformRole } from '../types';

function createStaffSession(
  roles: PlatformRole[],
  customRolePermissions?: Array<{ subject: string; action: string }>
): CaslSession {
  return {
    userId: 'staff-user-001',
    email: 'agent@hub.twicely.co',
    isSeller: false,
    sellerId: null,
    sellerStatus: null,
    delegationId: null,
    onBehalfOfSellerId: null,
    onBehalfOfSellerProfileId: null,
    delegatedScopes: [],
    isPlatformStaff: true,
    platformRoles: roles,
    customRolePermissions,
  };
}

describe('Custom role permissions in CASL ability factory', () => {
  test('Staff with no custom roles has baseline system role permissions only', () => {
    const session = createStaffSession(['SUPPORT']);
    const ability = defineAbilitiesFor(session);
    // SUPPORT can read orders per platform-abilities
    expect(ability.can('read', 'Order')).toBe(true);
    // SUPPORT cannot create custom roles (no custom role permissions granted)
    expect(ability.can('create', 'CustomRole')).toBe(false);
  });

  test('Staff with custom role granting read on Order can read orders', () => {
    const session = createStaffSession(
      ['HELPDESK_AGENT'],
      [{ subject: 'Order', action: 'read' }]
    );
    const ability = defineAbilitiesFor(session);
    expect(ability.can('read', 'Order')).toBe(true);
  });

  test('Custom role permissions are additive to system role permissions', () => {
    // MODERATION can read Listing but not read Payout
    // Custom role grants read on Payout
    const session = createStaffSession(
      ['MODERATION'],
      [{ subject: 'Payout', action: 'read' }]
    );
    const ability = defineAbilitiesFor(session);
    expect(ability.can('read', 'Listing')).toBe(true);  // from MODERATION role
    expect(ability.can('read', 'Payout')).toBe(true);   // from custom role
  });

  test('Custom role manage on CustomRole is blocked by hard ceiling', () => {
    const session = createStaffSession(
      ['SUPPORT'],
      [{ subject: 'CustomRole', action: 'manage' }]
    );
    const ability = defineAbilitiesFor(session);
    // Hard ceiling prevents non-admin staff from managing CustomRole
    expect(ability.can('manage', 'CustomRole')).toBe(false);
  });

  test('Custom role manage on StaffUser is blocked by hard ceiling', () => {
    const session = createStaffSession(
      ['SUPPORT'],
      [{ subject: 'StaffUser', action: 'manage' }]
    );
    const ability = defineAbilitiesFor(session);
    // Hard ceiling prevents non-admin staff from managing StaffUser
    expect(ability.can('manage', 'StaffUser')).toBe(false);
  });

  test('Deactivated custom role does not grant permissions', () => {
    // When customRolePermissions is empty (deactivated roles are filtered out at query time),
    // no additional permissions are granted
    const session = createStaffSession(['HELPDESK_AGENT'], []);
    const ability = defineAbilitiesFor(session);
    expect(ability.can('read', 'Payout')).toBe(false);
  });

  test('Revoked custom role assignment does not grant permissions', () => {
    // Revoked assignments are filtered by isNull(revokedAt) at query time,
    // so they never reach customRolePermissions
    const session = createStaffSession(['HELPDESK_AGENT'], undefined);
    const ability = defineAbilitiesFor(session);
    expect(ability.can('delete', 'LedgerEntry')).toBe(false);
  });
});
