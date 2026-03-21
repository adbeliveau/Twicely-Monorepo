'use server';

/**
 * Admin Trust Settings Actions (F1.5 + I7)
 * Auto-moderation, fraud, verification thresholds.
 * I7: Band override set + revoke — ADMIN only.
 * bandOverrideBy is always set from session, never from input.
 */

import { db } from '@twicely/db';
import { platformSetting, platformSettingHistory, auditEvent, sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { z } from 'zod';

const updateTrustSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
}).strict();

export async function updateTrustSettings(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateTrustSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { key, value } = parsed.data;

  const [existing] = await db
    .select()
    .from(platformSetting)
    .where(eq(platformSetting.key, key))
    .limit(1);

  if (!existing) {
    await db.insert(platformSetting).values({
      key,
      value,
      type: typeof value === 'boolean' ? 'boolean' : 'string',
      category: 'trust',
      description: `Trust setting: ${key}`,
    });
  } else {
    await db.insert(platformSettingHistory).values({
      settingId: existing.id,
      previousValue: existing.value,
      newValue: value,
      changedByStaffId: session.staffUserId,
      reason: 'Trust settings update',
    });

    await db
      .update(platformSetting)
      .set({ value, updatedAt: new Date(), updatedByStaffId: session.staffUserId })
      .where(eq(platformSetting.id, existing.id));
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_TRUST_SETTING',
    subject: 'Setting',
    severity: 'HIGH',
    detailsJson: { key },
  });

  return { success: true };
}

// ─── Band Override Schemas (I7) ───────────────────────────────────────────────

const updateBandOverrideSchema = z.object({
  userId: z.string(),
  newBand: z.enum(['POWER_SELLER', 'TOP_RATED', 'ESTABLISHED', 'EMERGING']),
  reason: z.string().min(10).max(500),
  expiresInDays: z.number().int().min(1).max(365).optional().default(90),
}).strict();

const revokeBandOverrideSchema = z.object({
  userId: z.string(),
  reason: z.string().min(5),
}).strict();

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ─── Band Override Actions (I7) ───────────────────────────────────────────────

export async function updateBandOverride(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'SellerProfile')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateBandOverrideSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, newBand, reason, expiresInDays } = parsed.data;

  const [existing] = await db
    .select({ id: sellerProfile.id, performanceBand: sellerProfile.performanceBand })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!existing) return { error: 'Seller not found' };

  const expiresAt = addDays(new Date(), expiresInDays);

  await db
    .update(sellerProfile)
    .set({
      bandOverride: newBand,
      bandOverrideReason: reason,
      bandOverrideBy: session.staffUserId,
      bandOverrideExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(sellerProfile.userId, userId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'trust.band_override',
    subject: 'SellerProfile',
    subjectId: existing.id,
    severity: 'HIGH',
    detailsJson: { userId, newBand, reason, expiresInDays, previousBand: existing.performanceBand },
  });

  revalidatePath('/trust');
  revalidatePath(`/trust/sellers/${userId}`);
  return { success: true as const };
}

export async function revokeBandOverride(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'SellerProfile')) {
    return { error: 'Forbidden' };
  }

  const parsed = revokeBandOverrideSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, reason } = parsed.data;

  const [existing] = await db
    .select({ id: sellerProfile.id, bandOverride: sellerProfile.bandOverride })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!existing) return { error: 'Seller not found' };

  await db
    .update(sellerProfile)
    .set({
      bandOverride: null,
      bandOverrideExpiresAt: null,
      bandOverrideReason: null,
      bandOverrideBy: null,
      updatedAt: new Date(),
    })
    .where(eq(sellerProfile.userId, userId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'trust.band_override_revoked',
    subject: 'SellerProfile',
    subjectId: existing.id,
    severity: 'MEDIUM',
    detailsJson: { userId, reason, revokedOverride: existing.bandOverride },
  });

  revalidatePath('/trust');
  revalidatePath(`/trust/sellers/${userId}`);
  return { success: true as const };
}
