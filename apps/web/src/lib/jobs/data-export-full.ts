/**
 * Enhanced Data Export — Full GDPR Article 20 Portability — G8.4
 *
 * Extends the base collectUserData() with all required categories:
 * payout history, saved searches, watchlist, follows, addresses,
 * tax info, conversations, messages, local transactions, promo
 * redemptions, interests, affiliate data, identity verification status.
 *
 * Per Decision #110 (GDPR portability) and Feature Lock-in §37.
 * Split from data-export.ts to keep files under 300 lines.
 */

import { db } from '@twicely/db';
import {
  user as userTable,
  order,
  listing as listingTable,
  ledgerEntry,
  review,
  payout,
  savedSearch,
  watchlistItem,
  follow,
  notificationPreference,
  address,
  taxInfo,
  affiliate,
  affiliateCommission,
  affiliatePayout,
  identityVerification,
  conversation,
  message,
  localTransaction,
  promoCodeRedemption,
  userInterest,
} from '@twicely/db/schema';
import { eq, or, inArray } from 'drizzle-orm';

const EXPORT_VERSION = '2.0';

/**
 * Collect ALL user data for GDPR Article 20 export.
 * Returns a structured object with _metadata + all data sections.
 * Uses Promise.all for parallel queries.
 */
export async function collectUserDataFull(
  userId: string
): Promise<Record<string, unknown>> {
  const exportedAt = new Date().toISOString();

  const [
    [userData],
    ordersAsBuyer,
    ordersAsSeller,
    listings,
    ledgerEntries,
    reviewsWritten,
    reviewsReceived,
    payouts,
    savedSearches,
    watchlistItems,
    follows,
    notificationPrefs,
    addresses,
    taxInfoData,
    affiliateData,
    identityVerifications,
    conversationsAsBuyer,
    conversationsAsSeller,
    localTransactions,
    promoRedemptions,
    interests,
  ] = await Promise.all([
    db.select().from(userTable).where(eq(userTable.id, userId)).limit(1),
    db.select().from(order).where(eq(order.buyerId, userId)).limit(5000),
    db.select().from(order).where(eq(order.sellerId, userId)).limit(5000),
    db.select().from(listingTable).where(eq(listingTable.ownerUserId, userId)).limit(10000),
    db.select().from(ledgerEntry).where(eq(ledgerEntry.userId, userId)).limit(10000),
    db.select().from(review).where(eq(review.reviewerUserId, userId)).limit(5000),
    db.select().from(review).where(eq(review.sellerId, userId)).limit(5000),
    db.select().from(payout).where(eq(payout.userId, userId)).limit(5000),
    db.select().from(savedSearch).where(eq(savedSearch.userId, userId)).limit(1000),
    db.select().from(watchlistItem).where(eq(watchlistItem.userId, userId)).limit(5000),
    db.select().from(follow).where(or(eq(follow.followerId, userId), eq(follow.followedId, userId))).limit(5000),
    db.select().from(notificationPreference).where(eq(notificationPreference.userId, userId)),
    db.select().from(address).where(eq(address.userId, userId)),
    db.select().from(taxInfo).where(eq(taxInfo.userId, userId)).limit(1),
    db.select().from(affiliate).where(eq(affiliate.userId, userId)).limit(1),
    db.select({ id: identityVerification.id, level: identityVerification.level, status: identityVerification.status, verifiedAt: identityVerification.verifiedAt })
      .from(identityVerification)
      .where(eq(identityVerification.userId, userId)),
    db.select().from(conversation).where(eq(conversation.buyerId, userId)).limit(5000),
    db.select().from(conversation).where(eq(conversation.sellerId, userId)).limit(5000),
    db.select().from(localTransaction).where(or(eq(localTransaction.buyerId, userId), eq(localTransaction.sellerId, userId))).limit(5000),
    db.select().from(promoCodeRedemption).where(eq(promoCodeRedemption.userId, userId)),
    db.select().from(userInterest).where(eq(userInterest.userId, userId)),
  ]);

  // Omit sensitive fields from tax info (return only non-encrypted fields)
  const taxInfoSafe = taxInfoData[0]
    ? {
        taxIdType: taxInfoData[0].taxIdType,
        taxIdLastFour: taxInfoData[0].taxIdLastFour,
        legalName: taxInfoData[0].legalName,
        businessName: taxInfoData[0].businessName,
        country: taxInfoData[0].country,
        form1099Threshold: taxInfoData[0].form1099Threshold,
        w9ReceivedAt: taxInfoData[0].w9ReceivedAt,
      }
    : null;

  // Fetch affiliate commissions/payouts if user has affiliate record
  let affiliateCommissions: unknown[] = [];
  let affiliatePayouts: unknown[] = [];
  if (affiliateData[0]) {
    [affiliateCommissions, affiliatePayouts] = await Promise.all([
      db.select().from(affiliateCommission)
        .where(eq(affiliateCommission.affiliateId, affiliateData[0].id))
        .limit(5000),
      db.select().from(affiliatePayout)
        .where(eq(affiliatePayout.affiliateId, affiliateData[0].id))
        .limit(5000),
    ]);
  }

  // Fetch messages for user's conversations
  const allConvIds = [
    ...conversationsAsBuyer.map((c) => c.id),
    ...conversationsAsSeller.map((c) => c.id),
  ];

  let messages: unknown[] = [];
  if (allConvIds.length > 0) {
    messages = await db
      .select()
      .from(message)
      .where(inArray(message.conversationId, allConvIds))
      .limit(10000);
  }

  const sections = [
    'profile', 'ordersAsBuyer', 'ordersAsSeller', 'listings', 'ledgerEntries',
    'reviewsWritten', 'reviewsReceived', 'payouts', 'savedSearches', 'watchlistItems',
    'follows', 'notificationPreferences', 'addresses', 'taxInfo', 'affiliateProfile',
    'affiliateCommissions', 'affiliatePayouts', 'identityVerifications',
    'conversations', 'messages', 'localTransactions', 'promoCodeRedemptions', 'interests',
    'cookieConsentPreferences',
  ];

  return {
    _metadata: {
      exportedAt,
      userId,
      format: 'json',
      version: EXPORT_VERSION,
      sections,
    },
    profile: userData ?? null,
    ordersAsBuyer,
    ordersAsSeller,
    listings,
    ledgerEntries,
    reviewsWritten,
    reviewsReceived,
    payouts,
    savedSearches,
    watchlistItems,
    follows,
    notificationPreferences: notificationPrefs,
    addresses,
    taxInfo: taxInfoSafe,
    affiliateProfile: affiliateData[0] ?? null,
    affiliateCommissions,
    affiliatePayouts,
    identityVerifications: identityVerifications,
    conversations: [...conversationsAsBuyer, ...conversationsAsSeller],
    conversationCount: allConvIds.length,
    messages,
    localTransactions,
    promoCodeRedemptions: promoRedemptions,
    interests,
    cookieConsentPreferences: userData?.cookieConsentJson ?? null,
  };
}
