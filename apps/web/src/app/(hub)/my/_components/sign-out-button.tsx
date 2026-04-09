'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@twicely/auth/client';

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState('');

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setError('');
    try {
      await signOut();
      router.push('/auth/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out';
      setError(message);
      setIsSigningOut(false);
    }
  }

  return (
    <>
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSigningOut ? 'Signing out...' : 'Sign Out'}
      </button>
    </>
  );
}
