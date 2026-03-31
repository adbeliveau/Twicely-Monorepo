import { z } from 'zod';
import { zodId } from './shared';

export const finalizeOrderSchema = z.object({
  paymentIntentId: zodId,
}).strict();

export type FinalizeOrderInput = z.infer<typeof finalizeOrderSchema>;

export const finalizeOrdersSchema = z.object({
  paymentIntentIds: z.array(zodId).min(1, 'At least one payment intent ID is required'),
}).strict();

export type FinalizeOrdersInput = z.infer<typeof finalizeOrdersSchema>;
