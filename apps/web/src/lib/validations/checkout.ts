import { z } from 'zod';
import { shippingAddressJsonSchema } from './address';

const couponDataSchema = z.object({
  promotionId: z.string().cuid2(),
  couponCode: z.string().min(1),
  discountCents: z.number().int().min(0),
  freeShipping: z.boolean(),
  appliedToSellerId: z.string().cuid2(),
}).strict();

export const initiateCheckoutSchema = z.object({
  cartId: z.string().cuid2(),
  shippingAddress: shippingAddressJsonSchema,
  buyerNote: z.string().max(500).optional(),
  isLocalPickup: z.boolean().optional(),
  authenticationRequested: z.boolean().optional(),
  coupon: couponDataSchema.optional(),
}).strict();

export type InitiateCheckoutInput = z.infer<typeof initiateCheckoutSchema>;
