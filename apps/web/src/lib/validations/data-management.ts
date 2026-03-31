import { z } from 'zod';
import { zodId } from './shared';

export const bulkListingUpdateSchema = z.object({
  listingIds: z.array(zodId).min(1).max(100),
  targetStatus: z.enum(['ACTIVE', 'PAUSED', 'ENDED', 'REMOVED']),
}).strict();

export const bulkUserBanSchema = z.object({
  userIds: z.array(zodId).min(1).max(100),
  reason: z.string().min(1).max(500),
}).strict();

export const bulkUserUnbanSchema = z.object({
  userIds: z.array(zodId).min(1).max(100),
}).strict();
