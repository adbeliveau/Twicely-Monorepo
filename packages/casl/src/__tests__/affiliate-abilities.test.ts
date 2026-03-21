import { describe, test, expect } from 'vitest';
import { defineAbilitiesFor } from '../ability';
import { sub } from '../check';
import { createSellerSession } from './helpers';

describe('Seller affiliate abilities', () => {
  const session = createSellerSession();
  const ability = defineAbilitiesFor(session);
  const userId = session.userId; // 'seller-123'

  test('can create own Affiliate record (manage includes create)', () => {
    expect(ability.can('create', sub('Affiliate', { userId }))).toBe(true);
  });

  test('can read own Affiliate record', () => {
    expect(ability.can('read', sub('Affiliate', { userId }))).toBe(true);
  });

  test('cannot create Affiliate record for another user', () => {
    expect(ability.can('create', sub('Affiliate', { userId: 'other-user' }))).toBe(false);
  });
});
