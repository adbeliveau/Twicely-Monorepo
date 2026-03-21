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
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Check Your Email</h1>
        <p className="text-gray-600 mb-6">
          If an account exists for {email}, we&apos;ve sent a password reset link.
        </p>
        <Link
          href="/auth/login"
          className="inline-block py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h1 className="text-2xl font-bold text-center mb-6">Reset Password</h1>

      <p className="text-gray-600 text-center mb-6">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>

      {error && (
        <div id="forgot-error" role="alert" aria-live="assertive" className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <div className="mt-4 text-center text-sm">
        <Link href="/auth/login" className="text-primary hover:underline">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
