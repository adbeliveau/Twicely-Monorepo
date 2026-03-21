/**
 * Combined Shipping Quote Resolver (D2.2)
 * Computes final shipping price after seller deadline penalty.
 * Buyer always pays the LOWER of: seller's quote OR penalty-discounted price.
 */

export interface QuoteResolutionInput {
  maxShippingCents: number;
  quotedShippingCents: number | null;
  penaltyDiscountPercent: number;
}

export interface QuoteResolutionResult {
  finalShippingCents: number;
  savingsCents: number;
  usedSellerQuote: boolean;
}

/**
 * Resolve the final shipping price for a combined shipping quote.
 * Called when a penalty has been applied (seller missed the deadline).
 *
 * Logic:
 * - penaltyPrice = maxShippingCents * (1 - penaltyDiscountPercent / 100)
 * - If seller quoted: finalShippingCents = min(quotedShippingCents, penaltyPrice)
 * - If seller did not quote: finalShippingCents = penaltyPrice
 * - savingsCents = maxShippingCents - finalShippingCents
 */
export function resolveQuoteFinalPrice(
  input: QuoteResolutionInput
): QuoteResolutionResult {
  const { maxShippingCents, quotedShippingCents, penaltyDiscountPercent } =
    input;

  const penaltyPrice = Math.round(
    maxShippingCents * (1 - penaltyDiscountPercent / 100)
  );

  let finalShippingCents: number;
  let usedSellerQuote: boolean;

  if (quotedShippingCents !== null) {
    finalShippingCents = Math.min(quotedShippingCents, penaltyPrice);
    usedSellerQuote = quotedShippingCents <= penaltyPrice;
  } else {
    finalShippingCents = penaltyPrice;
    usedSellerQuote = false;
  }

  return {
    finalShippingCents,
    savingsCents: maxShippingCents - finalShippingCents,
    usedSellerQuote,
  };
}
