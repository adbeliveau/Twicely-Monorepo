/**
 * /p/cookies — Cookie Preferences Page — G8.3
 *
 * PUBLIC route. Policy layout (marketplace).
 * Explains what cookies are used and allows users to manage preferences.
 *
 * Per Feature Lock-in section 37. Route /p/cookies per install prompt
 * inconsistency resolution (INCONSISTENCY 4).
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { CookiePreferencesForm } from '@/components/pages/privacy/cookie-preferences';
import { auth } from '@twicely/auth/server';

export const metadata: Metadata = {
  title: 'Cookie Preferences | Twicely',
  description: 'Manage your cookie preferences on Twicely.',
};

export default async function CookiesPage() {
  let isAuthenticated = false;
  try {
    const betterAuthSession = await auth.api.getSession({
      headers: await headers(),
    });
    isAuthenticated = !!betterAuthSession;
  } catch {
    isAuthenticated = false;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Cookie Preferences</h1>
        <p className="text-muted-foreground">
          Manage how Twicely uses cookies and similar technologies on your device.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">What are cookies?</h2>
        <p className="text-sm text-muted-foreground">
          Cookies are small text files placed on your device to help us provide and
          improve our services. We use three categories of cookies, detailed below.
          You can change your preferences at any time on this page.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Your preferences</h2>
        <CookiePreferencesForm isAuthenticated={isAuthenticated} />
      </section>

      <section className="space-y-2 text-sm text-muted-foreground">
        <p>
          For more information about how we handle your data, see our{' '}
          <Link href="/p/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          Your consent preferences are stored in a cookie on your device.
          If you are signed in, they are also saved to your account.
        </p>
      </section>
    </div>
  );
}
