import { z } from 'zod';

/**
 * Zod schema for uploaded image data sent to server actions.
 * Client-only fields (file, preview) are excluded since
 * they are not serializable over the wire.
 */
const uploadedImageSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  position: z.number().int().nonnegative(),
}).strict();

/**
 * Zod schema for CategorySearchResult sent from the form.
 */
const categorySearchResultSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  slug: z.string(),
  parentId: z.string().nullable(),
  parentName: z.string().nullable(),
  isLeaf: z.boolean(),
  depth: z.number().int().nonnegative(),
}).strict();

const listingConditionEnum = z.enum([
  'NEW_WITH_TAGS',
  'NEW_WITHOUT_TAGS',
  'NEW_WITH_DEFECTS',
  'LIKE_NEW',
  'VERY_GOOD',
  'GOOD',
  'ACCEPTABLE',
]);

const fulfillmentTypeEnum = z.enum([
  'SHIP_ONLY',
  'LOCAL_ONLY',
  'SHIP_AND_LOCAL',
]);

const localHandlingFlagEnum = z.enum([
  'NEEDS_VEHICLE',
  'NEEDS_HELP',
  'NEEDS_DISASSEMBLY',
  'NEEDS_EQUIPMENT',
]);

/**
 * Zod schema for ListingFormData. Uses .strict() to reject
 * unknown keys. Use z.infer<typeof listingFormSchema> for
 * type derivation where needed.
 */
export const listingFormSchema = z.object({
  // Basic details
  title: z.string(),
  description: z.string(),
  category: categorySearchResultSchema.nullable(),
  condition: listingConditionEnum.nullable(),
  brand: z.string(),
  tags: z.array(z.string()),
  images: z.array(uploadedImageSchema),
  quantity: z.number().int(),

  // Pricing (integer cents)
  priceCents: z.number().int(),
  originalPriceCents: z.number().int().nullable(),
  cogsCents: z.number().int().nullable(),

  // Offers
  allowOffers: z.boolean(),
  autoAcceptOfferCents: z.number().int().nullable(),
  autoDeclineOfferCents: z.number().int().nullable(),

  // Shipping (integer cents / measurements)
  freeShipping: z.boolean(),
  shippingCents: z.number().int(),
  weightOz: z.number().nullable(),
  lengthIn: z.number().nullable(),
  widthIn: z.number().nullable(),
  heightIn: z.number().nullable(),

  // Fulfillment
  fulfillmentType: fulfillmentTypeEnum,
  localPickupRadiusMiles: z.number().nullable(),
  localHandlingFlags: z.array(localHandlingFlagEnum).default([]),

  // Video (optional, 1 per listing)
  videoUrl: z.string().url().nullable(),
  videoThumbUrl: z.string().url().nullable(),
  videoDurationSeconds: z.number().int().min(15).max(60).nullable(),
}).strict();

export type ListingFormDataValidated = z.infer<typeof listingFormSchema>;
