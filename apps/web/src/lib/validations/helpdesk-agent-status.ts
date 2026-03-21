import { z } from 'zod';

export const toggleAgentOnlineStatusSchema = z.object({
  isOnline: z.boolean(),
}).strict();
