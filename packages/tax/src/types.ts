/**
 * Tax system types — US sales tax, marketplace facilitator, 1099-K
 */

export type TaxJurisdiction = {
  id: string;
  state: string;
  county: string | null;
  city: string | null;
  rateBasisPoints: number;
  isMarketplaceFacilitator: boolean;
  effectiveAt: Date;
  expiresAt: Date | null;
};

export type TaxCalculationInput = {
  subtotalCents: number;
  shippingCents: number;
  buyerAddress: TaxAddress;
  sellerAddress: TaxAddress;
  itemCategory?: string;
  exemptionCertificateId?: string;
};

export type TaxCalculationResult = {
  taxCents: number;
  rateBasisPoints: number;
  jurisdiction: string;
  breakdown: TaxBreakdownItem[];
  isMarketplaceFacilitator: boolean;
  exemptionApplied: boolean;
};

export type TaxBreakdownItem = {
  jurisdiction: string;
  level: 'STATE' | 'COUNTY' | 'CITY' | 'SPECIAL';
  rateBasisPoints: number;
  taxCents: number;
};

export type TaxAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type TaxExemption = {
  id: string;
  buyerId: string;
  certificateNumber: string;
  state: string;
  exemptionType: 'RESALE' | 'NONPROFIT' | 'GOVERNMENT' | 'OTHER';
  validFrom: Date;
  validTo: Date | null;
  isActive: boolean;
};

export type TaxDocument = {
  id: string;
  sellerId: string;
  documentType: '1099_K' | '1099_K_CORRECTION' | 'VOID';
  taxYear: number;
  grossAmountCents: number;
  transactionCount: number;
  status: 'PENDING' | 'GENERATED' | 'SENT' | 'CORRECTED' | 'VOIDED';
  generatedAt: Date | null;
  sentAt: Date | null;
};

export type TaxProvider = 'INTERNAL' | 'TAXJAR' | 'AVALARA';

export interface TaxCalculator {
  calculateTax(input: TaxCalculationInput): Promise<TaxCalculationResult>;
  validateAddress(address: TaxAddress): Promise<{ valid: boolean; corrected?: TaxAddress }>;
}
