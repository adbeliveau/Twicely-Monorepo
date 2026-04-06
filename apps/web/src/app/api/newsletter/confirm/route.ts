/**
 * GET /api/newsletter/confirm?token=<token>
 * Public double opt-in confirmation endpoint.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { db } from '@twicely/db';
import { newsletterSubscriber } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import NewsletterWelcomeEmail from '@twicely/email/templates/newsletter-welcome';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';

async function sendWelcomeEmail(email: string, unsubscribeToken: string): Promise<void> {
  const unsubscribeUrl = `${APP_URL}/api/newsletter/unsubscribe?token=${unsubscribeToken}`;
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'Twicely <noreply@twicely.co>',
    to: [email],
    subject: 'Welcome to Twicely updates',
    react: NewsletterWelcomeEmail({ unsubscribeUrl }),
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token');

  if (!token || token.trim() === '') {
    return NextResponse.redirect(new URL('/?subscribed=error', request.url));
  }

  try {
    const [row] = await db
      .select({
        id: newsletterSubscriber.id,
        email: newsletterSubscriber.email,
        confirmedAt: newsletterSubscriber.confirmedAt,
        unsubscribedAt: newsletterSubscriber.unsubscribedAt,
        welcomeSentAt: newsletterSubscriber.welcomeSentAt,
        createdAt: newsletterSubscriber.createdAt,
      })
      .from(newsletterSubscriber)
      .where(eq(newsletterSubscriber.unsubscribeToken, token))
      .limit(1);

    if (!row || row.unsubscribedAt !== null) {
      return NextResponse.redirect(new URL('/?subscribed=error', request.url));
    }

    // Reject expired confirmation tokens (7-day window)
    const CONFIRM_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
    if (!row.confirmedAt && row.createdAt.getTime() + CONFIRM_EXPIRY_MS < Date.now()) {
      return NextResponse.redirect(new URL('/?subscribed=expired', request.url));
    }

    const wasAlreadyConfirmed = row.confirmedAt !== null;

    if (!wasAlreadyConfirmed) {
      await db
        .update(newsletterSubscriber)
        .set({ confirmedAt: new Date() })
        .where(eq(newsletterSubscriber.id, row.id));
    }

    if (row.welcomeSentAt === null) {
      await sendWelcomeEmail(row.email, token);
      await db
        .update(newsletterSubscriber)
        .set({ welcomeSentAt: new Date() })
        .where(eq(newsletterSubscriber.id, row.id));
    }

    return NextResponse.redirect(
      new URL(wasAlreadyConfirmed ? '/?subscribed=already' : '/?subscribed=success', request.url),
    );
  } catch (error) {
    logger.error('[newsletter/confirm] Unexpected error', { error: String(error) });
    return NextResponse.redirect(new URL('/?subscribed=error', request.url));
  }
}
