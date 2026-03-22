'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  return (
    <div className="rounded-lg bg-white p-8 shadow-sm dark:bg-gray-800">
      <div className="mb-6 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
          <svg
            className="h-8 w-8 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white">
        Check Your Email
      </h1>

      <p className="mb-6 text-center text-gray-600 dark:text-gray-400">
        We&apos;ve sent a verification link to{' '}
        <strong>{email || 'your email address'}</strong>.
        Click the link in the email to verify your account.
      </p>

      <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-500">
        Didn&apos;t receive the email? Check your spam folder or try signing up again.
      </p>

      <Link
        href="/auth/login?callbackUrl=/auth/onboarding"
        className="block w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
      >
        Back to Sign In
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="rounded-lg bg-white p-8 shadow-sm dark:bg-gray-800 text-center">
        Loading...
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
