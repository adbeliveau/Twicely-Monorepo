import { z } from 'zod';

export const runFraudScanSchema = z.object({
  affiliateId: z.string().min(1, 'Affiliate ID is required'),
}).strict();

export type RunFraudScanInput = z.infer<typeof runFraudScanSchema>;
