/**
 * Smart Categorization Feature
 *
 * Categorizes listings into taxonomy. Returns top 3 suggestions.
 * Uses structured output with zod schema.
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
import { getCached, setCached, cacheKey } from '../cache';
import { CATEGORIZE_SYSTEM_PROMPT } from '../prompts/categorize-system';

const FEATURE: AiFeature = 'categorize';

const CategorySuggestionSchema = z.object({
  categoryId: z.string(),
  categoryPath: z.string(),
  confidence: z.number().min(0).max(1),
});

const CategorizationResultSchema = z.object({
  suggestions: z.array(CategorySuggestionSchema),
});

export interface CategorizationRequest {
  title: string;
  description?: string;
  imageUrl?: string;
  brand?: string;
  categoryTree?: string;
  userId?: string;
}

export interface CategorySuggestion {
  categoryId: string;
  categoryPath: string;
  confidence: number;
}

export async function suggestCategories(req: CategorizationRequest): Promise<CategorySuggestion[]> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('ai.categorize.enabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. Rate limit (optional userId)
  if (req.userId) {
    const { allowed } = await checkRateLimit(FEATURE, req.userId);
    if (!allowed) throw new Error('Daily categorization limit reached');
  }

  // 3. Budget
  await checkBudget(FEATURE);

  // 4. Build prompt
  const parts: string[] = [`Title: ${req.title}`];
  if (req.description) parts.push(`Description: ${req.description}`);
  if (req.brand) parts.push(`Brand: ${req.brand}`);
  if (req.categoryTree) parts.push(`Available categories:\n${req.categoryTree}`);
  parts.push('Return exactly 3 category suggestions as JSON with a "suggestions" array.');

  const userPrompt = parts.join('\n');

  // 5. Cache check
  const ck = cacheKey('completion', 'categorize', userPrompt);
  const cached = await getCached('completion', ck);
  if (cached) {
    const parsed = CategorizationResultSchema.parse(JSON.parse(cached));
    return parsed.suggestions.slice(0, 3);
  }

  // 6. Call provider
  const provider = await resolveProvider();
  let inputTokens: number;
  let outputTokens: number;
  let model: string;
  let rawText: string;

  if (req.imageUrl) {
    const visionModel = await getPlatformSetting<string>('ai.model.vision', 'gpt-4o-mini');
    const res = await provider.vision({
      model: visionModel,
      systemPrompt: CATEGORIZE_SYSTEM_PROMPT,
      userPrompt,
      imageUrls: [req.imageUrl],
      maxTokens: 512,
      temperature: 0.1,
      jsonMode: true,
    });
    inputTokens = res.inputTokens;
    outputTokens = res.outputTokens;
    model = res.model;
    rawText = res.text;
  } else {
    const completionModel = await getPlatformSetting<string>('ai.model.completionDefault', 'gpt-4o-mini');
    const res = await provider.complete({
      model: completionModel,
      systemPrompt: CATEGORIZE_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 512,
      temperature: 0.1,
      jsonMode: true,
    });
    inputTokens = res.inputTokens;
    outputTokens = res.outputTokens;
    model = res.model;
    rawText = res.text;
  }

  // 7. Parse
  const parsed = CategorizationResultSchema.parse(JSON.parse(rawText));
  const suggestions = parsed.suggestions.slice(0, 3);

  // 8. Cache
  const ttl = await getPlatformSetting<number>('ai.cache.completionTtlSeconds', 3600);
  void setCached('completion', ck, JSON.stringify({ suggestions }), ttl);

  // 9. Log
  void logUsage({
    feature: FEATURE,
    userId: req.userId,
    provider: provider.name,
    model,
    inputTokens,
    outputTokens,
    latencyMs: 0,
    cached: false,
  });

  logger.debug('[ai:categorize] Suggested', { count: suggestions.length });
  return suggestions;
}
