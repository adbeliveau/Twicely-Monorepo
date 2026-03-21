import { z } from 'zod';

const VALID_CARRIERS = ['USPS', 'UPS', 'FEDEX', 'OTHER'] as const;

export const shipOrderSchema = z.object({
  orderId: z.string().cuid2(),
  carrier: z.enum(VALID_CARRIERS, { error: 'Invalid carrier. Must be USPS, UPS, FEDEX, or OTHER' }),
  trackingNumber: z.string()
    .min(5, 'Tracking number must be between 5 and 40 characters')
    .max(40, 'Tracking number must be between 5 and 40 characters')
    .regex(/^[A-Za-z0-9-]+$/, 'Tracking number can only contain letters, numbers, and hyphens'),
}).strict();

export type ShipOrderInput = z.infer<typeof shipOrderSchema>;

export const cancelOrderSchema = z.object({
  orderId: z.string().cuid2(),
  reason: z.string()
    .min(10, 'Cancel reason must be at least 10 characters')
    .max(500, 'Cancel reason must not exceed 500 characters'),
}).strict();

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const confirmDeliverySchema = z.object({
  orderId: z.string().cuid2(),
}).strict();

export type ConfirmDeliveryInput = z.infer<typeof confirmDeliverySchema>;
