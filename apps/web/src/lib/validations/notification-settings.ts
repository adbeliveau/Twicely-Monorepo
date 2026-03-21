import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM

export const digestSettingsSchema = z.object({
  digestFrequency: z.enum(['daily', 'weekly']),
  digestTimeUtc: z.string().regex(timeRegex, 'Must be HH:MM format'),
  timezone: z.string().min(1).max(50),
}).strict();

export const quietHoursSchema = z.object({
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string().regex(timeRegex, 'Must be HH:MM format').nullable(),
  quietHoursEnd: z.string().regex(timeRegex, 'Must be HH:MM format').nullable(),
}).strict().refine(
  (data) => {
    if (data.quietHoursEnabled) {
      return data.quietHoursStart !== null && data.quietHoursEnd !== null;
    }
    return true;
  },
  { message: 'Start and end times required when quiet hours enabled' }
);

export const sellerNotificationSettingsSchema = z.object({
  dailySalesSummary: z.boolean(),
  staleListingDays: z.number().int().min(1).max(365).nullable(),
  trustScoreAlerts: z.boolean(),
}).strict();

export const marketingOptInSchema = z.object({
  marketingOptIn: z.boolean(),
}).strict();

export const updateNotificationSettingsSchema = z.object({
  digestFrequency: z.enum(['daily', 'weekly']),
  digestTimeUtc: z.string().regex(timeRegex, 'Must be HH:MM format'),
  timezone: z.string().min(1).max(50),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string().regex(timeRegex, 'Must be HH:MM format').nullable(),
  quietHoursEnd: z.string().regex(timeRegex, 'Must be HH:MM format').nullable(),
  marketingOptIn: z.boolean(),
  // Seller-only fields (silently ignored if user is not a seller)
  dailySalesSummary: z.boolean().optional(),
  staleListingDays: z.number().int().min(1).max(365).nullable().optional(),
  trustScoreAlerts: z.boolean().optional(),
}).strict().refine(
  (data) => {
    if (data.quietHoursEnabled) {
      return data.quietHoursStart !== null && data.quietHoursEnd !== null;
    }
    return true;
  },
  { message: 'Start and end times required when quiet hours enabled' }
);

export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;
