'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import {
  uploadMeetupPhotosSchema,
  removeMeetupPhotoSchema,
} from '@/lib/validations/local';
import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

const PHOTO_UPLOAD_STATUSES = ['BOTH_CHECKED_IN', 'ADJUSTMENT_PENDING'] as const;

function isPhotoUploadAllowed(status: string): boolean {
  return (PHOTO_UPLOAD_STATUSES as readonly string[]).includes(status);
}

// ─── uploadMeetupPhotosAction ─────────────────────────────────────────────────

export async function uploadMeetupPhotosAction(
  data: z.infer<typeof uploadMeetupPhotosSchema>
): Promise<{ success: boolean; photoUrls?: string[]; error?: string }> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = uploadMeetupPhotosSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [tx] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, parsed.data.localTransactionId))
    .limit(1);

  if (!tx || tx.buyerId !== session.userId) {
    return { success: false, error: 'Not found' };
  }

  if (!ability.can('update', sub('LocalTransaction', { buyerId: tx.buyerId }))) {
    return { success: false, error: 'Not found' };
  }

  if (!isPhotoUploadAllowed(tx.status)) {
    return { success: false, error: 'Photos can only be uploaded before confirming receipt' };
  }

  if (tx.confirmedAt !== null) {
    return { success: false, error: 'Transaction already confirmed' };
  }

  const existingUrls = tx.meetupPhotoUrls;
  const newUrls = parsed.data.photoUrls.filter((url) => !existingUrls.includes(url));
  const combined = [...existingUrls, ...newUrls];

  if (combined.length > 5) {
    return { success: false, error: 'Maximum 5 photos per transaction' };
  }

  const now = new Date();
  await db
    .update(localTransaction)
    .set({
      meetupPhotoUrls: combined,
      meetupPhotosAt: tx.meetupPhotosAt ?? now,
      updatedAt: now,
    })
    .where(eq(localTransaction.id, tx.id));

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');
  return { success: true, photoUrls: combined };
}

// ─── removeMeetupPhotoAction ──────────────────────────────────────────────────

export async function removeMeetupPhotoAction(
  data: z.infer<typeof removeMeetupPhotoSchema>
): Promise<{ success: boolean; error?: string }> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = removeMeetupPhotoSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [tx] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, parsed.data.localTransactionId))
    .limit(1);

  if (!tx || tx.buyerId !== session.userId) {
    return { success: false, error: 'Not found' };
  }

  if (!ability.can('update', sub('LocalTransaction', { buyerId: tx.buyerId }))) {
    return { success: false, error: 'Not found' };
  }

  if (!isPhotoUploadAllowed(tx.status)) {
    return { success: false, error: 'Photos cannot be removed after confirming receipt' };
  }

  if (tx.confirmedAt !== null) {
    return { success: false, error: 'Transaction already confirmed' };
  }

  if (!tx.meetupPhotoUrls.includes(parsed.data.photoUrl)) {
    return { success: false, error: 'Photo not found in transaction' };
  }

  const updatedUrls = tx.meetupPhotoUrls.filter((url) => url !== parsed.data.photoUrl);
  const now = new Date();

  await db
    .update(localTransaction)
    .set({
      meetupPhotoUrls: updatedUrls,
      meetupPhotosAt: updatedUrls.length === 0 ? null : tx.meetupPhotosAt,
      updatedAt: now,
    })
    .where(eq(localTransaction.id, tx.id));

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');
  return { success: true };
}
