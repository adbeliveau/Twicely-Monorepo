import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@twicely/db';
import { referral, listing, sellerProfile, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getAffiliateByReferralCode } from '@/lib/queries/affiliate';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { LISTING_REF_COOKIE_NAME } from '@/lib/affiliate/referral-cookie';
import { checkSelfReferralByIp } from '@/lib/affiliate/fraud-detection';
import { escalateAffiliate } from '@/lib/affiliate/fraud-escalation';
import { getClientIp } from '@twicely/utils/get-client-ip';

const listingClickSchema = z.object({
  referralCode: z.string().min(1).max(50),
  listingId: z.string().min(1),
  listingSlug: z.string().min(1),
}).strict();

// Simple in-memory IP rate limiter (per-instance, resets on restart)
// Sync by design — must run before any async DB call.
// Canonical values: affiliate.clickRateLimitPerMinute / affiliate.clickRateWindowMs
const clickCounts = new Map<string, { count: number; resetAt: number }>();
const CLICK_RATE_LIMIT = 30;
const CLICK_RATE_WINDOW_MS = 60_000;

function checkClickRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = clickCounts.get(ip);
  if (!record || now > record.resetAt) {
    clickCounts.set(ip, { count: 1, resetAt: now + CLICK_RATE_WINDOW_MS });
    return true;
  }
  if (record.count >= CLICK_RATE_LIMIT) return false;
  record.count++;
  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // IP rate limiting (unauthenticated endpoint)
  const clientIp = getClientIp(request.headers);
  if (!checkClickRateLimit(clientIp)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = listingClickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const { referralCode, listingId, listingSlug } = parsed.data;

  // 1. Check feature flag
  const listingLinkEnabled = await getPlatformSetting<boolean>('affiliate.listingLinkEnabled', true);
  if (!listingLinkEnabled) {
    return NextResponse.json({ success: true, attributed: false });
  }

  // 2. Look up affiliate by referral code (uppercase)
  const normalizedCode = referralCode.toUpperCase();
  const aff = await getAffiliateByReferralCode(normalizedCode);
  if (!aff || aff.status !== 'ACTIVE') {
    return NextResponse.json({ success: true, attributed: false });
  }

  // 3. Look up listing — must exist and be ACTIVE
  const [listingRow] = await db
    .select({ id: listing.id, status: listing.status, ownerUserId: listing.ownerUserId })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow || listingRow.status !== 'ACTIVE') {
    return NextResponse.json({ success: true, attributed: false });
  }

  // 4. Check seller opt-in
  const [sp] = await db
    .select({ affiliateOptIn: sellerProfile.affiliateOptIn })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, listingRow.ownerUserId))
    .limit(1);

  if (!sp?.affiliateOptIn) {
    return NextResponse.json({ success: true, attributed: false });
  }

  // 5. Self-referral check — affiliate cannot promote their own listings
  if (aff.userId === listingRow.ownerUserId) {
    return NextResponse.json({ success: true, attributed: false });
  }

  // 6. Extract IP and userAgent (reuse clientIp from rate limiter)
  const ipAddress = clientIp === 'unknown' ? null : clientIp;
  const userAgent = request.headers.get('user-agent') ?? null;

  // 7. IP-based self-referral fraud check
  const fraudEnabled = await getPlatformSetting<boolean>('affiliate.fraud.enabled', true);
  const selfReferralSignal = fraudEnabled
    ? await checkSelfReferralByIp(aff.userId, ipAddress)
    : { flagged: false, signalType: 'SELF_REFERRAL_IP' as const, details: '', severity: 'WARNING' as const };

  if (selfReferralSignal.flagged) {
    await db.insert(auditEvent).values({
      actorType: 'SYSTEM',
      actorId: 'SYSTEM',
      action: 'AFFILIATE_FRAUD_SIGNAL',
      subject: 'Affiliate',
      subjectId: aff.id,
      severity: 'HIGH',
      detailsJson: {
        signalType: selfReferralSignal.signalType,
        details: selfReferralSignal.details,
        listingId,
        listingSlug,
        ipAddress,
      },
      ipAddress,
    });
    void escalateAffiliate(aff.id, selfReferralSignal, 'SYSTEM');
    return NextResponse.json({ success: true, attributed: false });
  }

  // 8. First-touch attribution — check for existing listing ref cookie
  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(LISTING_REF_COOKIE_NAME);
  if (existingCookie) {
    // First-touch wins — do not override existing attribution
    return NextResponse.json({ success: true, attributed: false });
  }

  // 9. Compute expiry from platform setting
  const attributionWindowDays = await getPlatformSetting<number>('affiliate.listingAttributionWindowDays', 7);
  const expiresAt = new Date(Date.now() + attributionWindowDays * 24 * 60 * 60 * 1000);

  // 10. Insert referral record with listingId set
  const [newReferral] = await db.insert(referral).values({
    affiliateId: aff.id,
    status: 'CLICKED',
    expiresAt,
    ipAddress,
    userAgent,
    listingId,
  }).returning({ id: referral.id });

  if (!newReferral) {
    return NextResponse.json({ success: false, error: 'Failed to record click' }, { status: 500 });
  }

  // 11. Set listing attribution cookie
  cookieStore.set(LISTING_REF_COOKIE_NAME, JSON.stringify({
    referralId: newReferral.id,
    affiliateId: aff.id,
    affiliateCode: normalizedCode,
    clickedAt: new Date().toISOString(),
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: attributionWindowDays * 24 * 60 * 60,
  });

  return NextResponse.json({ success: true, attributed: true });
}
