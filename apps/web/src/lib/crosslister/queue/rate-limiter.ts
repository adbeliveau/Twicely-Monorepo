/**
 * In-memory sliding window rate limiter per channel+seller.
 * Source: F3.1 install prompt §3.6; Lister Canonical Section 8.3
 *
 * V1: resets on server restart. A Valkey-backed implementation is Phase G scope.
 *
 * Rate limits sourced from channel-registry.ts (callsPerHourPerSeller).
 */

import { getChannelMetadata } from '@twicely/crosslister/channel-registry';
import { RATE_LIMIT_WINDOW_MS } from './constants';

interface RateBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateBucket>();

function bucketKey(channel: string, sellerId: string): string {
  return `${channel}:${sellerId}`;
}

function getLimitForChannel(channel: string): number {
  try {
    const meta = getChannelMetadata(channel as Parameters<typeof getChannelMetadata>[0]);
    return meta.rateLimit.callsPerHourPerSeller;
  } catch {
    // Unknown channel: use a conservative default
    return 60;
  }
}

/** Prune timestamps older than 1 hour from the bucket. */
function prune(bucket: RateBucket): void {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);
}

/**
 * Check if a request can proceed within the rate limit.
 * Returns true if allowed, false if rate exceeded.
 */
export function checkRateLimit(channel: string, sellerId: string): boolean {
  const key = bucketKey(channel, sellerId);
  const bucket = buckets.get(key) ?? { timestamps: [] };
  prune(bucket);
  buckets.set(key, bucket);
  const limit = getLimitForChannel(channel);
  return bucket.timestamps.length < limit;
}

/**
 * Record a request against the rate limit.
 */
export function recordRequest(channel: string, sellerId: string): void {
  const key = bucketKey(channel, sellerId);
  const bucket = buckets.get(key) ?? { timestamps: [] };
  prune(bucket);
  bucket.timestamps.push(Date.now());
  buckets.set(key, bucket);
}

/**
 * Get the delay in ms before the next request can proceed.
 * Returns 0 if no delay needed.
 */
export function getDelayMs(channel: string, sellerId: string): number {
  const key = bucketKey(channel, sellerId);
  const bucket = buckets.get(key) ?? { timestamps: [] };
  prune(bucket);
  buckets.set(key, bucket);
  const limit = getLimitForChannel(channel);

  if (bucket.timestamps.length < limit) {
    return 0;
  }

  // The oldest timestamp in the window — when it falls off, a slot opens
  const oldest = bucket.timestamps[0];
  if (oldest === undefined) return 0;

  const timeUntilFree = oldest + RATE_LIMIT_WINDOW_MS - Date.now();
  return Math.max(0, timeUntilFree);
}
