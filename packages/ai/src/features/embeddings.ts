/**
 * Embedding Generation Feature
 *
 * Generates embeddings for listings and queries.
 * Used by search (vector indexing + query embedding) and recommendation engine.
 * Cached in Valkey for 7 days.
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiFeature } from '../types';
import { resolveProvider } from '../providers/provider-resolver';
import { logUsage } from '../usage-log';
import { getCached, setCached, cacheKey } from '../cache';

const FEATURE: AiFeature = 'embeddings';

/**
 * Generate embeddings for multiple texts. Handles caching per text.
 */
export async function embedTexts(texts: string[], dimensions?: number): Promise<number[][]> {
  const provider = await resolveProvider();
  const model = await getPlatformSetting<string>('ai.model.embedding', 'text-embedding-3-small');
  const dims = dimensions ?? await getPlatformSetting<number>('ai.model.embeddingDimensions', 512);

  // Check cache for each text
  const results: (number[] | null)[] = await Promise.all(
    texts.map(async (t) => {
      const key = cacheKey('embed', model, String(dims), t);
      const cached = await getCached('embed', key);
      return cached ? (JSON.parse(cached) as number[]) : null;
    }),
  );

  const uncachedIndices = results
    .map((r, i) => (r === null ? i : -1))
    .filter((i) => i >= 0);

  if (uncachedIndices.length > 0) {
    const uncachedTexts = uncachedIndices.map((i) => texts[i]!);
    const res = await provider.embed({ model, inputs: uncachedTexts, dimensions: dims });

    const ttl = await getPlatformSetting<number>('ai.cache.embeddingTtlSeconds', 604800);

    for (let j = 0; j < uncachedIndices.length; j++) {
      const idx = uncachedIndices[j]!;
      results[idx] = res.embeddings[j]!;
      const key = cacheKey('embed', model, String(dims), texts[idx]!);
      void setCached('embed', key, JSON.stringify(res.embeddings[j]), ttl);
    }

    void logUsage({
      feature: FEATURE,
      provider: provider.name,
      model,
      inputTokens: res.totalTokens,
      outputTokens: 0,
      latencyMs: res.latencyMs,
      cached: false,
    });
  }

  logger.debug('[ai:embeddings] Generated', {
    total: texts.length,
    cached: texts.length - uncachedIndices.length,
    computed: uncachedIndices.length,
  });

  return results as number[][];
}

/**
 * Generate embedding for a single query text.
 */
export async function embedQuery(query: string, dimensions?: number): Promise<number[]> {
  const [embedding] = await embedTexts([query], dimensions);
  return embedding!;
}

/**
 * Generate embedding for an image by first extracting a text description.
 * Uses vision model to describe the image, then embeds the description.
 */
export async function embedImage(imageUrl: string, dimensions?: number): Promise<number[]> {
  const provider = await resolveProvider();
  const visionModel = await getPlatformSetting<string>('ai.model.vision', 'gpt-4o-mini');

  // Extract text description from image
  const visionRes = await provider.vision({
    model: visionModel,
    systemPrompt: 'Describe this product image in a single sentence focusing on: item type, brand if visible, color, material, style, condition.',
    userPrompt: 'Describe this product image concisely for search embedding.',
    imageUrls: [imageUrl],
    maxTokens: 150,
    temperature: 0,
  });

  void logUsage({
    feature: FEATURE,
    provider: provider.name,
    model: visionModel,
    inputTokens: visionRes.inputTokens,
    outputTokens: visionRes.outputTokens,
    latencyMs: visionRes.latencyMs,
    cached: false,
  });

  // Embed the text description
  return embedQuery(visionRes.text, dimensions);
}
