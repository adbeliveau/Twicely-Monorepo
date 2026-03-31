'use server';

/**
 * Seller Score Actions
 *
 * refreshSellerScore — triggers score recomputation for a given seller.
 * Can be called from admin UI or a cron job.
 *
 * sellerId = userId per the ownership model (§4.2).
 */

import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { computeAndStoreSellerScore } from '@twicely/commerce/seller-score-compute';

const refreshSellerScoreSchema = z.object({
  sellerId: zodId,
}).strict();

export async function refreshSellerScore(input: unknown) {
  const { ability } = await staffAuthorize();

  // Require manage access on SellerProfile — admin and agents with finance/moderation scope
  if (!ability.can('manage', 'SellerProfile')) {
    return { error: 'Forbidden' };
  }

  const parsed = refreshSellerScoreSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Invalid input' };
  }

  const { sellerId } = parsed.data;

  const result = await computeAndStoreSellerScore(sellerId);

  if (!result.success) {
    return { error: result.error ?? 'Score computation failed' };
  }

  return {
    success: true,
    score:   result.score,
    band:    result.band,
    isNew:   result.isNew,
  };
}
