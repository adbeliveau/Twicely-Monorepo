import { z } from 'zod';
import { zodId } from './shared';

export const submitBuyerReviewSchema = z.object({
  orderId: zodId,
  ratingPayment: z.number().int().min(1).max(5),
  ratingCommunication: z.number().int().min(1).max(5),
  ratingReturnBehavior: z.number().int().min(1).max(5).nullable(),
  note: z.string().max(1000).nullable(),
}).strict();

export const updateBuyerReviewSchema = z.object({
  reviewId: zodId,
  ratingPayment: z.number().int().min(1).max(5),
  ratingCommunication: z.number().int().min(1).max(5),
  ratingReturnBehavior: z.number().int().min(1).max(5).nullable(),
  note: z.string().max(1000).nullable(),
}).strict();

export type SubmitBuyerReviewInput = z.infer<typeof submitBuyerReviewSchema>;
export type UpdateBuyerReviewInput = z.infer<typeof updateBuyerReviewSchema>;
