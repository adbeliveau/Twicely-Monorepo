import { cache } from 'react';
import { eq, and, isNull, gt, or } from 'drizzle-orm';
import { db } from '@twicely/db';
import { affiliate, promoCode, user } from '@twicely/db/schema';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

export interface InfluencerLandingData {
  referralCode: string;
  displayName: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  socialLinks: {
    instagram?: string;
    youtube?: string;
    tiktok?: string;
    blog?: string;
  } | null;
  promoCodes: Array<{
    code: string;
    discountType: string;
    discountValue: number;
    durationMonths: number;
  }>;
}

interface ApplicationNoteData {
  note?: string;
  socialLinks?: {
    instagram?: string;
    youtube?: string;
    tiktok?: string;
    blog?: string;
  } | null;
  audienceSize?: number | null;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function safeLink(value: unknown): string | undefined {
  return typeof value === 'string' && isSafeUrl(value) ? value : undefined;
}

function parseSocialLinks(
  applicationNote: string | null,
): InfluencerLandingData['socialLinks'] {
  if (!applicationNote) return null;
  try {
    const parsed = JSON.parse(applicationNote) as ApplicationNoteData;
    const links = parsed.socialLinks;
    if (!links || typeof links !== 'object') return null;
    return {
      instagram: safeLink(links.instagram),
      youtube: safeLink(links.youtube),
      tiktok: safeLink(links.tiktok),
      blog: safeLink(links.blog),
    };
  } catch {
    return null;
  }
}

/**
 * Get data for an influencer landing page at /p/{slug}.
 *
 * Returns null if:
 * - affiliate.enabled or affiliate.influencer.enabled platform settings are false
 * - No INFLUENCER + ACTIVE affiliate exists for the given code
 */
export const getInfluencerLandingData = cache(async function getInfluencerLandingData(
  slug: string,
): Promise<InfluencerLandingData | null> {
  const [affiliateEnabled, influencerEnabled] = await Promise.all([
    getPlatformSetting('affiliate.enabled', true),
    getPlatformSetting('affiliate.influencer.enabled', true),
  ]);

  if (!affiliateEnabled || !influencerEnabled) {
    return null;
  }

  const uppercasedSlug = slug.toUpperCase();

  const [row] = await db
    .select({
      affiliateId: affiliate.id,
      referralCode: affiliate.referralCode,
      applicationNote: affiliate.applicationNote,
      name: user.name,
      displayName: user.displayName,
      username: user.username,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
    })
    .from(affiliate)
    .innerJoin(user, eq(affiliate.userId, user.id))
    .where(
      and(
        eq(affiliate.referralCode, uppercasedSlug),
        eq(affiliate.tier, 'INFLUENCER'),
        eq(affiliate.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const now = new Date();

  const promoCodes = await db
    .select({
      code: promoCode.code,
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue,
      durationMonths: promoCode.durationMonths,
    })
    .from(promoCode)
    .where(
      and(
        eq(promoCode.affiliateId, row.affiliateId),
        eq(promoCode.isActive, true),
        or(
          isNull(promoCode.expiresAt),
          gt(promoCode.expiresAt, now),
        ),
      ),
    );

  const socialLinks = parseSocialLinks(row.applicationNote);

  return {
    referralCode: row.referralCode,
    displayName: row.displayName,
    username: row.username,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    socialLinks,
    promoCodes,
  };
});
