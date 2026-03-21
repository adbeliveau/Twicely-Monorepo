'use server';

/**
 * Admin Connector Settings Actions (G10.13)
 * Update crosslister connector platform_settings — audited with history.
 */

import { db } from '@twicely/db';
import {
  platformSetting,
  platformSettingHistory,
  auditEvent,
} from '@twicely/db/schema';
import { eq, like } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ─── Connector auth config ────────────────────────────────────────────────────

const CONNECTOR_AUTH_CONFIG: Record<string, { type: 'OAUTH' | 'SESSION'; requiredKeys: string[] }> = {
  ebay: { type: 'OAUTH', requiredKeys: ['clientId', 'clientSecret'] },
  etsy: { type: 'OAUTH', requiredKeys: ['clientId', 'clientSecret'] },
  mercari: { type: 'OAUTH', requiredKeys: ['clientId', 'clientSecret'] },
  depop: { type: 'OAUTH', requiredKeys: ['clientId', 'clientSecret'] },
  grailed: { type: 'OAUTH', requiredKeys: ['clientId', 'clientSecret'] },
  fbMarketplace: { type: 'OAUTH', requiredKeys: ['clientId', 'clientSecret'] },
  poshmark: { type: 'SESSION', requiredKeys: ['apiBase'] },
  therealreal: { type: 'SESSION', requiredKeys: ['apiBase'] },
  shopify: { type: 'OAUTH', requiredKeys: ['clientId', 'clientSecret'] },
};

const updateConnectorSettingsSchema = z.object({
  connectorCode: z.string().min(1).max(50),
  settings: z.record(z.string(), z.unknown()),
}).strict();

/**
 * Batch-update platform_settings for a crosslister connector.
 * Each key must start with "crosslister.{connectorCode}."
 */
export async function updateConnectorSettings(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateConnectorSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { connectorCode, settings } = parsed.data;
  const prefix = `crosslister.${connectorCode}.`;

  for (const [key, value] of Object.entries(settings)) {
    if (!key.startsWith(prefix)) continue;

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
        reason: `Connector settings update: ${connectorCode}`,
      });

      await db
        .update(platformSetting)
        .set({
          value,
          updatedByStaffId: session.staffUserId,
          updatedAt: new Date(),
        })
        .where(eq(platformSetting.id, existing.id));
    }
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_CONNECTOR_SETTINGS',
    subject: 'Setting',
    subjectId: connectorCode,
    severity: 'HIGH',
    detailsJson: { connectorCode, keys: Object.keys(settings) },
  });

  revalidatePath(`/cfg/${connectorCode}`);
  return { success: true };
}

// ─── testConnectorConnection ──────────────────────────────────────────────────

const testConnectorConnectionSchema = z.object({
  connectorCode: z.string().min(1).max(50),
}).strict();

/**
 * Validate that a connector's credentials are configured in platform_settings.
 * Does not make external API calls — checks setting presence only.
 */
export async function testConnectorConnection(input: unknown): Promise<
  | { success: boolean; message: string; checks?: { hasCredentials: boolean; hasEnabledFeature: boolean } }
  | { error: string }
> {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return { error: 'Forbidden' };
  }

  const parsed = testConnectorConnectionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { connectorCode } = parsed.data;

  const authConfig = CONNECTOR_AUTH_CONFIG[connectorCode];
  if (!authConfig) {
    return { success: false, message: `Unknown connector: ${connectorCode}` };
  }

  const settings = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(like(platformSetting.key, `crosslister.${connectorCode}.%`));

  const settingMap = new Map(settings.map((s) => [s.key, s.value]));

  const hasCredentials = authConfig.requiredKeys.every((k) => {
    const val = settingMap.get(`crosslister.${connectorCode}.${k}`);
    return typeof val === 'string' && val.trim().length > 0;
  });

  const enabledKeys = ['importEnabled', 'crosslistEnabled', 'automationEnabled'];
  const hasEnabledFeature = enabledKeys.some((k) => {
    const val = settingMap.get(`crosslister.${connectorCode}.${k}`);
    return val === true || val === 'true';
  });

  const success = hasCredentials;
  const message = success
    ? `${connectorCode} credentials are configured`
    : `${connectorCode} is missing required credentials`;

  return { success, message, checks: { hasCredentials, hasEnabledFeature } };
}
