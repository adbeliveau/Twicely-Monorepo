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
  const providerName = await getPlatformSetting<string>(
    AUTH_SETTINGS_KEYS.AI_PROVIDER_NAME,
    'entrupy'
  );

  switch (providerName) {
    case 'entrupy':
      return new EntrupyProvider();
    default:
      throw new Error(`Unknown AI authentication provider: ${providerName}`);
  }
}
