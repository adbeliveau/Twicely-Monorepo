'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@twicely/auth/client';
import { Eye, EyeOff, Check, AlertTriangle } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters');
      return;
    }

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(result.error.message || 'Failed to reset password');
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      setIsLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="tw-card-shell text-center">
        <div className="tw-trust-icon-wrap mx-auto mb-4">
          <Check className="size-5" strokeWidth={3} />
        </div>
        <div className="tw-eyebrow mx-auto">
          <span className="tw-eyebrow-dot" />
          Success
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[var(--tw-black)]">
          Password <em className="not-italic text-[var(--mg)]">reset</em>
        </h1>
        <p className="mt-3 text-sm text-[var(--tw-muted)]">
          Your password has been successfully reset. You can now sign in with your new password.
        </p>
        <Link href="/auth/login" className="tw-btn-mg w-full mt-6">
          Sign In
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="tw-card-shell text-center">
        <div className="tw-trust-icon-wrap mx-auto mb-4 !bg-red-50 !text-red-600">
          <AlertTriangle className="size-5" strokeWidth={2.5} />
        </div>
        <div className="tw-eyebrow mx-auto">
          <span className="tw-eyebrow-dot" />
          Invalid link
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[var(--tw-black)]">
          Reset link <em className="not-italic text-[var(--mg)]">expired</em>
        </h1>
        <p className="mt-3 text-sm text-[var(--tw-muted)]">
          This password reset link is invalid or has expired.
        </p>
        <Link href="/auth/forgot-password" className="tw-btn-mg w-full mt-6">
          Request new link
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 text-center">
        <div className="tw-eyebrow mx-auto">
          <span className="tw-eyebrow-dot" />
          New password
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
          Set new <em className="not-italic text-[var(--mg)]">password</em>
        </h1>
        <p className="mt-2 text-sm text-[var(--tw-muted)]">
          Enter your new password below.
        </p>
      </div>

      {error && (
        <div
          id="reset-error"
          role="alert"
          aria-live="assertive"
          className="mb-6 rounded-[var(--tw-r-md)] border-[1.5px] border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"
        >
          {error}
        </div>
      )}

      <div className="tw-card-shell">
        <form
          onSubmit={handleSubmit}
          aria-describedby={error ? 'reset-error' : undefined}
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-extrabold text-[var(--tw-black)]"
            >
              New Password <span className="text-[var(--mg)]">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                placeholder="At least 10 characters"
                disabled={isLoading}
                className="h-11 w-full rounded-full border-[1.5px] border-[var(--tw-border)] bg-white px-5 py-2.5 pr-12 text-sm font-medium text-[var(--tw-black)] placeholder:text-[var(--tw-muted-lt)] focus-visible:border-[var(--mg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(233,30,203,0.15)] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 z-30 -translate-y-1/2 text-[var(--tw-muted)] hover:text-[var(--tw-black)]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-[var(--tw-muted-lt)]">
              Minimum 10 characters.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-extrabold text-[var(--tw-black)]"
            >
              Confirm New Password <span className="text-[var(--mg)]">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={10}
              placeholder="Confirm your password"
              disabled={isLoading}
              className="h-11 w-full rounded-full border-[1.5px] border-[var(--tw-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--tw-black)] placeholder:text-[var(--tw-muted-lt)] focus-visible:border-[var(--mg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(233,30,203,0.15)] disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="tw-btn-mg w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/auth/login"
            className="text-sm font-extrabold text-[var(--mg)] hover:underline"
          >
            &larr; Back to Sign In
          </Link>
        </div>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="tw-card-shell text-center text-sm font-bold text-[var(--tw-muted)]">
        Loading...
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
