import { z } from 'zod';
import { zodId } from './shared';

/**
 * Schema for creating a new offer (buyer → seller)
 */
export const createOfferSchema = z.object({
  listingId: zodId,
  offerCents: z.number().int().positive('Offer must be a positive amount'),
  message: z.string().max(500, 'Message must be 500 characters or less').optional(),
  paymentMethodId: zodId,
  shippingAddressId: zodId,
}).strict();

export type CreateOfferInput = z.infer<typeof createOfferSchema>;

/**
 * Schema for countering an offer (seller or buyer)
 */
export const counterOfferSchema = z.object({
  offerId: zodId,
  counterCents: z.number().int().positive('Counter amount must be positive'),
  message: z.string().max(500, 'Message must be 500 characters or less').optional(),
}).strict();

export type CounterOfferInput = z.infer<typeof counterOfferSchema>;

/**
 * Schema for offer settings on a listing
 */
export const offerSettingsSchema = z
  .object({
    allowOffers: z.boolean(),
    autoAcceptOfferCents: z.number().int().positive().nullable().optional(),
    autoDeclineOfferCents: z.number().int().positive().nullable().optional(),
    offerExpiryHours: z.number().refine(v => [24, 48, 72].includes(v), { message: 'Must be 24, 48, or 72' }).nullable().optional(),
  })
  .strict()
  .refine(
    (data) => {
      // If both thresholds are set, autoAccept must be > autoDecline
      if (data.autoAcceptOfferCents && data.autoDeclineOfferCents) {
        return data.autoAcceptOfferCents > data.autoDeclineOfferCents;
      }
      return true;
    },
    {
      message: 'Auto-accept threshold must be greater than auto-decline threshold',
      path: ['autoAcceptOfferCents'],
    }
  );

export type OfferSettingsInput = z.infer<typeof offerSettingsSchema>;

/**
 * Create a refined offer schema that validates against listing price
 * @param listingPriceCents - The listing's asking price in cents
 * @param minPercentOfAsking - Minimum percentage of asking price (default 50%)
 */
export function createOfferSchemaWithPrice(listingPriceCents: number, minPercentOfAsking = 50) {
  const minOfferCents = Math.ceil((listingPriceCents * minPercentOfAsking) / 100);

  return createOfferSchema.refine(
    (data) => data.offerCents >= minOfferCents,
    {
      message: `Offer must be at least ${minPercentOfAsking}% of asking price ($${(minOfferCents / 100).toFixed(2)})`,
      path: ['offerCents'],
    }
  );
}

/**
 * Create a refined counter schema that validates the counter differs from current offer
 * @param currentOfferCents - The current offer amount being countered
 */
export function counterOfferSchemaWithValidation(currentOfferCents: number) {
  return counterOfferSchema.refine(
    (data) => data.counterCents !== currentOfferCents,
    {
      message: 'Counter amount must be different from the current offer',
      path: ['counterCents'],
    }
  );
}

/**
 * Schema for creating a bundle offer (multiple items from same seller)
 */
export const createBundleOfferSchema = z.object({
  listingIds: z.array(zodId).min(2, 'Bundle must contain at least 2 items').max(10, 'Bundle cannot exceed 10 items'),
  offeredPriceCents: z.number().int().positive('Offer must be a positive amount'),
  shippingAddressId: zodId,
  paymentMethodId: zodId,
  message: z.string().max(500, 'Message must be 500 characters or less').optional(),
}).strict();

export type CreateBundleOfferInput = z.infer<typeof createBundleOfferSchema>;

/**
 * Schema for responding to a bundle offer
 */
export const respondBundleOfferSchema = z.object({
  offerId: zodId,
  action: z.enum(['accept', 'decline', 'counter']),
  counterPriceCents: z.number().int().positive().optional(),
}).strict().refine(
  (data) => data.action !== 'counter' || data.counterPriceCents !== undefined,
  {
    message: 'Counter price is required when action is counter',
    path: ['counterPriceCents'],
  }
);

export type RespondBundleOfferInput = z.infer<typeof respondBundleOfferSchema>;
