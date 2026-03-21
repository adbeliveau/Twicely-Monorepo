import { cookies } from 'next/headers';

export const REFERRAL_COOKIE_NAME = 'twicely_ref';

export async function getReferralIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(REFERRAL_COOKIE_NAME)?.value ?? null;
}

export async function clearReferralCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(REFERRAL_COOKIE_NAME);
}

// ─── G3.6 — Listing-level attribution cookie ─────────────────────────────────

export const LISTING_REF_COOKIE_NAME = 'twicely_listing_ref';

export interface ListingRefCookiePayload {
  referralId: string;
  affiliateId: string;
  affiliateCode: string;
  clickedAt: string;
}

export async function getListingRefCookie(): Promise<ListingRefCookiePayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LISTING_REF_COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ListingRefCookiePayload;
  } catch {
    return null;
  }
}

export async function clearListingRefCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(LISTING_REF_COOKIE_NAME);
}
