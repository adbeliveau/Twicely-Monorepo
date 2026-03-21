import { describe, test, expect } from 'vitest';
import { defineAbilitiesFor } from '../ability';
import { sub } from '../check';
import { guestSession, createBuyerSession, createSellerSession, createStaffSession } from './helpers';

describe('Seller abilities', () => {
  const session = createSellerSession();
  const ability = defineAbilitiesFor(session);

  test('inherits all buyer permissions', () => {
    expect(ability.can('read', 'Listing')).toBe(true);
    expect(ability.can('create', 'Order')).toBe(true);
    expect(ability.can('read', sub('Order', { buyerId: session.userId }))).toBe(true);
  });

  test('can CRUD own listings', () => {
    expect(ability.can('create', sub('Listing', { ownerUserId: session.userId }))).toBe(true);
    expect(ability.can('read', sub('Listing', { ownerUserId: session.userId }))).toBe(true);
    expect(ability.can('update', sub('Listing', { ownerUserId: session.userId }))).toBe(true);
    expect(ability.can('delete', sub('Listing', { ownerUserId: session.userId }))).toBe(true);
  });

  test('cannot CRUD other sellers listings', () => {
    expect(ability.can('create', sub('Listing', { ownerUserId: 'other-user' }))).toBe(false);
    expect(ability.can('update', sub('Listing', { ownerUserId: 'other-user' }))).toBe(false);
    expect(ability.can('delete', sub('Listing', { ownerUserId: 'other-user' }))).toBe(false);
  });

  test('can read/update own orders (seller side)', () => {
    expect(ability.can('read', sub('Order', { sellerId: session.sellerId }))).toBe(true);
    expect(ability.can('update', sub('Order', { sellerId: session.sellerId }))).toBe(true);
  });

  test('can manage own shipments', () => {
    expect(ability.can('create', sub('Shipment', { sellerId: session.sellerId }))).toBe(true);
    expect(ability.can('read', sub('Shipment', { sellerId: session.sellerId }))).toBe(true);
    expect(ability.can('update', sub('Shipment', { sellerId: session.sellerId }))).toBe(true);
  });

  test('can read own payouts', () => {
    expect(ability.can('read', sub('Payout', { userId: session.userId }))).toBe(true);
  });

  test('cannot manage payouts', () => {
    expect(ability.can('manage', sub('Payout', { userId: session.userId }))).toBe(false);
  });

  test('can manage own delegated access', () => {
    expect(ability.can('manage', sub('DelegatedAccess', { sellerId: session.sellerId }))).toBe(true);
  });

  test('can manage own subscriptions', () => {
    expect(ability.can('read', sub('Subscription', { sellerId: session.sellerId }))).toBe(true);
    expect(ability.can('create', sub('Subscription', { sellerId: session.sellerId }))).toBe(true);
    expect(ability.can('update', sub('Subscription', { sellerId: session.sellerId }))).toBe(true);
  });

  test('cannot access platform subjects', () => {
    expect(ability.can('read', 'FeatureFlag')).toBe(false);
    expect(ability.can('read', 'AuditEvent')).toBe(false);
    expect(ability.can('read', 'Setting')).toBe(false);
  });
});

