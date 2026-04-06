'use server';

/**
 * Admin Settings Actions (E3.6)
 * Update platform settings — audited with history
 */

import { db } from '@twicely/db';
import { platformSetting, platformSettingHistory, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import { getValkeyClient } from '@twicely/db/cache';
import { logger } from '@twicely/logger';

const updateSettingSchema = z.object({
  settingId: zodId,
  value: z.unknown(),
  reason: z.string().min(1).max(500),
}).strict();

/** Shared type + range validation for platform setting values. Returns error string or null. */
function validateSettingValue(existing: { type: string | null; key: string }, value: unknown): string | null {
  const settingType = existing.type as string;
  if (settingType === 'number' && typeof value !== 'number') return 'Value must be a number for this setting';
  if (settingType === 'boolean' && typeof value !== 'boolean') return 'Value must be a boolean for this setting';
  if (settingType === 'string' && typeof value !== 'string') return 'Value must be a string for this setting';
  if (settingType === 'number' && typeof value === 'number') {
    const key = existing.key as string;
    if (key.includes('holdHours') && value < 1) return 'Hold hours must be at least 1';
    if (key.includes('minimumCents') && value < 0) return 'Minimum cannot be negative';
    if (key.includes('RateBps') && (value < 0 || value > 10000)) return 'Rate must be 0-10000 bps';
  }
  return null;
}

export async function updateSettingAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateSettingSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { settingId, value, reason } = parsed.data;

  // Fetch existing setting
  const [existing] = await db
    .select()
    .from(platformSetting)
    .where(eq(platformSetting.id, settingId))
    .limit(1);

  if (!existing) return { error: 'Setting not found' };

  // N1 Security: Validate value type matches the setting's declared type
  const validationError = validateSettingValue(existing, value);
  if (validationError) return { error: validationError };

  // Store history before update
  await db.insert(platformSettingHistory).values({
    settingId,
    previousValue: existing.value,
    newValue: value,
    changedByStaffId: session.staffUserId,
    reason,
  });

  // Update the setting
  await db
    .update(platformSetting)
    .set({
      value,
      updatedByStaffId: session.staffUserId,
      updatedAt: new Date(),
    })
    .where(eq(platformSetting.id, settingId));

  // Audit
  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_SETTING',
    subject: 'Setting',
    subjectId: settingId,
    severity: 'HIGH',
    detailsJson: {
      key: existing.key,
      reason,
    },
  });

  return { success: true };
}

/**
 * Quick setting update (used by toggle switches on the settings hub).
 * Still audited but does not require a reason field.
 */
export async function updatePlatformSetting(settingId: string, value: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) {
    return { error: 'Forbidden' };
  }

  const [existing] = await db
    .select()
    .from(platformSetting)
    .where(eq(platformSetting.id, settingId))
    .limit(1);

  if (!existing) return { error: 'Setting not found' };

  const validationError = validateSettingValue(existing, value);
  if (validationError) return { error: validationError };

  await db.insert(platformSettingHistory).values({
    settingId,
    previousValue: existing.value,
    newValue: value,
    changedByStaffId: session.staffUserId,
    reason: 'Quick update from settings hub',
  });

  await db
    .update(platformSetting)
    .set({
      value,
      updatedByStaffId: session.staffUserId,
      updatedAt: new Date(),
    })
    .where(eq(platformSetting.id, settingId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_SETTING',
    subject: 'Setting',
    subjectId: settingId,
    severity: 'MEDIUM',
    detailsJson: { key: existing.key },
  });

  return { success: true };
}

/**
 * Batch save general settings from the settings hub.
 * Upserts each key — creates if missing, updates if exists.
 */
const GENERAL_KEYS_META: Record<string, { type: string; category: string; description: string }> = {
  'general.siteName': { type: 'string', category: 'general', description: 'Platform name displayed to users' },
  'general.supportEmail': { type: 'string', category: 'general', description: 'Support contact email address' },
  'general.siteDescription': { type: 'string', category: 'general', description: 'Platform description' },
  'general.maintenanceMode': { type: 'boolean', category: 'general', description: 'Disable public access' },
  'general.registrationEnabled': { type: 'boolean', category: 'general', description: 'Allow new user registration' },
  'general.sellerRegistrationEnabled': { type: 'boolean', category: 'general', description: 'Allow seller registration' },
  'general.defaultCurrency': { type: 'string', category: 'general', description: 'Default currency' },
  'general.minListingPriceCents': { type: 'cents', category: 'general', description: 'Min listing price' },
  'general.maxListingPriceCents': { type: 'cents', category: 'general', description: 'Max listing price' },
  'general.staffInactivityTimeoutMinutes': { type: 'number', category: 'general', description: 'Staff timeout minutes' },
  'general.userInactivityTimeoutMinutes': { type: 'number', category: 'general', description: 'User timeout minutes' },
  'general.userSessionMaxDays': { type: 'number', category: 'general', description: 'Max session days' },
};

const saveGeneralSchema = z.record(z.string(), z.unknown()).refine(
  (obj) => Object.keys(obj).every((k) => k in GENERAL_KEYS_META),
  { message: 'Unknown setting key' },
);

export async function saveGeneralSettings(data: Record<string, unknown>) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) return { error: 'Forbidden' };

  const parsed = saveGeneralSchema.safeParse(data);
  if (!parsed.success) return { error: 'Invalid input' };

  for (const [key, value] of Object.entries(parsed.data)) {
    const meta = GENERAL_KEYS_META[key];
    if (!meta) continue;

    // N3 Security: Validate value type matches declared meta type
    const typeErr = validateSettingValue({ type: meta.type, key }, value);
    if (typeErr) return { error: `${key}: ${typeErr}` };

    const [existing] = await db
      .select()
      .from(platformSetting)
      .where(eq(platformSetting.key, key))
      .limit(1);

    if (existing) {
      await db.insert(platformSettingHistory).values({
        settingId: existing.id,
        previousValue: existing.value,
        newValue: value,
        changedByStaffId: session.staffUserId,
        reason: 'Settings hub update',
      });
      await db
        .update(platformSetting)
        .set({ value, updatedByStaffId: session.staffUserId, updatedAt: new Date() })
        .where(eq(platformSetting.id, existing.id));
    } else {
      await db.insert(platformSetting).values({
        key,
        value,
        type: meta.type,
        category: meta.category,
        description: meta.description,
      });
    }
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_SETTING',
    subject: 'Setting',
    subjectId: 'general-batch',
    severity: 'HIGH',
    detailsJson: { keys: Object.keys(parsed.data) },
  });

  // Propagate maintenance mode to Valkey (cross-instance)
  if ('general.maintenanceMode' in parsed.data) {
    const isEnabled = parsed.data['general.maintenanceMode'] === true;
    try {
      const valkey = getValkeyClient();
      if (isEnabled) {
        await valkey.set('platform:maintenance', '1');
      } else {
        await valkey.del('platform:maintenance');
      }
    } catch (err) {
      logger.warn('[saveGeneralSettings] Failed to propagate maintenanceMode to Valkey', { error: String(err) });
    }
  }

  revalidatePath('/cfg');
  return { success: true };
}
