/**
 * Price Suggestion Feature
 *
 * Suggests prices based on market data and AI analysis.
 * If sufficient market data exists (>= minSampleSize), returns market-based
 * pricing without an AI call. AI is only used when data is sparse.
 */

import { z } from 'zod';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiFeature } from '../types';
import { AiDisabledError } from '../types';
import { resolveProvider } from '../providers/provider-resolver';
import { checkRateLimit } from '../rate-limiter';
import { checkBudget } from '../budget';
import { logUsage } from '../usage-log';
import { PRICING_SYSTEM_PROMPT } from '../prompts/pricing-system';

const FEATURE: AiFeature = 'pricing';

const PricingResultSchema = z.object({
  suggestedPriceCents: z.number().int().positive(),
  lowCents: z.number().int().positive(),
  highCents: z.number().int().positive(),
  marketMedianCents: z.number().int().nonnegative(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  reasoning: z.string(),
  sampleSize: z.number().int().nonnegative(),
});

export interface PriceSuggestionRequest {
  title: string;
  categoryId: string;
  brand?: string;
  condition: string;
  imageUrl?: string;
  marketData?: {
    medianCents: number;
    lowCents: number;
    highCents: number;
    sampleSize: number;
  };
  userId?: string;
}

export interface PriceSuggestionResult {
  suggestedPriceCents: number;
  lowCents: number;
  highCents: number;
  marketMedianCents: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  sampleSize: number;
}

/**
 * Compute condition multiplier for market-based pricing.
 */
function conditionMultiplier(condition: string): number {
  switch (condition.toUpperCase()) {
    case 'NEW_WITH_TAGS': return 1.15;
    case 'NEW_WITHOUT_TAGS': return 1.08;
    case 'LIKE_NEW': return 1.0;
    case 'GOOD': return 0.85;
    case 'FAIR': return 0.65;
    case 'POOR': return 0.50;
    default: return 0.85;
  }
}

export async function suggestPrice(req: PriceSuggestionRequest): Promise<PriceSuggestionResult> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('ai.pricing.enabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. Rate limit
  if (req.userId) {
    const { allowed } = await checkRateLimit(FEATURE, req.userId);
    if (!allowed) throw new Error('Daily pricing suggestion limit reached');
  }

  // 3. Check if sufficient market data exists
  const minSampleSize = await getPlatformSetting<number>('ai.pricing.minSampleSize', 5);

  if (req.marketData && req.marketData.sampleSize >= minSampleSize) {
    // Market data is sufficient — return directly without AI call
    const multiplier = conditionMultiplier(req.condition);
    const suggestedPriceCents = Math.round(req.marketData.medianCents * multiplier);
    const lowCents = Math.round(req.marketData.lowCents * multiplier);
    const highCents = Math.round(req.marketData.highCents * multiplier);
    const confidence = req.marketData.sampleSize >= 10 ? 'HIGH' as const : 'MEDIUM' as const;

    return {
      suggestedPriceCents,
      lowCents,
      highCents,
      marketMedianCents: req.marketData.medianCents,
      confidence,
      reasoning: `Based on ${req.marketData.sampleSize} comparable listings. Adjusted for ${req.condition} condition.`,
      sampleSize: req.marketData.sampleSize,
    };
  }

  // 4. Budget check (only if we need an AI call)
  await checkBudget(FEATURE);

  // 5. Build prompt for AI
  const parts: string[] = [
    `Title: ${req.title}`,
    `Category ID: ${req.categoryId}`,
    `Condition: ${req.condition}`,
  ];
  if (req.brand) parts.push(`Brand: ${req.brand}`);
  if (req.marketData) {
    parts.push(`Market data (insufficient sample): median ${req.marketData.medianCents} cents, ${req.marketData.sampleSize} samples`);
  } else {
    parts.push('No market data available.');
  }

  const userPrompt = parts.join('\n');

  // 6. Call provider
  const provider = await resolveProvider();
  const completionModel = await getPlatformSetting<string>('ai.model.completionDefault', 'gpt-4o-mini');

  const res = await provider.complete({
    model: completionModel,
    systemPrompt: PRICING_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 512,
    temperature: 0.2,
    jsonMode: true,
  });

  // 7. Parse and validate
  const parsed = PricingResultSchema.parse(JSON.parse(res.text));

  // 8. Log usage
  void logUsage({
    feature: FEATURE,
    userId: req.userId,
    provider: provider.name,
    model: res.model,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    latencyMs: res.latencyMs,
    cached: false,
  });

  logger.debug('[ai:pricing] Suggested', {
    suggestedPriceCents: parsed.suggestedPriceCents,
    confidence: parsed.confidence,
  });

  return parsed;
}
