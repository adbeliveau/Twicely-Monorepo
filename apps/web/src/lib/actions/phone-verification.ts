'use server';

/**
 * Phone Verification Actions — send and verify SMS codes.
 * Uses @twicely/sms with Telnyx backend.
 */

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { sendVerificationCode, verifyCode } from '@twicely/sms';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const phoneSchema = z.object({
  phone: z.string().min(10).max(20).regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format'),
}).strict();

const verifySchema = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
}).strict();

export async function sendPhoneVerificationAction(input: unknown) {
  const { session } = await authorize();
  if (!session) return { error: 'Not authenticated' };

  const parsed = phoneSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid phone number' };

  const { phone } = parsed.data;

  // Update phone on user record
  await db.update(user).set({
    phone,
    phoneVerified: false,
    updatedAt: new Date(),
  }).where(eq(user.id, session.userId));

  const result = await sendVerificationCode(phone);

  if (!result.success) {
    return { error: result.error ?? 'Failed to send verification code' };
  }

  return { success: true };
}

export async function verifyPhoneAction(input: unknown) {
  const { session } = await authorize();
  if (!session) return { error: 'Not authenticated' };

  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { phone, code } = parsed.data;

  // Verify the user's phone matches what they're verifying
  const [currentUser] = await db
    .select({ phone: user.phone })
    .from(user)
    .where(eq(user.id, session.userId))
    .limit(1);

  if (!currentUser || currentUser.phone !== phone) {
    return { error: 'Phone number mismatch' };
  }

  const result = await verifyCode(phone, code);

  if (!result.success) {
    return { error: result.error ?? 'Verification failed' };
  }

  // Mark phone as verified
  await db.update(user).set({
    phoneVerified: true,
    updatedAt: new Date(),
  }).where(eq(user.id, session.userId));

  revalidatePath('/my/settings');
  return { success: true };
}
