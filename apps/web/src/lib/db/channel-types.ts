/**
 * Channel type definitions derived from the channelEnum in schema/enums.ts.
 *
 * Shared between @twicely/crosslister and @twicely/finance to avoid
 * a circular dependency (finance → crosslister → finance).
 */

export type ExternalChannel =
  | 'EBAY'
  | 'POSHMARK'
  | 'MERCARI'
  | 'DEPOP'
  | 'FB_MARKETPLACE'
  | 'ETSY'
  | 'GRAILED'
  | 'THEREALREAL'
  | 'WHATNOT'
  | 'SHOPIFY'
  | 'VESTIAIRE';

export type Channel = 'TWICELY' | ExternalChannel;
