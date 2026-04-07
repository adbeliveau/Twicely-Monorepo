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
    <div className="tw-fullwidth min-h-screen bg-[var(--tw-bg)] flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-[var(--tw-border)]">
        <div className="mx-auto max-w-[1380px] px-7 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-black tracking-tight text-[var(--tw-black)]"
          >
            Twicely<span className="text-[var(--mg)]">.</span>
          </Link>
          <Link
            href="https://twicely.co"
            className="text-sm font-extrabold text-[var(--tw-muted)] hover:text-[var(--tw-black)]"
          >
            &larr; Back to Twicely.co
          </Link>
        </div>
      </header>

      {/* Centered card */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex items-center justify-center px-4 py-12"
      >
        <div className="w-full max-w-md">
          {/* Eyebrow + heading */}
          <div className="mb-8 text-center">
            <div className="tw-eyebrow mx-auto">
              <span className="tw-eyebrow-dot" />
              Staff portal
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
              Sign in to <em className="not-italic text-[var(--mg)]">the hub</em>
            </h1>
            <p className="mt-2 text-sm text-[var(--tw-muted)]">
              For Twicely staff only.
            </p>
          </div>

          {sessionMessage && (
            <div
              role="status"
              className="mb-6 rounded-[var(--tw-r-md)] border-[1.5px] border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800"
            >
              {sessionMessage}
            </div>
          )}

          {hasError && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-6 rounded-[var(--tw-r-md)] border-[1.5px] border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"
            >
              Invalid email or password. Please try again.
            </div>
          )}

          {/* Login Card */}
          <div className="tw-card-shell">
            <h2 className="mb-6 text-xl font-black text-[var(--tw-black)]">
              Staff Sign In
            </h2>

            <form action={loginStaffAction} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-extrabold text-[var(--tw-black)]"
                >
                  Email <span className="text-[var(--mg)]">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@twicely.co"
                  className="h-11 w-full rounded-full border-[1.5px] border-[var(--tw-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--tw-black)] placeholder:text-[var(--tw-muted-lt)] focus-visible:border-[var(--mg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(233,30,203,0.15)]"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-extrabold text-[var(--tw-black)]"
                >
                  Password <span className="text-[var(--mg)]">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-full border-[1.5px] border-[var(--tw-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--tw-black)] placeholder:text-[var(--tw-muted-lt)] focus-visible:border-[var(--mg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(233,30,203,0.15)]"
                />
              </div>

              <button type="submit" className="tw-btn-mg w-full">
                Sign In
              </button>
            </form>
          </div>

          {/* Footer note */}
          <p className="mt-6 text-center text-xs text-[var(--tw-muted-lt)]">
            This portal is for Twicely staff only.{' '}
            <Link
              href="https://twicely.co"
              className="font-extrabold text-[var(--mg)] hover:underline"
            >
              Go to Twicely.co
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--tw-border)] bg-white">
        <div className="mx-auto max-w-[1380px] px-7 h-14 flex items-center justify-center text-xs text-[var(--tw-muted-lt)]">
          &copy; {new Date().getFullYear()} Twicely. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
