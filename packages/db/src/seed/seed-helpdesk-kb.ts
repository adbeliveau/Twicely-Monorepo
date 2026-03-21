/**
 * G9 — Seed KB articles with real content for help center demo.
 * Idempotent via onConflictDoNothing.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { kbArticle } from '../schema';
import { HELPDESK_SEED_IDS } from './seed-helpdesk';
import {
  HOW_TO_BUY_BODY, SHIPPING_BODY, RETURNS_BODY, REFUND_BODY,
  BUYER_PROTECTION_BODY, HOW_TO_SELL_BODY, CROSSLISTER_BODY,
  PAYOUT_BODY, SECURITY_BODY, PRICING_BODY, DISPUTE_BODY, PROHIBITED_BODY,
} from './seed-helpdesk-kb-content';

const STAFF_AUTHOR = 'seed-staff-agent-001';

const ART_IDS = {
  howToBuy:         'seed-kb-art-001',
  shippingTimes:    'seed-kb-art-002',
  returnsPolicy:    'seed-kb-art-003',
  refundTimeline:   'seed-kb-art-004',
  buyerProtection:  'seed-kb-art-005',
  howToSell:        'seed-kb-art-006',
  crosslisterSetup: 'seed-kb-art-007',
  payoutGuide:      'seed-kb-art-008',
  accountSecurity:  'seed-kb-art-009',
  pricingPlans:     'seed-kb-art-010',
  disputeProcess:   'seed-kb-art-011',
  prohibitedItems:  'seed-kb-art-012',
};

const now = new Date();

export async function seedHelpdeskKb(db: PostgresJsDatabase): Promise<void> {
  await db.insert(kbArticle).values([
    {
      id: ART_IDS.howToBuy,
      categoryId: HELPDESK_SEED_IDS.kbCategories.ordersShipping,
      slug: 'how-to-buy', title: 'How to Buy on Twicely',
      excerpt: 'A step-by-step guide to finding and purchasing items.',
      body: HOW_TO_BUY_BODY,
      status: 'PUBLISHED', audience: 'BUYER', authorStaffId: STAFF_AUTHOR,
      tags: ['getting-started', 'buying'], searchKeywords: ['buy', 'purchase', 'order', 'checkout'],
      isFeatured: true, viewCount: 1245, helpfulYes: 89, helpfulNo: 3,
      publishedAt: now, createdAt: now, updatedAt: now,
    },
    {
      id: ART_IDS.shippingTimes,
      categoryId: HELPDESK_SEED_IDS.kbCategories.ordersShipping,
      slug: 'shipping-times-and-tracking', title: 'Shipping Times & Tracking',
      excerpt: 'Expected shipping times and how to track your order.',
      body: SHIPPING_BODY,
      status: 'PUBLISHED', audience: 'ALL', authorStaffId: STAFF_AUTHOR,
      tags: ['shipping', 'tracking'], searchKeywords: ['ship', 'track', 'delivery', 'carrier'],
      viewCount: 890, helpfulYes: 67, helpfulNo: 5,
      publishedAt: now, createdAt: now, updatedAt: now,
    },
    {
      id: ART_IDS.returnsPolicy,
      categoryId: HELPDESK_SEED_IDS.kbCategories.returnsRefunds,
      slug: 'returns-policy', title: 'Returns Policy',
      excerpt: 'When and how to return items purchased on Twicely.',
      body: RETURNS_BODY,
      status: 'PUBLISHED', audience: 'ALL', authorStaffId: STAFF_AUTHOR,
      tags: ['returns', 'policy'], searchKeywords: ['return', 'send back', 'refund', 'exchange'],
      isFeatured: true, viewCount: 2100, helpfulYes: 143, helpfulNo: 12,
      publishedAt: now, createdAt: now, updatedAt: now,
    },
    {
      id: ART_IDS.refundTimeline,
      categoryId: HELPDESK_SEED_IDS.kbCategories.returnsRefunds,
      slug: 'refund-timeline', title: 'Refund Processing Timeline',
      excerpt: 'How long refunds take and what to expect.',
      body: REFUND_BODY,
      status: 'PUBLISHED', audience: 'BUYER', authorStaffId: STAFF_AUTHOR,
      tags: ['refunds', 'timeline'], searchKeywords: ['refund', 'money back', 'how long'],
      viewCount: 780, helpfulYes: 54, helpfulNo: 8,
      publishedAt: now, createdAt: now, updatedAt: now,
    },
    {
      id: ART_IDS.buyerProtection,
      categoryId: HELPDESK_SEED_IDS.kbCategories.buyerProtection,
      slug: 'buyer-protection-guarantee', title: 'Buyer Protection Guarantee',
      excerpt: 'How Twicely protects your purchases.',
      body: BUYER_PROTECTION_BODY,
      status: 'PUBLISHED', audience: 'BUYER', authorStaffId: STAFF_AUTHOR,
      tags: ['protection', 'guarantee'], searchKeywords: ['protection', 'guarantee', 'safe', 'scam'],
      isFeatured: true, viewCount: 3200, helpfulYes: 210, helpfulNo: 4,
      publishedAt: now, createdAt: now, updatedAt: now,
    },
    {
      id: ART_IDS.howToSell,
      categoryId: HELPDESK_SEED_IDS.kbCategories.selling,
      slug: 'how-to-sell', title: 'How to Sell on Twicely',
      excerpt: 'Get started selling your items on the marketplace.',
      body: HOW_TO_SELL_BODY,
      status: 'PUBLISHED', audience: 'SELLER', authorStaffId: STAFF_AUTHOR,
      tags: ['getting-started', 'selling'], searchKeywords: ['sell', 'list', 'create listing'],
      isFeatured: true, viewCount: 1567, helpfulYes: 112, helpfulNo: 6,
      publishedAt: now, createdAt: now, updatedAt: now,
    },
    {
      id: ART_IDS.crosslisterSetup,
      categoryId: HELPDESK_SEED_IDS.kbCategories.crosslister,
      slug: 'crosslister-setup-guide', title: 'Crosslister Setup Guide',
      excerpt: 'Connect your other marketplace accounts to Twicely.',
      body: CROSSLISTER_BODY,
      status: 'PUBLISHED', audience: 'SELLER', authorStaffId: STAFF_AUTHOR,
      tags: ['crosslister', 'setup'], searchKeywords: ['crosslist', 'poshmark', 'ebay', 'mercari'],
      viewCount: 430, helpfulYes: 38, helpfulNo: 2,
      publishedAt: now, createdAt: now, updatedAt: now,
    },
    {
      id: ART_IDS.payoutGuide,
      categoryId: HELPDESK_SEED_IDS.kbCategories.paymentsBilling,
      slug: 'payout-guide', title: 'Understanding Your Earnings & Payouts',
      excerpt: 'How to request payouts and understand your earnings.',
      body: PAYOUT_BODY,
      status: 'PUBLISHED', audience: 'SELLER', authorStaffId: STAFF_AUTHOR,
      tags: ['payout', 'earnings'], searchKeywords: ['payout', 'earnings', 'bank', 'transfer'],
      viewCount: 950, helpfulYes: 72, helpfulNo: 9,
      publishedAt: now, createdAt: now, updatedAt: now,
    },
    {
      id: ART_IDS.accountSecurity,
      categoryId: HELPDESK_SEED_IDS.kbCategories.account,
      slug: 'account-security-tips', title: 'Account Security Tips',
      excerpt: 'Keep your Twicely account safe and secure.',
      body: SECURITY_BODY,
      status: 'PUBLISHED', audience: 'ALL', authorStaffId: STAFF_AUTHOR,
      tags: ['security', 'account'], searchKeywords: ['password', 'security', '2fa', 'hack'],
      viewCount: 620, helpfulYes: 45, helpfulNo: 1,
      publishedAt: now, createdAt: now, updatedAt: now,
    },
    {
      id: ART_IDS.pricingPlans,
      categoryId: HELPDESK_SEED_IDS.kbCategories.selling,
      slug: 'pricing-and-plans', title: 'Twicely Pricing & Plans',
      excerpt: 'Compare store tiers and crosslister plans.',
      body: PRICING_BODY,
      status: 'PUBLISHED', audience: 'SELLER', authorStaffId: STAFF_AUTHOR,
      tags: ['pricing', 'plans', 'subscription'],
      searchKeywords: ['price', 'plan', 'cost', 'subscription', 'tier', 'fee'],
      isFeatured: true, viewCount: 1890, helpfulYes: 98, helpfulNo: 15,
      publishedAt: now, createdAt: now, updatedAt: now,
    },
    {
      id: ART_IDS.disputeProcess,
      categoryId: HELPDESK_SEED_IDS.kbCategories.buyerProtection,
      slug: 'dispute-resolution-process', title: 'Dispute Resolution Process',
      excerpt: 'How disputes are handled between buyers and sellers.',
      body: DISPUTE_BODY,
      status: 'PUBLISHED', audience: 'ALL', authorStaffId: STAFF_AUTHOR,
      tags: ['dispute', 'resolution'], searchKeywords: ['dispute', 'claim', 'problem', 'issue'],
      viewCount: 540, helpfulYes: 32, helpfulNo: 7,
      publishedAt: now, createdAt: now, updatedAt: now,
    },
    {
      id: ART_IDS.prohibitedItems,
      categoryId: HELPDESK_SEED_IDS.kbCategories.policies,
      slug: 'prohibited-items', title: 'Prohibited Items Policy',
      excerpt: 'Items that cannot be sold on Twicely.',
      body: PROHIBITED_BODY,
      status: 'PUBLISHED', audience: 'ALL', authorStaffId: STAFF_AUTHOR,
      tags: ['policy', 'prohibited'], searchKeywords: ['banned', 'prohibited', 'not allowed'],
      viewCount: 380, helpfulYes: 28, helpfulNo: 2,
      publishedAt: now, createdAt: now, updatedAt: now,
    },
  ]).onConflictDoNothing();
}

export const KB_ARTICLE_IDS = ART_IDS;
