/**
 * Smart Autofill Feature
 *
 * Auto-fill listing form fields from photos.
 * Uses vision model with structured output for consistent field extraction.
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
import { AUTOFILL_SYSTEM_PROMPT } from '../prompts/autofill-system';

const FEATURE: AiFeature = 'autofill';

const AutofillSchema = z.object({
  title: z.string(),
  description: z.string(),
  brand: z.string().nullable(),
  condition: z.string(),
  categorySlug: z.string(),
  attributes: z.record(z.string()),
  tags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type AutofillResult = z.infer<typeof AutofillSchema>;

export interface AutofillRequest {
  imageUrls: string[];
  categoryHint?: string;
  existingTitle?: string;
  userId: string;
}

export async function autofillFromImages(req: AutofillRequest): Promise<AutofillResult> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('ai.autofill.enabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. Rate limit
  const { allowed } = await checkRateLimit(FEATURE, req.userId);
  if (!allowed) throw new Error('Monthly autofill limit reached');

  // 3. Budget
  await checkBudget(FEATURE);

  // 4. Build prompt
  const model = await getPlatformSetting<string>('ai.model.vision', 'gpt-4o-mini');
  const maxTokens = await getPlatformSetting<number>('ai.autofill.maxTokens', 2048);

  const parts: string[] = [];
  if (req.existingTitle) parts.push(`Current title: ${req.existingTitle}`);
  if (req.categoryHint) parts.push(`Category hint: ${req.categoryHint}`);
  parts.push('Analyze the images and fill in listing details. Return JSON matching the schema.');

  const userPrompt = parts.join('\n');

  // 5. Call provider
  const provider = await resolveProvider();
  const res = await provider.vision({
    model,
    systemPrompt: AUTOFILL_SYSTEM_PROMPT,
    userPrompt,
    imageUrls: req.imageUrls.slice(0, 8),
    maxTokens,
    temperature: 0.2,
    jsonMode: true,
  });

  // 6. Parse
  const parsed = AutofillSchema.parse(JSON.parse(res.text));

  // 7. Log
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

  logger.debug('[ai:autofill] Complete', {
    confidence: parsed.confidence,
    brand: parsed.brand,
    categorySlug: parsed.categorySlug,
  });

  return parsed;
}
