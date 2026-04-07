'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@twicely/auth/client';
import { Eye, EyeOff } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sanitize callback URL to prevent open redirect attacks
  const rawCallback = searchParams.get('callbackUrl') || searchParams.get('redirect') || '/my';
  const callbackUrl = rawCallback.startsWith('/') && !rawCallback.startsWith('//')
    ? rawCallback
    : '/my';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
        callbackURL: callbackUrl,
        rememberMe,
      });

      if (result.error) {
        setError(result.error.message || 'Invalid email or password');
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="mb-8 text-center">
        <div className="tw-eyebrow mx-auto">
          <span className="tw-eyebrow-dot" />
          Welcome back
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
          Sign in to <em className="not-italic text-[var(--mg)]">Twicely</em>
        </h1>
        <p className="mt-2 text-sm text-[var(--tw-muted)]">
          Buy. Sell. Repeat.
        </p>
      </div>

      {error && (
        <div
          id="login-error"
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
          aria-describedby={error ? 'login-error' : undefined}
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-extrabold text-[var(--tw-black)]"
              >
                Email <span className="text-[var(--mg)]">*</span>
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 w-full rounded-full border-[1.5px] border-[var(--tw-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--tw-black)] placeholder:text-[var(--tw-muted-lt)] focus-visible:border-[var(--mg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(233,30,203,0.15)] disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-extrabold text-[var(--tw-black)]"
              >
                Password <span className="text-[var(--mg)]">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={10}
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
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="rememberMe" className="flex items-center gap-2 cursor-pointer">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--tw-border)] accent-[var(--mg)] focus-visible:ring-2 focus-visible:ring-[rgba(233,30,203,0.15)]"
                />
                <span className="text-sm font-bold text-[var(--tw-muted)]">
                  Keep me logged in
                </span>
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-sm font-extrabold text-[var(--mg)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="tw-btn-mg w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm font-bold text-[var(--tw-muted)]">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/signup"
              className="font-extrabold text-[var(--mg)] hover:underline"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-[var(--tw-muted-lt)]">
        By signing in, you agree to our{' '}
        <Link href="/p/terms" className="font-bold underline hover:text-[var(--tw-muted)]">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/p/privacy" className="font-bold underline hover:text-[var(--tw-muted)]">
          Privacy Policy
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="tw-card-shell text-center text-sm font-bold text-[var(--tw-muted)]">
        Loading...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
