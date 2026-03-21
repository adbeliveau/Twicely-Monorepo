/**
 * Zod validation schemas for all crosslister action inputs.
 * All schemas use .strict() to reject unknown keys.
 * Source: Lister Canonical Section 9.2, E2.1 install prompt §2.9
 */

import { z } from 'zod';

// The 8 external channels supported by the crosslister
const externalChannelEnum = z.enum([
  'EBAY',
  'POSHMARK',
  'MERCARI',
  'DEPOP',
  'FB_MARKETPLACE',
  'ETSY',
  'GRAILED',
  'THEREALREAL',
]);

/**
 * Connect a new channel account.
 * Auth credentials are mutually exclusive by authMethod but all optional
 * at the schema level — the action layer validates the combination.
 */
export const connectAccountSchema = z.object({
  channel: externalChannelEnum,
  authMethod: z.enum(['OAUTH', 'API_KEY', 'SESSION']),
  code: z.string().optional(),
  redirectUri: z.string().url().optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
}).strict();

export type ConnectAccountInput = z.infer<typeof connectAccountSchema>;

/**
 * Disconnect an existing channel account.
 */
export const disconnectAccountSchema = z.object({
  accountId: z.string().min(1),
}).strict();

export type DisconnectAccountInput = z.infer<typeof disconnectAccountSchema>;

/**
 * Start an import batch from a connected account.
 */
export const startImportSchema = z.object({
  accountId: z.string().min(1),
}).strict();

export type StartImportInput = z.infer<typeof startImportSchema>;

/**
 * Queue a publish job for one or more listings to one or more channels.
 * Source: Lister Canonical Section 7.1 — each publish counts against
 * the seller's monthly publish limit for their ListerTier.
 */
export const publishListingsSchema = z.object({
  listingIds: z.array(z.string().min(1)).min(1).max(500),
  channels: z.array(externalChannelEnum).min(1),
}).strict();

export type PublishListingsInput = z.infer<typeof publishListingsSchema>;

/**
 * Update per-channel overrides for an existing projection.
 * Title max 80 chars matches the Lister Canonical Section 19.2 constraint.
 */
export const updateProjectionOverridesSchema = z.object({
  projectionId: z.string().min(1),
  titleOverride: z.string().max(80).optional().nullable(),
  descriptionOverride: z.string().max(5000).optional().nullable(),
  priceCentsOverride: z.number().int().min(1).optional().nullable(),
}).strict();

export type UpdateProjectionOverridesInput = z.infer<typeof updateProjectionOverridesSchema>;

/**
 * Cancel a pending or queued cross job.
 */
export const cancelJobSchema = z.object({
  jobId: z.string().min(1),
}).strict();

export type CancelJobInput = z.infer<typeof cancelJobSchema>;

/**
 * Update seller automation settings.
 * Numeric ranges from Lister Canonical Section 13 (automation constraints).
 */
export const updateAutomationSettingsSchema = z.object({
  autoRelistEnabled: z.boolean().optional(),
  autoRelistDays: z.number().int().min(7).max(90).optional(),
  autoRelistChannels: z.array(z.string()).optional(),
  offerToLikersEnabled: z.boolean().optional(),
  offerDiscountPercent: z.number().int().min(1).max(50).optional(),
  offerMinDaysListed: z.number().int().min(1).max(90).optional(),
  priceDropEnabled: z.boolean().optional(),
  priceDropPercent: z.number().int().min(1).max(50).optional(),
  priceDropIntervalDays: z.number().int().min(1).max(90).optional(),
  priceDropFloorPercent: z.number().int().min(10).max(90).optional(),
  poshShareEnabled: z.boolean().optional(),
  poshShareTimesPerDay: z.number().int().min(1).max(10).optional(),
}).strict();

export type UpdateAutomationSettingsInput = z.infer<typeof updateAutomationSettingsSchema>;
