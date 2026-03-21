'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  return (
    <div className="bg-white rounded-lg shadow-md p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Check Your Email</h1>

      <p className="text-gray-600 mb-6">
        We&apos;ve sent a verification link to{' '}
        <span className="font-medium">{email || 'your email address'}</span>.
        Click the link in the email to verify your account.
      </p>

      <p className="text-sm text-gray-500 mb-6">
        Didn&apos;t receive the email? Check your spam folder or try signing up again.
      </p>

      <Link
        href="/auth/login?callbackUrl=/auth/onboarding"
        className="inline-block py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Back to Sign In
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="bg-white rounded-lg shadow-md p-8 text-center">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
