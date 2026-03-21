/**
 * Affiliate listing query (G3.6)
 *
 * Returns the affiliate info needed to render the AffiliateLinkButton
 * on a listing page: whether the viewer is an active affiliate, the seller's
 * opt-in status, and the effective commission rate.
 */

import { eq } from 'drizzle-orm';
import { db } from '@twicely/db';
import { affiliate, sellerProfile } from '@twicely/db/schema';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

export interface ListingAffiliateInfo {
  isAffiliate: boolean;
  affiliateCode: string | null;
  affiliateStatus: string | null;
  sellerOptedIn: boolean;
  commissionBps: number;  // Seller custom rate or platform default
}

const DEFAULT_RESULT: ListingAffiliateInfo = {
  isAffiliate: false,
  affiliateCode: null,
  affiliateStatus: null,
  sellerOptedIn: false,
  commissionBps: 300,
};

export async function getListingAffiliateInfo(
  viewerUserId: string | null,
  sellerUserId: string,
): Promise<ListingAffiliateInfo> {
  // Default listing commission from platform settings
  const defaultCommissionBps = await getPlatformSetting<number>('affiliate.listingCommissionBps', 300);

  if (!viewerUserId) {
    return { ...DEFAULT_RESULT, commissionBps: defaultCommissionBps };
  }

  const [affiliateRow, sellerProfileRow] = await Promise.all([
    db.select({
      id: affiliate.id,
      status: affiliate.status,
      referralCode: affiliate.referralCode,
    })
      .from(affiliate)
      .where(eq(affiliate.userId, viewerUserId))
      .limit(1),

    db.select({
      affiliateOptIn: sellerProfile.affiliateOptIn,
      affiliateCommissionBps: sellerProfile.affiliateCommissionBps,
    })
      .from(sellerProfile)
      .where(eq(sellerProfile.userId, sellerUserId))
      .limit(1),
  ]);

  const aff = affiliateRow[0] ?? null;
  const sp = sellerProfileRow[0] ?? null;

  const sellerOptedIn = sp?.affiliateOptIn ?? true;
  // Use seller custom rate if set, otherwise platform default
  const commissionBps = sp?.affiliateCommissionBps ?? defaultCommissionBps;

  if (!aff) {
    return {
      isAffiliate: false,
      affiliateCode: null,
      affiliateStatus: null,
      sellerOptedIn,
      commissionBps,
    };
  }

  return {
    isAffiliate: true,
    affiliateCode: aff.referralCode,
    affiliateStatus: aff.status,
    sellerOptedIn,
    commissionBps,
  };
}
