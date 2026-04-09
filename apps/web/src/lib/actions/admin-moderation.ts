'use server';

/**
 * Admin Moderation Actions (E3.5 + I5 + I6)
 * Remove/clear/suppress listings, approve/remove/flag reviews — all audited
 */

import { db } from '@twicely/db';
import { listing, auditEvent } from '@twicely/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import { getFlaggedListings } from '@/lib/queries/admin-moderation';

// Review actions and bulk operations are in ./admin-moderation-helpers.ts
// Import directly from there to avoid Turbopack re-export bundling issues.

// ─── Schemas ──────────────────────────────────────────────────────────────────

const listingActionSchema = z.object({
  listingId: zodId,
  reason: z.string().min(1).max(500).optional(),
}).strict();

const bulkListingSchema = z.object({
  listingIds: z.array(zodId).min(1).max(50),
  reason: z.string().min(1).max(500).optional(),
}).strict();

// ─── Listing Actions ──────────────────────────────────────────────────────────

export async function removeListingAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = listingActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(listing)
    .set({ enforcementState: 'REMOVED' })
    .where(eq(listing.id, parsed.data.listingId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'REMOVE_LISTING',
    subject: 'Listing',
    subjectId: parsed.data.listingId,
    severity: 'HIGH',
    detailsJson: { reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function clearListingFlagAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = listingActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(listing)
    .set({ enforcementState: 'CLEAR' })
    .where(eq(listing.id, parsed.data.listingId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CLEAR_LISTING_FLAG',
    subject: 'Listing',
    subjectId: parsed.data.listingId,
    severity: 'MEDIUM',
    detailsJson: {},
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function suppressListingAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = listingActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(listing)
    .set({ enforcementState: 'SUPPRESSED' })
    .where(eq(listing.id, parsed.data.listingId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'SUPPRESS_LISTING',
    subject: 'Listing',
    subjectId: parsed.data.listingId,
    severity: 'HIGH',
    detailsJson: { reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function reinstateListingAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = listingActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(listing)
    .set({ enforcementState: 'CLEAR' })
    .where(eq(listing.id, parsed.data.listingId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'REINSTATE_LISTING',
    subject: 'Listing',
    subjectId: parsed.data.listingId,
    severity: 'MEDIUM',
    detailsJson: { reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function flagListingAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = listingActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(listing)
    .set({ enforcementState: 'FLAGGED' })
    .where(eq(listing.id, parsed.data.listingId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'FLAG_LISTING',
    subject: 'Listing',
    subjectId: parsed.data.listingId,
    severity: 'MEDIUM',
    detailsJson: { reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function bulkClearListingFlagsAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = bulkListingSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  if (parsed.data.listingIds.length === 0) return { error: 'No listings specified' };

  await db
    .update(listing)
    .set({ enforcementState: 'CLEAR' })
    .where(inArray(listing.id, parsed.data.listingIds));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'BULK_CLEAR_LISTING_FLAGS',
    subject: 'Listing',
    subjectId: 'bulk',
    severity: 'HIGH',
    detailsJson: { ids: parsed.data.listingIds, reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function getFlaggedListingsAction(page: number = 1, pageSize: number = 50) {
  const { ability } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) return { listings: [], total: 0 };
  return getFlaggedListings(page, pageSize);
}
