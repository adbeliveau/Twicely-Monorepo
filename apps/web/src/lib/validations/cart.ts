import { z } from 'zod';

export const addToCartSchema = z.object({
  listingId: z.string().cuid2(),
  quantity: z.number().int().min(1).max(100).default(1),
}).strict();

export type AddToCartInput = z.infer<typeof addToCartSchema>;

export const removeFromCartSchema = z.object({
  cartItemId: z.string().cuid2(),
}).strict();

export type RemoveFromCartInput = z.infer<typeof removeFromCartSchema>;

export const updateCartQuantitySchema = z.object({
  cartItemId: z.string().cuid2(),
  quantity: z.number().int(),
}).strict();

export type UpdateCartQuantityInput = z.infer<typeof updateCartQuantitySchema>;
