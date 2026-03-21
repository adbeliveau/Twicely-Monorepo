import { z } from 'zod';

export const createWatcherOfferSchema = z.object({
  listingId: z.string().min(1),
  discountedPriceCents: z.number().int().positive(),
  message: z.string().max(500).optional(),
}).strict();

export const acceptWatcherOfferSchema = z.object({
  watcherOfferId: z.string().min(1),
  shippingAddressId: z.string().min(1),
}).strict();

export const cancelWatcherOfferSchema = z.object({
  watcherOfferId: z.string().min(1),
}).strict();
