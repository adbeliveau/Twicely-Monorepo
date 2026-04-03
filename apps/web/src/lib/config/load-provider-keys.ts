/**
 * Load provider API keys from providerSecret (encrypted DB) into process.env.
 * Called once at startup from instrumentation.ts, BEFORE any provider client is imported.
 * Falls back gracefully if no DB keys exist (env vars remain as-is).
 */

import { db } from '@twicely/db';
import { providerAdapter, providerInstance, providerSecret } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { decryptSecret } from '@/lib/crypto/provider-secrets';
import { logger } from '@twicely/logger';

/** Map of providerAdapter.code → { secretKey → envVar }. */
const PROVIDER_KEY_MAP: Record<string, Record<string, string>> = {
  stripe: {
    live_secret_key: 'STRIPE_SECRET_KEY',
    test_secret_key: 'STRIPE_TEST_SECRET_KEY',
    live_publishable_key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    webhook_signing_secret: 'STRIPE_WEBHOOK_SECRET',
    connect_webhook_secret: 'STRIPE_CONNECT_WEBHOOK_SECRET',
    identity_webhook_secret: 'STRIPE_IDENTITY_WEBHOOK_SECRET',
    subscription_webhook_secret: 'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET',
  },
  shippo: {
    api_key: 'SHIPPO_API_KEY',
  },
  resend: {
    api_key: 'RESEND_API_KEY',
  },
  anthropic: {
    api_key: 'ANTHROPIC_API_KEY',
  },
  taxjar: {
    api_key: 'TAXJAR_API_KEY',
  },
};

/**
 * Load all provider secrets from the DB and set them as process.env vars.
 * Existing env vars are NOT overwritten — DB keys only fill in gaps or
 * override when explicitly set by admin (DB takes priority).
 */
export async function loadProviderKeys(): Promise<void> {
  try {
    // Get all provider instances with their adapter codes (join to get code)
    const instances = await db
      .select({
        instanceId: providerInstance.id,
        adapterCode: providerAdapter.code,
      })
      .from(providerInstance)
      .innerJoin(providerAdapter, eq(providerAdapter.id, providerInstance.adapterId));

    let loaded = 0;

    for (const inst of instances) {
      const keyMap = PROVIDER_KEY_MAP[inst.adapterCode];
      if (!keyMap) continue;

      // Get all secrets for this instance
      const secrets = await db
        .select({
          key: providerSecret.key,
          encryptedValue: providerSecret.encryptedValue,
        })
        .from(providerSecret)
        .where(eq(providerSecret.instanceId, inst.instanceId));

      for (const secret of secrets) {
        const envVar = keyMap[secret.key];
        if (!envVar) continue;

        try {
          const decrypted = decryptSecret(secret.encryptedValue);
          if (decrypted) {
            process.env[envVar] = decrypted;
            loaded++;
          }
        } catch {
          logger.warn(`[loadProviderKeys] Failed to decrypt ${inst.adapterCode}.${secret.key}`);
        }
      }
    }

    if (loaded > 0) {
      logger.info(`[loadProviderKeys] Loaded ${loaded} provider key(s) from DB`);
    }
  } catch (err) {
    // DB not ready or no provider_instance table — env vars remain as-is
    logger.warn('[loadProviderKeys] Could not load from DB, using env vars', { error: String(err) });
  }
}
