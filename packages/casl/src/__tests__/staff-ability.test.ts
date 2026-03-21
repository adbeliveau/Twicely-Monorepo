import { describe, test, expect } from 'vitest';
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

describe('Platform Admin abilities (ADMIN, SUPER_ADMIN)', () => {
  const session = createPlatformStaffSession(['ADMIN']);
  const ability = defineAbilitiesFor(session);

  test('ADMIN can manage all subjects except immutable ones', () => {
    expect(ability.can('manage', 'User')).toBe(true);
    expect(ability.can('manage', 'Order')).toBe(true);
    expect(ability.can('manage', 'Listing')).toBe(true);
    expect(ability.can('manage', 'Setting')).toBe(true);
  });

  test('ADMIN cannot delete LedgerEntry', () => {
    expect(ability.can('delete', 'LedgerEntry')).toBe(false);
  });

  test('ADMIN cannot delete AuditEvent', () => {
    expect(ability.can('delete', 'AuditEvent')).toBe(false);
  });

  test('ADMIN cannot update LedgerEntry', () => {
    expect(ability.can('update', 'LedgerEntry')).toBe(false);
  });

  test('SUPER_ADMIN has same restrictions as ADMIN', () => {
    const superAdminSession = createPlatformStaffSession(['SUPER_ADMIN']);
    const superAbility = defineAbilitiesFor(superAdminSession);
    expect(superAbility.can('delete', 'LedgerEntry')).toBe(false);
    expect(superAbility.can('delete', 'AuditEvent')).toBe(false);
    expect(superAbility.can('update', 'LedgerEntry')).toBe(false);
  });
});

describe('SUPPORT role abilities', () => {
  const session = createPlatformStaffSession(['SUPPORT']);
  const ability = defineAbilitiesFor(session);

  test('SUPPORT can read User, Order, Listing, Return, Dispute, Payout', () => {
    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('read', 'Order')).toBe(true);
    expect(ability.can('read', 'Listing')).toBe(true);
    expect(ability.can('read', 'Return')).toBe(true);
    expect(ability.can('read', 'Dispute')).toBe(true);
    expect(ability.can('read', 'Payout')).toBe(true);
  });

  test('SUPPORT can create Return (guided refund)', () => {
    expect(ability.can('create', 'Return')).toBe(true);
  });

  test('SUPPORT cannot update Listing', () => {
    expect(ability.can('update', 'Listing')).toBe(false);
  });

  test('SUPPORT can read AuditEvent', () => {
    expect(ability.can('read', 'AuditEvent')).toBe(true);
  });
});

describe('MODERATION role abilities', () => {
  const session = createPlatformStaffSession(['MODERATION']);
  const ability = defineAbilitiesFor(session);

  test('MODERATION can read and update Listing', () => {
    expect(ability.can('read', 'Listing')).toBe(true);
    expect(ability.can('update', 'Listing')).toBe(true);
  });

  test('MODERATION can update Review', () => {
    expect(ability.can('update', 'Review')).toBe(true);
  });

  test('MODERATION cannot read Payout', () => {
    expect(ability.can('read', 'Payout')).toBe(false);
  });

  test('MODERATION can update SellerProfile', () => {
    expect(ability.can('update', 'SellerProfile')).toBe(true);
  });
});

describe('FINANCE role abilities', () => {
  const session = createPlatformStaffSession(['FINANCE']);
  const ability = defineAbilitiesFor(session);

  test('FINANCE can read LedgerEntry and Payout', () => {
    expect(ability.can('read', 'LedgerEntry')).toBe(true);
    expect(ability.can('read', 'Payout')).toBe(true);
  });

  test('FINANCE can update Payout (hold)', () => {
    expect(ability.can('update', 'Payout')).toBe(true);
  });

  test('FINANCE cannot update Listing', () => {
    expect(ability.can('update', 'Listing')).toBe(false);
  });

  test('FINANCE can read Order and User', () => {
    expect(ability.can('read', 'Order')).toBe(true);
    expect(ability.can('read', 'User')).toBe(true);
  });
});

describe('DEVELOPER role abilities', () => {
  const session = createPlatformStaffSession(['DEVELOPER']);
  const ability = defineAbilitiesFor(session);

  test('DEVELOPER can read and update FeatureFlag', () => {
    expect(ability.can('read', 'FeatureFlag')).toBe(true);
    expect(ability.can('update', 'FeatureFlag')).toBe(true);
  });

  test('DEVELOPER cannot read Payout', () => {
    expect(ability.can('read', 'Payout')).toBe(false);
  });

  test('DEVELOPER can read HealthCheck', () => {
    expect(ability.can('read', 'HealthCheck')).toBe(true);
  });
});

describe('SRE role abilities', () => {
  const session = createPlatformStaffSession(['SRE']);
  const ability = defineAbilitiesFor(session);

  test('SRE can read and manage HealthCheck', () => {
    expect(ability.can('read', 'HealthCheck')).toBe(true);
    expect(ability.can('manage', 'HealthCheck')).toBe(true);
  });

  test('SRE cannot read Payout', () => {
    expect(ability.can('read', 'Payout')).toBe(false);
  });

  test('SRE can read AuditEvent', () => {
    expect(ability.can('read', 'AuditEvent')).toBe(true);
  });
});

describe('HELPDESK_AGENT role abilities', () => {
  const session = createPlatformStaffSession(['HELPDESK_AGENT']);
  const ability = defineAbilitiesFor(session);

  test('HELPDESK_AGENT can manage HelpdeskCase', () => {
    expect(ability.can('manage', 'HelpdeskCase')).toBe(true);
  });

  test('HELPDESK_AGENT can read User, Order, Listing, Return, Dispute', () => {
    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('read', 'Order')).toBe(true);
    expect(ability.can('read', 'Listing')).toBe(true);
    expect(ability.can('read', 'Return')).toBe(true);
    expect(ability.can('read', 'Dispute')).toBe(true);
  });
});

describe('Staff with no roles', () => {
  const session = createPlatformStaffSession([]);
  const ability = defineAbilitiesFor(session);

  test('staff with no roles has no permissions', () => {
    expect(ability.can('read', 'User')).toBe(false);
    expect(ability.can('read', 'Order')).toBe(false);
    expect(ability.can('read', 'Listing')).toBe(false);
    expect(ability.can('manage', 'all')).toBe(false);
  });
});

describe('Admin subsumes agent roles', () => {
  test('staff with ADMIN + MODERATION gets manage all (ADMIN subsumes)', () => {
    const session = createPlatformStaffSession(['ADMIN', 'MODERATION']);
    const ability = defineAbilitiesFor(session);
    expect(ability.can('manage', 'User')).toBe(true);
    expect(ability.can('manage', 'Order')).toBe(true);
    expect(ability.can('delete', 'LedgerEntry')).toBe(false);
  });
});
