/**
 * Tests for crosslister CASL abilities — seller rules and staff delegation scopes.
 * Source: ability.ts (defineSellerAbilities), staff-abilities.ts (crosslister.* scopes)
 */

import { describe, test, expect } from 'vitest';
import { defineAbilitiesFor } from '../ability';
import { sub } from '../check';
import {
  guestSession,
  createBuyerSession,
  createSellerSession,
  createStaffSession,
} from './helpers';

// ─── Seller crosslister abilities ────────────────────────────────────────────

describe('Seller crosslister abilities', () => {
  const session = createSellerSession();
  const ability = defineAbilitiesFor(session);
  const userId = session.userId; // 'seller-123'

  test('can manage own CrosslisterAccount', () => {
    expect(ability.can('create', sub('CrosslisterAccount', { sellerId: userId }))).toBe(true);
    expect(ability.can('read', sub('CrosslisterAccount', { sellerId: userId }))).toBe(true);
    expect(ability.can('update', sub('CrosslisterAccount', { sellerId: userId }))).toBe(true);
    expect(ability.can('delete', sub('CrosslisterAccount', { sellerId: userId }))).toBe(true);
  });

  test('cannot access another sellers CrosslisterAccount', () => {
    expect(ability.can('read', sub('CrosslisterAccount', { sellerId: 'other-user' }))).toBe(false);
    expect(ability.can('delete', sub('CrosslisterAccount', { sellerId: 'other-user' }))).toBe(false);
  });

  test('can manage own ChannelProjection', () => {
    expect(ability.can('create', sub('ChannelProjection', { sellerId: userId }))).toBe(true);
    expect(ability.can('read', sub('ChannelProjection', { sellerId: userId }))).toBe(true);
    expect(ability.can('update', sub('ChannelProjection', { sellerId: userId }))).toBe(true);
    expect(ability.can('delete', sub('ChannelProjection', { sellerId: userId }))).toBe(true);
  });

  test('cannot access another sellers ChannelProjection', () => {
    expect(ability.can('read', sub('ChannelProjection', { sellerId: 'other-user' }))).toBe(false);
  });

  test('can create and read own ImportBatch', () => {
    expect(ability.can('create', sub('ImportBatch', { sellerId: userId }))).toBe(true);
    expect(ability.can('read', sub('ImportBatch', { sellerId: userId }))).toBe(true);
  });

  test('cannot update or delete ImportBatch', () => {
    expect(ability.can('update', sub('ImportBatch', { sellerId: userId }))).toBe(false);
    expect(ability.can('delete', sub('ImportBatch', { sellerId: userId }))).toBe(false);
  });

  test('can read and delete own CrossJob', () => {
    expect(ability.can('read', sub('CrossJob', { sellerId: userId }))).toBe(true);
    expect(ability.can('delete', sub('CrossJob', { sellerId: userId }))).toBe(true);
  });

  test('cannot create CrossJob directly', () => {
    expect(ability.can('create', sub('CrossJob', { sellerId: userId }))).toBe(false);
  });

  test('can manage own AutomationSetting', () => {
    expect(ability.can('read', sub('AutomationSetting', { sellerId: userId }))).toBe(true);
    expect(ability.can('update', sub('AutomationSetting', { sellerId: userId }))).toBe(true);
  });

  test('cannot access another sellers AutomationSetting', () => {
    expect(ability.can('read', sub('AutomationSetting', { sellerId: 'other-user' }))).toBe(false);
    expect(ability.can('update', sub('AutomationSetting', { sellerId: 'other-user' }))).toBe(false);
  });
});

// ─── Guest / buyer cannot access crosslister subjects ─────────────────────

describe('Guest and buyer crosslister access', () => {
  test('guest cannot read any crosslister subject', () => {
    const ability = defineAbilitiesFor(guestSession);
    expect(ability.can('read', 'CrosslisterAccount')).toBe(false);
    expect(ability.can('read', 'ChannelProjection')).toBe(false);
    expect(ability.can('read', 'CrossJob')).toBe(false);
    expect(ability.can('read', 'ImportBatch')).toBe(false);
    expect(ability.can('read', 'AutomationSetting')).toBe(false);
  });

  test('buyer cannot read or create any crosslister subject', () => {
    const session = createBuyerSession();
    const ability = defineAbilitiesFor(session);
    expect(ability.can('read', sub('CrosslisterAccount', { sellerId: session.userId }))).toBe(false);
    expect(ability.can('create', sub('ImportBatch', { sellerId: session.userId }))).toBe(false);
    expect(ability.can('read', sub('AutomationSetting', { sellerId: session.userId }))).toBe(false);
  });
});

