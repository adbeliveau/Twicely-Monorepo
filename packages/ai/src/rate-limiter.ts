/**
 * AI Rate Limiter — Per-Feature Sliding Window
 *
 * Uses Valkey INCR with TTL for sliding window rate limiting.
 * Key pattern: ai:rate:{feature}:{userId}:{windowKey}
 *
 * Config loaded from platform_settings per feature.
 * Falls back to allowing requests if Valkey is unavailable (fail-open).
 */

import { getValkeyClient } from '@twicely/db/cache';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiFeature } from './types';

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/** Rate limit config defaults per feature */
const FEATURE_DEFAULTS: Record<AiFeature, { limitKey: string; defaultLimit: number; windowSeconds: number }> = {
  'autofill':        { limitKey: 'ai.autofill.limitDefault',     defaultLimit: 10,   windowSeconds: 30 * 24 * 3600 },
  'description':     { limitKey: 'ai.description.dailyLimit',    defaultLimit: 20,   windowSeconds: 24 * 3600 },
  'categorize':      { limitKey: 'ai.categorize.dailyLimit',     defaultLimit: 100,  windowSeconds: 24 * 3600 },
  'pricing':         { limitKey: 'ai.pricing.dailyLimit',        defaultLimit: 50,   windowSeconds: 24 * 3600 },
  'image-analysis':  { limitKey: 'ai.imageAnalysis.dailyLimit',  defaultLimit: 50,   windowSeconds: 24 * 3600 },
  'visual-search':   { limitKey: 'ai.visualSearch.dailyLimit',   defaultLimit: 30,   windowSeconds: 24 * 3600 },
  'authentication':  { limitKey: 'ai.authentication.dailyLimit', defaultLimit: 10,   windowSeconds: 24 * 3600 },
  'helpdesk':        { limitKey: 'ai.helpdesk.dailyLimitPerAgent', defaultLimit: 100, windowSeconds: 24 * 3600 },
  'fraud':           { limitKey: 'ai.fraud.dailyLimit',          defaultLimit: -1,   windowSeconds: 24 * 3600 },
  'recommendations': { limitKey: 'ai.recommendations.dailyLimit', defaultLimit: 100, windowSeconds: 24 * 3600 },
  'nl-query':        { limitKey: 'ai.nlQuery.dailyLimit',        defaultLimit: 200,  windowSeconds: 24 * 3600 },
  'moderation':      { limitKey: 'ai.moderation.dailyLimit',     defaultLimit: -1,   windowSeconds: 24 * 3600 },
  'embeddings':      { limitKey: 'ai.embeddings.dailyLimit',     defaultLimit: -1,   windowSeconds: 24 * 3600 },
  'receipt-ocr':     { limitKey: 'ai.receiptOcr.dailyLimit',     defaultLimit: 20,   windowSeconds: 24 * 3600 },
};

/**
 * Get the rate limit config for a feature from platform_settings.
 */
export async function getRateLimitConfig(feature: AiFeature): Promise<RateLimitConfig> {
  const defaults = FEATURE_DEFAULTS[feature];
  const limit = await getPlatformSetting<number>(defaults.limitKey, defaults.defaultLimit);
  return { limit, windowSeconds: defaults.windowSeconds };
}

/**
 * Compute the window key for the current time period.
 * Daily limits use date-based keys; monthly limits use month-based keys.
 */
function getWindowKey(windowSeconds: number): string {
  const now = new Date();
  if (windowSeconds >= 28 * 24 * 3600) {
    // Monthly window
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  // Daily window
  return now.toISOString().slice(0, 10);
}

/**
 * Check rate limit for a feature + user combination.
 * Returns whether the request is allowed, remaining count, and reset time.
 */
export async function checkRateLimit(
  feature: AiFeature,
  userId: string,
): Promise<RateLimitResult> {
  const config = await getRateLimitConfig(feature);

  // Unlimited features (-1)
  if (config.limit < 0) {
    return { allowed: true, remaining: Infinity, resetAt: new Date(Date.now() + config.windowSeconds * 1000) };
  }

  const windowKey = getWindowKey(config.windowSeconds);
  const redisKey = `ai:rate:${feature}:${userId}:${windowKey}`;

  try {
    const client = getValkeyClient();
    const currentCount = await client.incr(redisKey);

    // Set TTL on first increment
    if (currentCount === 1) {
      await client.expire(redisKey, config.windowSeconds);
    }

    const remaining = Math.max(0, config.limit - currentCount);
    const allowed = currentCount <= config.limit;
    const ttl = await client.ttl(redisKey);
    const resetAt = new Date(Date.now() + Math.max(0, ttl) * 1000);

    if (!allowed) {
      logger.info('[ai:rate-limiter] Rate limit exceeded', {
        feature,
        userId,
        currentCount,
        limit: config.limit,
      });
    }

    return { allowed, remaining, resetAt };
  } catch (err) {
    // Fail-open: allow request if Valkey is down
    logger.warn('[ai:rate-limiter] Valkey error, failing open', {
      feature,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: new Date(Date.now() + config.windowSeconds * 1000),
    };
  }
}
