import { z } from 'zod';

export const finalizeOrderSchema = z.object({
  paymentIntentId: z.string().min(1, 'Payment intent ID is required'),
}).strict();

export type FinalizeOrderInput = z.infer<typeof finalizeOrderSchema>;

export const finalizeOrdersSchema = z.object({
  paymentIntentIds: z.array(z.string().min(1)).min(1, 'At least one payment intent ID is required'),
}).strict();

export type FinalizeOrdersInput = z.infer<typeof finalizeOrdersSchema>;
