import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@twicely/db';
import { referral, auditEvent } from '@twicely/db/schema';
import { getAffiliateByReferralCode } from '@/lib/queries/affiliate';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { REFERRAL_COOKIE_NAME } from '@/lib/affiliate/referral-cookie';
import { checkSelfReferralByIp } from '@/lib/affiliate/fraud-detection';
import { escalateAffiliate } from '@/lib/affiliate/fraud-escalation';
import { getClientIp } from '@/lib/utils/get-client-ip';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await params;
  const normalizedCode = code.toUpperCase();

  // 1. Check if affiliate program is enabled
  const affiliateEnabled = await getPlatformSetting('affiliate.enabled', true);
  if (!affiliateEnabled) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. Look up the affiliate by referral code
  const aff = await getAffiliateByReferralCode(normalizedCode);
  if (!aff) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 3. Verify affiliate is active
  if (aff.status !== 'ACTIVE') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 4. Compute cookie expiry from affiliate's cookieDurationDays
  const expiresAt = new Date(Date.now() + aff.cookieDurationDays * 24 * 60 * 60 * 1000);

  // 5. Extract fraud signals
  const rawIp = getClientIp(request.headers);
  const ipAddress = rawIp === 'unknown' ? null : rawIp;
  const userAgent = request.headers.get('user-agent') ?? null;

  // 6. Extract UTM params
  const searchParams = request.nextUrl.searchParams;
  const utmSource = searchParams.get('utm_source') || null;
  const utmMedium = searchParams.get('utm_medium') || null;
  const utmCampaign = searchParams.get('utm_campaign') || null;

  // 6.5 Check for self-referral by IP (between extracting IP and inserting referral)
  const fraudEnabled = await getPlatformSetting<boolean>('affiliate.fraud.enabled', true);
  const selfReferralSignal = fraudEnabled
    ? await checkSelfReferralByIp(aff.userId, ipAddress)
    : { flagged: false, signalType: 'SELF_REFERRAL_IP', details: '', severity: 'WARNING' as const };

  // 7. Insert referral record (always, for analytics visibility — even when fraud-blocked)
  const [newReferral] = await db.insert(referral).values({
    affiliateId: aff.id,
    status: 'CLICKED',
    expiresAt,
    ipAddress,
    userAgent,
    utmSource,
    utmMedium,
    utmCampaign,
  }).returning({ id: referral.id });

  if (selfReferralSignal.flagged) {
    // Log audit event for fraud-blocked attribution
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
        referralId: newReferral?.id ?? null,
        ipAddress,
      },
      ipAddress,
    });

    // Escalate the affiliate (three-strikes)
    void escalateAffiliate(aff.id, selfReferralSignal, 'SYSTEM');

    // Do NOT set attribution cookie — redirect without it
    return NextResponse.redirect(new URL('/auth/signup', request.url));
  }

  // 8. Set attribution cookie only if none exists (first-touch)
  const cookieStore = await cookies();
  const existingRef = cookieStore.get(REFERRAL_COOKIE_NAME);

  if (!existingRef && newReferral) {
    cookieStore.set(REFERRAL_COOKIE_NAME, newReferral.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: aff.cookieDurationDays * 24 * 60 * 60,
    });
  }

  // 9. Redirect to signup
  return NextResponse.redirect(new URL('/auth/signup', request.url));
}
