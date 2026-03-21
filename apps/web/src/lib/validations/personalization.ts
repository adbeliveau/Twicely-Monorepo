import { z } from 'zod';

export const saveUserInterestsSchema = z.object({
  tagSlugs: z.array(z.string().min(1).max(50)).min(2).max(50),
});

export type SaveUserInterestsInput = z.infer<typeof saveUserInterestsSchema>;
