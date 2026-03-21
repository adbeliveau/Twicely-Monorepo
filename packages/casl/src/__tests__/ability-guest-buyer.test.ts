import { describe, test, expect } from 'vitest';
import { defineAbilitiesFor } from '../ability';
import { sub } from '../check';
import { guestSession, createBuyerSession } from './helpers';

describe('Guest abilities', () => {
  const ability = defineAbilitiesFor(guestSession);

  test('can read listings', () => {
    expect(ability.can('read', 'Listing')).toBe(true);
  });

  test('can read categories', () => {
    expect(ability.can('read', 'Category')).toBe(true);
  });

  test('can read reviews', () => {
    expect(ability.can('read', 'Review')).toBe(true);
  });

  test('can read seller profiles', () => {
    expect(ability.can('read', 'SellerProfile')).toBe(true);
  });

  test('can read policies', () => {
    expect(ability.can('read', 'Policy')).toBe(true);
  });

  test('can manage cart (session-based)', () => {
    expect(ability.can('read', 'Cart')).toBe(true);
    expect(ability.can('create', 'Cart')).toBe(true);
    expect(ability.can('update', 'Cart')).toBe(true);
    expect(ability.can('delete', 'Cart')).toBe(true);
  });

  test('cannot create listings', () => {
    expect(ability.can('create', 'Listing')).toBe(false);
  });

  test('cannot read orders', () => {
    expect(ability.can('read', 'Order')).toBe(false);
  });

  test('cannot access any manage action on protected resources', () => {
    expect(ability.can('manage', 'Order')).toBe(false);
    expect(ability.can('manage', 'Listing')).toBe(false);
    expect(ability.can('manage', 'User')).toBe(false);
  });
});

describe('Buyer abilities', () => {
  const session = createBuyerSession();
  const ability = defineAbilitiesFor(session);

  test('inherits guest read permissions', () => {
    expect(ability.can('read', 'Listing')).toBe(true);
    expect(ability.can('read', 'Category')).toBe(true);
    expect(ability.can('read', 'Review')).toBe(true);
  });

  test('can manage own cart', () => {
    expect(ability.can('manage', sub('Cart', { userId: session.userId }))).toBe(true);
  });

  test('cannot manage other users cart', () => {
    expect(ability.can('manage', sub('Cart', { userId: 'other-user' }))).toBe(false);
  });

  test('can create orders', () => {
    expect(ability.can('create', 'Order')).toBe(true);
  });

  test('can read own orders', () => {
    expect(ability.can('read', sub('Order', { buyerId: session.userId }))).toBe(true);
  });

  test('cannot read other users orders', () => {
    expect(ability.can('read', sub('Order', { buyerId: 'other-user' }))).toBe(false);
  });

  test('can create returns on own orders', () => {
    expect(ability.can('create', sub('Return', { buyerId: session.userId }))).toBe(true);
  });

  test('can create reviews', () => {
    expect(ability.can('create', sub('Review', { buyerId: session.userId }))).toBe(true);
  });

  test('can manage own notifications', () => {
    expect(ability.can('manage', sub('Notification', { userId: session.userId }))).toBe(true);
  });

  test('cannot create listings', () => {
    expect(ability.can('create', 'Listing')).toBe(false);
  });

  test('cannot access seller subjects', () => {
    expect(ability.can('read', 'Payout')).toBe(false);
    expect(ability.can('manage', 'DelegatedAccess')).toBe(false);
  });

  test('cannot access platform subjects', () => {
    expect(ability.can('read', 'FeatureFlag')).toBe(false);
    expect(ability.can('read', 'AuditEvent')).toBe(false);
    expect(ability.can('read', 'Setting')).toBe(false);
  });
});
