/**
 * Local Seller Metrics Query (G2.17)
 * Fetches local-specific performance data for public display on
 * seller storefront and listing detail pages.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A14.
 * Privacy rule: raw mark counts and event types are NOT exposed.
 * Only completedCount, completionRate, and responseLabel are public.
 */

import { db } from '@twicely/db';
import { user, localTransaction } from '@twicely/db/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SellerLocalMetrics {
  localTransactionCount: number;
  localCompletedCount: number;
  localCompletionRate: number;
  localReliabilityTier: 'RELIABLE' | 'INCONSISTENT' | 'UNRELIABLE';
  localAvgResponseLabel: string | null;
  hasLocalActivity: boolean;
}

// ─── Response Time Label Helpers ──────────────────────────────────────────────

/**
 * Convert average response time in hours to a human-readable label.
 * Thresholds per install prompt §2.2.
 */
function toResponseLabel(avgHours: number): string {
  if (avgHours < 1) return 'Within 1 hour';
  if (avgHours < 4) return 'Within a few hours';
  if (avgHours < 24) return 'Same day';
  if (avgHours < 48) return 'Within 1 day';
  return 'Within 2 days';
}

// ─── Reliability Tier Helper ──────────────────────────────────────────────────

/**
 * Derive reliability tier from active mark count.
 * Thresholds read from platform_settings — never hardcoded.
 * 0 – (inconsistentThreshold - 1): RELIABLE
 * inconsistentThreshold – (suspensionThreshold - 1): INCONSISTENT
 * suspensionThreshold+: UNRELIABLE
 */
async function deriveReliabilityTier(
  marks: number,
): Promise<'RELIABLE' | 'INCONSISTENT' | 'UNRELIABLE'> {
  const [inconsistentThreshold, suspensionThreshold] = await Promise.all([
    getPlatformSetting<number>('commerce.local.inconsistentMarkThreshold', 3),
    getPlatformSetting<number>('commerce.local.suspensionMarkThreshold', 9),
  ]);

  if (marks >= suspensionThreshold) return 'UNRELIABLE';
  if (marks >= inconsistentThreshold) return 'INCONSISTENT';
  return 'RELIABLE';
}

// ─── Main Query ───────────────────────────────────────────────────────────────

/**
 * Returns public-safe local seller metrics for display on storefront
 * and listing detail pages.
 *
 * Reads cached values from user table (localTransactionCount,
 * localCompletionRate, localReliabilityMarks) — no expensive joins needed.
 * Computes localAvgResponseLabel from localTransaction rows at query time.
 */
export async function getSellerLocalMetrics(
  userId: string,
): Promise<SellerLocalMetrics> {
  // Read cached user fields — single row, no joins
  const [userRow] = await db
    .select({
      localTransactionCount: user.localTransactionCount,
      localCompletionRate: user.localCompletionRate,
      localReliabilityMarks: user.localReliabilityMarks,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const txCount = userRow?.localTransactionCount ?? 0;
  // localCompletionRate is nullable real — treat null as 0
  const completionRate = userRow?.localCompletionRate ?? 0;
  const marks = userRow?.localReliabilityMarks ?? 0;

  const localCompletedCount = Math.round(txCount * completionRate);
  const hasLocalActivity = txCount > 0;

  const localReliabilityTier = await deriveReliabilityTier(marks);

  // Compute average response time from day-of confirmation pairs.
  // Only count seller-side rows (sellerId = userId) where BOTH timestamps
  // are present. Per spec §2.2 — buyers do not have a response time metric.
  const [responseRow] = await db
    .select({
      avgMs: sql<number | null>`
        AVG(
          EXTRACT(EPOCH FROM (
            ${localTransaction.dayOfConfirmationRespondedAt}
            - ${localTransaction.dayOfConfirmationSentAt}
          )) * 1000
        )
      `,
    })
    .from(localTransaction)
    .where(
      and(
        eq(localTransaction.sellerId, userId),
        isNotNull(localTransaction.dayOfConfirmationSentAt),
        isNotNull(localTransaction.dayOfConfirmationRespondedAt),
      ),
    );

  const avgMs = responseRow?.avgMs ?? null;
  const localAvgResponseLabel =
    avgMs !== null && avgMs >= 0
      ? toResponseLabel(avgMs / (1000 * 60 * 60))
      : null;

  return {
    localTransactionCount: txCount,
    localCompletedCount,
    localCompletionRate: completionRate,
    localReliabilityTier,
    localAvgResponseLabel,
    hasLocalActivity,
  };
}
