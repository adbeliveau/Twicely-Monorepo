/**
 * Admin Integration Queries (F1.2)
 * Stripe and Shippo settings — never returns real secret keys
 */

import { db } from '@twicely/db';
import { platformSetting, providerSecret, providerInstance } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';

export interface IntegrationSettings {
  moduleEnabled: boolean;
  hasTestSecretKey: boolean;
  hasLiveSecretKey: boolean;
  hasTestPublishableKey: boolean;
  hasLivePublishableKey: boolean;
  webhookUrl: string | null;
  connectEnabled: boolean;
  additionalConfig: Record<string, unknown>;
}

async function getSecretKeyPresence(instanceName: string): Promise<{
  hasTestSecretKey: boolean;
  hasLiveSecretKey: boolean;
  hasTestPublishableKey: boolean;
  hasLivePublishableKey: boolean;
}> {
  const [instance] = await db
    .select({ id: providerInstance.id })
    .from(providerInstance)
    .where(eq(providerInstance.name, instanceName))
    .limit(1);

  if (!instance) {
    return {
      hasTestSecretKey: false,
      hasLiveSecretKey: false,
      hasTestPublishableKey: false,
      hasLivePublishableKey: false,
    };
  }

  const secrets = await db
    .select({ key: providerSecret.key })
    .from(providerSecret)
    .where(eq(providerSecret.instanceId, instance.id));

  const keySet = new Set(secrets.map((s) => s.key));

  return {
    hasTestSecretKey: keySet.has('test_secret_key'),
    hasLiveSecretKey: keySet.has('live_secret_key'),
    hasTestPublishableKey: keySet.has('test_publishable_key'),
    hasLivePublishableKey: keySet.has('live_publishable_key'),
  };
}

async function getModuleEnabled(moduleKey: string): Promise<boolean> {
  const [row] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, moduleKey))
    .limit(1);

  return row?.value === true;
}

export async function getStripeSettings(): Promise<IntegrationSettings> {
  const [moduleEnabled, keyPresence] = await Promise.all([
    getModuleEnabled('integrations.stripe.enabled'),
    getSecretKeyPresence('stripe-primary'),
  ]);

  const [connectRow] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, 'integrations.stripe.connectEnabled'))
    .limit(1);

  const [webhookRow] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, 'integrations.stripe.webhookUrl'))
    .limit(1);

  return {
    moduleEnabled,
    ...keyPresence,
    webhookUrl: webhookRow?.value ? String(webhookRow.value) : null,
    connectEnabled: connectRow?.value === true,
    additionalConfig: {},
  };
}

export async function getShippoSettings(): Promise<IntegrationSettings> {
  const [moduleEnabled, keyPresence] = await Promise.all([
    getModuleEnabled('integrations.shippo.enabled'),
    getSecretKeyPresence('shippo-primary'),
  ]);

  const [webhookRow] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, 'integrations.shippo.webhookUrl'))
    .limit(1);

  return {
    moduleEnabled,
    ...keyPresence,
    webhookUrl: webhookRow?.value ? String(webhookRow.value) : null,
    connectEnabled: false,
    additionalConfig: {},
  };
}
