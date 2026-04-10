/**
 * Tax calculator factory — resolves provider from platform_settings
 */

import type { TaxCalculator, TaxProvider } from './types';
import { InternalTaxCalculator } from './calculator';

const calculators: Map<TaxProvider, TaxCalculator> = new Map();

export function getTaxCalculator(provider: TaxProvider = 'INTERNAL'): TaxCalculator {
  const existing = calculators.get(provider);
  if (existing) return existing;

  let calculator: TaxCalculator;

  switch (provider) {
    case 'TAXJAR':
      // TaxJar integration — V4D-004 (free tier)
      // Falls back to internal if not configured
      calculator = new InternalTaxCalculator();
      break;
    case 'AVALARA':
      // Avalara integration — future provider
      calculator = new InternalTaxCalculator();
      break;
    case 'INTERNAL':
    default:
      calculator = new InternalTaxCalculator();
      break;
  }

  calculators.set(provider, calculator);
  return calculator;
}
