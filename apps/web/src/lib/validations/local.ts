import { z } from 'zod';
import { zodId } from './shared';

export const updateSellerLocalSettingsSchema = z.object({
  maxMeetupDistanceMiles: z.number().int().min(1).max(50).nullable(),
}).strict();

export const checkInSchema = z.object({
  localTransactionId: zodId,
}).strict();

// Online confirmation: buyer scans seller's QR token
export const confirmReceiptOnlineSchema = z.object({
  localTransactionId: zodId,
  sellerToken: z.string().min(1),
}).strict();

// Online confirmation: buyer enters seller's 6-digit code manually
export const confirmReceiptManualSchema = z.object({
  localTransactionId: zodId,
  sellerOfflineCode: z.string().regex(/^\d{6}$/),
}).strict();

// Offline dual-token confirmation: both QR tokens submitted together
export const confirmOfflineDualSchema = z.object({
  localTransactionId: zodId,
  sellerToken: z.string().min(1),
  buyerToken: z.string().min(1),
  offlineTimestamp: z.string().datetime(),
}).strict();

// Offline dual-code confirmation: both 6-digit codes submitted together
export const confirmOfflineDualCodeSchema = z.object({
  localTransactionId: zodId,
  sellerOfflineCode: z.string().regex(/^\d{6}$/),
  buyerOfflineCode: z.string().regex(/^\d{6}$/),
  offlineTimestamp: z.string().datetime(),
}).strict();

export const initiatePriceAdjustmentSchema = z.object({
  localTransactionId: zodId,
  adjustedPriceCents: z.number().int().min(1),
  adjustmentReason: z.string().min(1).max(500),
}).strict();

export const respondToAdjustmentSchema = z.object({
  localTransactionId: zodId,
  accept: z.boolean(),
}).strict();

/** Propose a meetup time (date + time). */
export const proposeMeetupTimeSchema = z.object({
  localTransactionId: zodId,
  proposedAt: z.string().datetime(),
}).strict();

/** Accept a proposed meetup time. */
export const acceptMeetupTimeSchema = z.object({
  localTransactionId: zodId,
}).strict();

/** Propose a reschedule (change confirmed meetup time). */
export const proposeRescheduleSchema = z.object({
  localTransactionId: zodId,
  proposedAt: z.string().datetime(),
}).strict();

/** Accept or decline a pending reschedule. */
export const respondToRescheduleSchema = z.object({
  localTransactionId: zodId,
  accept: z.boolean(),
}).strict();

/** Cancel a local transaction before the meetup. */
export const cancelLocalTransactionSchema = z.object({
  localTransactionId: zodId,
  reason: z.string().min(1).max(500).optional(),
}).strict();

/** Buyer sends a day-of confirmation request to the seller. */
export const sendDayOfConfirmationSchema = z.object({
  localTransactionId: zodId,
}).strict();

/** Seller confirms they are still coming to the meetup. */
export const respondToDayOfConfirmationSchema = z.object({
  localTransactionId: zodId,
}).strict();

/** Upload meetup condition photos (buyer only, before receipt confirmation). */
export const uploadMeetupPhotosSchema = z.object({
  localTransactionId: zodId,
  photoUrls: z.array(z.string().url()).min(1).max(5),
}).strict();

/** Remove a meetup photo (buyer only, before receipt confirmation). */
export const removeMeetupPhotoSchema = z.object({
  localTransactionId: zodId,
  photoUrl: z.string().url(),
}).strict();

/** Create a local transaction for an order. */
export const createLocalTransactionSchema = z.object({
  orderId: zodId,
  meetupLocationId: zodId.optional(),
}).strict();

/** Confirm a local transaction (buyer received item). */
export const confirmLocalTransactionSchema = z.object({
  localTransactionId: zodId,
  mode: z.enum(['QR_ONLINE', 'QR_DUAL_OFFLINE', 'CODE_ONLINE', 'CODE_DUAL_OFFLINE']),
}).strict();

/** Check if the current user is eligible for local transactions. */
export const checkLocalEligibilitySchema = z.object({}).strict();

/** Check if a meetup time can be proposed for a transaction. */
export const canProposeMeetupTimeSchema = z.object({
  localTransactionId: zodId,
}).strict();
