/**
 * Factory for accounting provider adapters — G10.3
 */

import type { AccountingAdapter } from './types';
import { QuickBooksAdapter } from './quickbooks-adapter';
import { XeroAdapter } from './xero-adapter';

export function getAccountingAdapter(provider: 'QUICKBOOKS' | 'XERO'): AccountingAdapter {
  switch (provider) {
    case 'QUICKBOOKS': return new QuickBooksAdapter();
    case 'XERO': return new XeroAdapter();
    default: throw new Error(`Unknown accounting provider: ${provider}`);
  }
}
