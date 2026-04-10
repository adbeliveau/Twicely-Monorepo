'use server';

import { revalidatePath } from 'next/cache';
import { authorize } from '@twicely/casl/authorize';
import {
  createOffer,
  acceptOffer,
  declineOffer,
  counterOffer,
  cancelOffer,
} from '@twicely/commerce/offer-engine';
import { createOfferSchema, counterOfferSchema } from '@/lib/validations/offers';
import { zodId } from '@/lib/validations/shared';
import { z } from 'zod';
import { db } from '@twicely/db';
import { listingOffer } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';

export { createBundleOfferAction } from './offers-bundle';

interface ActionResult {
  success: boolean;
  error?: string;
  offerId?: string;
  orderId?: string;
  orderNumber?: string;
  autoAccepted?: boolean;
}

/**
 * Create a new offer on a listing (buyer action).
 * Includes shippingAddressId for order creation when accepted.
 */
export async function createOfferAction(data: z.infer<typeof createOfferSchema>): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to make an offer' };
  }

  if (!ability.can('create', 'Offer')) {
    return { success: false, error: 'You do not have permission to create offers' };
  }

  // Validate input
  const parsed = createOfferSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const result = await createOffer({
    listingId: parsed.data.listingId,
    buyerId: session.userId,
    offerCents: parsed.data.offerCents,
    message: parsed.data.message,
    paymentMethodId: parsed.data.paymentMethodId,
    shippingAddressId: parsed.data.shippingAddressId,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath('/my/buying/offers');
  revalidatePath(`/i/${parsed.data.listingId}`);

  return {
    success: true,
    offerId: result.offer?.id,
    autoAccepted: result.autoAccepted,
    orderId: result.orderId,
    orderNumber: result.orderNumber,
  };
}

const acceptOfferInputSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
  paymentMethodId: zodId.optional(),
}).strict();

/**
 * Accept an offer (seller accepts buyer offer, or buyer accepts seller counter).
 * Shipping address is already on the offer from when it was created.
 */
export async function acceptOfferAction(
  data: z.infer<typeof acceptOfferInputSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', 'Offer')) {
    return { success: false, error: 'You do not have permission to accept offers' };
  }

  // Validate input
  const parsed = acceptOfferInputSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // SEC-003: Verify caller is a party to this offer (defense-in-depth)
  const [offerRow] = await db.select({ buyerId: listingOffer.buyerId, sellerId: listingOffer.sellerId })
    .from(listingOffer).where(eq(listingOffer.id, parsed.data.offerId)).limit(1);
  if (!offerRow || (offerRow.buyerId !== session.userId && offerRow.sellerId !== session.userId)) {
    return { success: false, error: 'Offer not found' };
  }

  const result = await acceptOffer(
    parsed.data.offerId,
    session.userId,
    parsed.data.paymentMethodId
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath('/my/buying/offers');
  revalidatePath('/my/selling/offers');
  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');

  return {
    success: true,
    offerId: result.offer?.id,
    orderId: result.orderId,
    orderNumber: result.orderNumber,
  };
}

const declineOfferInputSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
}).strict();

/**
 * Decline an offer (seller action).
 */
export async function declineOfferAction(
  data: z.infer<typeof declineOfferInputSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', 'Offer')) {
    return { success: false, error: 'You do not have permission to decline offers' };
  }

  // Validate input
  const parsed = declineOfferInputSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // SEC-003: Verify caller is a party to this offer
  const [decOfferRow] = await db.select({ sellerId: listingOffer.sellerId })
    .from(listingOffer).where(eq(listingOffer.id, parsed.data.offerId)).limit(1);
  if (!decOfferRow || decOfferRow.sellerId !== session.userId) {
    return { success: false, error: 'Offer not found' };
  }

  const result = await declineOffer(parsed.data.offerId, session.userId);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath('/my/buying/offers');
  revalidatePath('/my/selling/offers');

  return { success: true, offerId: result.offer?.id };
}

const counterOfferInputSchema = counterOfferSchema.extend({
  paymentMethodId: zodId.optional(), // Required when buyer counters
});

/**
 * Counter an offer (seller or buyer action).
 * When buyer counters, paymentMethodId is required for the new hold.
 */
export async function counterOfferAction(
  data: z.infer<typeof counterOfferInputSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', 'Offer')) {
    return { success: false, error: 'You do not have permission to counter offers' };
  }

  // Validate input
  const parsed = counterOfferInputSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // SEC-003: Verify caller is a party to this offer
  const [ctrOfferRow] = await db.select({ buyerId: listingOffer.buyerId, sellerId: listingOffer.sellerId })
    .from(listingOffer).where(eq(listingOffer.id, parsed.data.offerId)).limit(1);
  if (!ctrOfferRow || (ctrOfferRow.buyerId !== session.userId && ctrOfferRow.sellerId !== session.userId)) {
    return { success: false, error: 'Offer not found' };
  }

  const result = await counterOffer(
    parsed.data.offerId,
    session.userId,
    parsed.data.counterCents,
    parsed.data.message,
    parsed.data.paymentMethodId
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath('/my/buying/offers');
  revalidatePath('/my/selling/offers');

  return { success: true, offerId: result.offer?.id };
}

const cancelOfferInputSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
}).strict();

/**
 * Cancel/withdraw an offer (buyer action).
 */
export async function cancelOfferAction(
  data: z.infer<typeof cancelOfferInputSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('delete', 'Offer')) {
    return { success: false, error: 'You do not have permission to cancel offers' };
  }

  // Validate input
  const parsed = cancelOfferInputSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // SEC-003: Verify caller is the buyer (only buyer can cancel)
  const [canOfferRow] = await db.select({ buyerId: listingOffer.buyerId })
    .from(listingOffer).where(eq(listingOffer.id, parsed.data.offerId)).limit(1);
  if (!canOfferRow || canOfferRow.buyerId !== session.userId) {
    return { success: false, error: 'Offer not found' };
  }

  const result = await cancelOffer(parsed.data.offerId, session.userId);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath('/my/buying/offers');
  revalidatePath('/my/selling/offers');

  return { success: true, offerId: result.offer?.id };
}

