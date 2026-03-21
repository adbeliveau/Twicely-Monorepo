import { describe, test, expect } from 'vitest';
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

// ─── HELPDESK_AGENT ───────────────────────────────────────────────────────────

describe('HELPDESK_AGENT abilities', () => {
  const session = createPlatformStaffSession(['HELPDESK_AGENT']);
  const ability = defineAbilitiesFor(session);

  test('can manage HelpdeskCase', () => {
    expect(ability.can('manage', 'HelpdeskCase')).toBe(true);
  });

  test('can read User, Order, Listing', () => {
    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('read', 'Order')).toBe(true);
    expect(ability.can('read', 'Listing')).toBe(true);
  });

  test('can read KbArticle and KbCategory', () => {
    expect(ability.can('read', 'KbArticle')).toBe(true);
    expect(ability.can('read', 'KbCategory')).toBe(true);
  });

  test('can read HelpdeskTeam, HelpdeskMacro, HelpdeskSavedView', () => {
    expect(ability.can('read', 'HelpdeskTeam')).toBe(true);
    expect(ability.can('read', 'HelpdeskMacro')).toBe(true);
    expect(ability.can('read', 'HelpdeskSavedView')).toBe(true);
  });

  test('can manage CaseCsat (CSAT responses)', () => {
    expect(ability.can('manage', 'CaseCsat')).toBe(true);
  });

  test('cannot manage HelpdeskMacro (read only, not manage)', () => {
    expect(ability.can('manage', 'HelpdeskMacro')).toBe(false);
  });

  test('cannot manage KbArticle (requires LEAD+)', () => {
    expect(ability.can('manage', 'KbArticle')).toBe(false);
  });

  test('cannot manage HelpdeskTeam (requires MANAGER)', () => {
    expect(ability.can('manage', 'HelpdeskTeam')).toBe(false);
  });

  test('cannot manage HelpdeskRoutingRule (requires MANAGER)', () => {
    expect(ability.can('manage', 'HelpdeskRoutingRule')).toBe(false);
  });

  test('cannot manage HelpdeskSlaPolicy (requires MANAGER)', () => {
    expect(ability.can('manage', 'HelpdeskSlaPolicy')).toBe(false);
  });

  test('cannot manage HelpdeskAutomationRule (requires MANAGER)', () => {
    expect(ability.can('manage', 'HelpdeskAutomationRule')).toBe(false);
  });
});

// ─── HELPDESK_LEAD ────────────────────────────────────────────────────────────

describe('HELPDESK_LEAD abilities', () => {
  const session = createPlatformStaffSession(['HELPDESK_LEAD']);
  const ability = defineAbilitiesFor(session);

  test('can manage HelpdeskCase (inherits from isHelpdeskRole)', () => {
    expect(ability.can('manage', 'HelpdeskCase')).toBe(true);
  });

  test('can manage HelpdeskMacro', () => {
    expect(ability.can('manage', 'HelpdeskMacro')).toBe(true);
  });

  test('can manage KbArticle', () => {
    expect(ability.can('manage', 'KbArticle')).toBe(true);
  });

  test('can manage KbCategory', () => {
    expect(ability.can('manage', 'KbCategory')).toBe(true);
  });

  test('still cannot manage HelpdeskTeam (requires MANAGER)', () => {
    expect(ability.can('manage', 'HelpdeskTeam')).toBe(false);
  });

  test('still cannot manage HelpdeskRoutingRule (requires MANAGER)', () => {
    expect(ability.can('manage', 'HelpdeskRoutingRule')).toBe(false);
  });

  test('still cannot manage HelpdeskSlaPolicy (requires MANAGER)', () => {
    expect(ability.can('manage', 'HelpdeskSlaPolicy')).toBe(false);
  });

  test('still cannot manage HelpdeskAutomationRule (requires MANAGER)', () => {
    expect(ability.can('manage', 'HelpdeskAutomationRule')).toBe(false);
  });
});

// ─── HELPDESK_MANAGER ─────────────────────────────────────────────────────────

describe('HELPDESK_MANAGER abilities', () => {
  const session = createPlatformStaffSession(['HELPDESK_MANAGER']);
  const ability = defineAbilitiesFor(session);

  test('can manage HelpdeskCase', () => {
    expect(ability.can('manage', 'HelpdeskCase')).toBe(true);
  });

  test('can manage HelpdeskMacro (inherits from LEAD)', () => {
    expect(ability.can('manage', 'HelpdeskMacro')).toBe(true);
  });

  test('can manage KbArticle (inherits from LEAD)', () => {
    expect(ability.can('manage', 'KbArticle')).toBe(true);
  });

  test('can manage HelpdeskTeam', () => {
    expect(ability.can('manage', 'HelpdeskTeam')).toBe(true);
  });

  test('can manage HelpdeskRoutingRule', () => {
    expect(ability.can('manage', 'HelpdeskRoutingRule')).toBe(true);
  });

  test('can manage HelpdeskSlaPolicy', () => {
    expect(ability.can('manage', 'HelpdeskSlaPolicy')).toBe(true);
  });

  test('can manage HelpdeskAutomationRule', () => {
    expect(ability.can('manage', 'HelpdeskAutomationRule')).toBe(true);
  });

  test('can manage HelpdeskEmailConfig', () => {
    expect(ability.can('manage', 'HelpdeskEmailConfig')).toBe(true);
  });

  test('can manage HelpdeskSavedView', () => {
    expect(ability.can('manage', 'HelpdeskSavedView')).toBe(true);
  });
});

// ─── Regular user (not staff) ─────────────────────────────────────────────────

describe('Regular user cannot manage helpdesk subjects', () => {
  const regularSession: CaslSession = {
    userId: 'user-regular-001',
    email: 'user@test.com',
    isSeller: false,
    sellerId: null,
    sellerStatus: null,
    delegationId: null,
    onBehalfOfSellerId: null,
    onBehalfOfSellerProfileId: null,
    delegatedScopes: [],
    isPlatformStaff: false,
    platformRoles: [],
  };
  const ability = defineAbilitiesFor(regularSession);

  test('cannot manage HelpdeskCase', () => {
    expect(ability.can('manage', 'HelpdeskCase')).toBe(false);
  });

  test('cannot manage KbArticle', () => {
    expect(ability.can('manage', 'KbArticle')).toBe(false);
  });

  test('cannot manage HelpdeskTeam', () => {
    expect(ability.can('manage', 'HelpdeskTeam')).toBe(false);
  });
});
