'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from '@twicely/auth/client';
import { Eye, EyeOff } from 'lucide-react';

export default function SignupForm() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        setError(result.error.message || 'Failed to create account');
        setIsLoading(false);
        return;
      }

      router.push('/auth/verify-email?email=' + encodeURIComponent(email));
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
          Get started
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
          Join <em className="not-italic text-[var(--mg)]">Twicely</em>
        </h1>
        <p className="mt-2 text-sm text-[var(--tw-muted)]">
          Create your account and start buying or selling.
        </p>
      </div>

      {error && (
        <div
          id="signup-error"
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
          aria-describedby={error ? 'signup-error' : undefined}
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-extrabold text-[var(--tw-black)]"
              >
                Display Name <span className="text-[var(--mg)]">*</span>
              </label>
              <input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 w-full rounded-full border-[1.5px] border-[var(--tw-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--tw-black)] placeholder:text-[var(--tw-muted-lt)] focus-visible:border-[var(--mg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(233,30,203,0.15)] disabled:opacity-50"
              />
              <p className="mt-1.5 text-xs text-[var(--tw-muted-lt)]">
                This is how your name will appear to other users.
              </p>
            </div>

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
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={10}
                  disabled={isLoading}
                  aria-describedby="password-hint"
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
              <p id="password-hint" className="mt-1.5 text-xs text-[var(--tw-muted-lt)]">
                Must be at least 10 characters.
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-extrabold text-[var(--tw-black)]"
              >
                Confirm Password <span className="text-[var(--mg)]">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={10}
                disabled={isLoading}
                className="h-11 w-full rounded-full border-[1.5px] border-[var(--tw-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--tw-black)] placeholder:text-[var(--tw-muted-lt)] focus-visible:border-[var(--mg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(233,30,203,0.15)] disabled:opacity-50"
              />
            </div>

            <label htmlFor="terms" className="flex items-start gap-3 cursor-pointer">
              <input
                id="terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                required
                disabled={isLoading}
                className="mt-0.5 h-4 w-4 rounded border-[var(--tw-border)] accent-[var(--mg)] focus-visible:ring-2 focus-visible:ring-[rgba(233,30,203,0.15)]"
              />
              <span className="text-sm font-bold text-[var(--tw-muted)]">
                I agree to the{' '}
                <Link
                  href="/p/terms"
                  className="font-extrabold text-[var(--mg)] hover:underline"
                  target="_blank"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/p/privacy"
                  className="font-extrabold text-[var(--mg)] hover:underline"
                  target="_blank"
                >
                  Privacy Policy
                </Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading || !agreedToTerms}
              className="tw-btn-mg w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm font-bold text-[var(--tw-muted)]">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="font-extrabold text-[var(--mg)] hover:underline"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
