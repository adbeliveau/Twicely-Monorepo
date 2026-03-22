/**
 * Zod runtime validation schema for eBay inventory item data.
 * Validates fields accessed by normalizeEbayListing() in ebay-normalizer.ts.
 * Source: F2/F3 install prompts — schema validation layer.
 */

import { z } from 'zod';

const EbayProductSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  aspects: z.record(z.string(), z.array(z.string())).optional(),
  brand: z.string().optional(),
});

const EbayOfferSchema = z.object({
  offerId: z.string().optional(),
  listingId: z.string().optional(),
  pricingSummary: z.object({
    price: z.object({
      value: z.string().optional(),
      currency: z.string().optional(),
    }).optional(),
  }).optional(),
  status: z.string().optional(),
});

const EbayAvailabilitySchema = z.object({
  shipToLocationAvailability: z.object({
    quantity: z.number().optional(),
  }).optional(),
});

export const EbayInventoryItemSchema = z.object({
  sku: z.string(),
  condition: z.string().optional(),
  product: EbayProductSchema.optional(),
  availability: EbayAvailabilitySchema.optional(),
  offers: z.array(EbayOfferSchema).optional(),
});

export type { EbayInventoryItem } from '@twicely/crosslister/connectors/ebay-types';
