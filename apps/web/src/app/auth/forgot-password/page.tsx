'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { authClient } from '@twicely/auth/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: '/auth/reset-password',
      });

      if (result.error) {
        setError(result.error.message || 'Failed to send reset email');
        setIsLoading(false);
        return;
      }

      setIsSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      setIsLoading(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="tw-card-shell text-center">
        <div className="tw-trust-icon-wrap mx-auto mb-4">
          <Mail className="size-5" strokeWidth={2} />
        </div>
        <div className="tw-eyebrow mx-auto">
          <span className="tw-eyebrow-dot" />
          Email sent
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[var(--tw-black)]">
          Check your <em className="not-italic text-[var(--mg)]">email</em>
        </h1>
        <p className="mt-3 text-sm text-[var(--tw-muted)]">
          If an account exists for <strong className="text-[var(--tw-black)]">{email}</strong>, you
          will receive a password reset link shortly.
        </p>
        <p className="mt-2 text-xs text-[var(--tw-muted-lt)]">
          Didn&apos;t receive the email? Check your spam folder or try again.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setIsSubmitted(false)}
            className="tw-btn-ghost w-full"
          >
            Try another email
          </button>
          <Link href="/auth/login" className="tw-btn-mg w-full">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 text-center">
        <div className="tw-eyebrow mx-auto">
          <span className="tw-eyebrow-dot" />
          Forgot password
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
          Reset your <em className="not-italic text-[var(--mg)]">password</em>
        </h1>
        <p className="mt-2 text-sm text-[var(--tw-muted)]">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      {error && (
        <div
          id="forgot-error"
          role="alert"
          aria-live="assertive"
          className="mb-6 rounded-[var(--tw-r-md)] border-[1.5px] border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"
        >
          {error}
        </div>
      )}

      <div className="tw-card-shell">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-extrabold text-[var(--tw-black)]"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              disabled={isLoading}
              className="h-11 w-full rounded-full border-[1.5px] border-[var(--tw-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--tw-black)] placeholder:text-[var(--tw-muted-lt)] focus-visible:border-[var(--mg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(233,30,203,0.15)] disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="tw-btn-mg w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/auth/login"
            className="text-sm font-extrabold text-[var(--mg)] hover:underline"
          >
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </>
  );
}
