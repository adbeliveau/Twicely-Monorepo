import { z } from 'zod';
import { zodId } from './shared';

export const SERVICE_TYPES = [
  'STORAGE', 'EMAIL', 'SEARCH', 'SMS', 'PUSH',
  'PAYMENTS', 'SHIPPING', 'REALTIME', 'CACHE',
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const createProviderMappingSchema = z.object({
  usageKey: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  serviceType: z.enum(SERVICE_TYPES),
  primaryInstanceId: zodId,
  fallbackInstanceId: z.string().nullable().optional(),
  autoFailover: z.boolean().default(false),
}).strict();

export type CreateProviderMappingInput = z.infer<typeof createProviderMappingSchema>;
