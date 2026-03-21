'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@twicely/db';
import { affiliate, user, auditEvent } from '@twicely/db/schema';
import { authorize, sub } from '@twicely/casl';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getAffiliateByUserId, getAffiliateByReferralCode } from '@/lib/queries/affiliate';
import { joinAffiliateSchema } from '@/lib/validations/affiliate';

interface JoinAffiliateResult {
  success: boolean;
  error?: string;
  referralCode?: string;
}

export async function joinAffiliateProgram(input: unknown): Promise<JoinAffiliateResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }

  if (!session.isSeller) {
    return { success: false, error: 'You must be a seller to join the affiliate program' };
  }

  if (!ability.can('create', sub('Affiliate', { userId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = joinAffiliateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // Check feature toggles
  const enabled = await getPlatformSetting('affiliate.enabled', true);
  if (!enabled) {
    return { success: false, error: 'The affiliate program is currently disabled' };
  }

  const communityEnabled = await getPlatformSetting('affiliate.community.enabled', true);
  if (!communityEnabled) {
    return { success: false, error: 'Community affiliate signup is currently disabled' };
  }

  // Check if already an affiliate
  const existing = await getAffiliateByUserId(session.userId);
  if (existing) {
    return { success: false, error: 'You are already registered as an affiliate' };
  }

  // Determine referral code — query user table since CaslSession lacks username
  const [userRow] = await db
    .select({ username: user.username })
    .from(user)
    .where(eq(user.id, session.userId))
    .limit(1);

  if (!parsed.data.referralCode && !userRow?.username) {
    return {
      success: false,
      error: 'Please set a username in your account settings before joining the affiliate program',
    };
  }

  const referralCode = parsed.data.referralCode ?? userRow!.username!.toUpperCase();

  // Check uniqueness
  const codeExists = await getAffiliateByReferralCode(referralCode);
  if (codeExists) {
    return { success: false, error: 'This referral code is already taken' };
  }

  // Read configurable values from platform_settings
  const commissionRateBps = await getPlatformSetting('affiliate.community.commissionRateBps', 1500);
  const cookieDays = await getPlatformSetting('affiliate.community.cookieDays', 30);
  const commissionDurationMonths = await getPlatformSetting('affiliate.commissionDurationMonths', 12);

  // Insert — community tier goes ACTIVE immediately (no approval needed)
  try {
    await db.insert(affiliate).values({
      userId: session.userId,
      tier: 'COMMUNITY',
      status: 'ACTIVE',
      referralCode,
      commissionRateBps,
      cookieDurationDays: cookieDays,
      commissionDurationMonths,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('unique')) {
      return { success: false, error: 'This referral code is already taken' };
    }
    throw err;
  }

  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: session.userId,
    action: 'AFFILIATE_JOINED',
    subject: 'Affiliate',
    subjectId: session.userId,
    severity: 'LOW',
    detailsJson: { tier: 'COMMUNITY', referralCode },
  });

  revalidatePath('/my/selling/affiliate');

  return { success: true, referralCode };
}
