/**
 * Fire-and-forget notifications for AI authentication results — G10.2
 */

import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';

type AuthResult = 'AUTHENTICATED' | 'COUNTERFEIT' | 'INCONCLUSIVE';

const TEMPLATE_MAP: Record<AuthResult, 'auth.ai.authenticated' | 'auth.ai.counterfeit' | 'auth.ai.inconclusive'> = {
  AUTHENTICATED: 'auth.ai.authenticated',
  COUNTERFEIT: 'auth.ai.counterfeit',
  INCONCLUSIVE: 'auth.ai.inconclusive',
};

/**
 * Notify user(s) about an AI authentication result.
 * If buyer-initiated, notifies both seller and buyer.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function notifyAuthResult(
  sellerId: string,
  buyerId: string | null,
  listingId: string,
  itemTitle: string,
  result: AuthResult,
  confidence?: number,
): Promise<void> {
  const templateKey = TEMPLATE_MAP[result];
  const data: Record<string, string> = {
    itemTitle,
    listingId,
    confidencePercent: confidence != null ? String(Math.round(confidence * 100)) : 'N/A',
  };

  try {
    // Always notify the seller
    await notify(sellerId, templateKey, data);

    // If buyer-initiated, also notify the buyer
    if (buyerId && buyerId !== sellerId) {
      await notify(buyerId, templateKey, data);
    }
  } catch (err) {
    logger.error('[notifyAuthResult] Failed to send notification', {
      sellerId,
      buyerId,
      listingId,
      result,
      error: String(err),
    });
  }
}
