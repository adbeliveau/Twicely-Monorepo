'use server';

import { headers } from 'next/headers';
import { auth } from '@twicely/auth/server';
import { db } from '@twicely/db';
import { user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { z } from 'zod';
import { logger } from '@twicely/logger';

// Note: auth and headers imports are still used by checkUsernameAvailability

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  displayName: z.string().max(100).optional(),
  username: z.string().min(3).max(30).optional(),
  bio: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  marketingOptIn: z.boolean().optional(),
}).strict();

export type UpdateProfileData = z.infer<typeof updateProfileSchema>;

export interface UpdateProfileResult {
  success: boolean;
  error?: string;
}

export async function updateProfile(data: unknown): Promise<UpdateProfileResult> {
  const parsed = updateProfileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  // CASL authorization check - user can only update their own profile
  if (!ability.can('update', sub('User', { id: session.userId }))) {
    return { success: false, error: 'Not authorized to update this profile' };
  }

  // Check username uniqueness if username is being changed
  if (parsed.data.username) {
    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, parsed.data.username))
      .limit(1);

    if (existingUser.length > 0 && existingUser[0]?.id !== session.userId) {
      return { success: false, error: 'Username is already taken' };
    }
  }

  try {
    // Build update object with only provided fields
    const updateData: {
      name?: string;
      displayName?: string | null;
      username?: string | null;
      bio?: string | null;
      phone?: string | null;
      marketingOptIn?: boolean;
    } = {};

    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.displayName !== undefined) updateData.displayName = parsed.data.displayName || null;
    if (parsed.data.username !== undefined) updateData.username = parsed.data.username || null;
    if (parsed.data.bio !== undefined) updateData.bio = parsed.data.bio || null;
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone || null;
    if (parsed.data.marketingOptIn !== undefined) updateData.marketingOptIn = parsed.data.marketingOptIn;

    await db
      .update(user)
      .set(updateData)
      .where(eq(user.id, session.userId));

    return { success: true };
  } catch (error) {
    logger.error('Failed to update profile', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: 'Failed to update profile' };
  }
}

export async function checkUsernameAvailability(username: string): Promise<{ available: boolean }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { available: false };
  }

  if (!username || username.length < 3) {
    return { available: false };
  }

  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);

  // Available if no user has it, or if current user has it
  const available = existingUser.length === 0 || existingUser[0]?.id === session.user.id;

  return { available };
}
