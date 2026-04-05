'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { loginStaff } from '@twicely/auth/staff-auth';
import { STAFF_TOKEN_COOKIE } from '@twicely/casl/staff-authorize';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getValkeyClient } from '@twicely/db/cache';
import { logger } from '@twicely/logger';
import { headers } from 'next/headers';
import { getClientIp } from '@/lib/utils/get-client-ip';

const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

/**
 * Hub login server action.
 * On success: sets the staff token cookie and redirects to /d.
 * On failure: redirects back to /login with an error query param.
 */
export async function loginStaffAction(formData: FormData): Promise<void> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    redirect('/login?error=1');
  }

  // SEC-004 + SEC-046: Rate limiting — per-email AND per-IP to prevent lockout DoS
  const clientIp = getClientIp(await headers());
  try {
    const valkey = getValkeyClient();

    // Per-email limit (prevents brute force on a single account)
    const emailKey = `staff-login-rl:${parsed.data.email.toLowerCase()}`;
    const emailAttempts = await valkey.incr(emailKey);
    if (emailAttempts === 1) await valkey.expire(emailKey, 900);
    if (emailAttempts > 5) {
      logger.warn('[staffLogin] Email rate limited', { email: parsed.data.email });
      redirect('/login?error=locked');
    }

    // Per-IP limit (prevents single IP from locking out multiple accounts)
    const ipKey = `staff-login-ip:${clientIp}`;
    const ipAttempts = await valkey.incr(ipKey);
    if (ipAttempts === 1) await valkey.expire(ipKey, 900);
    if (ipAttempts > 20) {
      logger.warn('[staffLogin] IP rate limited', { ip: clientIp });
      redirect('/login?error=locked');
    }
  } catch (err) {
    // If Valkey is down, log and continue (fail-open for availability)
    logger.warn('[staffLogin] Rate limit check failed', { error: String(err) });
  }

  let token: string;
  try {
    const result = await loginStaff(parsed.data.email, parsed.data.password);
    token = result.token;
  } catch {
    redirect('/login?error=1');
  }

  const cookieStore = await cookies();
  cookieStore.set(STAFF_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: await getPlatformSetting<number>('general.staffSessionAbsoluteHours', 8) * 3600,
    path: '/',
  });

  redirect('/d');
}

/**
 * Hub logout server action.
 * Clears the staff token cookie and redirects to /login.
 */
export async function logoutStaffAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_TOKEN_COOKIE)?.value;

  if (token) {
    const { logoutStaff } = await import('@twicely/auth/staff-auth');
    await logoutStaff(token);
  }

  cookieStore.delete(STAFF_TOKEN_COOKIE);
  // SEC-045: Clear impersonation cookie on staff logout
  cookieStore.delete('twicely.impersonation_token');
  redirect('/login');
}
