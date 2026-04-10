/**
 * AI authentication provider factory.
 * Reads the active provider name from platform_settings and returns the
 * appropriate provider implementation.
 */

import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { AUTH_SETTINGS_KEYS } from './constants';
import { EntrupyProvider } from './entrupy-provider';
import type { AiAuthProvider } from './ai-provider';

export async function getAiAuthProvider(): Promise<AiAuthProvider> {
  const [providerName, webhookSecret] = await Promise.all([
    getPlatformSetting<string>(AUTH_SETTINGS_KEYS.AI_PROVIDER_NAME, 'entrupy'),
    getPlatformSetting<string>(AUTH_SETTINGS_KEYS.AI_PROVIDER_WEBHOOK_SECRET, ''),
  ]);

  switch (providerName) {
    case 'entrupy':
      return new EntrupyProvider(webhookSecret || undefined);
    default:
      throw new Error(`Unknown AI authentication provider: ${providerName}`);
  }
}
