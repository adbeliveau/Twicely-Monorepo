/**
 * Seed affiliate data: 2 affiliates, 3 promo codes, 5 referrals, 3 commissions, 1 payout.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  affiliate,
  promoCode,
  referral,
  affiliateCommission,
  affiliatePayout,
} from '@twicely/db/schema';
import { USER_IDS } from './seed-users';

const AFF_IDS = {
  seller1: 'seed-aff-001',
  seller2: 'seed-aff-002',
};

const PROMO_IDS = {
  seller1Code: 'seed-pc-001',
  seller2Code: 'seed-pc-002',
  platformWelcome: 'seed-pc-003',
};

const REF_IDS = {
  ref1: 'seed-ref-001',
  ref2: 'seed-ref-002',
  ref3: 'seed-ref-003',
  ref4: 'seed-ref-004',
  ref5: 'seed-ref-005',
};

const COMMISSION_IDS = {
  c1: 'seed-acom-001',
  c2: 'seed-acom-002',
  c3: 'seed-acom-003',
};

const PAYOUT_IDS = {
  p1: 'seed-apay-001',
};

export async function seedAffiliates(db: PostgresJsDatabase): Promise<void> {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // 1. Affiliates
  await db.insert(affiliate).values([
    {
      id: AFF_IDS.seller1,
      userId: USER_IDS.seller1,
      tier: 'COMMUNITY',
      status: 'ACTIVE',
      referralCode: 'SELLER1REF',
      commissionRateBps: 1500,
      cookieDurationDays: 30,
      commissionDurationMonths: 12,
      pendingBalanceCents: 2500,
      availableBalanceCents: 7500,
      totalEarnedCents: 15000,
      totalPaidCents: 5000,
    },
    {
      id: AFF_IDS.seller2,
      userId: USER_IDS.seller2,
      tier: 'COMMUNITY',
      status: 'ACTIVE',
      referralCode: 'SELLER2REF',
      commissionRateBps: 1500,
      cookieDurationDays: 30,
      commissionDurationMonths: 12,
      pendingBalanceCents: 0,
      availableBalanceCents: 0,
      totalEarnedCents: 0,
      totalPaidCents: 0,
    },
  ]).onConflictDoNothing();

  // 2. Promo codes
  await db.insert(promoCode).values([
    {
      id: PROMO_IDS.seller1Code,
      code: 'SELLER1REF',
      type: 'AFFILIATE',
      affiliateId: AFF_IDS.seller1,
      discountType: 'PERCENTAGE',
      discountValue: 1000,
      durationMonths: 1,
      isActive: true,
      createdByUserId: USER_IDS.seller1,
    },
    {
      id: PROMO_IDS.seller2Code,
      code: 'SELLER2REF',
      type: 'AFFILIATE',
      affiliateId: AFF_IDS.seller2,
      discountType: 'PERCENTAGE',
      discountValue: 1000,
      durationMonths: 1,
      isActive: true,
      createdByUserId: USER_IDS.seller2,
    },
    {
      id: PROMO_IDS.platformWelcome,
      code: 'WELCOME20',
      type: 'PLATFORM',
      affiliateId: null,
      discountType: 'PERCENTAGE',
      discountValue: 2000,
      durationMonths: 1,
      isActive: true,
      createdByUserId: USER_IDS.seller1,
    },
  ]).onConflictDoNothing();

  // 3. Referrals
  await db.insert(referral).values([
    {
      id: REF_IDS.ref1,
      affiliateId: AFF_IDS.seller1,
      referredUserId: USER_IDS.buyer1,
      status: 'CONVERTED',
      clickedAt: daysAgo(60),
      signedUpAt: daysAgo(59),
      convertedAt: daysAgo(45),
      expiresAt: daysFromNow(300),
    },
    {
      id: REF_IDS.ref2,
      affiliateId: AFF_IDS.seller1,
      referredUserId: USER_IDS.buyer2,
      status: 'SIGNED_UP',
      clickedAt: daysAgo(30),
      signedUpAt: daysAgo(29),
      expiresAt: daysFromNow(330),
    },
    {
      id: REF_IDS.ref3,
      affiliateId: AFF_IDS.seller1,
      referredUserId: null,
      status: 'CLICKED',
      clickedAt: daysAgo(5),
      expiresAt: daysFromNow(25),
    },
    {
      id: REF_IDS.ref4,
      affiliateId: AFF_IDS.seller2,
      referredUserId: USER_IDS.buyer3,
      status: 'SIGNED_UP',
      clickedAt: daysAgo(20),
      signedUpAt: daysAgo(19),
      expiresAt: daysFromNow(340),
    },
    {
      id: REF_IDS.ref5,
      affiliateId: AFF_IDS.seller1,
      referredUserId: null,
      status: 'CHURNED',
      clickedAt: daysAgo(90),
      expiresAt: daysAgo(60),
    },
  ]).onConflictDoNothing();

  // 4. Commissions
  await db.insert(affiliateCommission).values([
    {
      id: COMMISSION_IDS.c1,
      affiliateId: AFF_IDS.seller1,
      referralId: REF_IDS.ref1,
      invoiceId: 'in_seed_001',
      subscriptionProduct: 'store',
      grossRevenueCents: 2999,
      netRevenueCents: 2700,
      commissionRateBps: 1500,
      commissionCents: 405,
      status: 'PAYABLE',
      holdExpiresAt: daysAgo(15),
    },
    {
      id: COMMISSION_IDS.c2,
      affiliateId: AFF_IDS.seller1,
      referralId: REF_IDS.ref1,
      invoiceId: 'in_seed_002',
      subscriptionProduct: 'store',
      grossRevenueCents: 2999,
      netRevenueCents: 2700,
      commissionRateBps: 1500,
      commissionCents: 405,
      status: 'PAID',
      holdExpiresAt: daysAgo(45),
      paidAt: daysAgo(30),
    },
    {
      id: COMMISSION_IDS.c3,
      affiliateId: AFF_IDS.seller1,
      referralId: REF_IDS.ref1,
      invoiceId: 'in_seed_003',
      subscriptionProduct: 'lister',
      grossRevenueCents: 999,
      netRevenueCents: 900,
      commissionRateBps: 1500,
      commissionCents: 135,
      status: 'PENDING',
      holdExpiresAt: daysFromNow(15),
    },
  ]).onConflictDoNothing();

  // 5. Payout
  await db.insert(affiliatePayout).values([
    {
      id: PAYOUT_IDS.p1,
      affiliateId: AFF_IDS.seller1,
      amountCents: 5000,
      method: 'stripe_connect',
      status: 'COMPLETED',
      periodStart: daysAgo(60),
      periodEnd: daysAgo(30),
      completedAt: daysAgo(28),
    },
  ]).onConflictDoNothing();
}

export const AFFILIATE_IDS = {
  affiliates: AFF_IDS,
  promoCodes: PROMO_IDS,
  referrals: REF_IDS,
  commissions: COMMISSION_IDS,
  payouts: PAYOUT_IDS,
};
