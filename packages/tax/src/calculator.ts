/**
 * Internal US sales tax calculator — baseline implementation
 * Uses jurisdiction rate table from DB, no external provider needed.
 */

import type { TaxCalculator, TaxCalculationInput, TaxCalculationResult, TaxAddress } from './types';

export class InternalTaxCalculator implements TaxCalculator {
  async calculateTax(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    const { subtotalCents, shippingCents, buyerAddress } = input;

    // US-only for V4 (V4D-008: i18n deferred to V5)
    if (buyerAddress.country !== 'US') {
      return {
        taxCents: 0,
        rateBasisPoints: 0,
        jurisdiction: buyerAddress.country,
        breakdown: [],
        isMarketplaceFacilitator: false,
        exemptionApplied: false,
      };
    }

    // TODO: Look up jurisdiction rates from DB (taxJurisdiction table)
    // For now return zero — rates must be seeded before tax collection is enabled
    const taxableAmountCents = subtotalCents + shippingCents;
    const rateBasisPoints = 0; // Will be loaded from DB
    const taxCents = Math.round((taxableAmountCents * rateBasisPoints) / 10000);

    return {
      taxCents,
      rateBasisPoints,
      jurisdiction: `${buyerAddress.state}, US`,
      breakdown: [],
      isMarketplaceFacilitator: true, // Twicely is marketplace facilitator
      exemptionApplied: !!input.exemptionCertificateId,
    };
  }

  async validateAddress(address: TaxAddress): Promise<{ valid: boolean; corrected?: TaxAddress }> {
    // Basic validation — real validation handled by provider or Shippo
    const valid = !!(address.line1 && address.city && address.state && address.zip && address.country);
    return { valid };
  }
}
