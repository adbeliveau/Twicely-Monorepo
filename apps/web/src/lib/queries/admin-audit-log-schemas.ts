import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  actorType: z.string().optional(),
  action: z.string().optional(),
  subject: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  actorId: z.string().optional(),
  subjectId: z.string().optional(),
}).strict();

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
