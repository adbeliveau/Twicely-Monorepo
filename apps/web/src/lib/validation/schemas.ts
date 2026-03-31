import { z } from 'zod';

/**
 * Shared ID validation schema for server actions.
 * Validates non-empty string with max length guard.
 * Accepts cuid2, Stripe IDs, and other external ID formats.
 */
export const zodId = z.string().min(1).max(128);
