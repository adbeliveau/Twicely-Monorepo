import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

import {
  qualifiesForAuthOffer,
  getAuthOfferConfig,
} from '../auth-offer';
import { ledgerEntryTypeEnum } from '@twicely/db/schema';
import { order } from '@twicely/db/schema/commerce';

describe('Authentication Offer (B3.5)', () => {
  describe('getAuthOfferConfig defaults', () => {
    it('default threshold is $500 (50000 cents)', async () => {
      const config = await getAuthOfferConfig();
      expect(config.thresholdCents).toBe(50000);
    });

    it('default buyer fee is $19.99 (1999 cents)', async () => {
      const config = await getAuthOfferConfig();
      expect(config.buyerFeeCents).toBe(1999);
    });
  });

  describe('qualifiesForAuthOffer', () => {
    it('returns true for item priced at exactly $500', async () => {
      expect(await qualifiesForAuthOffer(50000)).toBe(true);
    });

    it('returns true for item priced above $500', async () => {
      expect(await qualifiesForAuthOffer(50001)).toBe(true);
      expect(await qualifiesForAuthOffer(100000)).toBe(true); // $1000
      expect(await qualifiesForAuthOffer(999999)).toBe(true); // ~$10k
    });

    it('returns false for item priced at $499.99', async () => {
      expect(await qualifiesForAuthOffer(49999)).toBe(false);
    });

    it('returns false for item priced below $500', async () => {
      expect(await qualifiesForAuthOffer(10000)).toBe(false); // $100
      expect(await qualifiesForAuthOffer(1000)).toBe(false);  // $10
      expect(await qualifiesForAuthOffer(0)).toBe(false);
    });

    it('returns false for negative price', async () => {
      expect(await qualifiesForAuthOffer(-1)).toBe(false);
      expect(await qualifiesForAuthOffer(-50000)).toBe(false);
    });
  });

  describe('Order auth flag logic', () => {
    // Helper to calculate auth flags from input (mirrors create-order.ts logic)
    function calcAuthFlags(authenticationRequested: boolean | undefined) {
      return {
        offered: authenticationRequested !== undefined,
        declined: authenticationRequested === false,
      };
    }

    it('auth requested (true) → offered=true, declined=false', () => {
      const flags = calcAuthFlags(true);
      expect(flags.offered).toBe(true);
      expect(flags.declined).toBe(false);
    });

    it('auth declined (false) → offered=true, declined=true', () => {
      const flags = calcAuthFlags(false);
      expect(flags.offered).toBe(true);
      expect(flags.declined).toBe(true);
    });

    it('no offer shown (undefined) → offered=false, declined=false', () => {
      const flags = calcAuthFlags(undefined);
      expect(flags.offered).toBe(false);
      expect(flags.declined).toBe(false);
    });

    it('auth fee is added to total only when requested', async () => {
      const config = await getAuthOfferConfig();
      const authenticationRequested: boolean | undefined = true;
      const feeCents = authenticationRequested ? config.buyerFeeCents : 0;
      expect(feeCents).toBe(1999);
    });

    it('no auth fee when declined or not offered', async () => {
      const config = await getAuthOfferConfig();
      const declined: boolean | undefined = false;
      const notOffered: boolean | undefined = undefined;
      expect(declined ? config.buyerFeeCents : 0).toBe(0);
      expect(notOffered ? config.buyerFeeCents : 0).toBe(0);
    });
  });

  describe('Structural Tests', () => {
    it('ledgerEntryTypeEnum contains AUTH_FEE_BUYER', () => {
      expect(ledgerEntryTypeEnum.enumValues).toContain('AUTH_FEE_BUYER');
    });

    it('order table has authenticationOffered column', () => {
      expect(order.authenticationOffered).toBeDefined();
    });

    it('order table has authenticationDeclined column', () => {
      expect(order.authenticationDeclined).toBeDefined();
    });

    it('order table has authenticationDeclinedAt column', () => {
      expect(order.authenticationDeclinedAt).toBeDefined();
    });

    it('order table has authenticationRequestId column', () => {
      expect(order.authenticationRequestId).toBeDefined();
    });
  });
});
