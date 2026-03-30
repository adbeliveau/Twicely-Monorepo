'use client';

import { useState } from 'react';
import Link from 'next/link';
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
    } catch {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  }

  if (isSubmitted) {
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
          Check your email
        </h1>
        <p className="mb-6 text-center text-gray-600 dark:text-gray-400">
          If an account exists for <strong>{email}</strong>, you will receive a password
          reset link shortly.
        </p>
        <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-500">
          Didn&apos;t receive the email? Check your spam folder or try again.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setIsSubmitted(false)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Try another email
          </button>
          <Link
            href="/auth/login"
            className="w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-8 shadow-sm dark:bg-gray-800">
      <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white">
        Forgot your password?
      </h1>
      <p className="mb-6 text-center text-gray-600 dark:text-gray-400">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>

      {error && (
        <div
          id="forgot-error"
          role="alert"
          aria-live="assertive"
          className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
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
            className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus-visible:border-blue-700 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !email}
          className="h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/auth/login"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
