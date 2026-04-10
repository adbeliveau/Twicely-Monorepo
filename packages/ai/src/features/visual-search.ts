/**
 * Visual Search Feature
 *
 * Image-to-listing search. User uploads a photo, system finds visually similar listings.
 * 1. Vision model extracts attributes from uploaded image
 * 2. Generate text embedding from extracted attributes
 * 3. Return extracted attributes and similarity query data
 *
 * NOTE: The actual Typesense vector query is performed by the caller (@twicely/search)
 * to avoid circular deps. This module provides the embedding + attribute extraction.
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

const FEATURE: AiFeature = 'visual-search';

const VisualAttributeSchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  color: z.string().optional(),
  style: z.string().optional(),
  itemType: z.string().optional(),
  material: z.string().optional(),
  searchQuery: z.string(),
});

export interface VisualSearchRequest {
  imageUrl: string;
  maxResults?: number;
  categoryFilter?: string;
  userId: string;
}

export interface VisualSearchExtractionResult {
  extractedAttributes: {
    category?: string;
    brand?: string;
    color?: string;
    style?: string;
    itemType?: string;
    material?: string;
  };
  searchQuery: string;
  embedding: number[];
}

export async function extractVisualSearchData(req: VisualSearchRequest): Promise<VisualSearchExtractionResult> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('ai.visualSearch.enabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. Rate limit
  const { allowed } = await checkRateLimit(FEATURE, req.userId);
  if (!allowed) throw new Error('Daily visual search limit reached');

  // 3. Budget
  await checkBudget(FEATURE);

  // 4. Extract attributes from image using vision model
  const provider = await resolveProvider();
  const visionModel = await getPlatformSetting<string>('ai.model.vision', 'gpt-4o-mini');

  const systemPrompt = `You are a visual product analyzer for a resale marketplace. Given a product image, extract key attributes and generate a search query that would find similar items.`;
  const userPrompt = req.categoryFilter
    ? `Analyze this image. Category hint: ${req.categoryFilter}. Return JSON with: category, brand, color, style, itemType, material, searchQuery (a natural language search query to find similar items).`
    : `Analyze this image. Return JSON with: category, brand, color, style, itemType, material, searchQuery (a natural language search query to find similar items).`;

  const visionRes = await provider.vision({
    model: visionModel,
    systemPrompt,
    userPrompt,
    imageUrls: [req.imageUrl],
    maxTokens: 512,
    temperature: 0.1,
    jsonMode: true,
  });

  const attributes = VisualAttributeSchema.parse(JSON.parse(visionRes.text));

  // 5. Generate embedding from the extracted search query
  const embeddingModel = await getPlatformSetting<string>('ai.model.embedding', 'text-embedding-3-small');
  const dimensions = await getPlatformSetting<number>('ai.model.embeddingDimensions', 512);

  const embedRes = await provider.embed({
    model: embeddingModel,
    inputs: [attributes.searchQuery],
    dimensions,
  });

  // 6. Log usage (combined for both calls)
  void logUsage({
    feature: FEATURE,
    userId: req.userId,
    provider: provider.name,
    model: visionModel,
    inputTokens: visionRes.inputTokens + embedRes.totalTokens,
    outputTokens: visionRes.outputTokens,
    latencyMs: visionRes.latencyMs + embedRes.latencyMs,
    cached: false,
  });

  logger.debug('[ai:visual-search] Extracted', { searchQuery: attributes.searchQuery });

  return {
    extractedAttributes: {
      category: attributes.category,
      brand: attributes.brand,
      color: attributes.color,
      style: attributes.style,
      itemType: attributes.itemType,
      material: attributes.material,
    },
    searchQuery: attributes.searchQuery,
    embedding: embedRes.embeddings[0] ?? [],
  };
}
