'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@twicely/db';
import { affiliate, auditEvent } from '@twicely/db/schema';
import { authorize, sub } from '@twicely/casl';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getAffiliateByUserId } from '@/lib/queries/affiliate';
import { applyInfluencerSchema } from '@/lib/validations/affiliate';

interface ApplyInfluencerResult {
  success: boolean;
  error?: string;
}

export async function applyForInfluencer(input: unknown): Promise<ApplyInfluencerResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }

  if (!session.isSeller) {
    return { success: false, error: 'You must be a seller to apply for the influencer program' };
  }

  if (!ability.can('create', sub('Affiliate', { userId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // Feature flag checks
  const enabled = await getPlatformSetting('affiliate.enabled', true);
  if (!enabled) {
    return { success: false, error: 'The affiliate program is currently disabled' };
  }

  const influencerEnabled = await getPlatformSetting('affiliate.influencer.enabled', true);
  if (!influencerEnabled) {
    return { success: false, error: 'Influencer applications are currently disabled' };
  }

  const parsed = applyInfluencerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const data = parsed.data;

  // Serialize social links and audience size into applicationNote
  const applicationData = {
    note: data.applicationNote,
    socialLinks: data.socialLinks ?? null,
    audienceSize: data.audienceSize ?? null,
  };
  const serializedNote = JSON.stringify(applicationData);

  const existing = await getAffiliateByUserId(session.userId);

  if (existing) {
    if (existing.tier === 'INFLUENCER') {
      return { success: false, error: 'You have already applied for the influencer program' };
    }
    if (existing.status === 'SUSPENDED' || existing.status === 'BANNED') {
      return { success: false, error: 'Your affiliate account is not eligible to apply' };
    }
    // Existing COMMUNITY ACTIVE — upgrade to INFLUENCER PENDING
    await db
      .update(affiliate)
      .set({
        tier: 'INFLUENCER',
        status: 'PENDING',
        applicationNote: serializedNote,
        updatedAt: new Date(),
      })
      .where(eq(affiliate.id, existing.id));

    await db.insert(auditEvent).values({
      actorType: 'USER',
      actorId: session.userId,
      action: 'INFLUENCER_APPLIED',
      subject: 'Affiliate',
      subjectId: existing.id,
      severity: 'LOW',
      detailsJson: { tier: 'INFLUENCER', previousTier: 'COMMUNITY' },
    });
  } else {
    // No existing affiliate — create new INFLUENCER PENDING record
    const commissionRateBps = await getPlatformSetting('affiliate.influencer.defaultCommissionRateBps', 2500);
    const cookieDurationDays = await getPlatformSetting('affiliate.influencer.cookieDays', 60);
    const commissionDurationMonths = await getPlatformSetting('affiliate.commissionDurationMonths', 12);

    // Use provided referralCode or fall back to userId as placeholder
    const referralCode = data.referralCode ?? session.userId.toUpperCase().slice(0, 20);

    const [inserted] = await db
      .insert(affiliate)
      .values({
        userId: session.userId,
        tier: 'INFLUENCER',
        status: 'PENDING',
        referralCode,
        commissionRateBps,
        cookieDurationDays,
        commissionDurationMonths,
        applicationNote: serializedNote,
      })
      .returning();

    if (!inserted) {
      return { success: false, error: 'Failed to submit application' };
    }

    await db.insert(auditEvent).values({
      actorType: 'USER',
      actorId: session.userId,
      action: 'INFLUENCER_APPLIED',
      subject: 'Affiliate',
      subjectId: inserted.id,
      severity: 'LOW',
      detailsJson: { tier: 'INFLUENCER', previousTier: null },
    });
  }

  revalidatePath('/my/selling/affiliate');
  return { success: true };
}
