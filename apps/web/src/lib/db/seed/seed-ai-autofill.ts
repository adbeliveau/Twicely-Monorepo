/**
 * AI Auto-Fill Platform Settings (G1.1)
 *
 * Monthly usage limits per StoreTier and feature configuration.
 * All values read at runtime from platform_settings — never hardcoded in app code.
 */

import type { PlatformSettingSeed } from './v32-platform-settings';

export const AI_AUTOFILL_SETTINGS: PlatformSettingSeed[] = [
  // AI Auto-Fill (G1.1)
  { key: 'ai.autofill.limitDefault', value: 10, type: 'number', category: 'ai', description: 'Monthly auto-fill limit for sellers with no Store subscription' },
  { key: 'ai.autofill.limitStarter', value: 50, type: 'number', category: 'ai', description: 'Monthly auto-fill limit for STARTER Store tier' },
  { key: 'ai.autofill.limitPro', value: 200, type: 'number', category: 'ai', description: 'Monthly auto-fill limit for PRO Store tier' },
  { key: 'ai.autofill.limitPower', value: -1, type: 'number', category: 'ai', description: 'Monthly auto-fill limit for POWER/ENTERPRISE tier (-1 = unlimited)' },
  { key: 'ai.autofill.enabled', value: true, type: 'boolean', category: 'ai', description: 'Master toggle for AI auto-fill feature' },
  { key: 'ai.autofill.model', value: 'claude-sonnet-4-5-20250514', type: 'string', category: 'ai', description: 'Claude model ID for vision analysis' },
  { key: 'ai.autofill.maxTokens', value: 2048, type: 'number', category: 'ai', description: 'Max tokens for Claude AI response' },
];
