/**
 * Tax calculation service
 * G5.2 — TaxJar integration (sales tax at checkout)
 *
 * Provider abstraction allows swapping tax providers.
 * TaxJar is used when TAXJAR_API_KEY is set.
 * Fallback: $0 tax when provider disabled or API fails.
 *
 * All monetary values in integer cents internally.
 * TaxJar API requires dollar amounts (converted only at call boundary).
 */

import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getTaxCodeForCategory } from './tax-codes';

export interface TaxCalcParams {
  subtotalCents: number;
  shippingCents: number;
  buyerAddress: {
    state: string;
    city: string;
    zip: string;
  };
  sellerAddress: {
    state: string;
  };
  itemCategoryTaxCode?: string;
}

export interface TaxCalcResult {
  taxCents: number;
  taxRatePercent: number;
  jurisdictionJson: Record<string, unknown>;
  isMarketplaceFacilitator: boolean;
}

export interface TaxProvider {
  calculateTax(params: TaxCalcParams): Promise<TaxCalcResult>;
}

const ZERO_RESULT: TaxCalcResult = {
  taxCents: 0,
  taxRatePercent: 0,
  jurisdictionJson: {},
  isMarketplaceFacilitator: true,
};

/** TaxJar API v2 response shape (partial) */
interface TaxJarTaxResponse {
  tax: {
    amount_to_collect: number;
    rate: number;
    has_nexus: boolean;
    freight_taxable: boolean;
    tax_source: string;
    jurisdictions?: Record<string, unknown>;
  };
}

export class TaxJarProvider implements TaxProvider {
  async calculateTax(params: TaxCalcParams): Promise<TaxCalcResult> {
    const apiKey = process.env.TAXJAR_API_KEY;
    if (!apiKey) {
      logger.warn('[TaxJarProvider] TAXJAR_API_KEY not set — returning $0 tax');
      return ZERO_RESULT;
    }

    // TaxJar expects dollar amounts (not cents)
    const subtotalDollars = params.subtotalCents / 100;
    const shippingDollars = params.shippingCents / 100;

    const body = {
      from_state: params.sellerAddress.state,
      to_state: params.buyerAddress.state,
      to_city: params.buyerAddress.city,
      to_zip: params.buyerAddress.zip,
      amount: subtotalDollars,
      shipping: shippingDollars,
      product_tax_code: params.itemCategoryTaxCode,
      nexus_addresses: [
        { state: params.sellerAddress.state },
      ],
    };

    try {
      const response = await fetch('https://api.taxjar.com/v2/taxes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token token="${apiKey}"`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        logger.error('[TaxJarProvider] API error', { status: response.status });
        return ZERO_RESULT;
      }

      const data = (await response.json()) as TaxJarTaxResponse;
      // Convert back to cents
      const taxCents = Math.round(data.tax.amount_to_collect * 100);

      return {
        taxCents,
        taxRatePercent: data.tax.rate * 100,
        jurisdictionJson: (data.tax.jurisdictions as Record<string, unknown>) ?? {},
        isMarketplaceFacilitator: true,
      };
    } catch (err) {
      logger.error('[TaxJarProvider] Failed to call TaxJar API', { error: err });
      return ZERO_RESULT;
    }
  }
}

/**
 * Calculate sales tax for an order.
 * Returns $0 if tax.facilitatorEnabled = false or if the provider fails.
 * Tax is NOT included in TF calculation — it's a separate line item.
 */
export async function calculateSalesTax(
  params: TaxCalcParams,
  feeBucket?: string | null
): Promise<TaxCalcResult> {
  const facilitatorEnabled = await getPlatformSetting<boolean>(
    'tax.facilitatorEnabled',
    false
  );

  if (!facilitatorEnabled) {
    return ZERO_RESULT;
  }

  const taxCode = feeBucket
    ? getTaxCodeForCategory(feeBucket)
    : undefined;

  const provider = new TaxJarProvider();
  return provider.calculateTax({ ...params, itemCategoryTaxCode: taxCode });
}
