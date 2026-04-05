/**
 * GET /api/newsletter/unsubscribe?token=<token>
 * Public one-click unsubscribe endpoint.
 * G10.12
 */

import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@twicely/db';
import { newsletterSubscriber } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { logger } from '@twicely/logger';

const UNSUBSCRIBE_TOKEN_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token');

  if (!token || token.trim() === '') {
    return NextResponse.redirect(new URL('/?unsubscribed=error', request.url));
  }

  const [row] = await db
    .select({
      id: newsletterSubscriber.id,
      unsubscribedAt: newsletterSubscriber.unsubscribedAt,
      unsubscribeTokenExpiresAt: newsletterSubscriber.unsubscribeTokenExpiresAt,
    })
    .from(newsletterSubscriber)
    .where(eq(newsletterSubscriber.unsubscribeToken, token))
    .limit(1);

  if (!row) {
    return NextResponse.redirect(new URL('/?unsubscribed=error', request.url));
  }

  if (row.unsubscribedAt !== null) {
    return NextResponse.redirect(new URL('/?unsubscribed=already', request.url));
  }

  // SEC-041: Check token expiration (null = legacy token, always valid)
  const now = new Date();
  const tokenExpired = row.unsubscribeTokenExpiresAt !== null
    && row.unsubscribeTokenExpiresAt < now;

  if (tokenExpired) {
    logger.warn('[newsletter] Unsubscribe with expired token', { subscriberId: row.id });
  }

  // Always allow unsubscribe even with expired token (CAN-SPAM compliance).
  // If token was expired, regenerate it to invalidate the old one.
  await db
    .update(newsletterSubscriber)
    .set({
      unsubscribedAt: now,
      ...(tokenExpired ? {
        unsubscribeToken: createId(),
        unsubscribeTokenExpiresAt: new Date(now.getTime() + UNSUBSCRIBE_TOKEN_EXPIRY_MS),
      } : {}),
    })
    .where(eq(newsletterSubscriber.id, row.id));

  return NextResponse.redirect(new URL('/?unsubscribed=success', request.url));
}
