import { z } from 'zod';

export const askQuestionSchema = z.object({
  listingId: z.string().cuid2(),
  questionText: z
    .string()
    .min(5, 'Question must be at least 5 characters')
    .max(500, 'Question must be under 500 characters'),
}).strict();

export const answerQuestionSchema = z.object({
  questionId: z.string().cuid2(),
  answerText: z
    .string()
    .min(1, 'Answer is required')
    .max(1000, 'Answer must be under 1000 characters'),
}).strict();

export const hideQuestionSchema = z.object({
  questionId: z.string().cuid2(),
}).strict();

export const pinQuestionSchema = z.object({
  questionId: z.string().cuid2(),
  isPinned: z.boolean(),
}).strict();

export type AskQuestionInput = z.infer<typeof askQuestionSchema>;
export type AnswerQuestionInput = z.infer<typeof answerQuestionSchema>;
export type HideQuestionInput = z.infer<typeof hideQuestionSchema>;
export type PinQuestionInput = z.infer<typeof pinQuestionSchema>;
