'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  return (
    <div className="tw-card-shell text-center">
      <div className="tw-trust-icon-wrap mx-auto mb-4">
        <Mail className="size-5" strokeWidth={2} />
      </div>

      <div className="tw-eyebrow mx-auto">
        <span className="tw-eyebrow-dot" />
        Verify email
      </div>
      <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[var(--tw-black)]">
        Check your <em className="not-italic text-[var(--mg)]">email</em>
      </h1>

      <p className="mt-3 text-sm text-[var(--tw-muted)]">
        We&apos;ve sent a verification link to{' '}
        <strong className="text-[var(--tw-black)]">{email || 'your email address'}</strong>. Click
        the link in the email to verify your account.
      </p>

      <p className="mt-2 text-xs text-[var(--tw-muted-lt)]">
        Didn&apos;t receive the email? Check your spam folder or try signing up again.
      </p>

      <Link
        href="/auth/login?callbackUrl=/auth/onboarding"
        className="tw-btn-mg w-full mt-6"
      >
        Back to Sign In
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="tw-card-shell text-center text-sm font-bold text-[var(--tw-muted)]">
        Loading...
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
