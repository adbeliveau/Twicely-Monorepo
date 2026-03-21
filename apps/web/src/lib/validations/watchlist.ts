import { z } from 'zod';

export const toggleWatchlistSchema = z.object({
  listingId: z.string().min(1, 'Listing ID is required'),
}).strict();

export type ToggleWatchlistInput = z.infer<typeof toggleWatchlistSchema>;

export const togglePriceAlertSchema = z.object({
  listingId: z.string().min(1, 'Listing ID is required'),
}).strict();

export type TogglePriceAlertInput = z.infer<typeof togglePriceAlertSchema>;
