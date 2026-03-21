import { z } from 'zod';

/**
 * Zod schema for review submission and editing.
 *
 * Business rules:
 * - Overall rating: required (1-5 stars)
 * - DSR ratings: optional (1-5 stars each)
 * - Title: max 200 chars
 * - Body: max 5000 chars
 * - Photos: max 4 URLs (placeholder URLs for now, R2 in Phase E)
 */
export const reviewSubmissionSchema = z.object({
  rating: z
    .number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1 star')
    .max(5, 'Rating must be at most 5 stars'),

  title: z
    .string()
    .max(200, 'Title must be 200 characters or less')
    .optional(),

  body: z
    .string()
    .max(5000, 'Review must be 5000 characters or less')
    .optional(),

  photos: z
    .array(z.string().url('Photo must be a valid URL'))
    .max(4, 'Maximum 4 photos allowed')
    .optional()
    .default([]),

  // Detailed Seller Ratings (DSR) - optional buyer feedback on 4 dimensions
  dsrItemAsDescribed: z
    .number()
    .int('DSR rating must be a whole number')
    .min(1, 'DSR rating must be at least 1 star')
    .max(5, 'DSR rating must be at most 5 stars')
    .optional()
    .nullable(),

  dsrShippingSpeed: z
    .number()
    .int('DSR rating must be a whole number')
    .min(1, 'DSR rating must be at least 1 star')
    .max(5, 'DSR rating must be at most 5 stars')
    .optional()
    .nullable(),

  dsrCommunication: z
    .number()
    .int('DSR rating must be a whole number')
    .min(1, 'DSR rating must be at least 1 star')
    .max(5, 'DSR rating must be at most 5 stars')
    .optional()
    .nullable(),

  dsrPackaging: z
    .number()
    .int('DSR rating must be a whole number')
    .min(1, 'DSR rating must be at least 1 star')
    .max(5, 'DSR rating must be at most 5 stars')
    .optional()
    .nullable(),
}).strict();

export type ReviewSubmissionData = z.infer<typeof reviewSubmissionSchema>;

/**
 * Schema for updating a review (same as submission).
 */
export const reviewUpdateSchema = reviewSubmissionSchema;

export type ReviewUpdateData = z.infer<typeof reviewUpdateSchema>;
