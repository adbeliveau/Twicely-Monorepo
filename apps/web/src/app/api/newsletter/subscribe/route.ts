/**
 * POST /api/newsletter/subscribe
 * Public endpoint — subscribes a guest or user email to the newsletter.
 * G10.12
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { db } from '@twicely/db';
import { newsletterSubscriber } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getValkeyClient } from '@twicely/db/cache';
import { logger } from '@twicely/logger';
import { getClientIp } from '@twicely/utils/get-client-ip';
import NewsletterWelcomeEmail from '@twicely/email/templates/newsletter-welcome';
import NewsletterConfirmationEmail from '@twicely/email/templates/newsletter-confirmation';

const subscribeSchema = z.object({
  email: z.string().email().max(254).transform((e) => e.toLowerCase().trim()),
  source: z.enum(['HOMEPAGE_SECTION', 'HOMEPAGE_FOOTER']).default('HOMEPAGE_SECTION'),
}).strict();

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';
const UNSUBSCRIBE_TOKEN_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000; // SEC-041: 90 days

async function sendConfirmationEmail(email: string, unsubscribeToken: string): Promise<void> {
  const confirmUrl = `${APP_URL}/api/newsletter/confirm?token=${unsubscribeToken}`;
  const unsubscribeUrl = `${APP_URL}/api/newsletter/unsubscribe?token=${unsubscribeToken}`;
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'Twicely <noreply@twicely.co>',
    to: [email],
    subject: 'Confirm your Twicely updates subscription',
    react: NewsletterConfirmationEmail({ confirmUrl, unsubscribeUrl }),
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  // M1 Security: IP-based rate limiting (3 per hour)
  const ip = getClientIp(request.headers);
  try {
    const valkey = getValkeyClient();
    const key = `newsletter-rate:${ip}`;
    const count = await valkey.incr(key);
    if (count === 1) await valkey.expire(key, 3600);
    if (count > 3) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }
  } catch (error) {
    logger.warn('[newsletter] Valkey unavailable for rate limiting', { error: String(error) });
    return NextResponse.json(
      { success: false, error: 'Newsletter subscriptions are temporarily unavailable' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
  }

  const { email, source } = parsed.data;

  try {
    const enabled = await getPlatformSetting<boolean>('newsletter.enabled', true);
    if (!enabled) {
      return NextResponse.json(
        { success: false, error: 'Newsletter subscriptions are currently unavailable' },
        { status: 503 },
      );
    }
    const doubleOptIn = await getPlatformSetting<boolean>('newsletter.doubleOptIn', true);

    const [existing] = await db
      .select({
        id: newsletterSubscriber.id,
        unsubscribedAt: newsletterSubscriber.unsubscribedAt,
        confirmedAt: newsletterSubscriber.confirmedAt,
      })
      .from(newsletterSubscriber)
      .where(eq(newsletterSubscriber.email, email))
      .limit(1);

    if (existing && existing.unsubscribedAt === null && existing.confirmedAt !== null) {
      return NextResponse.json({ success: true, alreadySubscribed: true });
    }

    let subscriberId: string;

    if (existing) {
      // Re-subscribe or re-send confirmation: normalize subscriber state before emailing again.
      await db
        .update(newsletterSubscriber)
        .set({
          unsubscribedAt: null,
          confirmedAt: doubleOptIn ? null : new Date(),
          welcomeSentAt: null,
          unsubscribeTokenExpiresAt: new Date(Date.now() + UNSUBSCRIBE_TOKEN_EXPIRY_MS),
        })
        .where(eq(newsletterSubscriber.id, existing.id));
      subscriberId = existing.id;
    } else {
      // New subscriber
      const [inserted] = await db
        .insert(newsletterSubscriber)
        .values({
          email,
          source,
          confirmedAt: doubleOptIn ? null : new Date(),
          unsubscribeTokenExpiresAt: new Date(Date.now() + UNSUBSCRIBE_TOKEN_EXPIRY_MS),
        })
        .returning({ id: newsletterSubscriber.id });
      if (!inserted) {
        return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 });
      }
      subscriberId = inserted.id;
    }

    // Fetch unsubscribeToken for the email
    const [row] = await db
      .select({ unsubscribeToken: newsletterSubscriber.unsubscribeToken })
      .from(newsletterSubscriber)
      .where(eq(newsletterSubscriber.id, subscriberId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 });
    }

    if (doubleOptIn) {
      await sendConfirmationEmail(email, row.unsubscribeToken);
      return NextResponse.json({ success: true, confirmationRequired: true });
    }

    await sendWelcomeEmail(email, row.unsubscribeToken);

    await db
      .update(newsletterSubscriber)
      .set({ welcomeSentAt: new Date() })
      .where(eq(newsletterSubscriber.id, subscriberId));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 });
  }
}
