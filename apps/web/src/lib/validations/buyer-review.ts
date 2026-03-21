import { z } from 'zod';

export const submitBuyerReviewSchema = z.object({
  orderId: z.string().min(1),
  ratingPayment: z.number().int().min(1).max(5),
  ratingCommunication: z.number().int().min(1).max(5),
  ratingReturnBehavior: z.number().int().min(1).max(5).nullable(),
  note: z.string().max(1000).nullable(),
}).strict();

export const updateBuyerReviewSchema = z.object({
  reviewId: z.string().min(1),
  ratingPayment: z.number().int().min(1).max(5),
  ratingCommunication: z.number().int().min(1).max(5),
  ratingReturnBehavior: z.number().int().min(1).max(5).nullable(),
  note: z.string().max(1000).nullable(),
}).strict();

export type SubmitBuyerReviewInput = z.infer<typeof submitBuyerReviewSchema>;
export type UpdateBuyerReviewInput = z.infer<typeof updateBuyerReviewSchema>;
