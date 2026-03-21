import type { Metadata } from 'next';
import Link from 'next/link';
import { loginStaffAction } from '@/lib/actions/staff-login';

export const metadata: Metadata = {
  title: 'Hub Login | Twicely',
  robots: { index: false, follow: false },
};

interface HubLoginPageProps {
  searchParams: Promise<{ error?: string; reason?: string }>;
}

export default async function HubLoginPage({
  searchParams,
}: HubLoginPageProps) {
  const params = await searchParams;
  const hasError = params.error === '1';
  const reason = params.reason;

  const sessionMessage =
    reason === 'inactivity'
      ? 'Your session expired due to inactivity. Please sign in again.'
      : reason === 'expired'
        ? 'Your session has expired. Please sign in again.'
        : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      {/* Logo + subtitle */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary">Twicely</h1>
        <p className="mt-1 text-sm text-gray-500">Staff Portal</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h2 className="text-xl font-bold text-gray-900">Staff Sign In</h2>

        {sessionMessage && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            {sessionMessage}
          </div>
        )}

        {hasError && (
          <div className="mt-4 rounded-lg bg-error-50 p-3 text-sm text-error-700">
            Invalid email or password. Please try again.
          </div>
        )}

        <form action={loginStaffAction} className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-primary"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@twicely.co"
              className="w-full rounded-xl border border-gray-200 bg-primary/5 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-primary"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              className="w-full rounded-xl border border-gray-200 bg-primary/5 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Sign In
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>This portal is for Twicely staff only.</p>
        <Link
          href="https://twicely.co"
          className="mt-1 inline-block font-medium text-primary hover:text-primary/80"
        >
          Go to Twicely.co
        </Link>
      </div>
    </div>
  );
}
