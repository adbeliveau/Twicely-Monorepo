/**
 * Recommendation Engine Feature
 *
 * Personalized product recommendations based on user behavior signals.
 * Hybrid approach: embedding similarity + collaborative filtering + rule-based boost.
 * No AI completion call needed — purely embedding + scoring.
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiFeature } from '../types';
import { AiDisabledError } from '../types';
import { resolveProvider } from '../providers/provider-resolver';
import { logUsage } from '../usage-log';

const FEATURE: AiFeature = 'recommendations';

export interface RecommendationRequest {
  userId: string;
  context: 'home_feed' | 'listing_detail' | 'cart' | 'post_purchase';
  currentListingId?: string;
  maxResults?: number;
  signals: {
    viewedListingIds: string[];
    savedListingIds: string[];
    purchasedCategoryIds: string[];
    searchQueries: string[];
    priceRangeCents?: { min: number; max: number };
  };
}

export interface RecommendationItem {
  listingId: string;
  score: number;
  reason: 'similar_to_viewed' | 'popular_in_category' | 'price_match' | 'trending' | 'collaborative';
}

export interface RecommendationResult {
  listings: RecommendationItem[];
  embedding: number[];
}

/**
 * Build a user interest text profile from their signals for embedding.
 */
function buildUserProfile(signals: RecommendationRequest['signals']): string {
  const parts: string[] = [];

  if (signals.searchQueries.length > 0) {
    parts.push(`Recent searches: ${signals.searchQueries.slice(0, 10).join(', ')}`);
  }
  if (signals.purchasedCategoryIds.length > 0) {
    parts.push(`Purchased categories: ${signals.purchasedCategoryIds.slice(0, 10).join(', ')}`);
  }
  if (signals.priceRangeCents) {
    const minDollars = (signals.priceRangeCents.min / 100).toFixed(0);
    const maxDollars = (signals.priceRangeCents.max / 100).toFixed(0);
    parts.push(`Price range: $${minDollars}-$${maxDollars}`);
  }

  return parts.join('. ') || 'General browsing interest in fashion and home goods.';
}

export async function getRecommendations(req: RecommendationRequest): Promise<RecommendationResult> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('ai.recommendations.enabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. Generate user interest embedding
  const provider = await resolveProvider();
  const embeddingModel = await getPlatformSetting<string>('ai.model.embedding', 'text-embedding-3-small');
  const dimensions = await getPlatformSetting<number>('ai.model.embeddingDimensions', 512);

  const userProfile = buildUserProfile(req.signals);

  const embedRes = await provider.embed({
    model: embeddingModel,
    inputs: [userProfile],
    dimensions,
  });

  const embedding = embedRes.embeddings[0] ?? [];

  // 3. Log usage
  void logUsage({
    feature: FEATURE,
    userId: req.userId,
    provider: provider.name,
    model: embeddingModel,
    inputTokens: embedRes.totalTokens,
    outputTokens: 0,
    latencyMs: embedRes.latencyMs,
    cached: false,
  });

  logger.debug('[ai:recommendations] Generated embedding for user', {
    userId: req.userId,
    context: req.context,
    profileLength: userProfile.length,
  });

  // NOTE: The actual Typesense vector query + collaborative filtering + scoring
  // is performed by the caller (@twicely/search) to avoid circular deps.
  // This module returns the embedding that the caller uses for nearest-neighbor lookup.

  return {
    listings: [],
    embedding,
  };
}
