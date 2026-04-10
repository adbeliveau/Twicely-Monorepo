/**
 * @twicely/shipping - Rate shopping service
 *
 * Multi-carrier rate comparison with sorting, tagging, and caching.
 * All costs in integer cents. Rates persisted to shippingRate table.
 */

import { db } from '@twicely/db';
import { shippingRate } from '@twicely/db/schema';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import { createId } from '@paralleldrive/cuid2';
import { getProvider } from './providers/provider-factory';
import type { RateRequest, RateResult, RateResponse, RateTag } from './types';

export type RateStrategy = 'cheapest' | 'fastest' | 'best_value';

/**
 * Fetch shipping rates from provider, sort, tag, and cache.
 */
export async function getShippingRates(
  request: RateRequest & { orderId: string; sellerId: string }
): Promise<RateResponse> {
  // 1. Check kill switch
  const enabled = await getPlatformSetting('fulfillment.shipping.labelGenerationEnabled', true);
  if (!enabled) {
    return { success: false, rates: [], sessionId: '', error: 'Label generation is disabled' };
  }

  // 2. Read enabled carriers
  const enabledCarriers = await getPlatformSetting<string[]>(
    'fulfillment.shipping.enabledCarriers',
    ['USPS', 'UPS', 'FedEx']
  );

  // 3. Call provider with carrier filter
  const provider = await getProvider();
  let rates: RateResult[];
  try {
    rates = await provider.getRates({
      ...request,
      carriers: request.carriers ?? enabledCarriers,
    });
  } catch (err) {
    logger.error('[rate-shopping] Provider getRates failed', { error: String(err) });
    return { success: false, rates: [], sessionId: '', error: 'Failed to fetch rates' };
  }

  if (rates.length === 0) {
    return { success: true, rates: [], sessionId: createId(), error: undefined };
  }

  // 4. Sort by totalCents ascending (cheapest first)
  rates.sort((a, b) => a.totalCents - b.totalCents);

  // 5. Tag rates
  const taggedRates = tagRates(rates);

  // 6. Generate session ID and persist
  const sessionId = createId();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min expiry

  try {
    const rateRows = taggedRates.map((r) => ({
      orderId: request.orderId,
      sellerId: request.sellerId,
      sessionId,
      provider: 'shippo',
      providerRateId: r.providerRateId,
      carrier: r.carrier,
      carrierCode: r.carrierCode,
      service: r.service,
      serviceCode: r.serviceCode,
      rateCents: r.rateCents,
      surchargesCents: r.surchargesCents,
      totalCents: r.totalCents,
      currency: r.currency,
      retailRateCents: r.retailRateCents ?? null,
      savingsPercent: r.savingsPercent ?? null,
      etaDays: r.etaDays ?? null,
      etaBusinessDays: r.etaBusinessDays ?? null,
      guaranteedDelivery: r.guaranteedDelivery,
      trackingIncluded: true,
      insuranceIncluded: false,
      signatureIncluded: false,
      isSelected: false,
      isRecommended: r.tag === 'BEST_VALUE',
      recommendationTag: r.tag ?? null,
      fromPostalCode: request.fromAddress.zip,
      toPostalCode: request.toAddress.zip,
      weightOz: request.parcel.weightOz,
      expiresAt,
    }));

    if (rateRows.length > 0) {
      await db.insert(shippingRate).values(rateRows);
    }
  } catch (err) {
    // Non-fatal: rates still returned even if caching fails
    logger.warn('[rate-shopping] Failed to cache rates', { error: String(err) });
  }

  return { success: true, rates: taggedRates, sessionId };
}

/**
 * Get the best rate for a given strategy.
 */
export function getBestRate(
  rates: RateResult[],
  strategy: RateStrategy
): RateResult | null {
  if (rates.length === 0) return null;

  switch (strategy) {
    case 'cheapest':
      return rates.reduce((best, r) => r.totalCents < best.totalCents ? r : best);
    case 'fastest': {
      const withEta = rates.filter(r => r.etaDays !== null && r.etaDays !== undefined);
      if (withEta.length === 0) return rates[0] ?? null;
      return withEta.reduce((best, r) => (r.etaDays ?? Infinity) < (best.etaDays ?? Infinity) ? r : best);
    }
    case 'best_value': {
      // Best cost-per-day ratio
      const withEta = rates.filter(r => r.etaDays !== null && r.etaDays !== undefined && r.etaDays > 0);
      if (withEta.length === 0) return rates[0] ?? null;
      return withEta.reduce((best, r) => {
        const rCpd = r.totalCents / (r.etaDays ?? 1);
        const bCpd = best.totalCents / (best.etaDays ?? 1);
        return rCpd < bCpd ? r : best;
      });
    }
    default:
      return rates[0] ?? null;
  }
}

/**
 * Tag rates: CHEAPEST, FASTEST, BEST_VALUE
 */
function tagRates(rates: RateResult[]): RateResult[] {
  if (rates.length === 0) return rates;

  const tagged = rates.map(r => ({ ...r }));

  // CHEAPEST: lowest totalCents (already sorted, so first)
  const cheapestIdx = 0;

  // FASTEST: lowest etaDays
  let fastestIdx = -1;
  let minDays = Infinity;
  for (let i = 0; i < tagged.length; i++) {
    const days = tagged[i]!.etaDays;
    if (days !== null && days !== undefined && days < minDays) {
      minDays = days;
      fastestIdx = i;
    }
  }

  // BEST_VALUE: best cost-per-day
  let bestValueIdx = -1;
  let bestCpd = Infinity;
  for (let i = 0; i < tagged.length; i++) {
    const r = tagged[i]!;
    const days = r.etaDays;
    if (days !== null && days !== undefined && days > 0) {
      const cpd = r.totalCents / days;
      if (cpd < bestCpd) {
        bestCpd = cpd;
        bestValueIdx = i;
      }
    }
  }

  // Apply tags (only if distinct)
  const usedIndices = new Set<number>();

  tagged[cheapestIdx]!.tag = 'CHEAPEST' as RateTag;
  usedIndices.add(cheapestIdx);

  if (fastestIdx >= 0 && !usedIndices.has(fastestIdx)) {
    tagged[fastestIdx]!.tag = 'FASTEST' as RateTag;
    usedIndices.add(fastestIdx);
  }

  if (bestValueIdx >= 0 && !usedIndices.has(bestValueIdx)) {
    tagged[bestValueIdx]!.tag = 'BEST_VALUE' as RateTag;
  }

  return tagged;
}
