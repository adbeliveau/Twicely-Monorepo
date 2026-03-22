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
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#7C3AED]">Twicely</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Staff Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl bg-white p-8 shadow-lg dark:bg-gray-800">
          <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-white">
            Staff Sign In
          </h2>

          {sessionMessage && (
            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {sessionMessage}
            </div>
          )}

          {hasError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Invalid email or password. Please try again.
            </div>
          )}

          <form action={loginStaffAction} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter your email"
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[#7C3AED] py-2.5 font-medium text-white hover:bg-[#6D28D9] disabled:opacity-50"
            >
              Sign In
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-500">
          This portal is for Twicely staff only.
          <br />
          <Link
            href="https://twicely.co"
            className="text-[#7C3AED] hover:underline"
          >
            Go to Twicely.co
          </Link>
        </p>
      </div>
    </div>
  );
}
