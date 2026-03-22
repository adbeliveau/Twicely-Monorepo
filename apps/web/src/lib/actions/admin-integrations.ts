'use server';

/**
 * Admin Integration Actions (F1.2)
 * Stripe and Shippo key management + connection tests
 */

import { db } from '@twicely/db';
import {
  platformSetting,
  platformSettingHistory,
  providerInstance,
  providerSecret,
  auditEvent,
} from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';

const updateKeysSchema = z.object({
  provider: z.enum(['stripe', 'shippo', 'resend', 'anthropic', 'taxjar']),
  testSecretKey: z.string().optional(),
  liveSecretKey: z.string().optional(),
  testPublishableKey: z.string().optional(),
  livePublishableKey: z.string().optional(),
  webhookSigningSecret: z.string().optional(),
  connectWebhookSecret: z.string().optional(),
  identityWebhookSecret: z.string().optional(),
  apiKey: z.string().optional(),
}).strict();

async function getOrCreateInstance(
  instanceName: string,
  adapterCode: string,
  staffId: string
): Promise<string> {
  const [existing] = await db
    .select({ id: providerInstance.id })
    .from(providerInstance)
    .where(eq(providerInstance.name, instanceName))
    .limit(1);

  if (existing) return existing.id;

  const id = createId();
  await db.insert(providerInstance).values({
    id,
    adapterId: adapterCode,
    name: instanceName,
    displayName: instanceName,
    createdByStaffId: staffId,
  });
  return id;
}

async function upsertSecret(instanceId: string, key: string, value: string) {
  const [existing] = await db
    .select({ id: providerSecret.id })
    .from(providerSecret)
    .where(and(
      eq(providerSecret.instanceId, instanceId),
      eq(providerSecret.key, key)
    ))
    .limit(1);

  if (existing) {
    await db
      .update(providerSecret)
      .set({ encryptedValue: value, updatedAt: new Date() })
      .where(eq(providerSecret.id, existing.id));
  } else {
    await db.insert(providerSecret).values({
      instanceId,
      key,
      encryptedValue: value,
    });
  }
}

export async function updateIntegrationKeys(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateKeysSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { provider, testSecretKey, liveSecretKey, testPublishableKey, livePublishableKey, webhookSigningSecret, connectWebhookSecret, identityWebhookSecret, apiKey } = parsed.data;
  const instanceName = `${provider}-primary`;
  const instanceId = await getOrCreateInstance(instanceName, instanceName, session.staffUserId);

  if (testSecretKey) await upsertSecret(instanceId, 'test_secret_key', testSecretKey);
  if (liveSecretKey) await upsertSecret(instanceId, 'live_secret_key', liveSecretKey);
  if (testPublishableKey) await upsertSecret(instanceId, 'test_publishable_key', testPublishableKey);
  if (livePublishableKey) await upsertSecret(instanceId, 'live_publishable_key', livePublishableKey);
  if (webhookSigningSecret) await upsertSecret(instanceId, 'webhook_signing_secret', webhookSigningSecret);
  if (connectWebhookSecret) await upsertSecret(instanceId, 'connect_webhook_secret', connectWebhookSecret);
  if (identityWebhookSecret) await upsertSecret(instanceId, 'identity_webhook_secret', identityWebhookSecret);
  if (apiKey) await upsertSecret(instanceId, 'api_key', apiKey);

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_INTEGRATION_KEYS',
    subject: 'Setting',
    subjectId: instanceId,
    severity: 'HIGH',
    detailsJson: { provider },
  });

  return { success: true };
}

export async function testStripeConnection() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return { error: 'Forbidden' };
  }

  // Attempt to validate Stripe keys by checking if they exist
  const [instance] = await db
    .select({ id: providerInstance.id })
    .from(providerInstance)
    .where(eq(providerInstance.name, 'stripe-primary'))
    .limit(1);

  if (!instance) {
    return { success: false, message: 'No Stripe instance configured' };
  }

  const secrets = await db
    .select({ key: providerSecret.key })
    .from(providerSecret)
    .where(eq(providerSecret.instanceId, instance.id));

  const hasKeys = secrets.some((s) => s.key === 'live_secret_key' || s.key === 'test_secret_key');

  if (!hasKeys) {
    return { success: false, message: 'No API keys configured' };
  }

  return { success: true, message: 'Stripe keys are configured' };
}

export async function testShippoConnection() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return { error: 'Forbidden' };
  }

  const [instance] = await db
    .select({ id: providerInstance.id })
    .from(providerInstance)
    .where(eq(providerInstance.name, 'shippo-primary'))
    .limit(1);

  if (!instance) {
    return { success: false, message: 'No Shippo instance configured' };
  }

  const secrets = await db
    .select({ key: providerSecret.key })
    .from(providerSecret)
    .where(eq(providerSecret.instanceId, instance.id));

  const hasKeys = secrets.some((s) => s.key === 'live_secret_key' || s.key === 'test_secret_key');

  if (!hasKeys) {
    return { success: false, message: 'No API keys configured' };
  }

  return { success: true, message: 'Shippo keys are configured' };
}

const toggleModuleSchema = z.object({
  moduleKey: z.string().min(1),
  enabled: z.boolean(),
}).strict();

export async function toggleIntegrationModule(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) {
    return { error: 'Forbidden' };
  }

  const parsed = toggleModuleSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { moduleKey, enabled } = parsed.data;

  const [existing] = await db
    .select()
    .from(platformSetting)
    .where(eq(platformSetting.key, moduleKey))
    .limit(1);

  if (!existing) {
    // Create the setting if it doesn't exist
    await db.insert(platformSetting).values({
      key: moduleKey,
      value: enabled,
      type: 'boolean',
      category: 'integrations',
      description: `Enable/disable ${moduleKey}`,
    });
  } else {
    await db.insert(platformSettingHistory).values({
      settingId: existing.id,
      previousValue: existing.value,
      newValue: enabled,
      changedByStaffId: session.staffUserId,
      reason: `Module ${enabled ? 'enabled' : 'disabled'}`,
    });

    await db
      .update(platformSetting)
      .set({ value: enabled, updatedAt: new Date(), updatedByStaffId: session.staffUserId })
      .where(eq(platformSetting.id, existing.id));
  }

  return { success: true };
}
