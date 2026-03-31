'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { loginStaff } from '@twicely/auth/staff-auth';
import { STAFF_TOKEN_COOKIE } from '@twicely/casl/staff-authorize';

// 8 hours in seconds (matches absolute session expiry)
const COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60;

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
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_SECONDS,
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
  redirect('/login');
}
