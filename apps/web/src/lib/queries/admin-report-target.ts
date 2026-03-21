/**
 * Admin Report Target Preview Queries (I16)
 * Fetches content preview for content report targets: LISTING, REVIEW, MESSAGE, USER.
 */

import { db } from '@twicely/db';
import { listing, review, message, user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';

export type ContentReportTarget = 'LISTING' | 'REVIEW' | 'MESSAGE' | 'USER';

export interface ListingPreview {
  type: 'LISTING';
  title: string | null;
  thumbnailUrl: string | null;
  status: string;
}

export interface ReviewPreview {
  type: 'REVIEW';
  excerpt: string;
  rating: number;
}

export interface MessagePreview {
  type: 'MESSAGE';
  excerpt: string;
}

export interface UserPreview {
  type: 'USER';
  name: string;
  email: string;
  isBanned: boolean;
}

export type TargetPreview =
  | ListingPreview
  | ReviewPreview
  | MessagePreview
  | UserPreview
  | null;

export async function getReportTargetPreview(
  targetType: ContentReportTarget,
  targetId: string
): Promise<TargetPreview> {
  if (targetType === 'LISTING') {
    const [row] = await db
      .select({
        title: listing.title,
        status: listing.status,
      })
      .from(listing)
      .where(eq(listing.id, targetId))
      .limit(1);
    if (!row) return null;
    return { type: 'LISTING', title: row.title ?? null, thumbnailUrl: null, status: row.status };
  }

  if (targetType === 'REVIEW') {
    const [row] = await db
      .select({ body: review.body, rating: review.rating })
      .from(review)
      .where(eq(review.id, targetId))
      .limit(1);
    if (!row) return null;
    const body = row.body ?? '';
    return {
      type: 'REVIEW',
      excerpt: body.length > 200 ? `${body.slice(0, 200)}…` : body,
      rating: row.rating,
    };
  }

  if (targetType === 'MESSAGE') {
    const [row] = await db
      .select({ body: message.body })
      .from(message)
      .where(eq(message.id, targetId))
      .limit(1);
    if (!row) return null;
    const body = row.body;
    return {
      type: 'MESSAGE',
      excerpt: body.length > 200 ? `${body.slice(0, 200)}…` : body,
    };
  }

  if (targetType === 'USER') {
    const [row] = await db
      .select({ name: user.name, email: user.email, isBanned: user.isBanned })
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1);
    if (!row) return null;
    return { type: 'USER', name: row.name, email: row.email, isBanned: row.isBanned };
  }

  return null;
}
