import { z } from 'zod';

// Feature Lock-in Section 19: "required listingId", Decision #38
export const createConversationSchema = z.object({
  listingId: z.string().cuid2(),
  body: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message must be under 5000 characters'),
}).strict();

// Feature Lock-in Section 19: text messages, up to 4 images
export const sendMessageSchema = z.object({
  conversationId: z.string().cuid2(),
  body: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message must be under 5000 characters'),
  attachments: z
    .array(z.string().url())
    .max(4, 'Maximum 4 images per message')
    .default([]),
}).strict();

export const markAsReadSchema = z.object({
  conversationId: z.string().cuid2(),
}).strict();

export const archiveConversationSchema = z.object({
  conversationId: z.string().cuid2(),
}).strict();

export const reportMessageSchema = z.object({
  messageId: z.string().cuid2(),
  reason: z
    .string()
    .min(5, 'Reason must be at least 5 characters')
    .max(500, 'Reason must be under 500 characters'),
}).strict();

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.input<typeof sendMessageSchema>;
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;
export type ArchiveConversationInput = z.infer<typeof archiveConversationSchema>;
export type ReportMessageInput = z.infer<typeof reportMessageSchema>;
