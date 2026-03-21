import { z } from 'zod';

export const activateVacationSchema = z.object({
  modeType: z.enum(['PAUSE_SALES', 'ALLOW_SALES', 'CUSTOM']),
  vacationMessage: z.string().max(500).optional(),
  autoReplyMessage: z.string().max(500).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime(),
}).strict();

export const deactivateVacationSchema = z.object({}).strict();

export const adminForceDeactivateVacationSchema = z.object({
  sellerId: z.string().cuid2(),
  reason: z.string().min(1).max(500),
}).strict();

export type ActivateVacationInput = z.infer<typeof activateVacationSchema>;
export type AdminForceDeactivateVacationInput = z.infer<typeof adminForceDeactivateVacationSchema>;
