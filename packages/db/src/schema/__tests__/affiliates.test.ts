import { describe, it, expect } from 'vitest';
import * as schema from '@twicely/db/schema';
import {
  affiliateTierEnum,
  affiliateStatusEnum,
  referralStatusEnum,
  promoCodeTypeEnum,
  promoDiscountTypeEnum,
  commissionStatusEnum,
} from '@twicely/db/schema';

describe('affiliates schema — 6 tables', () => {
  it('affiliate table has all required columns', () => {
    const cols = Object.keys(schema.affiliate);
    const expected = [
      'id', 'userId', 'tier', 'status', 'referralCode',
      'commissionRateBps', 'cookieDurationDays', 'commissionDurationMonths',
      'payoutMethod', 'payoutEmail', 'stripeConnectAccountId', 'taxInfoProvided',
      'pendingBalanceCents', 'availableBalanceCents', 'totalEarnedCents', 'totalPaidCents',
      'warningCount', 'suspendedAt', 'suspendedReason', 'applicationNote',
      'createdAt', 'updatedAt',
    ];
    for (const col of expected) {
      expect(cols, `missing column: ${col}`).toContain(col);
    }
    expect(expected.length).toBe(22);
  });

  it('referral table has all required columns', () => {
    const cols = Object.keys(schema.referral);
    const expected = [
      'id', 'affiliateId', 'referredUserId', 'status',
      'clickedAt', 'signedUpAt', 'trialStartedAt', 'convertedAt', 'churnedAt', 'expiresAt',
      'ipAddress', 'userAgent', 'utmSource', 'utmMedium', 'utmCampaign',
      'promoCodeId', 'createdAt', 'updatedAt',
    ];
    for (const col of expected) {
      expect(cols, `missing column: ${col}`).toContain(col);
    }
    expect(expected.length).toBe(18);
  });

  it('promoCode table has all required columns', () => {
    const cols = Object.keys(schema.promoCode);
    const expected = [
      'id', 'code', 'type', 'affiliateId',
      'discountType', 'discountValue', 'durationMonths',
      'scopeProductTypes', 'usageLimit', 'usageCount',
      'expiresAt', 'isActive', 'createdByUserId',
      'createdAt', 'updatedAt',
    ];
    for (const col of expected) {
      expect(cols, `missing column: ${col}`).toContain(col);
    }
    expect(expected.length).toBe(15);
  });

  it('promoCodeRedemption table has all required columns', () => {
    const cols = Object.keys(schema.promoCodeRedemption);
    const expected = [
      'id', 'promoCodeId', 'userId', 'subscriptionProduct',
      'discountAppliedCents', 'monthsRemaining', 'stripePromotionCodeId',
      'createdAt',
    ];
    for (const col of expected) {
      expect(cols, `missing column: ${col}`).toContain(col);
    }
    expect(expected.length).toBe(8);
  });

  it('affiliateCommission table has all required columns', () => {
    const cols = Object.keys(schema.affiliateCommission);
    const expected = [
      'id', 'affiliateId', 'referralId', 'invoiceId',
      'subscriptionProduct', 'grossRevenueCents', 'netRevenueCents',
      'commissionRateBps', 'commissionCents',
      'status', 'holdExpiresAt', 'paidAt', 'reversedAt', 'reversalReason',
      'createdAt',
    ];
    for (const col of expected) {
      expect(cols, `missing column: ${col}`).toContain(col);
    }
    expect(expected.length).toBe(15);
  });

  it('affiliatePayout table has all required columns', () => {
    const cols = Object.keys(schema.affiliatePayout);
    const expected = [
      'id', 'affiliateId', 'amountCents', 'method',
      'externalPayoutId', 'status',
      'periodStart', 'periodEnd', 'failedReason',
      'createdAt', 'completedAt',
    ];
    for (const col of expected) {
      expect(cols, `missing column: ${col}`).toContain(col);
    }
    expect(expected.length).toBe(11);
  });

  it('monetary columns use integer cents naming', () => {
    // affiliate table
    expect(schema.affiliate.pendingBalanceCents).toBeDefined();
    expect(schema.affiliate.availableBalanceCents).toBeDefined();
    expect(schema.affiliate.totalEarnedCents).toBeDefined();
    expect(schema.affiliate.totalPaidCents).toBeDefined();
    // promoCodeRedemption
    expect(schema.promoCodeRedemption.discountAppliedCents).toBeDefined();
    // affiliateCommission
    expect(schema.affiliateCommission.grossRevenueCents).toBeDefined();
    expect(schema.affiliateCommission.netRevenueCents).toBeDefined();
    expect(schema.affiliateCommission.commissionCents).toBeDefined();
    // affiliatePayout
    expect(schema.affiliatePayout.amountCents).toBeDefined();
  });

  it('rate columns use integer basis points naming', () => {
    expect(schema.affiliate.commissionRateBps).toBeDefined();
    expect(schema.affiliateCommission.commissionRateBps).toBeDefined();
  });
});

describe('affiliate enums — 6 enums', () => {
  it('affiliateTierEnum has correct values', () => {
    expect(affiliateTierEnum.enumValues).toEqual(['COMMUNITY', 'INFLUENCER']);
  });

  it('affiliateStatusEnum has correct values', () => {
    expect(affiliateStatusEnum.enumValues).toEqual(['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED']);
  });

  it('referralStatusEnum has correct values', () => {
    expect(referralStatusEnum.enumValues).toEqual(['CLICKED', 'SIGNED_UP', 'TRIALING', 'CONVERTED', 'CHURNED']);
  });

  it('promoCodeTypeEnum has correct values', () => {
    expect(promoCodeTypeEnum.enumValues).toEqual(['AFFILIATE', 'PLATFORM']);
  });

  it('promoDiscountTypeEnum has correct values', () => {
    expect(promoDiscountTypeEnum.enumValues).toEqual(['PERCENTAGE', 'FIXED']);
  });

  it('commissionStatusEnum has correct values', () => {
    expect(commissionStatusEnum.enumValues).toEqual(['PENDING', 'PAYABLE', 'PAID', 'REVERSED']);
  });
});