describe('Seller Staff abilities', () => {
  test('with listings.view scope: can read listings, cannot create', () => {
    const session = createStaffSession(['listings.view']);
    const ability = defineAbilitiesFor(session);

    expect(ability.can('read', sub('Listing', { ownerUserId: session.onBehalfOfSellerId }))).toBe(true);
    expect(ability.can('create', sub('Listing', { ownerUserId: session.onBehalfOfSellerId }))).toBe(false);
  });

  test('with listings.manage scope: can CRUD listings', () => {
    const session = createStaffSession(['listings.manage']);
    const ability = defineAbilitiesFor(session);

    expect(ability.can('read', sub('Listing', { ownerUserId: session.onBehalfOfSellerId }))).toBe(true);
    expect(ability.can('create', sub('Listing', { ownerUserId: session.onBehalfOfSellerId }))).toBe(true);
    expect(ability.can('update', sub('Listing', { ownerUserId: session.onBehalfOfSellerId }))).toBe(true);
    expect(ability.can('delete', sub('Listing', { ownerUserId: session.onBehalfOfSellerId }))).toBe(true);
  });

  test('with orders.view scope: can read orders, cannot update', () => {
    const session = createStaffSession(['orders.view']);
    const ability = defineAbilitiesFor(session);

    expect(ability.can('read', sub('Order', { sellerId: session.onBehalfOfSellerId }))).toBe(true);
    expect(ability.can('update', sub('Order', { sellerId: session.onBehalfOfSellerId }))).toBe(false);
  });

  test('with orders.manage scope: can read and update orders', () => {
    const session = createStaffSession(['orders.manage']);
    const ability = defineAbilitiesFor(session);

    expect(ability.can('read', sub('Order', { sellerId: session.onBehalfOfSellerId }))).toBe(true);
    expect(ability.can('update', sub('Order', { sellerId: session.onBehalfOfSellerId }))).toBe(true);
  });

  test('with finance.view scope: can read payouts and ledger for delegating seller', () => {
    const session = createStaffSession(['finance.view']);
    const ability = defineAbilitiesFor(session);

    // Can read delegating seller's payouts and ledger (tables use userId, not sellerId)
    expect(ability.can('read', sub('Payout', { userId: session.onBehalfOfSellerId }))).toBe(true);
    expect(ability.can('read', sub('LedgerEntry', { userId: session.onBehalfOfSellerId }))).toBe(true);

    // Cannot read other sellers' payouts
    expect(ability.can('read', sub('Payout', { userId: 'other-seller' }))).toBe(false);
    expect(ability.can('read', sub('LedgerEntry', { userId: 'other-seller' }))).toBe(false);
  });

  test('CANNOT manage subscriptions regardless of scopes', () => {
    const session = createStaffSession([
      'listings.manage',
      'orders.manage',
      'finance.view',
      'settings.manage',
    ]);
    const ability = defineAbilitiesFor(session);

    expect(ability.can('manage', 'Subscription')).toBe(false);
    expect(ability.can('create', 'Subscription')).toBe(false);
    expect(ability.can('update', 'Subscription')).toBe(false);
    expect(ability.can('delete', 'Subscription')).toBe(false);
  });

  test('CANNOT manage payouts regardless of scopes', () => {
    const session = createStaffSession(['finance.view']);
    const ability = defineAbilitiesFor(session);

    expect(ability.can('manage', 'Payout')).toBe(false);
    expect(ability.can('create', 'Payout')).toBe(false);
    expect(ability.can('update', 'Payout')).toBe(false);
    expect(ability.can('delete', 'Payout')).toBe(false);
  });

  test('CANNOT update user account regardless of scopes', () => {
    const session = createStaffSession(['settings.manage', 'staff.manage']);
    const ability = defineAbilitiesFor(session);

    // Cannot update the seller owner's user account
    expect(ability.can('update', sub('User', { id: session.onBehalfOfSellerId }))).toBe(false);
  });

  test('CANNOT delete seller profile regardless of scopes', () => {
    const session = createStaffSession(['settings.manage']);
    const ability = defineAbilitiesFor(session);

    expect(ability.can('delete', 'SellerProfile')).toBe(false);
    expect(ability.can('delete', sub('SellerProfile', { id: session.onBehalfOfSellerId }))).toBe(false);
  });

  test('can manage delegating sellers listings but not others', () => {
    const session = createStaffSession(['listings.manage']);
    const ability = defineAbilitiesFor(session);

    // Can manage delegating seller's listings
    expect(ability.can('update', sub('Listing', { ownerUserId: session.onBehalfOfSellerId }))).toBe(true);
    expect(ability.can('delete', sub('Listing', { ownerUserId: session.onBehalfOfSellerId }))).toBe(true);

    // Cannot manage other sellers' listings
    expect(ability.can('update', sub('Listing', { ownerUserId: 'other-seller' }))).toBe(false);
    expect(ability.can('delete', sub('Listing', { ownerUserId: 'other-seller' }))).toBe(false);

    // Note: staff can still READ any public listing due to guest abilities
    expect(ability.can('read', sub('Listing', { ownerUserId: 'other-seller' }))).toBe(true);
  });

  test('with empty scopes: cannot manage seller resources', () => {
    const session = createStaffSession([]);
    const ability = defineAbilitiesFor(session);

    // Cannot manage delegating seller's resources without scopes
    expect(ability.can('update', sub('Listing', { ownerUserId: session.onBehalfOfSellerId }))).toBe(false);
    expect(ability.can('update', sub('Order', { sellerId: session.onBehalfOfSellerId }))).toBe(false);
    expect(ability.can('read', sub('Payout', { userId: session.onBehalfOfSellerId }))).toBe(false);

    // But can still read public listings (guest ability)
    expect(ability.can('read', 'Listing')).toBe(true);
  });

  test('retains personal buyer permissions', () => {
    const session = createStaffSession([]);
    const ability = defineAbilitiesFor(session);

    // Staff can still do buyer things on their own account
    expect(ability.can('read', sub('Order', { buyerId: session.userId }))).toBe(true);
    expect(ability.can('create', 'Order')).toBe(true);
    expect(ability.can('read', 'Review')).toBe(true);
    expect(ability.can('manage', sub('Notification', { userId: session.userId }))).toBe(true);
  });
});

describe('Default deny', () => {
  test('guest cannot access unspecified subjects', () => {
    const ability = defineAbilitiesFor(guestSession);

    expect(ability.can('read', 'HealthCheck')).toBe(false);
    expect(ability.can('read', 'Analytics')).toBe(false);
  });

  test('buyer cannot access FeatureFlag', () => {
    const session = createBuyerSession();
    const ability = defineAbilitiesFor(session);

    expect(ability.can('read', 'FeatureFlag')).toBe(false);
    expect(ability.can('manage', 'FeatureFlag')).toBe(false);
  });

  test('seller cannot access Setting', () => {
    const session = createSellerSession();
    const ability = defineAbilitiesFor(session);

    expect(ability.can('read', 'Setting')).toBe(false);
    expect(ability.can('manage', 'Setting')).toBe(false);
  });

  test('actions not explicitly granted are denied', () => {
    const session = createBuyerSession();
    const ability = defineAbilitiesFor(session);

    // Buyer was not granted 'delete' on Order
    expect(ability.can('delete', sub('Order', { buyerId: session.userId }))).toBe(false);
  });
});
