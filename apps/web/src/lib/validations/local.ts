import { z } from 'zod';

export const updateSellerLocalSettingsSchema = z.object({
  maxMeetupDistanceMiles: z.number().int().min(1).max(50).nullable(),
}).strict();

export const checkInSchema = z.object({
  localTransactionId: z.string().min(1),
}).strict();

// Online confirmation: buyer scans seller's QR token
export const confirmReceiptOnlineSchema = z.object({
  localTransactionId: z.string().min(1),
  sellerToken: z.string().min(1),
}).strict();

// Online confirmation: buyer enters seller's 6-digit code manually
export const confirmReceiptManualSchema = z.object({
  localTransactionId: z.string().min(1),
  sellerOfflineCode: z.string().regex(/^\d{6}$/),
}).strict();

// Offline dual-token confirmation: both QR tokens submitted together
export const confirmOfflineDualSchema = z.object({
  localTransactionId: z.string().min(1),
  sellerToken: z.string().min(1),
  buyerToken: z.string().min(1),
  offlineTimestamp: z.string().datetime(),
}).strict();

// Offline dual-code confirmation: both 6-digit codes submitted together
export const confirmOfflineDualCodeSchema = z.object({
  localTransactionId: z.string().min(1),
  sellerOfflineCode: z.string().regex(/^\d{6}$/),
  buyerOfflineCode: z.string().regex(/^\d{6}$/),
  offlineTimestamp: z.string().datetime(),
}).strict();

export const initiatePriceAdjustmentSchema = z.object({
  localTransactionId: z.string().min(1),
  adjustedPriceCents: z.number().int().min(1),
  adjustmentReason: z.string().min(1).max(500),
}).strict();

export const respondToAdjustmentSchema = z.object({
  localTransactionId: z.string().min(1),
  accept: z.boolean(),
}).strict();

/** Propose a meetup time (date + time). */
export const proposeMeetupTimeSchema = z.object({
  localTransactionId: z.string().min(1),
  proposedAt: z.string().datetime(),
}).strict();

/** Accept a proposed meetup time. */
export const acceptMeetupTimeSchema = z.object({
  localTransactionId: z.string().min(1),
}).strict();

/** Propose a reschedule (change confirmed meetup time). */
export const proposeRescheduleSchema = z.object({
  localTransactionId: z.string().min(1),
  proposedAt: z.string().datetime(),
}).strict();

/** Accept or decline a pending reschedule. */
export const respondToRescheduleSchema = z.object({
  localTransactionId: z.string().min(1),
  accept: z.boolean(),
}).strict();

/** Cancel a local transaction before the meetup. */
export const cancelLocalTransactionSchema = z.object({
  localTransactionId: z.string().min(1),
  reason: z.string().min(1).max(500).optional(),
}).strict();

/** Buyer sends a day-of confirmation request to the seller. */
export const sendDayOfConfirmationSchema = z.object({
  localTransactionId: z.string().min(1),
}).strict();

/** Seller confirms they are still coming to the meetup. */
export const respondToDayOfConfirmationSchema = z.object({
  localTransactionId: z.string().min(1),
}).strict();

/** Upload meetup condition photos (buyer only, before receipt confirmation). */
export const uploadMeetupPhotosSchema = z.object({
  localTransactionId: z.string().min(1),
  photoUrls: z.array(z.string().url()).min(1).max(5),
}).strict();

/** Remove a meetup photo (buyer only, before receipt confirmation). */
export const removeMeetupPhotoSchema = z.object({
  localTransactionId: z.string().min(1),
  photoUrl: z.string().url(),
}).strict();
