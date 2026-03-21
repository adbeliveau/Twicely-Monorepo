import { z } from 'zod';

export const applyCouponSchema = z.object({
  couponCode: z.string().min(4, 'Invalid coupon code'),
  cartItems: z.array(z.object({
    listingId: z.string().min(1),
    categoryId: z.string().min(1),
    sellerId: z.string().min(1),
    priceCents: z.number().int().min(0),
    quantity: z.number().int().min(1),
  }).strict()).min(1, 'Cart must have at least one item'),
}).strict();

export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;