// ─── Staff delegation: crosslister scopes ────────────────────────────────────

describe('Staff delegation: crosslister.read scope', () => {
  const session = createStaffSession(['crosslister.read']);
  const ability = defineAbilitiesFor(session);
  const sellerId = session.onBehalfOfSellerId!; // 'seller-user-456'

  test('can read CrosslisterAccount for delegating seller', () => {
    expect(ability.can('read', sub('CrosslisterAccount', { sellerId }))).toBe(true);
  });

  test('can read ChannelProjection, CrossJob, ImportBatch, AutomationSetting', () => {
    expect(ability.can('read', sub('ChannelProjection', { sellerId }))).toBe(true);
    expect(ability.can('read', sub('CrossJob', { sellerId }))).toBe(true);
    expect(ability.can('read', sub('ImportBatch', { sellerId }))).toBe(true);
    expect(ability.can('read', sub('AutomationSetting', { sellerId }))).toBe(true);
  });

  test('cannot create or manage resources with only crosslister.read', () => {
    expect(ability.can('create', sub('ChannelProjection', { sellerId }))).toBe(false);
    expect(ability.can('create', sub('ImportBatch', { sellerId }))).toBe(false);
    expect(ability.can('update', sub('AutomationSetting', { sellerId }))).toBe(false);
  });

  test('cannot access another sellers crosslister data', () => {
    expect(ability.can('read', sub('CrosslisterAccount', { sellerId: 'other-seller' }))).toBe(false);
  });
});

describe('Staff delegation: crosslister.publish scope', () => {
  const session = createStaffSession(['crosslister.publish']);
  const ability = defineAbilitiesFor(session);
  const sellerId = session.onBehalfOfSellerId!;

  test('can create ChannelProjection for delegating seller', () => {
    expect(ability.can('create', sub('ChannelProjection', { sellerId }))).toBe(true);
    expect(ability.can('read', sub('ChannelProjection', { sellerId }))).toBe(true);
  });

  test('can read CrosslisterAccount and CrossJob', () => {
    expect(ability.can('read', sub('CrosslisterAccount', { sellerId }))).toBe(true);
    expect(ability.can('read', sub('CrossJob', { sellerId }))).toBe(true);
  });

  test('cannot create ImportBatch with only crosslister.publish', () => {
    expect(ability.can('create', sub('ImportBatch', { sellerId }))).toBe(false);
  });
});

describe('Staff delegation: crosslister.import scope', () => {
  const session = createStaffSession(['crosslister.import']);
  const ability = defineAbilitiesFor(session);
  const sellerId = session.onBehalfOfSellerId!;

  test('can create and read ImportBatch', () => {
    expect(ability.can('create', sub('ImportBatch', { sellerId }))).toBe(true);
    expect(ability.can('read', sub('ImportBatch', { sellerId }))).toBe(true);
  });

  test('can read CrosslisterAccount and CrossJob', () => {
    expect(ability.can('read', sub('CrosslisterAccount', { sellerId }))).toBe(true);
    expect(ability.can('read', sub('CrossJob', { sellerId }))).toBe(true);
  });

  test('cannot create ChannelProjection with only crosslister.import', () => {
    expect(ability.can('create', sub('ChannelProjection', { sellerId }))).toBe(false);
  });
});

describe('Staff delegation: crosslister.manage scope', () => {
  const session = createStaffSession(['crosslister.manage']);
  const ability = defineAbilitiesFor(session);
  const sellerId = session.onBehalfOfSellerId!;

  test('can manage all crosslister subjects for delegating seller', () => {
    expect(ability.can('create', sub('CrosslisterAccount', { sellerId }))).toBe(true);
    expect(ability.can('delete', sub('CrosslisterAccount', { sellerId }))).toBe(true);
    expect(ability.can('create', sub('ChannelProjection', { sellerId }))).toBe(true);
    expect(ability.can('delete', sub('ChannelProjection', { sellerId }))).toBe(true);
    expect(ability.can('create', sub('CrossJob', { sellerId }))).toBe(true);
    expect(ability.can('create', sub('ImportBatch', { sellerId }))).toBe(true);
    expect(ability.can('update', sub('AutomationSetting', { sellerId }))).toBe(true);
  });

  test('cannot manage crosslister subjects for other sellers', () => {
    expect(ability.can('create', sub('CrosslisterAccount', { sellerId: 'other-seller' }))).toBe(false);
    expect(ability.can('manage', sub('AutomationSetting', { sellerId: 'other-seller' }))).toBe(false);
  });
});
