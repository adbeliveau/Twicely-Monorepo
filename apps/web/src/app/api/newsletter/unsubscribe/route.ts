/**
 * GET /api/newsletter/unsubscribe?token=<token>
 * Public one-click unsubscribe endpoint.
 * G10.12
 */

import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@twicely/db';
import { newsletterSubscriber } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token');

  if (!token || token.trim() === '') {
    return NextResponse.redirect(new URL('/?unsubscribed=error', request.url));
  }

  const [row] = await db
    .select({ id: newsletterSubscriber.id, unsubscribedAt: newsletterSubscriber.unsubscribedAt })
    .from(newsletterSubscriber)
    .where(eq(newsletterSubscriber.unsubscribeToken, token))
    .limit(1);

  if (!row) {
    return NextResponse.redirect(new URL('/?unsubscribed=error', request.url));
  }

  if (row.unsubscribedAt !== null) {
    return NextResponse.redirect(new URL('/?unsubscribed=already', request.url));
  }

  await db
    .update(newsletterSubscriber)
    .set({ unsubscribedAt: new Date() })
    .where(eq(newsletterSubscriber.id, row.id));

  return NextResponse.redirect(new URL('/?unsubscribed=success', request.url));
}
