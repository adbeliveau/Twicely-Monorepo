import { z } from 'zod';
import { zodId } from './shared';

export const createWatcherOfferSchema = z.object({
  listingId: zodId,
  discountedPriceCents: z.number().int().positive(),
  message: z.string().max(500).optional(),
}).strict();

export const acceptWatcherOfferSchema = z.object({
  watcherOfferId: zodId,
  shippingAddressId: zodId,
}).strict();

export const cancelWatcherOfferSchema = z.object({
  watcherOfferId: zodId,
}).strict();
