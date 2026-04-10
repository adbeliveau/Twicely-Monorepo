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

  // AI Fraud Detection (Canonical 26 §15 / C26 §7)
  { key: 'ai.fraud.enabled', value: true, type: 'boolean', category: 'ai', description: 'Master toggle for AI fraud detection' },
  { key: 'ai.fraud.flagThreshold', value: 0.3, type: 'number', category: 'ai', description: 'Risk score threshold to FLAG a transaction (0–1)' },
  { key: 'ai.fraud.blockThreshold', value: 0.7, type: 'number', category: 'ai', description: 'Risk score threshold to BLOCK a transaction (0–1)' },

  // AI Models & Providers
  { key: 'ai.provider', value: 'openai', type: 'string', category: 'ai', description: 'Primary AI provider (openai, anthropic)' },
  { key: 'ai.provider.fallback', value: 'anthropic', type: 'string', category: 'ai', description: 'Fallback AI provider' },
  { key: 'ai.model.completionDefault', value: 'gpt-4o-mini', type: 'string', category: 'ai', description: 'Default completion model ID' },
  { key: 'ai.model.completionPremium', value: 'gpt-4o', type: 'string', category: 'ai', description: 'Premium completion model (fraud, authentication)' },
  { key: 'ai.model.vision', value: 'gpt-4o-mini', type: 'string', category: 'ai', description: 'Default vision model ID' },
  { key: 'ai.model.visionPremium', value: 'gpt-4o', type: 'string', category: 'ai', description: 'Premium vision model (authentication)' },
  { key: 'ai.model.embedding', value: 'text-embedding-3-small', type: 'string', category: 'ai', description: 'Embedding model ID' },
  { key: 'ai.model.embeddingDimensions', value: 512, type: 'number', category: 'ai', description: 'Embedding dimensions' },

  // AI Budget & Cache
  { key: 'ai.budget.monthlyInputTokens', value: 50000000, type: 'number', category: 'ai', description: 'Monthly input token budget' },
  { key: 'ai.budget.monthlyOutputTokens', value: 10000000, type: 'number', category: 'ai', description: 'Monthly output token budget' },
  { key: 'ai.budget.hardCapEnabled', value: true, type: 'boolean', category: 'ai', description: 'Hard-stop when budget exhausted (vs soft warning)' },
  { key: 'ai.budget.alertThresholdPct', value: 80, type: 'number', category: 'ai', description: 'Budget usage % to trigger alert' },
  { key: 'ai.cache.completionTtlSeconds', value: 3600, type: 'number', category: 'ai', description: 'Completion cache TTL (1 hour)' },
  { key: 'ai.cache.embeddingTtlSeconds', value: 604800, type: 'number', category: 'ai', description: 'Embedding cache TTL (7 days)' },
];
