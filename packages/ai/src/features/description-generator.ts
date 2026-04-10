/**
 * Description Generation Feature
 *
 * Generates or improves listing descriptions from title, attributes, and photos.
 * Uses completion model for text-only, vision model when images are provided.
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
import { DESCRIPTION_SYSTEM_PROMPT } from '../prompts/description-system';

const FEATURE: AiFeature = 'description';

const DescriptionSchema = z.object({
  description: z.string(),
  suggestedTags: z.array(z.string()),
  seoKeywords: z.array(z.string()),
});

export interface DescriptionRequest {
  title: string;
  brand?: string;
  condition?: string;
  categoryName?: string;
  attributes?: Record<string, string>;
  imageUrls?: string[];
  tone?: 'professional' | 'casual' | 'luxury';
  existingDescription?: string;
  mode?: 'generate' | 'improve';
  userId: string;
}

export interface DescriptionResult {
  description: string;
  suggestedTags: string[];
  seoKeywords: string[];
  inputTokens: number;
  outputTokens: number;
}

export async function generateDescription(req: DescriptionRequest): Promise<DescriptionResult> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('ai.description.enabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. Rate limit
  const { allowed } = await checkRateLimit(FEATURE, req.userId);
  if (!allowed) throw new Error('Daily description generation limit reached');

  // 3. Budget
  await checkBudget(FEATURE);

  // 4. Build prompt
  const maxLength = await getPlatformSetting<number>('ai.description.maxLength', 2000);
  const tone = req.tone ?? 'professional';
  const mode = req.mode ?? 'generate';

  const parts: string[] = [
    `Title: ${req.title}`,
  ];
  if (req.brand) parts.push(`Brand: ${req.brand}`);
  if (req.condition) parts.push(`Condition: ${req.condition}`);
  if (req.categoryName) parts.push(`Category: ${req.categoryName}`);
  if (req.attributes) {
    const attrs = Object.entries(req.attributes).map(([k, v]) => `${k}: ${v}`).join(', ');
    parts.push(`Attributes: ${attrs}`);
  }
  if (req.existingDescription && mode === 'improve') {
    parts.push(`Existing description to improve: ${req.existingDescription}`);
  }
  parts.push(`Tone: ${tone}`);
  parts.push(`Max length: ${maxLength} characters`);
  parts.push(`Mode: ${mode}`);

  const userPrompt = parts.join('\n');

  // 5. Check cache (only for deterministic calls)
  const ck = cacheKey('completion', userPrompt, tone, String(maxLength));
  const cached = await getCached('completion', ck);
  if (cached) {
    const parsed = DescriptionSchema.parse(JSON.parse(cached));
    return { ...parsed, inputTokens: 0, outputTokens: 0 };
  }

  // 6. Resolve provider and call
  const provider = await resolveProvider();
  const hasImages = req.imageUrls && req.imageUrls.length > 0;

  let inputTokens: number;
  let outputTokens: number;
  let model: string;
  let rawText: string;

  if (hasImages) {
    const visionModel = await getPlatformSetting<string>('ai.model.vision', 'gpt-4o-mini');
    const res = await provider.vision({
      model: visionModel,
      systemPrompt: DESCRIPTION_SYSTEM_PROMPT,
      userPrompt,
      imageUrls: req.imageUrls!.slice(0, 8),
      maxTokens: 1024,
      temperature: 0.4,
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
      systemPrompt: DESCRIPTION_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1024,
      temperature: 0.4,
      jsonMode: true,
    });
    inputTokens = res.inputTokens;
    outputTokens = res.outputTokens;
    model = res.model;
    rawText = res.text;
  }

  // 7. Parse and validate
  const parsed = DescriptionSchema.parse(JSON.parse(rawText));

  // Enforce max length
  const truncatedDescription = parsed.description.slice(0, maxLength);

  // 8. Cache result
  const resultJson = JSON.stringify({ ...parsed, description: truncatedDescription });
  const ttl = await getPlatformSetting<number>('ai.cache.completionTtlSeconds', 3600);
  void setCached('completion', ck, resultJson, ttl);

  // 9. Log usage
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

  logger.debug('[ai:description] Generated', { mode, tone, length: truncatedDescription.length });

  return {
    description: truncatedDescription,
    suggestedTags: parsed.suggestedTags,
    seoKeywords: parsed.seoKeywords,
    inputTokens,
    outputTokens,
  };
}
