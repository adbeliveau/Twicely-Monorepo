import { z } from 'zod';

/**
 * Validation schema for seller response to a review.
 *
 * Rules:
 * - Body: 1-2000 characters (required)
 * - One response per review (enforced by unique constraint on reviewResponse.reviewId)
 * - Must respond within 30 days of review creation
 * - Can edit within 24 hours of response creation
 */
export const sellerResponseSchema = z.object({
  body: z
    .string()
    .min(1, 'Response cannot be empty')
    .max(2000, 'Response cannot exceed 2000 characters'),
}).strict();

export type SellerResponseInput = z.infer<typeof sellerResponseSchema>;
