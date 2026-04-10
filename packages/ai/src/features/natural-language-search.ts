/**
 * Natural Language Search (Query Understanding) Feature
 *
 * Transforms natural language queries into structured search intent.
 * Runs on every search — optimized for speed (< 200ms target).
 * Aggressively cached: normalized queries cached 24 hours.
 */

import { z } from 'zod';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiFeature } from '../types';
import { AiDisabledError } from '../types';
import { resolveProvider } from '../providers/provider-resolver';
import { checkBudget } from '../budget';
import { logUsage } from '../usage-log';
import { getCached, setCached, cacheKey } from '../cache';
import { QUERY_UNDERSTANDING_PROMPT } from '../prompts/query-system';

const FEATURE: AiFeature = 'nl-query';

const PriceRangeSchema = z.object({
  minCents: z.number().int().optional(),
  maxCents: z.number().int().optional(),
}).optional();

const ExtractedFiltersSchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  condition: z.string().optional(),
  priceRange: PriceRangeSchema,
  color: z.string().optional(),
  size: z.string().optional(),
});

const QueryResultSchema = z.object({
  intent: z.enum(['product_search', 'brand_search', 'category_browse', 'question', 'ambiguous']),
  expandedQuery: z.string(),
  extractedFilters: ExtractedFiltersSchema,
  synonyms: z.array(z.string()),
  spellCorrection: z.string().nullable(),
});

export interface QueryUnderstandingRequest {
  query: string;
  userContext?: {
    recentCategories?: string[];
    preferredBrands?: string[];
  };
}

export interface QueryUnderstandingResult {
  intent: 'product_search' | 'brand_search' | 'category_browse' | 'question' | 'ambiguous';
  expandedQuery: string;
  extractedFilters: {
    category?: string;
    brand?: string;
    condition?: string;
    priceRange?: { minCents?: number; maxCents?: number };
    color?: string;
    size?: string;
  };
  synonyms: string[];
  spellCorrection: string | null;
}

export async function understandQuery(req: QueryUnderstandingRequest): Promise<QueryUnderstandingResult> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('ai.nlQuery.enabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. Normalize query for cache key
  const normalizedQuery = req.query.trim().toLowerCase();

  // 3. Check cache (aggressively cached for speed)
  const ck = cacheKey('completion', 'query', normalizedQuery);
  const cached = await getCached('completion', ck);
  if (cached) {
    return QueryResultSchema.parse(JSON.parse(cached));
  }

  // 4. Budget
  await checkBudget(FEATURE);

  // 5. Build prompt
  const parts = [`Query: "${req.query}"`];
  if (req.userContext?.recentCategories?.length) {
    parts.push(`User recent categories: ${req.userContext.recentCategories.join(', ')}`);
  }
  if (req.userContext?.preferredBrands?.length) {
    parts.push(`User preferred brands: ${req.userContext.preferredBrands.join(', ')}`);
  }

  const userPrompt = parts.join('\n');

  // 6. Call provider (fast model, low temperature)
  const provider = await resolveProvider();
  const model = await getPlatformSetting<string>('ai.model.completionDefault', 'gpt-4o-mini');

  const res = await provider.complete({
    model,
    systemPrompt: QUERY_UNDERSTANDING_PROMPT,
    userPrompt,
    maxTokens: 512,
    temperature: 0,
    jsonMode: true,
  });

  // 7. Parse
  const parsed = QueryResultSchema.parse(JSON.parse(res.text));

  // 8. Cache for 24 hours
  void setCached('completion', ck, JSON.stringify(parsed), 86400);

  // 9. Log
  void logUsage({
    feature: FEATURE,
    provider: provider.name,
    model: res.model,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    latencyMs: res.latencyMs,
    cached: false,
  });

  logger.debug('[ai:nl-query] Understood', {
    query: req.query,
    intent: parsed.intent,
    latencyMs: res.latencyMs,
  });

  return parsed;
}
