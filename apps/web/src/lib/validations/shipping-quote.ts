import { z } from 'zod';

export const QUOTE_STATUSES = [
  'PENDING_SELLER',
  'PENDING_BUYER',
  'ACCEPTED',
  'DISPUTED',
  'EXPIRED',
  'PENALTY_APPLIED',
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const submitShippingQuoteSchema = z
  .object({
    quoteId: z.string().min(1),
    quotedShippingCents: z.number().int().min(0).max(999999),
  })
  .strict();

export type SubmitShippingQuoteInput = z.infer<typeof submitShippingQuoteSchema>;

export const respondToShippingQuoteSchema = z
  .object({
    quoteId: z.string().min(1),
    action: z.enum(['ACCEPT', 'DISPUTE']),
  })
  .strict();

export type RespondToShippingQuoteInput = z.infer<
  typeof respondToShippingQuoteSchema
>;
