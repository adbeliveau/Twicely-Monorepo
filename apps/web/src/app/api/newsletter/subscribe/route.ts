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
import NewsletterWelcomeEmail from '@twicely/email/templates/newsletter-welcome';

const subscribeSchema = z.object({
  email: z.string().email().max(254).transform((e) => e.toLowerCase().trim()),
  source: z.enum(['HOMEPAGE_SECTION', 'HOMEPAGE_FOOTER']).default('HOMEPAGE_SECTION'),
}).strict();

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // M1 Security: IP-based rate limiting (3 per hour)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  try {
    const valkey = getValkeyClient();
    const key = `newsletter-rate:${ip}`;
    const count = await valkey.incr(key);
    if (count === 1) await valkey.expire(key, 3600);
    if (count > 3) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }
  } catch {
    logger.warn('[newsletter] Valkey unavailable for rate limiting');
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

    const [existing] = await db
      .select({ id: newsletterSubscriber.id, unsubscribedAt: newsletterSubscriber.unsubscribedAt })
      .from(newsletterSubscriber)
      .where(eq(newsletterSubscriber.email, email))
      .limit(1);

    if (existing && existing.unsubscribedAt === null) {
      return NextResponse.json({ success: true, alreadySubscribed: true });
    }

    let subscriberId: string;

    if (existing && existing.unsubscribedAt !== null) {
      // Re-subscribe: clear unsubscribedAt and reset welcome state
      await db
        .update(newsletterSubscriber)
        .set({ unsubscribedAt: null, confirmedAt: new Date(), welcomeSentAt: null })
        .where(eq(newsletterSubscriber.id, existing.id));
      subscriberId = existing.id;
    } else {
      // New subscriber
      const [inserted] = await db
        .insert(newsletterSubscriber)
        .values({ email, source })
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

    const unsubscribeUrl = `${APP_URL}/api/newsletter/unsubscribe?token=${row.unsubscribeToken}`;

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

    await db
      .update(newsletterSubscriber)
      .set({ welcomeSentAt: new Date() })
      .where(eq(newsletterSubscriber.id, subscriberId));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 });
  }
}
