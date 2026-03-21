/**
 * Category-to-TaxJar tax code mapping
 * G5.2 — TaxJar integration
 *
 * TaxJar product tax codes: https://developers.taxjar.com/api/reference/#categories
 * Clothing exempt in some states (MA, PA, NY under $110, etc.)
 */

export const TAX_CODE_MAP: Record<string, string> = {
  // Apparel — may be exempt in some states
  APPAREL_ACCESSORIES: '20010',   // Clothing
  SHOES:               '20010',

  // Electronics — taxable
  ELECTRONICS:         'PC030000',  // Computers & electronics

  // Collectibles
  COLLECTIBLES_LUXURY: 'PG050101',  // Jewelry and precious metals

  // Books — exempt in some states
  BOOKS:               '81100',    // Books

  // General merchandise (default)
  HOME_GENERAL:        'P0000000', // General tangible personal property
};

/** Default tax code used when no category mapping exists */
export const DEFAULT_TAX_CODE = 'P0000000';

/**
 * Get TaxJar product tax code for a given category feeBucket.
 * Returns the default code if no specific mapping exists.
 */
export function getTaxCodeForCategory(feeBucket: string | null | undefined): string {
  if (!feeBucket) return DEFAULT_TAX_CODE;
  return TAX_CODE_MAP[feeBucket] ?? DEFAULT_TAX_CODE;
}
